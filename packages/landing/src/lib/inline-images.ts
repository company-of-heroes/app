export async function inlineImagesForExport(root: HTMLElement): Promise<() => void> {
	const images = [...root.querySelectorAll('img')];
	const restore: Array<[HTMLImageElement, string]> = [];

	await Promise.all(
		images.map(async (img) => {
			const original = img.currentSrc || img.src;
			if (!original || original.startsWith('data:')) {
				return;
			}

			let fetchUrl: string;
			try {
				const parsed = new URL(original, window.location.origin);
				if (parsed.origin !== window.location.origin) {
					fetchUrl = `/api/image?url=${encodeURIComponent(parsed.href)}`;
				} else {
					fetchUrl = parsed.href;
				}
			} catch {
				return;
			}

			const response = await fetch(fetchUrl);
			if (!response.ok) {
				return;
			}

			const blob = await response.blob();
			const dataUrl = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result));
				reader.onerror = () => reject(reader.error);
				reader.readAsDataURL(blob);
			});

			restore.push([img, img.src]);
			img.src = dataUrl;
		})
	);

	return () => {
		for (const [img, src] of restore) {
			img.src = src;
		}
	};
}
