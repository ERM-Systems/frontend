export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
	id: number;
	message: string;
	type: ToastType;
}

const defaultDuration = 4000;
let nextId = 0;

export const toasts = $state<Toast[]>([]);

export function dismiss(id: number) {
	const index = toasts.findIndex((toast) => toast.id === id);
	if (index !== -1) toasts.splice(index, 1);
}

export function toast(message: string, type: ToastType = 'info', duration = defaultDuration) {
	const id = nextId++;
	toasts.push({ id, message, type });
	setTimeout(() => dismiss(id), duration);
	return id;
}
