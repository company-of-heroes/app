use std::path::PathBuf;
use warp::Filter;

/// Starts a lightweight static file server on port 9842
/// Serves files from the overlays directory in the app's data directory
pub async fn start_server(overlays_path: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting web server on http://localhost:9842");
    println!("Serving files from: {}", overlays_path.display());

    // Create a filter that serves static files from the overlays directory
    let static_files = warp::fs::dir(overlays_path);

    // Add CORS headers to allow cross-origin requests
    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "OPTIONS"])
        .allow_headers(vec!["Content-Type"]);

    let routes = static_files.with(cors);

    // Start the server on port 9842
    warp::serve(routes)
        .run(([127, 0, 0, 1], 9000))
        .await;

    Ok(())
}

/// Spawns the web server in a background thread with its own runtime
pub fn spawn_server(overlays_path: PathBuf) {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(async move {
            if let Err(e) = start_server(overlays_path).await {
                eprintln!("Web server error: {}", e);
            }
        });
    });
}
