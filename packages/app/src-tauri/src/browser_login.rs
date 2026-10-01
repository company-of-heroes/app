use std::sync::Arc;

use tauri::{AppHandle, Manager, State};
use tokio::sync::{Mutex, oneshot};
use tokio::time::{timeout, Duration};
use warp::http::{StatusCode, Uri};
use warp::reply::{with_status, Reply};

const HANDOFF_TIMEOUT_SECS: u64 = 60;

#[derive(Clone)]
pub struct BrowserLoginState {
    pending: Arc<Mutex<Option<oneshot::Sender<Result<String, String>>>>>,
}

impl BrowserLoginState {
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(serde::Deserialize)]
pub struct BrowserLoginQuery {
    redirect_uri: String,
    redirect: Option<String>,
}

fn is_allowed_handoff_uri(uri: &str) -> bool {
	let Ok(parsed) = uri.parse::<Uri>() else {
		return false;
	};

	if parsed.path() != "/auth/handoff" {
		return false;
	}

	match (parsed.scheme_str(), parsed.host()) {
		(Some("https"), Some("coh1stats.com" | "www.coh1stats.com")) => true,
		(Some("http"), Some("localhost" | "127.0.0.1")) => true,
		_ => false,
	}
}

fn percent_encode_component(value: &str) -> String {
	value
		.bytes()
		.map(|byte| match byte {
			b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
				(byte as char).to_string()
			}
			_ => format!("%{:02X}", byte),
		})
		.collect()
}

fn build_redirect_url(base: &str, params: &[(&str, &str)]) -> Uri {
	let mut url = base.to_string();
	let separator = if base.contains('?') { '&' } else { '?' };
	let query = params
		.iter()
		.map(|(key, value)| format!("{}={}", key, percent_encode_component(value)))
		.collect::<Vec<_>>()
		.join("&");
	url.push(separator);
	url.push_str(&query);
	Uri::try_from(url).unwrap_or_else(|_| Uri::from_static("/"))
}

pub async fn handle_browser_login(
    query: BrowserLoginQuery,
    app: AppHandle,
    state: BrowserLoginState,
) -> warp::reply::Response {
    if !is_allowed_handoff_uri(&query.redirect_uri) {
        return with_status("Invalid redirect URI.", StatusCode::BAD_REQUEST).into_response();
    }

    let redirect = query.redirect.unwrap_or_else(|| "/".to_string());
    let (tx, rx) = oneshot::channel();

    {
        let mut pending = state.pending.lock().await;
        if pending.is_some() {
            return with_status(
                "Another browser login is already in progress.",
                StatusCode::CONFLICT,
            )
                .into_response();
        }
        *pending = Some(tx);
    }

    let app_for_eval = app.clone();
    if app
        .run_on_main_thread(move || {
            if let Some(window) = app_for_eval.get_webview_window("main") {
                let _ = window.eval(
                    r#"
                    (async () => {
                        try {
                            const create = window.__cohCreateHandoffForBrowser;
                            if (!create) {
                                throw new Error('Desktop app is still starting. Try again in a moment.');
                            }
                            const code = await create();
                            await window.__TAURI_INTERNALS__.invoke('complete_browser_login', { code });
                        } catch (error) {
                            const message = error instanceof Error ? error.message : String(error);
                            await window.__TAURI_INTERNALS__.invoke('complete_browser_login', { error: message });
                        }
                    })();
                "#,
                );
            }
        })
        .is_err()
    {
        state.pending.lock().await.take();
        return with_status(
            "Could not reach the desktop app.",
            StatusCode::INTERNAL_SERVER_ERROR,
        )
            .into_response();
    }

    let result = timeout(Duration::from_secs(HANDOFF_TIMEOUT_SECS), rx).await;
    state.pending.lock().await.take();

    match result {
        Ok(Ok(Ok(code))) => {
            if !code.starts_with("signed-v1.") {
                let location = build_redirect_url(
                    &query.redirect_uri,
                    &[("error", "Invalid login link. Restart the desktop app and try again.")],
                );
                return warp::redirect::redirect(location).into_response();
            }

            let location = build_redirect_url(
                &query.redirect_uri,
                &[("code", &code), ("redirect", &redirect)],
            );
            warp::redirect::redirect(location).into_response()
        }
        Ok(Ok(Err(message))) => {
            let location = build_redirect_url(&query.redirect_uri, &[("error", &message)]);
            warp::redirect::redirect(location).into_response()
        }
        _ => with_status(
            "Timed out waiting for the desktop app. Make sure Companion is running and signed in.",
            StatusCode::GATEWAY_TIMEOUT,
        )
            .into_response(),
    }
}

#[tauri::command]
pub async fn complete_browser_login(
    state: State<'_, BrowserLoginState>,
    code: Option<String>,
    error: Option<String>,
) -> Result<(), String> {
    if error.is_none() {
        if let Some(code) = &code {
            if !code.starts_with("signed-v1.") {
                return Ok(());
            }
        }
    }

    let tx = state.pending.lock().await.take();
    if let Some(tx) = tx {
        let result = if let Some(code) = code {
            Ok(code)
        } else {
            Err(error.unwrap_or_else(|| "Cancelled.".to_string()))
        };
        tx.send(result)
            .map_err(|_| "Browser login request expired.".to_string())?;
    }

    Ok(())
}
