<script lang="ts">
	export let slides: string[] = [];
	export let selectedSlideIndex = 0;
	export let renderMarkdown: (md: string) => string;
	export let onClose: () => void;
	export let onPrevSlide: () => void;
	export let onNextSlide: () => void;
</script>

<div class="fixed inset-0 z-50 flex flex-col bg-black">
	<!-- 슬라이드쇼 컨트롤 바 -->
	<div class="absolute top-4 right-4 z-10 flex gap-2">
		<div class="rounded-md bg-black/50 px-3 py-2 text-sm text-white">
			{selectedSlideIndex + 1} / {slides.length}
		</div>
		<button
			class="rounded-md bg-black/50 px-3 py-2 text-sm text-white transition-colors hover:bg-black/70"
			on:click={onClose}
		>
			종료 (ESC)
		</button>
	</div>

	<!-- 슬라이드 네비게이션 버튼 -->
	{#if selectedSlideIndex > 0}
		<button
			aria-label="이전 슬라이드"
			class="absolute top-1/2 left-4 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition-colors hover:bg-black/70"
			on:click={onPrevSlide}
		>
			<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
		</button>
	{/if}

	{#if selectedSlideIndex < slides.length - 1}
		<button
			aria-label="다음 슬라이드"
			class="absolute top-1/2 right-4 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition-colors hover:bg-black/70"
			on:click={onNextSlide}
		>
			<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>
		</button>
	{/if}

	<!-- 슬라이드 컨텐츠 -->
	<div class="flex flex-1 items-center justify-center p-8">
		<div
			class="max-h-[85vh] w-full max-w-[1400px] overflow-y-auto rounded-lg bg-white px-20 py-16 shadow-2xl"
			style="font-size: clamp(16px, 1.4vw, 24px); line-height: 1.8;"
		>
			<div class="prose prose-slate prose-2xl max-w-none" style="max-width: 100%;">
				{@html renderMarkdown(slides[selectedSlideIndex] || '')}
			</div>
		</div>
	</div>
</div>
