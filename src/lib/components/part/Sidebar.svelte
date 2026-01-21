<script lang="ts">
	import { Files, List, Settings, CircleQuestionMark, FolderOpen } from '@lucide/svelte';
	import FileTree from './FileTree.svelte';
	import type { FileNode } from '../../interface';
	import type { SidebarPanel } from '../../interface';

	export let activeSidebarPanel: SidebarPanel = 'files';
	export let workspacePath = '';
	export let currentFilePath: string | null = null;
	export let slides: string[] = [];
	export let selectedSlideIndex = 0;
	export let fileTree: FileNode[] = [];
	export let selectedFiles: Set<string> = new Set();
	export let autoSaveEnabled = true;
	export let notificationsEnabled = true;
	export let fontSize = 14;
	export let fontFamily = 'JetBrains Mono';
	export let systemFonts: string[] = [];

	export let onSelectPanel: (panel: SidebarPanel) => void;
	export let onSlideClick: (index: number) => void;
	export let onWorkspaceChange: () => void;
	export let onAutoSaveToggle: () => void;
	export let onNotificationsToggle: () => void;
	export let onFileClick: (event: MouseEvent, filePath: string) => void;
	export let onDirectoryToggle: (node: FileNode) => Promise<void>;
	export let onContextMenu: (
		event: MouseEvent,
		type: 'file' | 'directory' | 'empty',
		target?: FileNode
	) => void;
	export let onFontSizeChange: (size: number) => void;
	export let onFontFamilyChange: (family: string) => void;

	// 슬라이드 요소 참조
	let slideElements: HTMLButtonElement[] = [];

	// 선택된 슬라이드로 자동 스크롤
	$: if (slideElements[selectedSlideIndex]) {
		slideElements[selectedSlideIndex].scrollIntoView({
			behavior: 'smooth',
			block: 'nearest'
		});
	}
</script>

