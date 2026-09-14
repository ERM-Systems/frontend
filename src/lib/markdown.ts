export interface TextSpan {
	kind: 'text' | 'bold' | 'italic' | 'code' | 'strike';
	text: string;
}

export interface LinkSpan {
	kind: 'link';
	text: string;
	href: string;
}

export interface ImageSpan {
	kind: 'image';
	alt: string;
	src: string;
}

export type Span = TextSpan | LinkSpan | ImageSpan;

export interface ListItem {
	spans: Span[];
	list: ListBlock | null;
}

export interface ListBlock {
	kind: 'list';
	ordered: boolean;
	items: ListItem[];
}

export type Block =
	| { kind: 'heading'; level: number; spans: Span[] }
	| { kind: 'paragraph'; spans: Span[] }
	| { kind: 'quote'; spans: Span[] }
	| ListBlock
	| { kind: 'code'; text: string }
	| { kind: 'rule' };

const inline =
	/(\*\*|__)(.+?)\1|([*_])(.+?)\3|~~(.+?)~~|`([^`]+)`|\[([^\]]+)]\(([^)\s]+)\)|!\[([^\]]*)]\(([^)\s]+)\)/;

function href(raw: string): string {
	try {
		const url = new URL(raw);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
	} catch {
		return '';
	}
}

export function spans(source: string): Span[] {
	const parts: Span[] = [];
	let rest = source;

	while (rest) {
		const match = inline.exec(rest);
		if (!match) break;

		if (match.index) parts.push({ kind: 'text', text: rest.slice(0, match.index) });

		if (match[2] !== undefined) parts.push({ kind: 'bold', text: match[2] });
		else if (match[4] !== undefined) parts.push({ kind: 'italic', text: match[4] });
		else if (match[5] !== undefined) parts.push({ kind: 'strike', text: match[5] });
		else if (match[6] !== undefined) parts.push({ kind: 'code', text: match[6] });
		else if (match[9] !== undefined) {
			const src = href(match[10] ?? '');
			if (src) parts.push({ kind: 'image', alt: match[9], src });
			else parts.push({ kind: 'text', text: match[0] });
		} else {
			const link = href(match[8] ?? '');
			if (link) parts.push({ kind: 'link', text: match[7], href: link });
			else parts.push({ kind: 'text', text: match[0] });
		}

		rest = rest.slice(match.index + match[0].length);
	}

	if (rest) parts.push({ kind: 'text', text: rest });
	return parts;
}

export function markdown(source: string): Block[] {
	const blocks: Block[] = [];
	const lines = source.replace(/\r\n?/g, '\n').split('\n');
	let paragraph: string[] = [];
	let stack: { indent: number; list: ListBlock }[] = [];

	const flush = () => {
		if (!paragraph.length) return;
		blocks.push({ kind: 'paragraph', spans: spans(paragraph.join(' ')) });
		paragraph = [];
	};

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index].replace(/\t/g, '    ');
		const trimmed = line.trim();

		if (!trimmed) {
			flush();
			continue;
		}

		const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
		const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);

		if (bullet || numbered) {
			flush();

			const ordered = !bullet;
			const indent = line.length - line.trimStart().length;
			const item: ListItem = { spans: spans((bullet ?? numbered)![1]), list: null };

			while (stack.length && indent < stack[stack.length - 1].indent) stack.pop();

			const top = stack[stack.length - 1];

			if (top && indent > top.indent) {
				const nested: ListBlock = { kind: 'list', ordered, items: [item] };

				top.list.items[top.list.items.length - 1].list = nested;
				stack.push({ indent, list: nested });
				continue;
			}

			if (top && top.list.ordered === ordered) {
				top.list.items.push(item);
				continue;
			}

			const list: ListBlock = { kind: 'list', ordered, items: [item] };

			blocks.push(list);
			stack = [{ indent, list }];
			continue;
		}

		stack = [];

		if (trimmed.startsWith('```')) {
			flush();
			const body: string[] = [];
			index += 1;
			while (index < lines.length && !lines[index].trim().startsWith('```')) {
				body.push(lines[index]);
				index += 1;
			}
			blocks.push({ kind: 'code', text: body.join('\n') });
			continue;
		}

		if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
			flush();
			blocks.push({ kind: 'rule' });
			continue;
		}

		const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
		if (heading) {
			flush();
			blocks.push({ kind: 'heading', level: heading[1].length, spans: spans(heading[2]) });
			continue;
		}

		if (trimmed.startsWith('> ')) {
			flush();
			blocks.push({ kind: 'quote', spans: spans(trimmed.slice(2)) });
			continue;
		}

		paragraph.push(trimmed);
	}

	flush();
	return blocks;
}
