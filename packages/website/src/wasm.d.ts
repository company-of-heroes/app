/** A compiled wasm module (`wasmModulePlugin` in `vite.config.ts`). */
declare module '*.wasm?module' {
	const module: WebAssembly.Module;
	export default module;
}
