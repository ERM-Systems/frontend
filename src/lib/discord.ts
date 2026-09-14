export const IS_COMPONENTS_V2 = 1 << 15;

export const messageLimits = {
	content: 2000,
	embeds: 10,
	embedTitle: 256,
	embedDescription: 4096,
	embedFields: 25,
	fieldName: 256,
	fieldValue: 1024,
	footerText: 2048,
	authorName: 256,
	embedTotal: 6000,
	textDisplay: 4000,
	containers: 10,
	blocks: 40,
	actionRows: 5,
	rowButtons: 5,
	buttonLabel: 80,
	customId: 100
};

export const buttonStyles: { value: 1 | 2 | 3 | 4 | 5; label: string }[] = [
	{ value: 1, label: 'Blurple' },
	{ value: 2, label: 'Grey' },
	{ value: 3, label: 'Green' },
	{ value: 4, label: 'Red' },
	{ value: 5, label: 'Link' }
];

export enum ComponentType {
	ActionRow = 1,
	Button = 2,
	StringSelect = 3,
	Section = 9,
	TextDisplay = 10,
	Thumbnail = 11,
	MediaGallery = 12,
	File = 13,
	Separator = 14,
	Container = 17
}

export interface EmbedMedia {
	url: string;
}

export interface EmbedAuthor {
	name: string;
	url: string;
	icon_url: string;
}

export interface EmbedFooter {
	text: string;
	icon_url: string;
}

export interface EmbedField {
	name: string;
	value: string;
	inline: boolean;
}

export interface DiscordEmbed {
	title: string;
	description: string;
	url: string;
	color: number | null;
	timestamp: string;
	author: EmbedAuthor;
	footer: EmbedFooter;
	image: EmbedMedia;
	thumbnail: EmbedMedia;
	fields: EmbedField[];
}

export interface TextDisplay {
	type: ComponentType.TextDisplay;
	content: string;
}

export interface Separator {
	type: ComponentType.Separator;
	divider: boolean;
	spacing: 1 | 2;
}

export interface GalleryItem {
	media: EmbedMedia;
	description: string;
	spoiler: boolean;
}

export interface MediaGallery {
	type: ComponentType.MediaGallery;
	items: GalleryItem[];
}

export interface Thumbnail {
	type: ComponentType.Thumbnail;
	media: EmbedMedia;
	description: string;
	spoiler: boolean;
}

export interface Section {
	type: ComponentType.Section;
	components: TextDisplay[];
	accessory: Thumbnail;
}

export interface Container {
	type: ComponentType.Container;
	accent_color: number | null;
	spoiler: boolean;
	components: Block[];
}

export interface Button {
	type: ComponentType.Button;
	style: 1 | 2 | 3 | 4 | 5;
	label: string;
	url: string;
	custom_id: string;
	disabled: boolean;
}

export interface ActionRow {
	type: ComponentType.ActionRow;
	components: Button[];
}

export interface UnknownComponent {
	type: -1;
	raw: Record<string, unknown>;
}

export type Block = TextDisplay | Separator | MediaGallery | Section | UnknownComponent;
export type Component = Container | ActionRow | Block;

export interface DiscordMessage {
	content: string;
	embeds: DiscordEmbed[];
	components: Component[];
}

export interface ValidationError {
	message: string;
}

