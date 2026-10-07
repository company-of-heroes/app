/** Bar colour for a 0–1 chance (accuracy, penetration): good, so-so, poor. */
export const chanceTone = (value: number) =>
	value >= 0.6 ? 'bg-green-400/80' : value >= 0.3 ? 'bg-amber-400/80' : 'bg-red-400/80';
