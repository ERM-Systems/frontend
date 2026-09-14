export const beatTimeout = 16_000;

class Health {
	online = $state(true);
	streaming = $state(true);

	watch(): () => void {
		const source = new EventSource('/api/health/stream');
		let watchdog: ReturnType<typeof setTimeout> | null = null;

		const arm = () => {
			if (watchdog) clearTimeout(watchdog);
			watchdog = setTimeout(() => (this.online = false), beatTimeout);
		};

		source.addEventListener('beat', () => {
			this.online = true;
			arm();
		});

		source.onopen = () => {
			this.online = true;
			arm();
		};

		source.onerror = () => (this.online = false);

		arm();

		return () => {
			source.close();
			if (watchdog) clearTimeout(watchdog);
		};
	}
}

export const health = new Health();
