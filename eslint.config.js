import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			'no-undef': 'off',
			'no-empty': ['error', { allowEmptyCatch: true }]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		files: [
			'src/routes/[[]guildID[]]/server/+page.svelte',
			'src/lib/components/Markdown.svelte',
			'src/lib/components/discord/MessagePreview.svelte',
			'src/lib/components/panel/Docs.svelte',
			'src/lib/components/panel/Menu.svelte',
			'src/lib/components/panel/Moderations.svelte'
		],
		rules: { 'svelte/no-navigation-without-resolve': ['error', { ignoreLinks: true }] }
	},
	{
		rules: {}
	}
);
