import translate from 'google-translate-api-x';
import { fetch } from '$core/http/fetch';

export async function translateText(text: string, to: string): Promise<string> {
	if (!text.trim()) {
		return text;
	}

	const { text: translated } = await translate(text, {
		to,
		requestFunction: fetch
	});

	return translated;
}