function str(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function flag(value: unknown): boolean {
	return value === true;
}

function media(value: unknown): EmbedMedia {
	const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	return { url: str(source.url) };
}

function color(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	return Math.min(0xffffff, Math.max(0, Math.round(value)));
}

export function intToHex(value: number): string {
	return `#${Math.min(0xffffff, Math.max(0, Math.round(value)))
		.toString(16)
		.padStart(6, '0')}`;
}

export function hexToInt(hex: string): number {
	const parsed = parseInt(hex.replace('#', ''), 16);
	return Number.isFinite(parsed) ? Math.min(0xffffff, Math.max(0, parsed)) : 0;
}

export function blankEmbed(): DiscordEmbed {
	return {
		title: '',
		description: '',
		url: '',
		color: null,
		timestamp: '',
		author: { name: '', url: '', icon_url: '' },
		footer: { text: '', icon_url: '' },
		image: { url: '' },
		thumbnail: { url: '' },
		fields: []
	};
}

export function blankMessage(): DiscordMessage {
	return { content: '', embeds: [], components: [] };
}

export function blankTextDisplay(): TextDisplay {
	return { type: ComponentType.TextDisplay, content: '' };
}

export function blankSeparator(): Separator {
	return { type: ComponentType.Separator, divider: true, spacing: 1 };
}

export function blankGallery(): MediaGallery {
	return {
		type: ComponentType.MediaGallery,
		items: [{ media: { url: '' }, description: '', spoiler: false }]
	};
}

export function blankSection(): Section {
	return {
		type: ComponentType.Section,
		components: [blankTextDisplay()],
		accessory: {
			type: ComponentType.Thumbnail,
			media: { url: '' },
			description: '',
			spoiler: false
		}
	};
}

export function blankButton(): Button {
	return {
		type: ComponentType.Button,
		style: 1,
		label: '',
		url: '',
		custom_id: '',
		disabled: false
	};
}

export function blankActionRow(): ActionRow {
	return { type: ComponentType.ActionRow, components: [blankButton()] };
}

export function blankContainer(): Container {
	return { type: ComponentType.Container, accent_color: null, spoiler: false, components: [] };
}

function readEmbed(raw: Record<string, unknown>): DiscordEmbed {
	const author = (raw.author ?? {}) as Record<string, unknown>;
	const footer = (raw.footer ?? {}) as Record<string, unknown>;
	const fields = Array.isArray(raw.fields) ? (raw.fields as Record<string, unknown>[]) : [];

	return {
		title: str(raw.title),
		description: str(raw.description),
		url: str(raw.url),
		color: color(raw.color),
		timestamp: str(raw.timestamp),
		author: { name: str(author.name), url: str(author.url), icon_url: str(author.icon_url) },
		footer: { text: str(footer.text), icon_url: str(footer.icon_url) },
		image: media(raw.image),
		thumbnail: media(raw.thumbnail),
		fields: fields.map((field) => ({
			name: str(field.name),
			value: str(field.value),
			inline: flag(field.inline)
		}))
	};
}

function readTextDisplay(raw: Record<string, unknown>): TextDisplay {
	return { type: ComponentType.TextDisplay, content: str(raw.content) };
}

function readBlock(raw: Record<string, unknown>): Block {
	switch (raw.type) {
		case ComponentType.TextDisplay:
			return readTextDisplay(raw);
		case ComponentType.Separator:
			return {
				type: ComponentType.Separator,
				divider: raw.divider !== false,
				spacing: raw.spacing === 2 ? 2 : 1
			};
		case ComponentType.MediaGallery: {
			const items = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : [];
			return {
				type: ComponentType.MediaGallery,
				items: items.map((item) => ({
					media: media(item.media),
					description: str(item.description),
					spoiler: flag(item.spoiler)
				}))
			};
		}
		case ComponentType.Section: {
			const texts = Array.isArray(raw.components)
				? (raw.components as Record<string, unknown>[])
				: [];
			const accessory = (raw.accessory ?? {}) as Record<string, unknown>;
			if (accessory.type !== ComponentType.Thumbnail) {
				return { type: -1, raw };
			}
			return {
				type: ComponentType.Section,
				components: texts
					.filter((entry) => entry.type === ComponentType.TextDisplay)
					.map(readTextDisplay),
				accessory: {
					type: ComponentType.Thumbnail,
					media: media(accessory.media),
					description: str(accessory.description),
					spoiler: flag(accessory.spoiler)
				}
			};
		}
		default:
			return { type: -1, raw };
	}
}

function readButton(raw: Record<string, unknown>): Button {
	const style = Number(raw.style);

	return {
		type: ComponentType.Button,
		style: style >= 1 && style <= 5 ? (style as Button['style']) : 1,
		label: str(raw.label),
		url: str(raw.url),
		custom_id: str(raw.custom_id),
		disabled: flag(raw.disabled)
	};
}

function readComponent(raw: Record<string, unknown>): Component {
	if (raw.type === ComponentType.ActionRow) {
		const children = Array.isArray(raw.components)
			? (raw.components as Record<string, unknown>[])
			: [];
		const buttons = children.filter((child) => child.type === ComponentType.Button);
		if (buttons.length !== children.length) return { type: -1, raw };

		return { type: ComponentType.ActionRow, components: buttons.map(readButton) };
	}

	if (raw.type === ComponentType.Container) {
		const children = Array.isArray(raw.components)
			? (raw.components as Record<string, unknown>[])
			: [];
		return {
			type: ComponentType.Container,
			accent_color: color(raw.accent_color),
			spoiler: flag(raw.spoiler),
			components: children.map(readBlock)
		};
	}

	return readBlock(raw);
}

export function readMessage(raw: unknown): DiscordMessage {
	const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const embeds = Array.isArray(source.embeds) ? (source.embeds as Record<string, unknown>[]) : [];
	const components = Array.isArray(source.components)
		? (source.components as Record<string, unknown>[])
		: [];

	return {
		content: str(source.content),
		embeds: embeds.map(readEmbed),
		components: components.map(readComponent)
	};
}

function trimMedia(value: EmbedMedia): EmbedMedia | undefined {
	return value.url ? { url: value.url } : undefined;
}

function packEmbed(embed: DiscordEmbed): Record<string, unknown> {
	const packed: Record<string, unknown> = {};

	if (embed.title) packed.title = embed.title;
	if (embed.description) packed.description = embed.description;
	if (embed.url) packed.url = embed.url;
	if (embed.color !== null) packed.color = embed.color;
	if (embed.timestamp) packed.timestamp = embed.timestamp;
	if (embed.author.name) {
		packed.author = {
			name: embed.author.name,
			...(embed.author.url ? { url: embed.author.url } : {}),
			...(embed.author.icon_url ? { icon_url: embed.author.icon_url } : {})
		};
	}
	if (embed.footer.text) {
		packed.footer = {
			text: embed.footer.text,
			...(embed.footer.icon_url ? { icon_url: embed.footer.icon_url } : {})
		};
	}
	const image = trimMedia(embed.image);
	if (image) packed.image = image;
	const thumbnail = trimMedia(embed.thumbnail);
	if (thumbnail) packed.thumbnail = thumbnail;
	const fields = embed.fields.filter((field) => field.name || field.value);
	if (fields.length) packed.fields = fields;

	return packed;
}

function packBlock(block: Block): Record<string, unknown> {
	switch (block.type) {
		case ComponentType.TextDisplay:
			return { type: block.type, content: block.content };
		case ComponentType.Separator:
			return { type: block.type, divider: block.divider, spacing: block.spacing };
		case ComponentType.MediaGallery:
			return {
				type: block.type,
				items: block.items
					.filter((item) => item.media.url)
					.map((item) => ({
						media: { url: item.media.url },
						...(item.description ? { description: item.description } : {}),
						...(item.spoiler ? { spoiler: true } : {})
					}))
			};
		case ComponentType.Section:
			return {
				type: block.type,
				components: block.components.map((text) => ({ type: text.type, content: text.content })),
				accessory: {
					type: ComponentType.Thumbnail,
					media: { url: block.accessory.media.url },
					...(block.accessory.description ? { description: block.accessory.description } : {}),
					...(block.accessory.spoiler ? { spoiler: true } : {})
				}
			};
		default:
			return block.raw;
	}
}

function packButton(button: Button): Record<string, unknown> {
	return {
		type: button.type,
		style: button.style,
		label: button.label,
		...(button.style === 5 ? { url: button.url } : { custom_id: button.custom_id }),
		...(button.disabled ? { disabled: true } : {})
	};
}

function packComponent(component: Component): Record<string, unknown> {
	if (component.type === ComponentType.ActionRow) {
		return { type: component.type, components: component.components.map(packButton) };
	}

	if (component.type === ComponentType.Container) {
		return {
			type: component.type,
			...(component.accent_color !== null ? { accent_color: component.accent_color } : {}),
			...(component.spoiler ? { spoiler: true } : {}),
			components: component.components.map(packBlock)
		};
	}

	return packBlock(component);
}

export function usesComponentsV2(message: DiscordMessage): boolean {
	return message.components.some((component) => component.type !== ComponentType.ActionRow);
}

export function packMessage(message: DiscordMessage): Record<string, unknown> {
	const packed: Record<string, unknown> = {};

	if (message.content) packed.content = message.content;
	if (message.embeds.length) packed.embeds = message.embeds.map(packEmbed);
	if (message.components.length) {
		packed.components = message.components.map(packComponent);
		if (usesComponentsV2(message)) packed.flags = IS_COMPONENTS_V2;
	}

	return packed;
}

export function isEmptyMessage(message: DiscordMessage): boolean {
	return !message.content && !message.embeds.length && !message.components.length;
}

function urlIssue(value: string, label: string): string | null {
	if (!value || value.includes('{')) return null;
	try {
		const url = new URL(value);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			return `${label} must start with http or https.`;
		}
	} catch {
		return `${label} is not a valid URL.`;
	}
	return null;
}

