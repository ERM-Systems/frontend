import type { Moderation } from './server/panel';

export const perPage = 20;

const pagesPerChunk = 5;
const chunkSize = perPage * pagesPerChunk;
const prefetchWithin = 2;
const boloLimit = 50;

export interface Filters {
	type: string;
	username: string;
	userId: string;
	reason?: string;
	from?: string;
	to?: string;
}

interface Page {
	rows: Moderation[];
	total: number;
}

export class Punishments {
	rows = $state<(Moderation | undefined)[]>([]);
	bolos = $state<Moderation[]>([]);
	total = $state(0);
	loading = $state(false);
	ready = $state(false);
	failed = $state(false);
	page = $state(1);

	#base: string;
	#filters: Filters = { type: '', username: '', userId: '', reason: '', from: '', to: '' };
	#loaded: number[] = [];
	#started = false;

	constructor(base: string) {
		this.#base = base;
	}

	get shown(): Moderation[] {
		const start = (this.page - 1) * perPage;
		const pinned = this.bolos.map((entry) => entry.id);

		return this.rows
			.slice(start, start + perPage)
			.filter((entry): entry is Moderation => !!entry && !pinned.includes(entry.id));
	}

	get showBolos(): boolean {
		return !this.#filters.type || this.#filters.type === 'BOLO';
	}

	#query(extra: Record<string, string>, type = this.#filters.type): string {
		const fields: Record<string, string> = {
			feed: 'moderations',
			...extra,
			...(type ? { type } : {}),
			...(this.#filters.username ? { username: this.#filters.username } : {}),
			...(this.#filters.userId ? { userId: this.#filters.userId } : {}),
			...(this.#filters.reason ? { reason: this.#filters.reason } : {}),
			...(this.#filters.from ? { from: this.#filters.from } : {}),
			...(this.#filters.to ? { to: this.#filters.to } : {})
		};

		const query = Object.entries(fields)
			.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
			.join('&');

		return `${this.#base}?${query}`;
	}

	async #fetch(url: string): Promise<Page | null> {
		try {
			const response = await fetch(url, { cache: 'no-store' });
			if (!response.ok) throw new Error(String(response.status));

			return (await response.json()) as Page;
		} catch {
			return null;
		}
	}

	async #chunk(index: number): Promise<void> {
		if (index < 0 || this.#loaded.includes(index)) return;
		this.#loaded.push(index);

		const skip = index * chunkSize;
		if (skip && skip >= this.total) return;

		this.loading = true;

		const page = await this.#fetch(this.#query({ skip: String(skip), limit: String(chunkSize) }));

		this.loading = false;

		if (!page) {
			this.#loaded = this.#loaded.filter((entry) => entry !== index);
			this.failed = true;
			return;
		}

		this.failed = false;
		this.ready = true;

		this.total = page.total > 0 ? page.total : Math.max(this.total, skip + page.rows.length);

		const rows = [...this.rows];
		rows.length = Math.max(rows.length, this.total);
		for (const [offset, entry] of page.rows.entries()) rows[skip + offset] = entry;

		this.rows = rows;
	}

	async #loadBolos(): Promise<void> {
		if (!this.showBolos) {
			this.bolos = [];
			return;
		}

		const page = await this.#fetch(this.#query({ skip: '0', limit: String(boloLimit) }, 'BOLO'));

		this.bolos = page?.rows ?? [];
	}

	ensure(page: number): void {
		const index = Math.floor((page - 1) / pagesPerChunk);

		void this.#chunk(index);
		if ((page - 1) % pagesPerChunk >= pagesPerChunk - prefetchWithin) {
			void this.#chunk(index + 1);
		}
	}

	apply(filters: Filters): void {
		const same =
			this.#started &&
			filters.type === this.#filters.type &&
			filters.username === this.#filters.username &&
			filters.userId === this.#filters.userId &&
			filters.reason === this.#filters.reason &&
			filters.from === this.#filters.from &&
			filters.to === this.#filters.to;

		if (same) return;

		this.#filters = { ...filters };
		this.reload();
	}

	reload(): void {
		this.#started = true;
		this.#loaded = [];
		this.rows = [];
		this.total = 0;
		this.page = 1;

		void this.#loadBolos();
		this.ensure(1);
	}

	refresh(): void {
		const page = this.page;

		this.#started = true;
		this.#loaded = [];

		void this.#loadBolos();
		this.ensure(page);
	}
}
