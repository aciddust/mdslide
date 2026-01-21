<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { toast } from 'svelte-sonner';
	import { getCurrentWindow } from '@tauri-apps/api/window';

	import Tauri from '@/components/screen/tauri.svelte';

	let inputName = '';
	let isTauri = false;
	let appVersion = '';
	let greeting = '';

	onMount(async () => {
		// Tauri 환경인지 확인
		try {
			const window = await getCurrentWindow();
			isTauri = window !== undefined;
			if (isTauri) {
				appVersion = await invoke('get_app_version');
			}
		} catch (error) {
			toast.error('Not running in Tauri environment');
			isTauri = false;
		}
	});

	async function greetUser() {
		// 데이터 교환을 위해 Tauri 백엔드 호출하려면 이 기능을 참조해주세요
		if (!isTauri) {
			greeting = 'This feature only works in Tauri app!';
			return;
		}

		try {
			greeting = await invoke('greet', { name: inputName });
		} catch (error) {
			console.error('Error calling greet:', error);
			greeting = 'Error occurred while greeting!';
		}
	}

	async function minimizeWindow() {
		// Tauri 환경에서 창 최소화
		if (isTauri) {
			try {
				const window = await getCurrentWindow();
				window.minimize();
				toast.info('Window minimized');
			} catch (error) {
				console.error('Error minimizing window:', error);
				toast.error('Error minimizing window');
			}
		}
	}

	async function closeWindow() {
		if (isTauri) {
			try {
				const window = getCurrentWindow();
				await window.close();
			} catch (error) {
				console.error('Error closing window:', error);
				toast.error('Window cannot be closed');
			}
		}
	}
</script>

{#if isTauri}
	<Tauri />
{:else}
	<!-- 웹 페이지로 서빙하려면 여기에 내용을 추가하세요 -->
{/if}
