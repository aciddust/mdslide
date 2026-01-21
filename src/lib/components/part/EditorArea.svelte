<script lang="ts">
	import { convertFileSrc } from '@tauri-apps/api/core';

	export let isImageFile = false;
	export let currentFilePath: string | null = null;
	export let markdownContent = '';
	export let fontSize = 14;
	export let fontFamily = 'JetBrains Mono';
	export let textareaElement: HTMLTextAreaElement | undefined = undefined;

	export let onInput: (event: Event) => void;
	export let onCursorMove: () => void;
	export let onPaste: (event: ClipboardEvent) => void;
	export let onNewFile: () => void;
	export let onEditorContextMenu: (event: MouseEvent) => void;
</script>

<div class="flex-1 p-4">
	{#if currentFilePath}
		{#if isImageFile}
			<!-- 이미지 뷰어 -->
			<div
				class="flex h-full w-full items-center justify-center overflow-auto rounded-md border border-border bg-background"
			>
				<img
					src={convertFileSrc(currentFilePath)}
					alt={currentFilePath.split('/').pop()}
					class="max-h-full max-w-full object-contain"
					style="image-rendering: auto;"
				/>
			</div>
		{:else}
			<!-- 마크다운 편집기 -->
			<textarea
				bind:this={textareaElement}
				class="h-full w-full resize-none rounded-md border border-border bg-background p-4 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
				style="font-family: {fontFamily}, monospace; font-size: {fontSize}px;"
				value={markdownContent}
				on:input={onInput}
				on:click={onCursorMove}
				on:keyup={onCursorMove}
				on:paste={onPaste}
				on:contextmenu={onEditorContextMenu}
				placeholder="마크다운 문서를 작성해볼까요?&#13;&#10;&#13;&#10;--- 를 입력하고 개행하면 새 슬라이드가 추가됩니다.&#13;&#10;&#13;&#10;⌘/Ctrl + N: 새 파일&#13;&#10;⌘/Ctrl + S: 저장&#13;&#10;⌘/Ctrl + P: 미리보기 토글&#13;&#10;F5: 슬라이드쇼 시작&#13;&#10;&#13;&#10;⌘/Ctrl + B: 굵게&#13;&#10;⌘/Ctrl + I: 기울임&#13;&#10;⌘/Ctrl + I: 기울임&#13;&#10;⌘/Ctrl + ⇧ + X: 취소선"
				spellcheck="false"
			></textarea>
		{/if}
	{:else}
		<div class="flex h-full w-full flex-col items-center justify-center text-center">
			<div class="max-w-md space-y-4">
				<svg
					class="mx-auto h-16 w-16 text-muted-foreground/30"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				<h2 class="text-2xl font-semibold text-foreground">마크다운 슬라이드 편집기</h2>
				<p class="text-muted-foreground">
					왼쪽 파일 탐색기에서 파일을 선택하거나<br />
					새 파일을 생성하여 시작하세요.
				</p>
				<button
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium whitespace-nowrap text-primary-foreground shadow-md ring-offset-background transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
					on:click={onNewFile}
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
					새 파일 만들기
				</button>
				<p class="text-xs text-muted-foreground">
					단축키: <kbd class="rounded bg-muted px-2 py-1 text-xs">⌘N</kbd>
				</p>
			</div>
		</div>
	{/if}
</div>
