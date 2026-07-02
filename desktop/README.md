# 读心助手 · Windows 桌面端（Tauri）

「置顶军师面板 + 热键捕获微信窗口」——见 [DESIGN.md §9.2](../DESIGN.md)。

## 工作方式

- 一个**置顶小窗**加载现有 Web 前端（复用全部 UI 与后端），贴在微信旁边。
- 按 **`Ctrl+Shift+A`**：自动找到微信电脑版窗口 → 截图 → 注入页面并立即分析。
  聊天过程零打断，不用手动截图。

## 在 Windows 上构建运行

前置：安装 [Rust](https://rustup.rs/)、Node.js ≥ 20、
[Tauri 环境依赖](https://tauri.app/start/prerequisites/)（WebView2，Win10/11 一般自带）。

```powershell
# 1. 先在仓库根目录启动后端（桌面端窗口加载的就是它）
npm install ; npm start          # http://localhost:3000

# 2. 另开终端，启动桌面端
cd desktop
npm install
npm run dev                      # 开发模式
npm run build                    # 打包（需先在 tauri.conf.json 开启 bundle 并补图标：npx tauri icon <图片>）
```

后端不在本机时，把 `src-tauri/tauri.conf.json` 里两处 `http://localhost:3000`
改成你的服务器地址即可。

## 状态

⚠️ **骨架，尚未在 Windows 上编译验证**（本仓库在 WSL/Linux 中开发，无法交叉构建
Windows GUI）。逻辑完整，首次构建若 `xcap` API 有出入，按编译器提示微调
`src/lib.rs` 即可。

## 后续增强（见 DESIGN.md §9.2）

- [ ] 定时自动捕获（每 N 秒对微信窗口截屏，有变化才分析）
- [ ] 托盘图标 + 开机自启
- [ ] 桌面录音（麦克风 + 系统声音回采）接入 `/api/audio`
