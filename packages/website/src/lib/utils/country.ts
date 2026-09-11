export function getCountryDisplayName(
	country: string | null | undefined,
	locale = 'en'
): string | null {
	if (!country) {
		return null;
	}

	const region = String(country).trim().toUpperCase();
	if (!/^[A-Z]{2}$/.test(region)) {
		return null;
	}

	try {
		return new Intl.DisplayNames([locale], { type: 'region' }).of(region) || region;
	} catch {
		return region;
	}
}
