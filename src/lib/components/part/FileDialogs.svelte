<script lang="ts">
	export let showRenameDialog = false;
	export let showDeleteDialog = false;
	export let showNewFileDialog = false;
	export let showNewDirDialog = false;
	export let renameInputValue = '';
	export let newItemInputValue = '';
	export let deleteTargetName: string | null = null;
	export let selectedFilesCount = 0;
	export let confirmDeleteEnabled = true;
	export let dontAskAgainDelete = false;

	export let onRenameConfirm: () => void;
	export let onDeleteConfirm: () => void;
	export let onNewFileConfirm: () => void;
	export let onNewDirConfirm: () => void;
</script>

<!-- 이름 변경 다이얼로그 -->
{#if showRenameDialog}
	<div
		role="dialog"
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		on:click={() => (showRenameDialog = false)}
		on:keydown={(e) => {
			if (e.key === 'Escape') showRenameDialog = false;
		}}
	>
		<div
			role="document"
			class="w-[400px] rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
			on:click={(e) => e.stopPropagation()}
			on:keydown={(e) => e.stopPropagation()}
		>
			<h3 class="mb-4 text-lg font-semibold">이름 변경</h3>
			<input
				type="text"
				bind:value={renameInputValue}
				class="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
				placeholder="새 이름 입력"
				on:keydown={(e) => {
					if (e.key === 'Enter') onRenameConfirm();
				}}
			/>
			<div class="flex justify-end gap-2">
				<button
					class="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
					on:click={() => (showRenameDialog = false)}
				>
					취소
				</button>
				<button
					class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
					on:click={onRenameConfirm}
				>
					확인
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 삭제 확인 다이얼로그 -->
{#if showDeleteDialog}
	<div
		role="dialog"
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		on:click={() => (showDeleteDialog = false)}
		on:keydown={(e) => {
			if (e.key === 'Escape') showDeleteDialog = false;
		}}
	>
		<div
			role="document"
			class="w-[400px] rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
			on:click={(e) => e.stopPropagation()}
			on:keydown={(e) => e.stopPropagation()}
		>
			<h3 class="mb-4 text-lg font-semibold">삭제 확인</h3>
			<p class="mb-4">
				{#if deleteTargetName}
					정말로 <strong>{deleteTargetName}</strong>을(를) 삭제하시겠습니까?
				{:else if selectedFilesCount > 0}
					정말로 선택한 <strong>{selectedFilesCount}개의 파일</strong>을 삭제하시겠습니까?
				{/if}
			</p>
			<label class="mb-4 flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={dontAskAgainDelete} class="h-4 w-4" />
				<span>다음에는 물어보지 않기</span>
			</label>
			<div class="flex justify-end gap-2">
				<button
					class="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
					on:click={() => {
						showDeleteDialog = false;
						dontAskAgainDelete = false;
					}}
				>
					취소
				</button>
				<button
					class="inline-flex h-9 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
					on:click={onDeleteConfirm}
				>
					삭제
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 새 파일 추가 다이얼로그 -->
{#if showNewFileDialog}
	<div
		role="dialog"
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		on:click={() => (showNewFileDialog = false)}
		on:keydown={(e) => {
			if (e.key === 'Escape') showNewFileDialog = false;
		}}
	>
		<div
			role="document"
			class="w-[400px] rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
			on:click={(e) => e.stopPropagation()}
			on:keydown={(e) => e.stopPropagation()}
		>
			<h3 class="mb-4 text-lg font-semibold">새 파일 추가</h3>
			<input
				type="text"
				bind:value={newItemInputValue}
				class="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
				placeholder="파일 이름 입력"
				on:keydown={(e) => {
					if (e.key === 'Enter') onNewFileConfirm();
				}}
			/>
			<div class="flex justify-end gap-2">
				<button
					class="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
					on:click={() => (showNewFileDialog = false)}
				>
					취소
				</button>
				<button
					class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
					on:click={onNewFileConfirm}
				>
					추가
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 새 디렉터리 추가 다이얼로그 -->
{#if showNewDirDialog}
	<div
		role="dialog"
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		on:click={() => (showNewDirDialog = false)}
		on:keydown={(e) => {
			if (e.key === 'Escape') showNewDirDialog = false;
		}}
	>
		<div
			role="document"
			class="w-[400px] rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
			on:click={(e) => e.stopPropagation()}
			on:keydown={(e) => e.stopPropagation()}
		>
			<h3 class="mb-4 text-lg font-semibold">새 디렉터리 추가</h3>
			<input
				type="text"
				bind:value={newItemInputValue}
				class="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
				placeholder="디렉터리 이름 입력"
				on:keydown={(e) => {
					if (e.key === 'Enter') onNewDirConfirm();
				}}
			/>
			<div class="flex justify-end gap-2">
				<button
					class="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
					on:click={() => (showNewDirDialog = false)}
				>
					취소
				</button>
				<button
					class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
					on:click={onNewDirConfirm}
				>
					추가
				</button>
			</div>
		</div>
	</div>
{/if}
