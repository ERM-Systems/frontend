<script lang="ts">
	import { page } from '$app/state';

	let {
		title,
		description = '',
		image = '',
		wide = false,
		noindex = false
	}: {
		title: string;
		description?: string;
		image?: string;
		wide?: boolean;
		noindex?: boolean;
	} = $props();

	const canonical = $derived(`${page.url.origin}${page.url.pathname}`);
	const social = $derived(image || `${page.url.origin}/favicon-512.png`);
</script>

<svelte:head>
	<title>{title}</title>
	<link rel="canonical" href={canonical} />
	{#if noindex}<meta name="robots" content="noindex" />{/if}
	{#if description}<meta name="description" content={description} />{/if}

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="ERM Systems" />
	<meta property="og:url" content={canonical} />
	<meta property="og:title" content={title} />
	{#if description}<meta property="og:description" content={description} />{/if}
	<meta property="og:image" content={social} />

	<meta name="twitter:card" content={wide ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={title} />
	{#if description}<meta name="twitter:description" content={description} />{/if}
	<meta name="twitter:image" content={social} />
</svelte:head>
