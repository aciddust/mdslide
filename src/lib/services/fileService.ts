import {
	readDir,
	readTextFile,
	writeTextFile,
	readFile,
	mkdir,
	exists
} from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

export interface FileNode {
	name: string;
	path: string;
	isDirectory: boolean;
	children?: FileNode[];
	expanded?: boolean;
}

/**
 * 디렉터리 트리 구조 생성
 */
export async function buildFileTree(dirPath: string): Promise<FileNode[]> {
	try {
		console.log('디렉터리 읽기 시도:', dirPath);
		const entries = await readDir(dirPath);
		console.log('읽은 항목 수:', entries.length);
		const nodes: FileNode[] = [];

		for (const entry of entries) {
			// 경로 정규화 - 이중 슬래시 방지
			const fullPath = dirPath.endsWith('/')
				? `${dirPath}${entry.name}`
				: `${dirPath}/${entry.name}`;
			const node: FileNode = {
				name: entry.name,
				path: fullPath,
				isDirectory: entry.isDirectory,
				expanded: false
			};

			const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.apng', '.bmp', '.webp', '.svg'];
			const isImageFile = imageExtensions.some((ext) => entry.name.toLowerCase().endsWith(ext));

			// .md 파일, 이미지 파일, 디렉터리만 표시
			if (entry.isDirectory || entry.name.endsWith('.md') || isImageFile) {
				nodes.push(node);
			}
		}

		console.log('필터링된 항목 수:', nodes.length);
		// 디렉터리 먼저, 파일 나중에, 각각 알파벳 순
		return nodes.sort((a, b) => {
			if (a.isDirectory && !b.isDirectory) return -1;
			if (!a.isDirectory && b.isDirectory) return 1;
			return a.name.localeCompare(b.name);
		});
	} catch (error) {
		console.error('디렉터리 읽기 오류:', dirPath, error);
		return [];
	}
}

/**
 * 파일 열기
 */
export async function openFile(filePath: string): Promise<{ content: string; isImage: boolean }> {
	const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.apng', '.bmp', '.webp', '.svg'];
	const isImageFile = imageExtensions.some((ext) => filePath.toLowerCase().endsWith(ext));

	if (isImageFile) {
		return { content: '', isImage: true };
	}

	const content = await readTextFile(filePath);
	return { content, isImage: false };
}

/**
 * 파일 저장
 */
export async function saveFile(filePath: string, content: string): Promise<void> {
	await writeTextFile(filePath, content);
}

/**
 * 클립보드 이미지 또는 파일에서 이미지 저장
 */
export async function saveClipboardImage(
	currentFilePath: string,
	imageDataOrPath: number[] | string,
	extension: string = 'png'
): Promise<string> {
	const imageName = generateRandomString();

	let imageData: number[];
	let finalExtension = extension;

	if (typeof imageDataOrPath === 'string') {
		// 이미지 파일 경로인 경우 - 원본 확장자 추출
		const pathParts = imageDataOrPath.split('.');
		if (pathParts.length > 1) {
			finalExtension = pathParts[pathParts.length - 1].toLowerCase();
		}
		const fileData = await readFile(imageDataOrPath);
		imageData = Array.from(fileData);
	} else {
		// 이미 Array<number> 형태인 경우 (클립보드)
		imageData = imageDataOrPath;
	}

	return await invoke<string>('save_clipboard_image', {
		filePath: currentFilePath,
		imageName: imageName,
		imageData: imageData,
		extension: finalExtension
	});
}

/**
 * 워크스페이스 디렉터리 선택 다이얼로그
 */
export async function selectWorkspaceDirectory(): Promise<string | null> {
	const selected = await open({
		directory: true,
		multiple: false,
		title: '워크스페이스 선택'
	});
	return selected as string | null;
}

/**
 * 이미지 파일 선택 다이얼로그
 */
export async function selectImageFile(): Promise<string | null> {
	const selected = await open({
		multiple: false,
		filters: [
			{
				name: 'Images',
				extensions: ['jpg', 'jpeg', 'png', 'gif', 'apng', 'bmp', 'webp', 'svg']
			}
		]
	});
	return selected as string | null;
}

/**
 * PDF 파일 저장 다이얼로그
 */
export async function savePdfFile(defaultName: string): Promise<string | null> {
	return (await save({
		defaultPath: defaultName,
		filters: [
			{
				name: 'PDF',
				extensions: ['pdf']
			}
		]
	})) as string | null;
}

/**
 * 파일 삭제
 */
export async function deleteFile(path: string): Promise<void> {
	await invoke('delete_file', { path });
}

/**
 * 파일 이름 변경
 */
export async function renameFile(oldPath: string, newName: string): Promise<string> {
	const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
	const newPath = `${parentPath}/${newName}`;
	await invoke('rename_file', { oldPath, newPath });
	return newPath;
}

/**
 * 디렉터리 생성
 */
export async function createDirectory(path: string): Promise<void> {
	await invoke('create_directory', { path });
}

/**
 * 디렉터리 확인 및 생성
 */
export async function ensureDirectory(path: string): Promise<void> {
	const dirExists = await exists(path);
	if (!dirExists) {
		await mkdir(path, { recursive: true });
	}
}

/**
 * 랜덤 문자열 생성 (이미지 파일명용)
 */
export function generateRandomString(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < 12; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

/**
 * 파일 트리에서 파일 경로 목록 추출 (재귀)
 */
export function getFlatFileList(nodes: FileNode[], result: string[] = []): string[] {
	for (const node of nodes) {
		if (!node.isDirectory) {
			result.push(node.path);
		}
		if (node.children) {
			getFlatFileList(node.children, result);
		}
	}
	return result;
}

/**
 * 확장된 경로 추출
 */
export function getExpandedPaths(nodes: FileNode[]): Set<string> {
	const expandedPaths = new Set<string>();

	function traverse(nodeList: FileNode[]) {
		for (const node of nodeList) {
			if (node.isDirectory && node.expanded) {
				expandedPaths.add(node.path);
				if (node.children) {
					traverse(node.children);
				}
			}
		}
	}

	traverse(nodes);
	return expandedPaths;
}

/**
 * 확장된 상태 복원
 */
export async function restoreExpandedState(
	nodes: FileNode[],
	expandedPaths: Set<string>
): Promise<FileNode[]> {
	for (const node of nodes) {
		if (node.isDirectory && expandedPaths.has(node.path)) {
			node.expanded = true;
			node.children = await buildFileTree(node.path);
			if (node.children) {
				await restoreExpandedState(node.children, expandedPaths);
			}
		}
	}
	return nodes;
}
