// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn fetch_route(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "CycloRouteGenerator/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Server returned error: {}", response.status()));
    }

    let text = response.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

/// Schrijft een bestand naar een opgegeven pad op het bestandssysteem.
/// Wordt gebruikt voor directe export naar Google Drive of andere mappen.
#[tauri::command]
async fn save_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content.as_bytes())
        .map_err(|e| format!("Kon bestand niet opslaan op '{}': {}", path, e))
}

/// Controleert of een map bestaat op het bestandssysteem.
#[tauri::command]
fn dir_exists(path: String) -> bool {
    std::path::Path::new(&path).is_dir()
}

/// Maakt een map aan als die nog niet bestaat (inclusief alle parents).
#[tauri::command]
fn ensure_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path)
        .map_err(|e| format!("Kon map niet aanmaken '{}': {}", path, e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, fetch_route, save_file, dir_exists, ensure_dir])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