<div class="flex w-64 border-r border-border bg-muted/30">
	<!-- 사이드바 아이콘 탭 -->
	<div class="flex w-12 flex-col items-center gap-1 border-r border-border bg-muted/50 py-2">
		<!-- 상단 버튼들 -->
		<div class="flex flex-col gap-1">
			<button
				class="flex h-10 w-10 items-center justify-center rounded-md transition-colors {activeSidebarPanel ===
				'files'
					? 'bg-accent text-accent-foreground'
					: 'hover:bg-accent/50'}"
				on:click={() => onSelectPanel('files')}
				data-tooltip="파일 탐색기"
				data-tooltip-position="right"
			>
				<Files class="h-5 w-5" />
			</button>
			{#if currentFilePath}
				<button
					class="flex h-10 w-10 items-center justify-center rounded-md transition-colors {activeSidebarPanel ===
					'slides'
						? 'bg-accent text-accent-foreground'
						: 'hover:bg-accent/50'}"
					on:click={() => onSelectPanel('slides')}
					data-tooltip="슬라이드"
					data-tooltip-position="right"
				>
					<List class="h-5 w-5" />
				</button>
			{/if}
		</div>

		<!-- Spacer: 위 버튼과 아래 버튼 사이 공간 -->
		<div class="flex-1"></div>

		<!-- 하단 버튼들 -->
		<div class="flex flex-col gap-1">
			<button
				class="flex h-10 w-10 items-center justify-center rounded-md transition-colors {activeSidebarPanel ===
				'settings'
					? 'bg-accent text-accent-foreground'
					: 'hover:bg-accent/50'}"
				on:click={() => onSelectPanel('settings')}
				data-tooltip="설정"
				data-tooltip-position="right"
			>
				<Settings class="h-5 w-5" />
			</button>
			<button
				class="flex h-10 w-10 items-center justify-center rounded-md transition-colors {activeSidebarPanel ===
				'help'
					? 'bg-accent text-accent-foreground'
					: 'hover:bg-accent/50'}"
				on:click={() => onSelectPanel('help')}
				data-tooltip="도움말"
				data-tooltip-position="right"
			>
				<CircleQuestionMark class="h-5 w-5" />
			</button>
		</div>
	</div>

	<!-- 사이드바 컨텐츠 -->
	<div class="flex flex-1 flex-col overflow-hidden">
		{#if activeSidebarPanel === 'files'}
			<div class="flex items-center justify-between p-3">
				<h2 class="truncate text-lg font-semibold" title={workspacePath}>
					{workspacePath ? workspacePath.split('/').pop() : '파일 탐색기'}
				</h2>
				<button
					class="rounded p-1 transition-colors hover:bg-accent"
					on:click={onWorkspaceChange}
					data-tooltip="작업 디렉터리 변경"
				>
					<FolderOpen class="h-4 w-4" />
				</button>
			</div>
			<div class="flex-1 overflow-hidden">
				<FileTree
					{fileTree}
					{currentFilePath}
					{selectedFiles}
					{onFileClick}
					{onDirectoryToggle}
					{onContextMenu}
				/>
			</div>
		{:else if activeSidebarPanel === 'slides'}
			<div class="p-3">
				<h2
					class="mb-4 truncate text-lg font-semibold"
					title={currentFilePath ? currentFilePath.split('/').pop() : '슬라이드'}
				>
					{currentFilePath ? currentFilePath.split('/').pop() : '슬라이드'}
				</h2>
				<p class="text-sm text-muted-foreground">총 {slides.length}개</p>
			</div>
			<div class="flex-1 space-y-2 overflow-y-auto p-3">
				{#each slides as slide, index}
					<button
						bind:this={slideElements[index]}
						class="w-full rounded border border-border p-2 text-left transition-colors {selectedSlideIndex ===
						index
							? 'bg-primary text-primary-foreground'
							: 'hover:bg-accent'}"
						on:click={() => onSlideClick(index)}
					>
						<div class="mb-1 text-xs text-muted-foreground">슬라이드 {index + 1}</div>
						<div class="line-clamp-2 text-sm">{slide || '(비어있음)'}</div>
					</button>
				{/each}
			</div>
		{:else if activeSidebarPanel === 'settings'}
			<div class="p-3">
				<h2 class="mb-4 text-lg font-semibold">설정</h2>
			</div>
			<div class="flex-1 space-y-4 overflow-y-auto p-3">
				<div>
					<div class="mb-2 flex items-center justify-between">
						<label class="text-sm font-medium">작업 디렉터리</label>
						<button
							class="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
							on:click={onWorkspaceChange}
						>
							<FolderOpen class="inline-block h-4 w-4" />
						</button>
					</div>
					<input
						type="text"
						value={workspacePath}
						class="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
						readonly
					/>
				</div>
				<div>
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							checked={autoSaveEnabled}
							on:change={onAutoSaveToggle}
							class="h-4 w-4"
						/>
						<span class="text-sm">자동 저장</span>
					</label>
				</div>
				<div>
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							checked={notificationsEnabled}
							on:change={onNotificationsToggle}
							class="h-4 w-4"
						/>
						<span class="text-sm">알림</span>
					</label>
				</div>
				<div>
					<label class="mb-2 block text-sm font-medium">글꼴 크기</label>
					<input
						type="number"
						value={fontSize}
						on:input={(e) => onFontSizeChange(Number(e.currentTarget.value))}
						min="8"
						max="32"
						class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
					/>
				</div>
				<div>
					<label class="mb-2 block text-sm font-medium">글꼴</label>
					<select
						value={fontFamily}
						on:change={(e) => onFontFamilyChange(e.currentTarget.value)}
						class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
					>
						{#each systemFonts as font}
							<option value={font}>{font}</option>
						{/each}
					</select>
				</div>
			</div>
		{:else if activeSidebarPanel === 'help'}
			<div class="p-3">
				<h2 class="mb-4 text-lg font-semibold">도움말</h2>
			</div>
			<div class="flex-1 space-y-6 overflow-y-auto p-3">
				<div>
					<h3 class="mb-2 font-semibold">단축키</h3>
					<div class="space-y-1 text-xs text-muted-foreground">
						<div class="flex justify-between">
							<span>⌘/Ctrl + N</span>
							<span class="text-muted-foreground">새 파일</span>
						</div>
						<div class="flex justify-between">
							<span>⌘/Ctrl + S</span>
							<span class="text-muted-foreground">저장</span>
						</div>
						<div class="flex justify-between">
							<span>⌘/Ctrl + B</span>
							<span class="text-muted-foreground">굵게</span>
						</div>
						<div class="flex justify-between">
							<span>⌘/Ctrl + I</span>
							<span class="text-muted-foreground">기울임</span>
						</div>
						<div class="flex justify-between">
							<span>⌘/Ctrl + P</span>
							<span class="text-muted-foreground">미리보기</span>
						</div>
						<div class="flex justify-between">
							<span>F5</span>
							<span class="text-muted-foreground">슬라이드쇼</span>
						</div>
						<div class="flex justify-between">
							<span>ESC</span>
							<span class="text-muted-foreground">종료</span>
						</div>
					</div>
				</div>
				<div>
					<h3 class="mb-2 font-semibold">Markdown 문법</h3>
					<div class="space-y-1 text-xs text-muted-foreground">
						<p># 제목 (H1부터 H6까지)</p>
						<p>**굵게** 또는 __굵게__</p>
						<p>*기울임* 또는 _기울임_</p>
						<p>~~취소선~~</p>
						<p>--- (새 슬라이드)</p>
						<p>[링크](url)</p>
						<p>![이미지](url)</p>
					</div>
				</div>
				<div>
					<h3 class="mb-2 font-semibold">설정</h3>
					<div class="text-xs text-muted-foreground">
						<p class="mb-1">설정은 홈 디렉터리의 .mdslide_config.json 파일에 저장됩니다.</p>
						<p>워크스페이스 경로는 기본적으로 ~/mdslide입니다.</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
