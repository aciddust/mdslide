<script lang="ts">
	import {
		Bold,
		Italic,
		Strikethrough,
		Table,
		Image,
		Heading1,
		Heading2,
		Heading3,
		Heading4,
		Save,
		FileDown,
		Plus
	} from '@lucide/svelte';

	export let showTableGrid = false;
	export let tableRows = 0;
	export let tableCols = 0;
	export let maxTableSize = 10;
	export let showPreview = false;
	export let hasSlides = true;

	export let onBold: () => void;
	export let onItalic: () => void;
	export let onStrikethrough: () => void;
	export let onHeading: (level: 1 | 2 | 3 | 4) => void;
	export let onTableToggle: () => void;
	export let onTableGridClick: () => void;
	export let onTableGridHover: (rows: number, cols: number) => void;
	export let onImageInsert: () => void;
	export let onSave: () => void;
	export let onExportPdf: () => void;
	export let onSlideshowToggle: () => void;
	export let onPreviewToggle: () => void;
	export let onAddSlide: () => void;

	function handleKeydown(event: KeyboardEvent) {
		if (showTableGrid && event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			onTableToggle();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex items-center gap-1 border-b border-border bg-muted/20 p-2">
	<button
		class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
		on:click={onBold}
		data-tooltip="굵게 (⌘B)"
	>
		<Bold class="h-4 w-4" />
	</button>
	<button
		class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
		on:click={onItalic}
		data-tooltip="기울임 (⌘I)"
	>
		<Italic class="h-4 w-4" />
	</button>
	<button
		class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
		on:click={onStrikethrough}
		data-tooltip="취소선 (⌘⇧X)"
	>
		<Strikethrough class="h-4 w-4" />
	</button>
	<div class="mx-1 h-6 w-px bg-border"></div>
	<button
		class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
		on:click={() => onHeading(1)}
		data-tooltip="제목 1 (⌘1)"
	>
		<Heading1 class="h-4 w-4" />
	</button>
	<button
		class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
		on:click={() => onHeading(2)}
		data-tooltip="제목 2 (⌘2)"
	>
		<Heading2 class="h-4 w-4" />
	</button>
	<button
		class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
		on:click={() => onHeading(3)}
		data-tooltip="제목 3 (⌘3)"
	>
		<Heading3 class="h-4 w-4" />
	</button>
	<button
		class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
		on:click={() => onHeading(4)}
		data-tooltip="제목 4 (⌘4)"
	>
		<Heading4 class="h-4 w-4" />
	</button>
	<div class="mx-1 h-6 w-px bg-border"></div>
	<button
		class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
		on:click={onImageInsert}
		data-tooltip="이미지 삽입"
	>
		<Image class="h-4 w-4" />
	</button>
	<button
		class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
		on:click={onAddSlide}
		data-tooltip="슬라이드 추가 (⌘↵)"
	>
		<Plus class="h-4 w-4" />
	</button>
	<div class="mx-1 h-6 w-px bg-border"></div>
	<div class="relative">
		<button
			class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground {showTableGrid
				? 'bg-accent'
				: ''}"
			on:click={onTableToggle}
			data-tooltip="테이블 삽입"
		>
			<Table class="h-4 w-4" />
		</button>
		{#if showTableGrid}
			<!-- Backdrop -->
			<div
				class="fixed inset-0 z-40"
				on:click={onTableToggle}
				role="button"
				tabindex="-1"
				on:keydown={() => {}}
				aria-label="닫기"
			></div>

			<div
				class="absolute top-full left-0 z-50 mt-2 rounded-md border border-border bg-popover p-3 shadow-lg"
			>
				<div class="mb-2 text-center text-xs text-muted-foreground">
					{tableRows} x {tableCols}
				</div>
				<div class="grid gap-1" style="grid-template-columns: repeat({maxTableSize}, 1fr);">
					{#each Array(maxTableSize) as _, row}
						{#each Array(maxTableSize) as _, col}
							<div
								class="h-4 w-4 cursor-pointer border border-border transition-colors {row <
									tableRows && col < tableCols
									? 'bg-primary'
									: 'bg-background hover:bg-muted'}"
								on:mouseenter={() => onTableGridHover(row + 1, col + 1)}
								on:click={onTableGridClick}
								role="button"
								tabindex="0"
							></div>
						{/each}
					{/each}
				</div>
			</div>
		{/if}
	</div>
	<div class="flex-1"></div>
	<div class="mx-1 h-6 w-px bg-border"></div>
	<button
		class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
		on:click={onSave}
		data-tooltip="저장 (⌘S)"
		data-tooltip-position="left"
	>
		<Save class="h-4 w-4" />
	</button>
	<!-- <button
		class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors h-8 w-8 hover:bg-accent hover:text-accent-foreground"
		on:click={onExportPdf}
		data-tooltip="PDF 내보내기"
		data-tooltip-position="left"
	>
		<FileDown class="w-4 h-4" />
	</button> -->
	<button
		class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors {hasSlides
			? 'hover:bg-accent hover:text-accent-foreground'
			: 'cursor-not-allowed opacity-50'}"
		on:click={hasSlides ? onSlideshowToggle : undefined}
		disabled={!hasSlides}
		data-tooltip="슬라이드쇼 (F5)"
		data-tooltip-position="left"
	>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
			/>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
	</button>
	<button
		class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors {showPreview
			? 'bg-accent'
			: ''} {hasSlides
			? 'hover:bg-accent hover:text-accent-foreground'
			: 'cursor-not-allowed opacity-50'}"
		on:click={hasSlides ? onPreviewToggle : undefined}
		disabled={!hasSlides}
		data-tooltip="미리보기 (⌘P)"
		data-tooltip-position="left"
	>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
			/>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
			/>
		</svg>
	</button>
</div>
