/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { base, build, files, prerendered, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;

const cacheName = `erm-${version}`;
const offlineUrl = `${base}/offline`;

const precache = [...build, ...files, ...prerendered.filter((path) => path === offlineUrl)];

function isPrivate(url: URL): boolean {
	return (
		url.pathname.startsWith(`${base}/api/`) ||
		url.pathname.startsWith(`${base}/auth/`) ||
		url.pathname.startsWith(`${base}/logout`) ||
		url.pathname.endsWith('/__data.json') ||
		url.search.includes('x-sveltekit-invalidated')
	);
}

function isPrecached(url: URL): boolean {
	return precache.includes(url.pathname);
}

worker.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(cacheName)
			.then((cache) => cache.addAll(precache))
			.then(() => worker.skipWaiting())
	);
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))
			)
			.then(() => worker.clients.claim())
	);
});

worker.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== location.origin) return;
	if (isPrivate(url)) return;

	if (isPrecached(url)) {
		event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
		return;
	}

	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(async () => {
				const cache = await caches.open(cacheName);
				const offline = await cache.match(offlineUrl);
				return offline ?? Response.error();
			})
		);
	}
});

worker.addEventListener('message', (event) => {
	if (event.data === 'skip-waiting') worker.skipWaiting();
});
