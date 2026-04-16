use std::path::PathBuf;
use std::sync::Once;
use warp::Filter;

static SERVER_INIT: Once = Once::new();

/// Starts a lightweight static file server on port 9000
/// Serves files from the overlays directory in the app's data directory
pub async fn start_server(overlays_path: PathBuf) {
    println!("Starting web server on http://localhost:9000");
    println!("Serving files from: {}", overlays_path.display());

    // Create a filter that serves static files from the overlays directory
    let static_files = warp::fs::dir(overlays_path);

    // Add CORS headers to allow cross-origin requests
    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "OPTIONS"])
        .allow_headers(vec!["Content-Type"]);

    let routes = static_files.with(cors);

    match warp::serve(routes).try_bind_ephemeral(([127, 0, 0, 1], 9000)) {
        Ok((addr, server)) => {
            println!("Web server listening on http://{}", addr);
            server.await;
        }
        Err(e) => {
            eprintln!("Web server failed to bind to port 9000: {}", e);
        }
    }
}

/// Spawns the web server in a background thread with its own runtime.
/// Safe to call multiple times — the server is only started once.
pub fn spawn_server(overlays_path: PathBuf) {
    SERVER_INIT.call_once(|| {
        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
            rt.block_on(start_server(overlays_path));
        });
    });
}
