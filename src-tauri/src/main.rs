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
fn release_notes(app: tauri::AppHandle) -> Result<(), String> {
    app.opener().open_url("https://github.com/getkube/kube/releases", None::<&str>).map_err(|e| e.to_string())
}

fn main() {
    let client = Client::builder().redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(18)).build().expect("HTTP client");
    tauri::Builder::default().manage(client)
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init()).plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![request_json, release_notes])
        .run(tauri::generate_context!()).expect("Kube desktop");
}
