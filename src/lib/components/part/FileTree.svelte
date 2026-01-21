<script lang="ts">
	import { ChevronRight, ChevronDown, File } from '@lucide/svelte';
	import type { FileNode } from '../../interface';

	export let fileTree: FileNode[] = [];
	export let currentFilePath: string | null = null;
	export let selectedFiles: Set<string> = new Set();
	export let onFileClick: (event: MouseEvent, filePath: string) => void;
	export let onDirectoryToggle: (node: FileNode) => Promise<void>;
	export let onContextMenu: (
		event: MouseEvent,
		type: 'file' | 'directory' | 'empty',
		target?: FileNode
	) => void;
</script>

{#snippet FileTreeNode({
	node,
	toggleDirectory,
	openFile,
	depth = 0
}: {
	node: FileNode;
	toggleDirectory: (node: FileNode) => Promise<void>;
	openFile: (event: MouseEvent, path: string) => void;
	depth?: number;
})}
	<div style="padding-left: {depth * 0.75}rem;">
		{#if node.isDirectory}
			<button
				class="flex w-full items-center gap-1 rounded px-2 py-1 text-sm transition-colors hover:bg-accent"
				on:click={() => toggleDirectory(node)}
				on:contextmenu={(e) => {
					e.stopPropagation();
					onContextMenu(e, 'directory', node);
				}}
			>
				{#if node.expanded}
					<ChevronDown class="h-3 w-3 flex-shrink-0" />
				{:else}
					<ChevronRight class="h-3 w-3 flex-shrink-0" />
				{/if}
				<span class="truncate">{node.name}</span>
			</button>
			{#if node.expanded && node.children}
				{#each node.children as child}
					{@render FileTreeNode({ node: child, toggleDirectory, openFile, depth: depth + 1 })}
				{/each}
			{/if}
		{:else}
			<button
				class="flex w-full items-center gap-1 rounded px-2 py-1 text-sm transition-colors {selectedFiles.has(
					node.path
				)
					? 'bg-accent text-accent-foreground'
					: currentFilePath === node.path
						? 'bg-primary text-primary-foreground'
						: 'hover:bg-accent'}"
				on:click={(e) => openFile(e, node.path)}
				on:contextmenu={(e) => {
					e.stopPropagation();
					onContextMenu(e, 'file', node);
				}}
			>
				<File class="ml-4 h-3 w-3 flex-shrink-0" />
				<span class="truncate">{node.name}</span>
			</button>
		{/if}
	</div>
{/snippet}

<div
	class="h-full overflow-y-auto"
	on:contextmenu={(e) => {
		e.preventDefault();
		onContextMenu(e, 'empty');
	}}
>
	{#each fileTree as node}
		{@render FileTreeNode({ node, toggleDirectory: onDirectoryToggle, openFile: onFileClick })}
	{/each}
</div>
