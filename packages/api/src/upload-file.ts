import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { apiError, type ApiError } from './errors';

export type UploadImageKind = 'jpeg' | 'png' | 'webp' | 'gif' | 'bmp';

export type ToUploadFileOptions = {
	maxBytes: number;
	allowed: readonly UploadImageKind[];
	fallbackName: string;
	tooLargeMessage: string;
	invalidTypeMessage: string;
};

const EXT_BY_KIND: Record<UploadImageKind, string> = {
	jpeg: '.jpg',
	png: '.png',
	webp: '.webp',
	gif: '.gif',
	bmp: '.bmp'
};

const MIME_BY_KIND: Record<UploadImageKind, string> = {
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	gif: 'image/gif',
	bmp: 'image/bmp'
};

function detectImageKind(bytes: Uint8Array): UploadImageKind | null {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return 'jpeg';
	}

	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47
	) {
		return 'png';
	}

	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return 'webp';
	}

	if (
		bytes.length >= 6 &&
		bytes[0] === 0x47 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x38 &&
		(bytes[4] === 0x37 || bytes[4] === 0x39) &&
		bytes[5] === 0x61
	) {
		return 'gif';
	}

	if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
		return 'bmp';
	}

	return null;
}

function nameWithExtension(name: string, kind: UploadImageKind, fallbackName: string): string {
	const base =
		(name || fallbackName).replace(/\.[^.]+$/, '') || fallbackName.replace(/\.[^.]+$/, '');
	return `${base}${EXT_BY_KIND[kind]}`;
}

/** Reads bytes first: SvelteKit LazyFile is not a Blob, so `new File([lazyFile])` stores "[object Object]". */
export function toUploadFile(
	file: { name?: string; size?: number; type?: string; arrayBuffer: () => Promise<ArrayBuffer> },
	options: ToUploadFileOptions
): ResultAsync<File, ApiError> {
	const sizeHint = typeof file.size === 'number' ? file.size : 0;
	if (sizeHint > options.maxBytes) {
		return errAsync(apiError(400, options.tooLargeMessage));
	}

	return ResultAsync.fromPromise(file.arrayBuffer(), () =>
		apiError(400, options.invalidTypeMessage)
	).andThen((buffer) => {
		const bytes = new Uint8Array(buffer);
		if (bytes.byteLength < 1) {
			return errAsync(apiError(400, options.invalidTypeMessage));
		}

		if (bytes.byteLength > options.maxBytes) {
			return errAsync(apiError(400, options.tooLargeMessage));
		}

		const kind = detectImageKind(bytes);
		if (!kind || !options.allowed.includes(kind)) {
			return errAsync(apiError(400, options.invalidTypeMessage));
		}

		const name = nameWithExtension(file.name || '', kind, options.fallbackName);
		return okAsync(new File([bytes], name, { type: MIME_BY_KIND[kind] }));
	});
}

export function cloneUploadFile(file: File): File {
	return new File([file], file.name, { type: file.type });
}
