<script lang="ts">
	let {
		total,
		perPage = 10,
		page = $bindable(1),
		label = 'entries'
	}: {
		total: number;
		perPage?: number;
		page: number;
		label?: string;
	} = $props();

	const pages = $derived(Math.max(1, Math.ceil(total / perPage)));

	$effect(() => {
		if (page > pages) page = pages;
	});
</script>

{#if pages > 1}
	<div class="flex flex-wrap items-center gap-3 border-t border-line px-6 py-4">
		<p class="flex-1 text-sm text-muted">
			Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total}
			{label}
		</p>

		<button
			type="button"
			onclick={() => (page -= 1)}
			disabled={page === 1}
			class="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:py-3"
		>
			Previous
		</button>

		<span class="text-sm text-muted">{page} of {pages}</span>

		<button
			type="button"
			onclick={() => (page += 1)}
			disabled={page === pages}
			class="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:py-3"
		>
			Next
		</button>
	</div>
{/if}
