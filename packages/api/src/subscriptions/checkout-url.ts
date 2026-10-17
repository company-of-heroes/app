/** True for an https link on paddle.com or one of its subdomains (the customer portal). */
export function isPaddlePortalUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			url.protocol === 'https:' &&
			(url.hostname === 'paddle.com' || url.hostname.endsWith('.paddle.com'))
		);
	} catch {
		return false;
	}
}