export function embedLength(embed: DiscordEmbed): number {
	return (
		embed.title.length +
		embed.description.length +
		embed.author.name.length +
		embed.footer.text.length +
		embed.fields.reduce((total, field) => total + field.name.length + field.value.length, 0)
	);
}

function blockText(block: Block): string {
	if (block.type === ComponentType.TextDisplay) return block.content;
	if (block.type === ComponentType.Section) {
		return block.components.map((text) => text.content).join('');
	}
	return '';
}

export function validateMessage(message: DiscordMessage): ValidationError[] {
	const errors: ValidationError[] = [];
	const add = (issue: string | null) => issue && errors.push({ message: issue });

	if (usesComponentsV2(message) && (message.content || message.embeds.length)) {
		errors.push({
			message: 'A message using containers cannot also use content or embeds.'
		});
	}

	const rows = message.components.filter(
		(component) => component.type === ComponentType.ActionRow
	) as ActionRow[];

	if (rows.length > messageLimits.actionRows) {
		errors.push({ message: `Discord allows at most ${messageLimits.actionRows} button rows.` });
	}

	rows.forEach((row, index) => {
		const label = `Button row ${index + 1}`;

		if (row.components.length > messageLimits.rowButtons) {
			errors.push({ message: `${label} has more than ${messageLimits.rowButtons} buttons.` });
		}

		row.components.forEach((button, position) => {
			const name = `${label} button ${position + 1}`;

			if (!button.label.trim()) errors.push({ message: `${name} needs a label.` });
			if (button.label.length > messageLimits.buttonLabel) {
				errors.push({ message: `${name} label is over ${messageLimits.buttonLabel} characters.` });
			}

			if (button.style === 5) {
				if (!button.url.trim()) errors.push({ message: `${name} needs a link.` });
				add(urlIssue(button.url, `${name} link`));
				return;
			}

			if (!button.custom_id.trim()) errors.push({ message: `${name} needs an ID.` });
			if (button.custom_id.length > messageLimits.customId) {
				errors.push({ message: `${name} ID is over ${messageLimits.customId} characters.` });
			}
		});
	});

	if (message.content.length > messageLimits.content) {
		errors.push({
			message: `Message content is over the ${messageLimits.content} character limit.`
		});
	}

	if (message.embeds.length > messageLimits.embeds) {
		errors.push({ message: `Discord allows at most ${messageLimits.embeds} embeds.` });
	}

	message.embeds.forEach((embed, index) => {
		const label = `Embed ${index + 1}`;

		if (embed.title.length > messageLimits.embedTitle) {
			errors.push({ message: `${label} title is over ${messageLimits.embedTitle} characters.` });
		}
		if (embed.description.length > messageLimits.embedDescription) {
			errors.push({
				message: `${label} description is over ${messageLimits.embedDescription} characters.`
			});
		}
		if (embed.author.name.length > messageLimits.authorName) {
			errors.push({
				message: `${label} author name is over ${messageLimits.authorName} characters.`
			});
		}
		if (embed.footer.text.length > messageLimits.footerText) {
			errors.push({
				message: `${label} footer text is over ${messageLimits.footerText} characters.`
			});
		}
		if (embed.fields.length > messageLimits.embedFields) {
			errors.push({ message: `${label} has more than ${messageLimits.embedFields} fields.` });
		}

		embed.fields.forEach((field, position) => {
			if (field.name.trim() && !field.value.trim()) {
				errors.push({ message: `${label} field ${position + 1} has a name but no value.` });
			}
			if (field.value.trim() && !field.name.trim()) {
				errors.push({ message: `${label} field ${position + 1} has a value but no name.` });
			}
			if (field.name.length > messageLimits.fieldName) {
				errors.push({
					message: `${label} field ${position + 1} name is over ${messageLimits.fieldName} characters.`
				});
			}
			if (field.value.length > messageLimits.fieldValue) {
				errors.push({
					message: `${label} field ${position + 1} value is over ${messageLimits.fieldValue} characters.`
				});
			}
		});

		add(urlIssue(embed.url, `${label} title URL`));
		add(urlIssue(embed.author.url, `${label} author URL`));
		add(urlIssue(embed.author.icon_url, `${label} author icon`));
		add(urlIssue(embed.footer.icon_url, `${label} footer icon`));
		add(urlIssue(embed.image.url, `${label} image`));
		add(urlIssue(embed.thumbnail.url, `${label} thumbnail`));
	});

	const embedTotal = message.embeds.reduce((total, embed) => total + embedLength(embed), 0);
	if (embedTotal > messageLimits.embedTotal) {
		errors.push({
			message: `Embeds are over the ${messageLimits.embedTotal} character total across the message.`
		});
	}

	message.components.forEach((component, index) => {
		if (component.type === ComponentType.ActionRow) return;

		const blocks = component.type === ComponentType.Container ? component.components : [component];
		const label =
			component.type === ComponentType.Container ? `Container ${index + 1}` : `Block ${index + 1}`;

		blocks.forEach((block) => {
			if (blockText(block).length > messageLimits.textDisplay) {
				errors.push({
					message: `${label} has a text block over ${messageLimits.textDisplay} characters.`
				});
			}
			if (block.type === ComponentType.MediaGallery) {
				block.items.forEach((item) => add(urlIssue(item.media.url, `${label} gallery image`)));
			}
			if (block.type === ComponentType.Section) {
				add(urlIssue(block.accessory.media.url, `${label} thumbnail`));
			}
		});
	});

	return errors;
}

