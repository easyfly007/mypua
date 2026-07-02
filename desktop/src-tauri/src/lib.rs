// 读心助手桌面端（Tauri v2）——「置顶军师面板 + 热键捕获微信窗口」。
//
// 工作方式：
//   1. 主窗口置顶（alwaysOnTop），加载现有 Web 前端（http://localhost:3000），
//      所有分析 UI 与 API 调用完全复用，桌面端零前端代码。
//   2. 全局热键 Ctrl+Shift+A：用 xcap 找到微信电脑版窗口并截图，
//      转成 data URL 后 eval 调用页面里的 window.receiveCapture(dataUrl)，
//      页面自动填入并发起分析——聊天过程零打断。
//
// 注意：本文件是骨架，尚未在 Windows 机器上编译验证（本仓库在 WSL 中开发）。
// 首次在 Windows 上构建时若 xcap API 有出入，按编译器提示微调即可。

use base64::Engine;
use tauri::Manager;
use tauri_plugin_global_shortcut::ShortcutState;

const WECHAT_TITLE_HINTS: [&str; 2] = ["微信", "WeChat"];

/// 找到微信窗口 → 截图 → PNG → data URL
fn capture_wechat_as_data_url() -> Result<String, String> {
    let windows = xcap::Window::all().map_err(|e| format!("枚举窗口失败: {e}"))?;
    let target = windows
        .into_iter()
        .find(|w| {
            let title = w.title().unwrap_or_default();
            let minimized = w.is_minimized().unwrap_or(false);
            !minimized && WECHAT_TITLE_HINTS.iter().any(|hint| title.contains(hint))
        })
        .ok_or("未找到微信窗口：请确认微信电脑版已打开且未最小化")?;

    let img = target
        .capture_image()
        .map_err(|e| format!("窗口截图失败: {e}"))?;

    let mut png = std::io::Cursor::new(Vec::new());
    img.write_to(&mut png, image::ImageFormat::Png)
        .map_err(|e| format!("PNG 编码失败: {e}"))?;

    Ok(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(png.into_inner())
    ))
}

/// 截图结果注入前端页面（serde_json 保证 JS 字符串安全转义，含中文错误信息）
fn inject_capture(app: &tauri::AppHandle) {
    let js = match capture_wechat_as_data_url() {
        Ok(data_url) => format!(
            "window.receiveCapture && window.receiveCapture({});",
            serde_json::to_string(&data_url).unwrap()
        ),
        Err(msg) => format!("alert({});", serde_json::to_string(&msg).unwrap()),
    };
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_focus();
        let _ = win.eval(&js);
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["ctrl+shift+a"])
                .expect("热键格式错误")
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let app = app.clone();
                        // 截图 + 编码放到独立线程，不阻塞事件循环
                        std::thread::spawn(move || inject_capture(&app));
                    }
                })
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("桌面端启动失败");
}
