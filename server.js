import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeScreenshot } from "./lib/analyzer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

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

// 录音通道：实时音频流 → ASR 转写 → 滚动分析（骨架，待 lib/asr.js 接通）
// 计划用 WebSocket 实现，见 DESIGN.md §5。占位返回 501。
app.all("/api/audio", (_req, res) => {
  res.status(501).json({ error: "实时录音通道尚在开发中（见 DESIGN.md §5）。" });
});

app.listen(PORT, () => {
  console.log(`mypua 已启动： http://localhost:${PORT}`);
});
