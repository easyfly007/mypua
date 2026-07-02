import "dotenv/config";
import express from "express";
import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { analyzeScreenshot, analyzeTranscript } from "./lib/analyzer.js";
import { transcribeSegment } from "./lib/asr.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// 滚动分析节奏：距上次分析 ≥ MIN_INTERVAL 且新增文本 ≥ MIN_NEW_CHARS 才触发
const ANALYZE_MIN_INTERVAL_MS = Number(process.env.ANALYZE_MIN_INTERVAL_MS || 10_000);
const ANALYZE_MIN_NEW_CHARS = Number(process.env.ANALYZE_MIN_NEW_CHARS || 20);

const app = express();
// 截图转成 base64 后体积较大，放宽请求体上限
app.use(express.json({ limit: "25mb" }));
app.use(express.static(path.join(__dirname, "public")));

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/(png|jpeg|jpg|gif|webp));base64,(.+)$/i.exec(dataUrl || "");
  if (!match) return null;
  let mediaType = match[1].toLowerCase();
  if (mediaType === "image/jpg") mediaType = "image/jpeg";
  return { mediaType, data: match[3] };
}

// 截图通道：上传聊天截图 → 结构化分析
app.post("/api/analyze", async (req, res) => {
  try {
    const { image, scene = "general", note = "" } = req.body || {};
    const img = parseDataUrl(image);
    if (!img) {
      return res.status(400).json({ error: "请上传有效的聊天截图（png/jpeg/webp）。" });
    }
    const analysis = await analyzeScreenshot({ image: img, scene, note });
    res.json({ analysis });
  } catch (err) {
    if (err.code === "refusal") {
      return res.status(422).json({ error: "这条内容无法分析，请换一张截图试试。" });
    }
    console.error("analyze error:", err);
    const status = err?.status && err.status >= 400 ? 502 : 500;
    res.status(status).json({ error: "分析服务出错了，请稍后重试。" });
  }
});

// —— 录音通道：WebSocket /api/audio ——
// 协议见 DESIGN.md §5.3：
//   上行 {type:"config", scene, note}
//        {type:"audio", chunk:<base64>, mime, speaker?}   每段为完整可解码音频
//        {type:"end"}
//   下行 {type:"transcript", text, speaker?}
//        {type:"analysis", data}
//        {type:"error", msg}

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/api/audio" });

wss.on("connection", (ws) => {
  const state = {
    scene: "general",
    note: "",
    lines: [], // {speaker: "me"|"other"|null, text}
    analyzedChars: 0,
    lastAnalyzedAt: 0,
    analyzing: false,
    ended: false,
  };

  const send = (msg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  const transcriptText = () =>
    state.lines
      .map((l) => `${l.speaker === "me" ? "我" : l.speaker === "other" ? "对方" : "（未标注）"}: ${l.text}`)
      .join("\n");

  async function maybeAnalyze(force = false) {
    if (state.analyzing) return;
    const text = transcriptText();
    const newChars = text.length - state.analyzedChars;
    const sinceLast = Date.now() - state.lastAnalyzedAt;
    if (!force && (newChars < ANALYZE_MIN_NEW_CHARS || sinceLast < ANALYZE_MIN_INTERVAL_MS)) return;
    if (newChars <= 0) return;

    state.analyzing = true;
    try {
      const data = await analyzeTranscript({ transcript: text, scene: state.scene, note: state.note });
      state.analyzedChars = text.length;
      state.lastAnalyzedAt = Date.now();
      send({ type: "analysis", data });
    } catch (err) {
      console.error("rolling analyze error:", err.message);
      // 失败也记时间，避免每段都立刻重试打爆下游
      state.lastAnalyzedAt = Date.now();
      send({ type: "error", msg: err.code === "refusal" ? "这段内容无法分析。" : "分析出错，稍后会自动重试。" });
    } finally {
      state.analyzing = false;
      if (state.ended) ws.close();
    }
  }

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send({ type: "error", msg: "消息格式错误。" });
    }

    if (msg.type === "config") {
      state.scene = msg.scene || "general";
      state.note = msg.note || "";
      return;
    }

    if (msg.type === "audio") {
      try {
        const audio = Buffer.from(msg.chunk || "", "base64");
        if (!audio.length) return;
        const text = await transcribeSegment(audio, { mimeType: msg.mime || "audio/webm" });
        if (!text) return; // 这段没有可识别语音
        const speaker = msg.speaker === "me" || msg.speaker === "other" ? msg.speaker : null;
        state.lines.push({ speaker, text });
        send({ type: "transcript", text, speaker });
        maybeAnalyze(); // 不 await：转写不被分析阻塞
      } catch (err) {
        console.error("asr error:", err);
        send({ type: "error", msg: `转写失败：${err.message}` });
      }
      return;
    }

    if (msg.type === "end") {
      state.ended = true;
      // 收尾：把剩余未分析的内容做最后一次分析
      if (transcriptText().length > state.analyzedChars) await maybeAnalyze(true);
      if (!state.analyzing) ws.close();
      return;
    }
  });

  ws.on("error", (err) => console.error("ws error:", err.message));
});

server.listen(PORT, () => {
  console.log(`mypua 已启动： http://localhost:${PORT}`);
});
