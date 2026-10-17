/** True for an https link on mollie.com or one of its subdomains (the hosted checkout). */
export function isMollieCheckoutUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			url.protocol === 'https:' &&
			(url.hostname === 'mollie.com' || url.hostname.endsWith('.mollie.com'))
		);
	} catch {
		return false;
	}
}
