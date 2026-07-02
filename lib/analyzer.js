// 分析引擎：截图通道与录音通道共用。
// 输入「对话内容（截图或文本）+ 场景」，输出固定结构的分析结果。
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const client = new Anthropic(); // 读取环境变量 ANTHROPIC_API_KEY

export const SCENES = {
  sales: {
    label: "销售 / 客户推进",
    focus:
      "你在帮助一位销售人员判断客户当前的心理状态，以及现在是否适合推进（逼单/约见/报价/促成），还是应该先建立信任、不要太急。",
  },
  dating: {
    label: "情感 / 暧昧推进",
    focus:
      "你在帮助用户和喜欢/有好感的人聊天，判断对方当下的情绪与好感程度，以及关系是否适合往前推进一步，还是应该保持节奏、避免用力过猛让对方反感。",
  },
  general: {
    label: "通用沟通",
    focus: "你在帮助用户判断对方当前的心理状态，并给出得体、有分寸的下一步沟通建议。",
  },
};

// 结构化输出 schema —— 强约束返回格式，前端可直接渲染
export const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    counterpart_state: {
      type: "string",
      description: "对方当前的心理状态与潜在想法，2-4 句话，基于对话内容给出依据，不要空泛。",
    },
    temperature: {
      type: "integer",
      description: "对方此刻的意向/好感热度，0-100。销售场景指购买/推进意向，情感场景指好感与投入度。",
    },
    temperature_reason: {
      type: "string",
      description: "给出这个热度分数的简短依据（引用对话里的具体信号）。",
    },
    signals: {
      type: "array",
      description: "从对话中读出的关键信号，2-5 条。",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          signal: { type: "string", description: "对方说/做的具体内容" },
          meaning: { type: "string", description: "这个信号背后可能的含义" },
        },
        required: ["signal", "meaning"],
      },
    },
    can_push: {
      type: "string",
      enum: ["可以推进", "保持节奏", "需要缓一缓"],
      description: "当前是否适合推进。",
    },
    push_reason: { type: "string", description: "为什么是这个判断，提醒用户节奏与分寸。" },
    replies: {
      type: "array",
      description: "给用户的 2-3 条可以直接发出去/说出口的话术，自然口语化，符合当前语境。",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", description: "可以直接用的一句话" },
          why: { type: "string", description: "为什么这样说、想达到的效果" },
        },
        required: ["text", "why"],
      },
    },
    avoid: {
      type: "array",
      description: "此刻应避免的做法或话术，1-3 条。",
      items: { type: "string" },
    },
  },
  required: [
    "counterpart_state",
    "temperature",
    "temperature_reason",
    "signals",
    "can_push",
    "push_reason",
    "replies",
    "avoid",
  ],
};

function buildSystemPrompt(scene, mode) {
  const s = SCENES[scene] || SCENES.general;
  const inputRule =
    mode === "screenshot"
      ? `你会收到一张聊天软件（多为微信）的截图。识别规则：
- 屏幕右侧的气泡是「用户本人」发的；左侧的气泡是「对方」发的。
- 如果有头像、昵称、时间，可作为辅助判断。
- 文字识别不清或信息不足时，要在分析里诚实说明，不要凭空编造。`
      : `你会收到一段当面/电话交谈的实时转写文本。识别规则：
- 文本可能用说话人标签区分（如「我:」「对方:」），若没有标签则结合上下文推断。
- 转写可能有错字或断句问题，遇到不确定处要诚实说明，不要凭空编造。`;

  return `你是一位资深的沟通与关系顾问，擅长从对话中读懂对方的情绪和心理。${s.focus}

${inputRule}

给建议时的原则：
- 真诚、有分寸、尊重对方，目标是健康有效的沟通，而不是操纵、欺骗或施压。
- 结合对方当前状态判断节奏：该推进时给出推进话术，不该急时明确提醒用户慢下来。
- 话术要自然、口语化、贴合当前对话语境，能直接用。
- 全部用中文回答。`;
}

async function runClaude({ system, content }) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    // 系统提示按场景固定不变，打上缓存标记：滚动分析会高频复用，显著降成本
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: ANALYSIS_SCHEMA } },
  });

  if (response.stop_reason === "refusal") {
    const e = new Error("内容无法分析");
    e.code = "refusal";
    throw e;
  }
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("未能生成分析结果");
  return JSON.parse(textBlock.text);
}

/** 截图通道：传入 {mediaType, data}（base64 图片）。 */
export async function analyzeScreenshot({ image, scene = "general", note = "" }) {
  const text = note?.trim()
    ? `这是当前的聊天截图。补充背景：${note.trim()}\n请分析对方此刻的心理状态，并给出我下一步的应对。`
    : "这是当前的聊天截图。请分析对方此刻的心理状态，并给出我下一步的应对。";
  return runClaude({
    system: buildSystemPrompt(scene, "screenshot"),
    content: [
      { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
      { type: "text", text },
    ],
  });
}

/** 录音通道：传入累积的对话转写文本。骨架已就绪，待 ASR 接通后启用。 */
export async function analyzeTranscript({ transcript, scene = "general", note = "" }) {
  const text = `${note?.trim() ? `背景：${note.trim()}\n\n` : ""}以下是当前对话的实时转写：\n${transcript}\n\n请分析对方此刻的心理状态，并给出我下一步该怎么说。`;
  return runClaude({
    system: buildSystemPrompt(scene, "audio"),
    content: [{ type: "text", text }],
  });
}
