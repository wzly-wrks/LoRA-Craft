use tauri::Manager;

#[tauri::command]
fn get_app_paths(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    
    let app_config_dir = app.path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "appData": app_data_dir.to_string_lossy(),
        "appConfig": app_config_dir.to_string_lossy()
    }))
}

#[tauri::command]
fn minimize_window(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn maximize_window(window: tauri::Window) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
fn close_window(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn is_maximized(window: tauri::Window) -> bool {
    window.is_maximized().unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            get_app_paths,
            minimize_window,
            maximize_window,
            close_window,
            is_maximized
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
