/// <reference types="@sveltejs/enhanced-img" />
declare global {
	namespace App {
		interface Locals {
			token: string | null;
			terminated: boolean;
			session: Promise<import('$lib/server/session').SessionUser | null>;
		}
	}

	interface Window {
		umami?: {
			track: (props: (data: Record<string, unknown>) => Record<string, unknown>) => void;
		};
	}
}

export {};
