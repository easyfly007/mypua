// 语音转写适配器（ASR）—— 把「实时录音通道」与具体厂商解耦。
//
// v1 采用「分段转写」：前端每 ~5 秒送来一段完整音频（webm/mp4），
// 这里整段转写后返回文本。升级为真流式时，只需在本文件里新增流式适配器，
// 上层（server.js 的 /api/audio）不变。
//
// 通过环境变量选择厂商：
//   ASR_PROVIDER=openai_compatible   # 默认。任何 OpenAI 兼容的转写接口：
//                                    # OpenAI Whisper、Groq、SiliconFlow(国内)、
//                                    # 自托管 faster-whisper-server 等
//   ASR_PROVIDER=mock                # 联调用，返回占位文本，无需任何密钥
//
// openai_compatible 所需配置：
//   ASR_BASE_URL   如 https://api.openai.com/v1（或兼容服务地址）
//   ASR_API_KEY    对应服务的密钥
//   ASR_MODEL      如 whisper-1 / FunAudioLLM/SenseVoiceSmall 等

const PROVIDER = () => process.env.ASR_PROVIDER || "openai_compatible";

/**
 * 转写一段完整音频。
 * @param {Buffer} audio  完整可解码的音频段（前端按段重启 MediaRecorder 保证这一点）
 * @param {Object} opts
 * @param {string} [opts.mimeType="audio/webm"]
 * @param {string} [opts.language="zh"]
 * @returns {Promise<string>} 转写文本（可能为空串，表示这段没有可识别语音）
 */
export async function transcribeSegment(audio, opts = {}) {
  const provider = PROVIDER();
  if (provider === "mock") return mockTranscribe(audio, opts);
  if (provider === "openai_compatible") return openaiCompatibleTranscribe(audio, opts);
  throw new Error(`未知的 ASR_PROVIDER: ${provider}`);
}

// —— OpenAI 兼容接口（POST {base}/audio/transcriptions，multipart）——
async function openaiCompatibleTranscribe(audio, { mimeType = "audio/webm", language = "zh" }) {
  const baseUrl = process.env.ASR_BASE_URL;
  const apiKey = process.env.ASR_API_KEY;
  const model = process.env.ASR_MODEL || "whisper-1";
  if (!baseUrl || !apiKey) {
    throw new Error("未配置 ASR：请在 .env 中设置 ASR_BASE_URL / ASR_API_KEY / ASR_MODEL（或用 ASR_PROVIDER=mock 联调）。");
  }
  const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mimeType }), `segment.${ext}`);
  form.append("model", model);
  form.append("language", language);
  form.append("response_format", "json");

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ASR 服务返回 ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.text || "").trim();
}

// —— mock：无密钥联调整条链路（WS → 转写 → 滚动分析 → 前端渲染）——
let mockIndex = 0;
const MOCK_LINES = [
  "这个方案听起来还行，不过价格方面我还要再考虑一下。",
  "你们和别家比优势在哪里？",
  "这样吧，你先把资料发我看看。",
  "嗯，周四下午我应该有空。",
];
async function mockTranscribe() {
  const line = MOCK_LINES[mockIndex % MOCK_LINES.length];
  mockIndex += 1;
  return line;
}

// 未来的流式适配器（M4，选型后落地）：
//   - createXfyunStream   讯飞实时语音转写（WebSocket 流式，支持说话人分离）
//   - createAliStream     阿里云实时识别
// 接口形态见 git 历史中本文件的 AsrSession typedef。
