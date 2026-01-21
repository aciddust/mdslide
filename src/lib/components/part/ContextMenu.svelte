<script lang="ts">
	export let x: number;
	export let y: number;
	export let type: 'file' | 'directory' | 'empty' | 'multiple-files' | 'editor';
	export let selectedFilesCount: number = 0;
	export let onRename: () => void;
	export let onDelete: () => void;
	export let onNewFile: () => void;
	export let onNewDirectory: () => void;
	export let onCopy: () => void = () => {};
	export let onCut: () => void = () => {};
	export let onPaste: () => void = () => {};
	export let onClose: () => void;
</script>

<div
	role="menu"
	class="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-lg"
	style="left: {x}px; top: {y}px;"
	on:click={(e) => e.stopPropagation()}
	on:keydown={(e) => {
		if (e.key === 'Escape') onClose();
	}}
>
	{#if type === 'directory'}
		<button
			class="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-accent"
			on:click={onRename}
		>
			이름 변경
		</button>
		<button
			class="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-accent"
			on:click={onNewFile}
		>
			파일 추가
		</button>
		<button
			class="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-accent"
			on:click={onNewDirectory}
		>
			디렉터리 추가
		</button>
		<button
			class="w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-accent dark:text-red-400"
			on:click={onDelete}
		>
			삭제
		</button>
	{:else if type === 'multiple-files'}
		<button
			class="w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-accent dark:text-red-400"
			on:click={onDelete}
		>
			삭제 ({selectedFilesCount}개)
		</button>
	{:else if type === 'file'}
		<button
			class="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-accent"
			on:click={onRename}
		>
			이름 변경
		</button>
		<button
			class="w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-accent dark:text-red-400"
			on:click={onDelete}
		>
			삭제
		</button>
	{:else if type === 'empty'}
		<button
			class="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-accent"
			on:click={onNewFile}
		>
			파일 추가
		</button>
		<button
			class="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-accent"
			on:click={onNewDirectory}
		>
			디렉터리 추가
		</button>
	{:else if type === 'editor'}
		<button
			class="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-accent"
			on:click={onCopy}
		>
			복사 (Ctrl+C)
		</button>
		<button
			class="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-accent"
			on:click={onCut}
		>
			잘라내기 (Ctrl+X)
		</button>
		<button
			class="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-accent"
			on:click={onPaste}
		>
			붙여넣기 (Ctrl+V)
		</button>
	{/if}
</div>
