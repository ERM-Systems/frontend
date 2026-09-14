interface Entry<T> {
	value: T;
	expires: number;
}

export class TtlCache<T> {
	#entries = new Map<string, Entry<T>>();
	#inFlight = new Map<string, Promise<unknown>>();
	#ttl: number;
	#max: number;

	constructor(ttl: number, max = 5000) {
		this.#ttl = ttl;
		this.#max = max;
	}

	get(key: string): T | undefined {
		const entry = this.#entries.get(key);
		if (!entry) return undefined;
		return entry.expires > Date.now() ? entry.value : undefined;
	}

	stale(key: string): T | undefined {
		return this.#entries.get(key)?.value;
	}

	set(key: string, value: T, ttl = this.#ttl) {
		if (this.#entries.size >= this.#max) this.#prune();
		this.#entries.set(key, { value, expires: Date.now() + ttl });
	}

	delete(key: string) {
		this.#entries.delete(key);
	}

	dedupe<R>(key: string, loader: () => Promise<R>): Promise<R> {
		const pending = this.#inFlight.get(key) as Promise<R> | undefined;
		if (pending) return pending;

		const promise = loader().finally(() => this.#inFlight.delete(key));
		this.#inFlight.set(key, promise);
		return promise;
	}

	#prune() {
		const now = Date.now();
		for (const [key, entry] of this.#entries) {
			if (entry.expires <= now) this.#entries.delete(key);
		}
		if (this.#entries.size < this.#max) return;
		const overflow = this.#entries.size - Math.floor(this.#max / 2);
		for (const key of [...this.#entries.keys()].slice(0, overflow)) this.#entries.delete(key);
	}
}
