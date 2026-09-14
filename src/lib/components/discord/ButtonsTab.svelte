<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Field from '$lib/components/settings/Field.svelte';
	import Input from '$lib/components/settings/Input.svelte';
	import Select from '$lib/components/settings/Select.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import {
		blankActionRow,
		blankButton,
		buttonStyles,
		ComponentType,
		messageLimits,
		type ActionRow,
		type Button,
		type DiscordMessage
	} from '$lib/discord';

	let {
		message,
		roles = []
	}: { message: DiscordMessage; roles?: { value: string; label: string }[] } = $props();

	const styleOptions = buttonStyles.map((style) => ({
		value: String(style.value),
		label: style.label
	}));

	const rows = $derived(
		message.components
			.map((component, index) => ({ component, index }))
			.filter((entry) => entry.component.type === ComponentType.ActionRow) as {
			component: ActionRow;
			index: number;
		}[]
	);

	function newButton(): Button {
		const button = blankButton();
		if (roles.length) button.custom_id = roles[0].value;
		return button;
	}

	function addRow() {
		const row = blankActionRow();
		row.components = [newButton()];
		message.components.push(row);
	}

	function removeRow(index: number) {
		message.components.splice(index, 1);
	}

	function setStyle(button: Button, next: string) {
		const parsed = Number(next);
		button.style = parsed >= 1 && parsed <= 5 ? (parsed as Button['style']) : 1;

		if (button.style === 5) {
			button.custom_id = '';
			return;
		}

		button.url = '';
		if (roles.length && !roles.some((role) => role.value === button.custom_id)) {
			button.custom_id = roles[0].value;
		}
	}
</script>

<div class="flex flex-col gap-5">
	<p class="text-sm text-muted">
		Buttons sit under the message. Discord allows {messageLimits.actionRows} rows of {messageLimits.rowButtons}
		buttons.
	</p>

	{#each rows as { component, index } (component)}
		<div class="rounded-xl border border-line bg-white/2">
			<div class="flex items-center justify-between border-b border-line px-4 py-3">
				<span class="text-sm font-semibold">Row {index + 1}</span>
				<button
					type="button"
					onclick={() => removeRow(index)}
					aria-label="Remove row {index + 1}"
					class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
				>
					<Trash2 class="h-4 w-4" />
				</button>
			</div>

			<div class="flex flex-col gap-3 px-4 py-4">
				{#each component.components as button, position (button)}
					<div class="rounded-lg border border-line bg-white/2 p-3">
						<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
							<Field label="Label" counter="{button.label.length}/{messageLimits.buttonLabel}">
								<Input bind:value={button.label} maxlength={messageLimits.buttonLabel} />
							</Field>

							<Field label="Style">
								<Select
									options={styleOptions}
									bind:value={() => String(button.style), (next) => setStyle(button, next)}
								/>
							</Field>
						</div>

						<div class="mt-3">
							{#if button.style === 5}
								<Field label="Link">
									<Input bind:value={button.url} placeholder="https://example.com" />
								</Field>
							{:else if roles.length}
								<Field label="Action" description="What the bot does when this button is pressed.">
									<div class="flex flex-wrap gap-1 rounded-lg border border-line bg-bg/40 p-1">
										{#each roles as role (role.value)}
											<button
												type="button"
												onclick={() => (button.custom_id = role.value)}
												aria-pressed={button.custom_id === role.value}
												class="rounded-md px-3 py-1.5 text-sm transition-colors pointer-coarse:py-3 {button.custom_id ===
												role.value
													? 'bg-white/8 font-medium text-white'
													: 'text-muted hover:bg-white/5 hover:text-white'}"
											>
												{role.label}
											</button>
										{/each}
									</div>
								</Field>
							{:else}
								<Field label="ID" counter="{button.custom_id.length}/{messageLimits.customId}">
									<Input bind:value={button.custom_id} maxlength={messageLimits.customId} />
								</Field>
							{/if}
						</div>

						<div class="mt-3 flex items-center justify-between">
							<label class="flex items-center gap-2 text-xs text-muted">
								<Switch bind:checked={button.disabled} label="Disabled" />
								Disabled
							</label>

							<button
								type="button"
								onclick={() => component.components.splice(position, 1)}
								aria-label="Remove button {position + 1}"
								class="rounded-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-white"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</div>
				{/each}

				{#if component.components.length < messageLimits.rowButtons}
					<button
						type="button"
						onclick={() => component.components.push(newButton())}
						class="self-start rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white"
					>
						+ Button
					</button>
				{/if}
			</div>
		</div>
	{/each}

	{#if rows.length < messageLimits.actionRows}
		<div class="flex items-center gap-2 rounded-xl border border-dashed border-line px-4 py-3">
			<button
				type="button"
				onclick={addRow}
				class="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-bg transition-opacity hover:opacity-85"
			>
				<Plus class="h-3.5 w-3.5" />
				Row
			</button>
		</div>
	{/if}
</div>
