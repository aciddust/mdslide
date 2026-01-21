<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from '$lib/components/ui/sonner/index.js';

	let { children } = $props();

	// 브라우저 기본 컨텍스트 메뉴 비활성화 (전체 영역)
	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
	}
</script>

<svelte:window on:contextmenu={handleContextMenu} />

<Toaster position="top-right" />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
