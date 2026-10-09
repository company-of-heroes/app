/** Gold, the site's orange, and the ribbon colours of the medals. */
const COLORS = ['#e0b23a', '#f4c15d', '#f97316', '#c23b3b', '#3f6fb0', '#2f5a34', '#f4f1e8'];
const DURATION_MS = 3200;
const GRAVITY = 0.32;

type Piece = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	angle: number;
	spin: number;
	tilt: number;
	width: number;
	height: number;
	color: string;
};

/**
 * Two bursts of confetti from the bottom corners over the whole window. Skipped when the
 * viewer prefers reduced motion; the canvas never takes pointer events and removes itself.
 */
export function fireConfetti(count = 180): void {
	if (
		typeof window === 'undefined' ||
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	) {
		return;
	}

	const canvas = document.createElement('canvas');
	const ratio = window.devicePixelRatio || 1;
	const width = window.innerWidth;
	const height = window.innerHeight;
	canvas.width = width * ratio;
	canvas.height = height * ratio;
	Object.assign(canvas.style, {
		position: 'fixed',
		inset: '0',
		width: '100%',
		height: '100%',
		pointerEvents: 'none',
		zIndex: '100'
	});
	canvas.setAttribute('aria-hidden', 'true');
	document.body.appendChild(canvas);
	const context = canvas.getContext('2d');
	if (!context) {
		canvas.remove();
		return;
	}

	context.scale(ratio, ratio);
	const pieces: Piece[] = Array.from({ length: count }, (_, i) => {
		const fromLeft = i % 2 === 0;
		const angle = (fromLeft ? -60 : -120) + (Math.random() - 0.5) * 40;
		const speed = 13 + Math.random() * 11;
		return {
			x: fromLeft ? width * 0.05 : width * 0.95,
			y: height + 10,
			vx: Math.cos((angle * Math.PI) / 180) * speed,
			vy: Math.sin((angle * Math.PI) / 180) * speed,
			angle: Math.random() * Math.PI * 2,
			spin: (Math.random() - 0.5) * 0.3,
			tilt: Math.random() * Math.PI,
			width: 6 + Math.random() * 6,
			height: 10 + Math.random() * 8,
			color: COLORS[i % COLORS.length]
		};
	});

	const start = performance.now();
	const frame = (now: number) => {
		const elapsed = now - start;
		context.clearRect(0, 0, width, height);
		context.globalAlpha = Math.max(
			0,
			1 - Math.max(0, elapsed - DURATION_MS * 0.7) / (DURATION_MS * 0.3)
		);
		for (const piece of pieces) {
			piece.vy += GRAVITY;
			piece.vx *= 0.985;
			piece.vy *= 0.985;
			piece.x += piece.vx;
			piece.y += piece.vy;
			piece.angle += piece.spin;
			piece.tilt += 0.12;
			context.save();
			context.translate(piece.x, piece.y);
			context.rotate(piece.angle);
			// Flipping paper: the height follows the tilt.
			context.scale(1, Math.cos(piece.tilt));
			context.fillStyle = piece.color;
			context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
			context.restore();
		}

		if (elapsed < DURATION_MS) {
			requestAnimationFrame(frame);
		} else {
			canvas.remove();
		}
	};
	requestAnimationFrame(frame);
}
