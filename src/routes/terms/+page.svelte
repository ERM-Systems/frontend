<script lang="ts">
	import Footer from '$lib/components/Footer.svelte';
	import Meta from '$lib/components/Meta.svelte';

	const description =
		'The terms of service governing your use of the ERM Systems bot, dashboard and website.';
</script>

<Meta title="Terms of Service - ERM Systems" {description} />

<section class="relative overflow-hidden">
	<div
		class="pointer-events-none absolute -top-50 left-1/2 h-150 w-250 -translate-x-1/2 rounded-full opacity-60 blur-[120px]"
		style="background: radial-gradient(closest-side, rgba(160,20,20,0.30), transparent)"
	></div>

	<div class="relative mx-auto max-w-225 px-6 pt-20 pb-12">
		<p class="text-sm font-semibold">Legal</p>
		<h1 class="mt-2 text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">
			Legal Terms. Your Agreement.
		</h1>
		<p class="mt-5 max-w-2xl text-lg leading-relaxed text-balance text-muted">
			Please read these terms carefully. By using our services, you agree to be bound by these
			terms.
		</p>
	</div>
</section>

<section class="mx-auto max-w-225 px-6 pb-28">
	<div
		class="prose max-w-none rounded-xl border border-line bg-surface p-6 prose-invert sm:p-10 prose-headings:tracking-[-0.02em] prose-p:text-muted prose-strong:text-white prose-li:text-muted"
	>
		<h2>1. Definitions</h2>
		<ul>
			<li>
				"Service" refers to Emergency Response Management's bot, website, and related services
			</li>
			<li>"User" means any individual or entity using the Service</li>
			<li>"Content" includes text, images, data, or other materials</li>
			<li>"Terms" refers to these Terms of Service</li>
		</ul>

		<h2>2. Service License</h2>
		<p>
			Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, and revocable
			license to use the Service. You may not:
		</p>
		<ul>
			<li>Modify, reverse engineer, or create derivative works</li>
			<li>Use the Service for any illegal purpose</li>
			<li>Attempt to gain unauthorized access</li>
			<li>License, sell, or commercially exploit the Service</li>
			<li>Use the Service in a way that could damage or impair it</li>
		</ul>

		<h2>3. User Obligations</h2>
		<p>You agree to:</p>
		<ul>
			<li>Comply with all applicable laws and regulations</li>
			<li>Maintain accurate account information</li>
			<li>Protect your account credentials</li>
			<li>Not impersonate others or misrepresent your affiliation</li>
			<li>Not use automated systems or bots without written permission</li>
			<li>Not interfere with the Service's security features</li>
		</ul>

		<h2>4. Intellectual Property</h2>
		<p>
			All rights, title, and interest in the Service, including all intellectual property rights,
			remain our exclusive property. Any feedback, suggestions, or improvements you provide may be
			used without obligation to you. You grant us a worldwide, royalty-free license to use, modify,
			and distribute any feedback you provide.
		</p>

		<h2>5. Disclaimer of Warranties</h2>
		<p>
			THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. WE
			EXPLICITLY DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF
			MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
		</p>

		<h2>6. Limitation of Liability</h2>
		<p>
			IN NO EVENT SHALL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
			CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, LOSS OF DATA, OR BUSINESS INTERRUPTION, ARISING
			OUT OF OR IN CONNECTION WITH THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
		</p>

		<h2>7. Termination</h2>
		<p>
			We reserve the right to terminate or suspend your access to the Service immediately, without
			prior notice or liability, for any reason whatsoever, including without limitation if you
			breach the Terms. All provisions of the Terms which by their nature should survive termination
			shall survive termination.
		</p>
	</div>
</section>

<Footer />
