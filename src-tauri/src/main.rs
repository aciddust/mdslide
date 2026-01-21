// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

// 설정 구조체
#[derive(Debug, Serialize, Deserialize, Clone)]
struct AppConfig {
    workspace_path: String,
    auto_save_enabled: bool,
    font_size: i32,
    font_family: String,
    confirm_delete: bool,
    notifications_enabled: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let default_workspace = home.join("mdslide");

        Self {
            workspace_path: default_workspace.to_string_lossy().to_string(),
            auto_save_enabled: false,
            font_size: 14,
            font_family: "JetBrains Mono".to_string(),
            confirm_delete: true,
            notifications_enabled: true,
        }
    }
}

// 설정 파일 경로 가져오기
fn get_config_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".mdslide_config.json")
}

// Tauri 명령어 정의
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// 설정 저장
#[tauri::command]
fn save_config(config: AppConfig) -> Result<(), String> {
    let config_path = get_config_path();
    let json =
        serde_json::to_string_pretty(&config).map_err(|e| format!("설정 직렬화 오류: {}", e))?;

    fs::write(&config_path, json).map_err(|e| format!("설정 파일 쓰기 오류: {}", e))?;

    Ok(())
}

// 설정 로드
#[tauri::command]
fn load_config() -> Result<AppConfig, String> {
    let config_path = get_config_path();

    if !config_path.exists() {
        // 설정 파일이 없으면 기본값 반환
        return Ok(AppConfig::default());
    }

    let json =
        fs::read_to_string(&config_path).map_err(|e| format!("설정 파일 읽기 오류: {}", e))?;

    let config: AppConfig =
        serde_json::from_str(&json).map_err(|e| format!("설정 파싱 오류: {}", e))?;

    Ok(config)
}

// 디렉터리 생성
#[tauri::command]
fn ensure_directory(path: String) -> Result<(), String> {
    let dir_path = PathBuf::from(&path);

    if dir_path.exists() {
        return Ok(());
    }

    fs::create_dir_all(&dir_path).map_err(|e| format!("디렉터리 생성 오류: {}", e))?;

    Ok(())
}

// 시스템 폰트 목록 가져오기
#[tauri::command]
fn get_system_fonts() -> Vec<String> {
    use font_kit::source::SystemSource;

    let source = SystemSource::new();
    let families = source.all_families();

    match families {
        Ok(mut fonts) => {
            // 기본 모노스페이스 폰트 추가
            let mut result = vec![
                "JetBrains Mono".to_string(),
                "Monaco".to_string(),
                "Menlo".to_string(),
                "Consolas".to_string(),
                "monospace".to_string(),
            ];

            // 시스템 폰트 추가 (중복 제거)
            for font in fonts.drain(..) {
                if !result.contains(&font) {
                    result.push(font);
                }
            }

            result.sort();
            result
        }
        Err(_) => {
            // 오류 발생 시 기본 폰트만 반환
            vec![
                "JetBrains Mono".to_string(),
                "Monaco".to_string(),
                "Menlo".to_string(),
                "Consolas".to_string(),
                "monospace".to_string(),
            ]
        }
    }
}

// 윈도우 타이틀 설정
#[tauri::command]
fn set_window_title(window: tauri::Window, title: String) -> Result<(), String> {
    window
        .set_title(&title)
        .map_err(|e| format!("윈도우 타이틀 설정 오류: {}", e))?;
    Ok(())
}

// 파일/디렉토리 이름 변경
#[tauri::command]
fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    let old = PathBuf::from(&old_path);
    let new = PathBuf::from(&new_path);

    if !old.exists() {
        return Err("파일이 존재하지 않습니다.".to_string());
    }

    if new.exists() {
        return Err("동일한 이름의 파일이 이미 존재합니다.".to_string());
    }

    fs::rename(&old, &new).map_err(|e| format!("이름 변경 오류: {}", e))?;

    Ok(())
}

// 파일/디렉토리 삭제
#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err("파일이 존재하지 않습니다.".to_string());
    }

    if file_path.is_dir() {
        fs::remove_dir_all(&file_path).map_err(|e| format!("디렉토리 삭제 오류: {}", e))?;
    } else {
        fs::remove_file(&file_path).map_err(|e| format!("파일 삭제 오류: {}", e))?;
    }

    Ok(())
}

// 디렉토리 생성 (파일 탐색기에서 사용)
#[tauri::command]
fn create_directory(path: String) -> Result<(), String> {
    let dir_path = PathBuf::from(&path);

    if dir_path.exists() {
        return Err("동일한 이름의 파일 또는 디렉토리가 이미 존재합니다.".to_string());
    }

    fs::create_dir_all(&dir_path).map_err(|e| format!("디렉토리 생성 오류: {}", e))?;

    Ok(())
}

// 클립보드 이미지 저장 (base64 이미지를 받아서 파일로 저장)
#[tauri::command]
fn save_clipboard_image(
    file_path: String,
    image_name: String,
    image_data: Vec<u8>,
    extension: String,
) -> Result<String, String> {
    use std::path::Path;

    println!("[RUST] save_clipboard_image 호출됨");
    println!("[RUST] file_path: {}", file_path);
    println!("[RUST] image_name: {}", image_name);
    println!("[RUST] extension: {}", extension);
    println!("[RUST] image_data 크기: {} bytes", image_data.len());

    // 파일 경로에서 확장자를 제외한 이름 추출
    let path = Path::new(&file_path);
    let file_stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("잘못된 파일 경로입니다.".to_string())?;

    println!("[RUST] file_stem: {}", file_stem);

    let parent_dir = path
        .parent()
        .ok_or("부모 디렉토리를 찾을 수 없습니다.".to_string())?;

    println!("[RUST] parent_dir: {:?}", parent_dir);

    // 이미지를 저장할 디렉토리 생성 (파일명과 동일한 디렉토리)
    let images_dir = parent_dir.join(file_stem);
    println!("[RUST] images_dir: {:?}", images_dir);

    match fs::create_dir_all(&images_dir) {
        Ok(_) => println!("[RUST] 디렉토리 생성 성공"),
        Err(e) => {
            println!("[RUST] 디렉토리 생성 실패: {}", e);
            return Err(format!("디렉토리 생성 오류: {}", e));
        }
    }

    // 이미지 파일 경로 (원본 확장자 사용)
    let image_file_path = images_dir.join(format!("{}.{}", image_name, extension));
    println!("[RUST] image_file_path: {:?}", image_file_path);

    // 이미지 데이터 저장
    match fs::write(&image_file_path, &image_data) {
        Ok(_) => {
            println!("[RUST] 파일 저장 성공");
            // 파일이 실제로 생성되었는지 확인
            if image_file_path.exists() {
                println!("[RUST] 파일 존재 확인: OK");
            } else {
                println!("[RUST] 경고: 파일이 존재하지 않습니다!");
            }
        }
        Err(e) => {
            println!("[RUST] 파일 저장 실패: {}", e);
            return Err(format!("이미지 저장 오류: {}", e));
        }
    }

    // 상대 경로 반환 (마크다운에서 사용)
    let relative_path = format!("{}/{}.{}", file_stem, image_name, extension);
    println!("[RUST] 반환 경로: {}", relative_path);
    Ok(relative_path)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_version,
            save_config,
            load_config,
            ensure_directory,
            get_system_fonts,
            set_window_title,
            rename_file,
            delete_file,
            create_directory,
            save_clipboard_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
