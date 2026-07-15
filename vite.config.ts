import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// Tauri devUrl(http://localhost:5173)과 포트를 고정해 dev 앱이 항상 HMR 서버에 연결되도록 한다
	server: {
		port: 5173,
		strictPort: true
	}
});
