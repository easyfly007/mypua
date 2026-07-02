# 读心助手 mypua

上传聊天截图、或实时录音，分析对方此刻的心理状态，并给出你下一步该怎么说。
适用于销售推进客户、与喜欢的人沟通等场景。

> 设计文档见 [DESIGN.md](./DESIGN.md)。截图分析与实时录音（v1）两条通道均已实现。

## 快速开始

```bash
npm install
cp .env.example .env      # 填入 ANTHROPIC_API_KEY；录音通道需再配 ASR_*（或先用 ASR_PROVIDER=mock 体验）
npm start                 # 默认 http://localhost:3000
```

- **手机使用**：与电脑同一局域网时，手机浏览器打开 `http://<电脑IP>:3000`。
  iPhone 可「添加到主屏幕」当 App 用（PWA）。⚠️ 录音功能需 HTTPS（localhost 除外）。
- **Windows 桌面端**：置顶军师面板 + `Ctrl+Shift+A` 一键捕获微信窗口分析，
  见 [desktop/README.md](./desktop/README.md)。

## 两种用法

1. **📷 截图分析**：上传微信聊天截图 → 心理分析 + 推进节奏判断 + 可复制话术。
2. **🎙️ 实时录音**：当面/电话交谈时开启录音 → 实时转写 + 滚动分析；自己说话时
   点亮「我在说」可提升说话人识别准确度。录音仅用于当次分析，不落盘。

## 目录结构

```
mypua/
├─ server.js            Express 入口（/api/analyze 截图分析；WS /api/audio 录音通道）
├─ public/              前端：双模式单页 + PWA（manifest/sw/图标）
├─ lib/
│  ├─ analyzer.js       分析引擎（prompt + 结构化 schema + 调 Claude），两通道共用
│  └─ asr.js            ASR 适配器（OpenAI 兼容接口 / mock 联调，可扩展讯飞、阿里）
├─ desktop/             Windows 桌面端（Tauri v2 骨架，待 Windows 上编译验证）
├─ DESIGN.md            设计文档
└─ README.md
```

## 技术栈

- 后端：Node.js + Express + ws
- AI：Claude（`claude-opus-4-8`）多模态 + 结构化输出 + prompt caching
- ASR：任意 OpenAI 兼容转写服务（Whisper / Groq / SiliconFlow 等，可换国内厂商）
- 前端：移动端友好的原生单页（PWA）；桌面端 Tauri v2

## 路线图与状态

见 [DESIGN.md §6 里程碑](./DESIGN.md)。M1–M3 已完成；M4 完成手动说话人标注，
真流式 ASR 待厂商选型；桌面端骨架待 Windows 编译验证。
