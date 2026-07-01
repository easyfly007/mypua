// 语音转写适配器（ASR）—— 骨架。
//
// 目标：把「实时录音通道」与具体 ASR 厂商解耦。上层只依赖下面的接口，
// 换厂商（讯飞 / 阿里 / 腾讯 / Whisper / Deepgram）时只改本文件。
//
// 现状：占位实现，未接真实服务。待 §7「待定决策」确认 ASR 选型后落地。

/**
 * @typedef {Object} TranscriptChunk
 * @property {string} text      本段转写文本
 * @property {string} [speaker] 说话人标签（"me" / "other"），无法区分时省略
 * @property {boolean} isFinal  是否为该段的最终结果（流式可能先出临时结果）
 */

/**
 * ASR 适配器接口。
 * @typedef {Object} AsrSession
 * @property {(audioChunk: Buffer) => void} push      送入一片音频
 * @property {() => Promise<void>} close               结束会话
 * @property {(cb: (chunk: TranscriptChunk) => void) => void} onTranscript 注册转写回调
 */

/**
 * 创建一个 ASR 会话。
 * @param {Object} opts
 * @param {string} [opts.language="zh"]
 * @param {boolean} [opts.diarization=false] 是否启用说话人分离（厂商支持时）
 * @returns {AsrSession}
 */
export function createAsrSession(opts = {}) {
  // TODO: 根据选型实例化具体厂商的流式识别客户端。
  // 占位：直接抛错，提醒尚未接通。
  let _onTranscript = () => {};
  return {
    push(_audioChunk) {
      throw new Error("ASR 尚未接入，请先在 lib/asr.js 中实现 createAsrSession。");
    },
    async close() {},
    onTranscript(cb) {
      _onTranscript = cb;
    },
  };
}

// 厂商适配实现示例（待补）：
//   - createXfyunSession  讯飞实时语音转写
//   - createAliSession    阿里云一句话/实时识别
//   - createWhisperSession 自托管 Whisper / faster-whisper
// 由 createAsrSession 按配置分发到具体实现。