function decodeShare(text: string): string | null {
	const trimmed = text.trim();
	if (!/^https?:\/\//i.test(trimmed)) return null;

	try {
		const url = new URL(trimmed);
		const data = url.searchParams.get('data');
		if (!data) return null;

		const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
		const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
		return atob(padded);
	} catch {
		return null;
	}
}

function unwrap(parsed: unknown): unknown {
	if (!parsed || typeof parsed !== 'object') return parsed;
	const record = parsed as Record<string, unknown>;

	if (Array.isArray(record.backups) && record.backups.length) {
		const backup = record.backups[0] as Record<string, unknown>;
		const nested = backup && typeof backup.data === 'object' ? backup.data : backup;
		return unwrap(nested);
	}

	if (Array.isArray(record.messages) && record.messages.length) {
		const first = record.messages[0] as Record<string, unknown>;
		return first && typeof first.data === 'object' ? first.data : first;
	}

	if (record.message && typeof record.message === 'object') {
		const message = record.message as Record<string, unknown>;
		return message.data && typeof message.data === 'object' ? message.data : message;
	}

	if (record.data && typeof record.data === 'object') return record.data;

	return parsed;
}

export function parseImport(
	input: string,
	kind: 'link' | 'json'
): { message: DiscordMessage } | { error: string } {
	const raw = input.trim();
	const link = /^https?:\/\//i.test(raw);

	if (!raw) {
		return {
			error: kind === 'link' ? 'Paste a share link first.' : 'Paste a message payload first.'
		};
	}

	if (kind === 'link' && !link) {
		return { error: 'That is not a link. Paste message JSON in the payload box instead.' };
	}

	if (kind === 'json' && link) {
		return { error: 'That is a link. Paste it in the share link box instead.' };
	}

	const shared = decodeShare(raw);
	if (kind === 'link' && shared === null) {
		return { error: 'That link carries no message data. Copy the share link from Discohook.' };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(shared ?? raw);
	} catch {
		return {
			error:
				kind === 'link'
					? 'That link could not be read. Use the JSON backup from Discohook instead.'
					: 'That is not valid JSON.'
		};
	}

	const data = unwrap(parsed);
	if (!data || typeof data !== 'object') {
		return { error: 'No message was found in that data.' };
	}

	const record = data as Record<string, unknown>;
	if (!('content' in record) && !('embeds' in record) && !('components' in record)) {
		return { error: 'That JSON does not look like a Discord message.' };
	}

	return { message: readMessage(record) };
}
