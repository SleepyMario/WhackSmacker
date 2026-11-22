use tauri::Manager;
use std::{fs, io::Write, path::PathBuf};
fn path(app: &tauri::AppHandle) -> Result<PathBuf,String> { app.path().app_data_dir().map(|p|p.join("proof-progress.json")).map_err(|e|e.to_string()) }
#[tauri::command]
fn load_progress(app: tauri::AppHandle) -> Result<Option<String>,String> { match fs::read_to_string(path(&app)?) { Ok(s)=>Ok(Some(s)),Err(e) if e.kind()==std::io::ErrorKind::NotFound=>Ok(None),Err(e)=>Err(e.to_string()) } }
#[tauri::command]
fn save_progress(app: tauri::AppHandle,value:String) -> Result<(),String> {
 if value.len()>16384 {return Err("Demo data is too large".into());}
 let v:serde_json::Value=serde_json::from_str(&value).map_err(|e|e.to_string())?;
 if v["packageId"]!="local.proof.geography" || v["itemId"]!="belgium-capital" {return Err("Unexpected demo identity".into());}
 let p=path(&app)?;fs::create_dir_all(p.parent().unwrap()).map_err(|e|e.to_string())?;
 let tmp=p.with_extension("tmp");let mut f=fs::File::create(&tmp).map_err(|e|e.to_string())?;
 f.write_all(value.as_bytes()).and_then(|_|f.sync_all()).map_err(|e|e.to_string())?;
 fs::rename(tmp,p).map_err(|e|e.to_string())
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() { tauri::Builder::default().invoke_handler(tauri::generate_handler![load_progress,save_progress]).run(tauri::generate_context!()).expect("WSM proof failed"); }
