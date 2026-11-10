#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use reqwest::{Client, Url};
use serde_json::Value;
use std::time::Duration;
use tauri::State;
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
async fn request_json(client: State<'_, Client>, input: String) -> Result<Value, String> {
    let url = Url::parse(&input).map_err(|_| "Invalid instance address")?;
    if input.len() > 4096 || url.scheme() != "https" || !url.username().is_empty()
        || url.password().is_some() || !(url.path().starts_with("/api/v1/")
        || (url.host_str() == Some("api.invidious.io") && url.path() == "/")) {
        return Err("Only HTTPS Invidious API requests are supported".into());
    }
    let mut response = client.get(url).header("Accept", "application/json").send().await
        .map_err(|_| "Cannot reach the instance")?;
    if !response.status().is_success() { return Err(format!("Instance returned HTTP {}", response.status())); }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "Incomplete API response")? {
        if body.len() + chunk.len() > 10_000_000 { return Err("API response too large".into()); }
        body.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&body).map_err(|_| "Instance did not return JSON".into())
}


#[tauri::command]
async fn catalog_request(client: State<'_, Client>, path: String, body: String) -> Result<String, String> {
    let url = Url::parse(&format!("https://music.youtube.com{}", path)).map_err(|_| "Invalid catalog path")?;
    if url.host_str() != Some("music.youtube.com") || body.len() > 100_000 ||
        !["/youtubei/v1/search", "/youtubei/v1/browse", "/youtubei/v1/next", "/youtubei/v1/player"].contains(&url.path()) {
        return Err("Unsupported catalog request".into());
    }
    let mut response = client.post(url).header("Content-Type", "application/json")
        .header("Origin", "https://music.youtube.com").body(body).send().await.map_err(|_| "Cannot reach YouTube Music")?;
    if !response.status().is_success() { return Err(format!("Music catalog HTTP {}", response.status())); }
    let mut data = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "Incomplete catalog response")? {
        if data.len() + chunk.len() > 10_000_000 { return Err("Catalog response too large".into()); }
        data.extend_from_slice(&chunk);
    }
    String::from_utf8(data).map_err(|_| "Invalid catalog response".into())
}

#[tauri::command]
fn release_notes(app: tauri::AppHandle) -> Result<(), String> {
    app.opener().open_url("https://github.com/getkube/kube/releases", None::<&str>).map_err(|e| e.to_string())
}

fn main() {
    let client = Client::builder().redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(18)).build().expect("HTTP client");
    tauri::Builder::default().manage(client)
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init()).plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![request_json, catalog_request, release_notes])
        .run(tauri::generate_context!()).expect("Kube desktop");
}
