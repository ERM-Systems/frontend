type Options = {
	delay?: number;
	duration?: number;
	from?: 'up' | 'left' | 'right' | 'zoom';
};

const baseDuration = 700;
const settleBuffer = 60;

export function reveal(node: HTMLElement, options: Options = {}) {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	const coarse = window.matchMedia('(pointer: coarse)').matches;
	const { duration, from = 'up' } = options;
	const delay = coarse ? 0 : (options.delay ?? 0);

	node.style.transitionDelay = `${delay}ms`;
	if (duration) node.style.transitionDuration = `${duration}ms`;
	node.classList.add('reveal', `reveal-${from}`);

	let settle: ReturnType<typeof setTimeout> | null = null;

	const clear = () => {
		node.classList.remove('reveal', `reveal-${from}`, 'reveal-in');
		node.style.transitionDelay = '';
		node.style.transitionDuration = '';
	};

	const observer = new IntersectionObserver(
		([entry]) => {
			if (!entry.isIntersecting) return;
			node.classList.add('reveal-in');
			observer.disconnect();

			settle = setTimeout(clear, (duration ?? baseDuration) + delay + settleBuffer);
		},
		{ rootMargin: coarse ? '0px 0px 35% 0px' : '0px 0px -12% 0px' }
	);

	observer.observe(node);

	return {
		destroy: () => {
			observer.disconnect();
			if (settle) clearTimeout(settle);
		}
	};
}
