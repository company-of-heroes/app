/** wrangler module rules (wrangler.toml): SVG as text, fonts and images as bytes, wasm compiled. */
declare module '*.svg' {
	const text: string;
	export default text;
}

declare module '*.woff' {
	const data: ArrayBuffer;
	export default data;
}

declare module '*.png' {
	const data: ArrayBuffer;
	export default data;
}

declare module '*.wasm' {
	const module: WebAssembly.Module;
	export default module;
}
