// 打包为 Windows GUI 程序时不弹出控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mypua_desktop_lib::run()
}
