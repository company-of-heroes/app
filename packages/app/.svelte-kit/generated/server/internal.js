
import root from '../root.js';
import { set_building, set_prerendering } from '__sveltekit/environment';
import { set_assets } from '$app/paths/internal/server';
import { set_manifest, set_read_implementation } from '__sveltekit/server';
import { set_private_env, set_public_env } from '../../../../../node_modules/.pnpm/@sveltejs+kit@2.61.0_@svelt_f726a89e9e79524f5ebca9bf8f74cfe8/node_modules/@sveltejs/kit/src/runtime/shared-server.js';

export const options = {
	app_template_contains_nonce: false,
	async: true,
	csp: {"mode":"auto","directives":{"upgrade-insecure-requests":false,"block-all-mixed-content":false},"reportOnly":{"upgrade-insecure-requests":false,"block-all-mixed-content":false}},
	csrf_check_origin: true,
	csrf_trusted_origins: [],
	embedded: false,
	env_public_prefix: 'PUBLIC_',
	env_private_prefix: '',
	hash_routing: false,
	hooks: null, // added lazily, via `get_hooks`
	preload_strategy: "modulepreload",
	root,
	service_worker: false,
	service_worker_options: undefined,
	server_error_boundaries: false,
	templates: {
		app: ({ head, body, assets, nonce, env }) => "<!doctype html>\r\n<html lang=\"en\">\r\n\t<head>\r\n\t\t<meta charset=\"utf-8\" />\r\n\t\t<link rel=\"icon\" href=\"" + assets + "/favicon.png\" />\r\n\t\t<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\r\n\t\t<title>Company of Heroes Companion - created by Fknoobs</title>\r\n\t\t<style>\r\n\t\t\t#boot-splash {\r\n\t\t\t\tposition: fixed;\r\n\t\t\t\tinset: 0;\r\n\t\t\t\tz-index: 2147483647;\r\n\t\t\t\tdisplay: flex;\r\n\t\t\t\tflex-direction: column;\r\n\t\t\t\talign-items: center;\r\n\t\t\t\tjustify-content: center;\r\n\t\t\t\tgap: 1.25rem;\r\n\t\t\t\tbackground: oklch(29% 0.003 285);\r\n\t\t\t\tcolor: oklch(66% 0.005 285);\r\n\t\t\t\tfont-family: system-ui, -apple-system, sans-serif;\r\n\t\t\t\tfont-size: 1rem;\r\n\t\t\t\tfont-weight: 600;\r\n\t\t\t}\r\n\r\n\t\t\t#boot-splash .boot-splash-spinner {\r\n\t\t\t\twidth: 48px;\r\n\t\t\t\theight: 48px;\r\n\t\t\t\tborder-radius: 9999px;\r\n\t\t\t\tborder: 2.5px solid oklch(41% 0.004 285 / 0.55);\r\n\t\t\t\tborder-top-color: oklch(0.88 0.11 80);\r\n\t\t\t\tanimation: boot-spin 1.5s linear infinite;\r\n\t\t\t}\r\n\r\n\t\t\t#boot-splash .boot-splash-label {\r\n\t\t\t\tmargin: 0;\r\n\t\t\t}\r\n\r\n\t\t\t#boot-splash .boot-splash-dots {\r\n\t\t\t\tdisplay: flex;\r\n\t\t\t\tgap: 0.4rem;\r\n\t\t\t\tmargin: -0.25rem 0 0;\r\n\t\t\t\tpadding: 0;\r\n\t\t\t\tlist-style: none;\r\n\t\t\t}\r\n\r\n\t\t\t#boot-splash .boot-splash-dots li {\r\n\t\t\t\twidth: 0.35rem;\r\n\t\t\t\theight: 0.35rem;\r\n\t\t\t\tborder-radius: 9999px;\r\n\t\t\t\tbackground: oklch(0.88 0.11 80);\r\n\t\t\t\topacity: 0.35;\r\n\t\t\t\tanimation: boot-dot-pulse 1.2s ease-in-out infinite;\r\n\t\t\t}\r\n\r\n\t\t\t#boot-splash .boot-splash-dots li:nth-child(2) {\r\n\t\t\t\tanimation-delay: 0.2s;\r\n\t\t\t}\r\n\r\n\t\t\t#boot-splash .boot-splash-dots li:nth-child(3) {\r\n\t\t\t\tanimation-delay: 0.4s;\r\n\t\t\t}\r\n\r\n\t\t\t@keyframes boot-spin {\r\n\t\t\t\tto {\r\n\t\t\t\t\ttransform: rotate(360deg);\r\n\t\t\t\t}\r\n\t\t\t}\r\n\r\n\t\t\t@keyframes boot-dot-pulse {\r\n\t\t\t\t0%,\r\n\t\t\t\t100% {\r\n\t\t\t\t\topacity: 0.25;\r\n\t\t\t\t\ttransform: scale(1);\r\n\t\t\t\t}\r\n\r\n\t\t\t\t50% {\r\n\t\t\t\t\topacity: 1;\r\n\t\t\t\t\ttransform: scale(1.15);\r\n\t\t\t\t}\r\n\t\t\t}\r\n\r\n\t\t\t@media (prefers-reduced-motion: reduce) {\r\n\t\t\t\t#boot-splash .boot-splash-spinner,\r\n\t\t\t\t#boot-splash .boot-splash-dots li {\r\n\t\t\t\t\tanimation: none;\r\n\t\t\t\t}\r\n\r\n\t\t\t\t#boot-splash .boot-splash-dots li {\r\n\t\t\t\t\topacity: 0.6;\r\n\t\t\t\t}\r\n\t\t\t}\r\n\t\t</style>\r\n\t\t" + head + "\r\n\t</head>\r\n\t<body class=\"overflow-hidden text-white\">\r\n\t\t<div id=\"boot-splash\" aria-live=\"polite\" aria-busy=\"true\">\r\n\t\t\t<div class=\"boot-splash-spinner\" aria-hidden=\"true\"></div>\r\n\t\t\t<p class=\"boot-splash-label\">Starting...</p>\r\n\t\t\t<ul class=\"boot-splash-dots\" aria-hidden=\"true\">\r\n\t\t\t\t<li></li>\r\n\t\t\t\t<li></li>\r\n\t\t\t\t<li></li>\r\n\t\t\t</ul>\r\n\t\t</div>\r\n\t\t<div style=\"display: contents\">" + body + "</div>\r\n\t\t<script>\r\n\t\t\tif (!/\\/splashscreen\\/?$/.test(location.pathname)) {\r\n\t\t\t\tdocument.getElementById('boot-splash')?.remove();\r\n\t\t\t}\r\n\t\t</script>\r\n\t</body>\r\n</html>\r\n",
		error: ({ status, message }) => "<!doctype html>\n<html lang=\"en\">\n\t<head>\n\t\t<meta charset=\"utf-8\" />\n\t\t<title>" + message + "</title>\n\n\t\t<style>\n\t\t\tbody {\n\t\t\t\t--bg: white;\n\t\t\t\t--fg: #222;\n\t\t\t\t--divider: #ccc;\n\t\t\t\tbackground: var(--bg);\n\t\t\t\tcolor: var(--fg);\n\t\t\t\tfont-family:\n\t\t\t\t\tsystem-ui,\n\t\t\t\t\t-apple-system,\n\t\t\t\t\tBlinkMacSystemFont,\n\t\t\t\t\t'Segoe UI',\n\t\t\t\t\tRoboto,\n\t\t\t\t\tOxygen,\n\t\t\t\t\tUbuntu,\n\t\t\t\t\tCantarell,\n\t\t\t\t\t'Open Sans',\n\t\t\t\t\t'Helvetica Neue',\n\t\t\t\t\tsans-serif;\n\t\t\t\tdisplay: flex;\n\t\t\t\talign-items: center;\n\t\t\t\tjustify-content: center;\n\t\t\t\theight: 100vh;\n\t\t\t\tmargin: 0;\n\t\t\t}\n\n\t\t\t.error {\n\t\t\t\tdisplay: flex;\n\t\t\t\talign-items: center;\n\t\t\t\tmax-width: 32rem;\n\t\t\t\tmargin: 0 1rem;\n\t\t\t}\n\n\t\t\t.status {\n\t\t\t\tfont-weight: 200;\n\t\t\t\tfont-size: 3rem;\n\t\t\t\tline-height: 1;\n\t\t\t\tposition: relative;\n\t\t\t\ttop: -0.05rem;\n\t\t\t}\n\n\t\t\t.message {\n\t\t\t\tborder-left: 1px solid var(--divider);\n\t\t\t\tpadding: 0 0 0 1rem;\n\t\t\t\tmargin: 0 0 0 1rem;\n\t\t\t\tmin-height: 2.5rem;\n\t\t\t\tdisplay: flex;\n\t\t\t\talign-items: center;\n\t\t\t}\n\n\t\t\t.message h1 {\n\t\t\t\tfont-weight: 400;\n\t\t\t\tfont-size: 1em;\n\t\t\t\tmargin: 0;\n\t\t\t}\n\n\t\t\t@media (prefers-color-scheme: dark) {\n\t\t\t\tbody {\n\t\t\t\t\t--bg: #222;\n\t\t\t\t\t--fg: #ddd;\n\t\t\t\t\t--divider: #666;\n\t\t\t\t}\n\t\t\t}\n\t\t</style>\n\t</head>\n\t<body>\n\t\t<div class=\"error\">\n\t\t\t<span class=\"status\">" + status + "</span>\n\t\t\t<div class=\"message\">\n\t\t\t\t<h1>" + message + "</h1>\n\t\t\t</div>\n\t\t</div>\n\t</body>\n</html>\n"
	},
	version_hash: "1nhzmia"
};

export async function get_hooks() {
	let handle;
	let handleFetch;
	let handleError;
	let handleValidationError;
	let init;
	

	let reroute;
	let transport;
	

	return {
		handle,
		handleFetch,
		handleError,
		handleValidationError,
		init,
		reroute,
		transport
	};
}

export { set_assets, set_building, set_manifest, set_prerendering, set_private_env, set_public_env, set_read_implementation };
