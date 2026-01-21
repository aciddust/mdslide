#[tauri::command]
fn get_system_fonts() -> Vec<String> {
    // macOS의 시스템 폰트 목록 반환
    vec![
        "SF Pro".to_string(),
        "SF Mono".to_string(),
        "JetBrains Mono".to_string(),
        "Fira Code".to_string(),
        "Monaco".to_string(),
        "Menlo".to_string(),
        "Consolas".to_string(),
        "Courier New".to_string(),
        "monospace".to_string(),
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_system_fonts])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
