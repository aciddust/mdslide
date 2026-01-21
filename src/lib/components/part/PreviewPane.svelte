<script lang="ts">
	export let markdownContent = '';
	export let slides: string[] = [];
	export let selectedSlideIndex = 0;
	export let renderMarkdown: (md: string) => string;
	export let onSlideClick: (index: number) => void;

	// 슬라이드 썸네일 요소 참조
	let thumbnailElements: HTMLButtonElement[] = [];

	// 선택된 슬라이드로 자동 스크롤 (썸네일)
	$: if (thumbnailElements[selectedSlideIndex]) {
		thumbnailElements[selectedSlideIndex].scrollIntoView({
			behavior: 'smooth',
			block: 'nearest',
			inline: 'center'
		});
	}

	// 현재 선택된 슬라이드 컨텐츠
	$: currentSlideContent = slides[selectedSlideIndex] || '';
</script>

<div class="flex h-full w-full flex-col bg-background">
	<!-- 슬라이드 네비게이션 -->
	<div class="flex-1 overflow-y-auto p-4">
		<div class="prose prose-slate max-w-none">
			{@html renderMarkdown(currentSlideContent)}
		</div>
	</div>

	<!-- 슬라이드 썸네일 -->
	{#if slides.length > 0}
		<div class="min-w-0 border-t border-border bg-muted/30 p-3">
			<div class="flex w-full gap-2 overflow-x-auto">
				{#each slides as slide, index}
					<button
						bind:this={thumbnailElements[index]}
						class="h-24 w-32 flex-shrink-0 overflow-hidden rounded-md border-2 transition-all {selectedSlideIndex ===
						index
							? 'border-primary ring-2 ring-primary/20'
							: 'border-border hover:border-primary/50'}"
						on:click={() => onSlideClick(index)}
					>
						<div class="flex h-full w-full flex-col overflow-hidden bg-white p-2">
							<div
								class="prose prose-slate max-w-none flex-1 overflow-hidden text-[0.5rem] leading-tight"
							>
								{@html renderMarkdown(slide)}
							</div>
							<div class="mt-1 text-center text-xs text-muted-foreground">{index + 1}</div>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
