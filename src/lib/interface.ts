export interface FileNode {
	name: string;
	path: string;
	isDirectory: boolean;
	children?: FileNode[];
	expanded?: boolean;
}

export type SidebarPanel = 'files' | 'slides' | 'settings' | 'help';
