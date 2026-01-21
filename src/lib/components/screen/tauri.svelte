<script lang="ts">
	import { onMount } from 'svelte';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { toast } from 'svelte-sonner';
	import { homeDir } from '@tauri-apps/api/path';
	import { writeFile } from '@tauri-apps/plugin-fs';

	// 서비스 import
	import * as fileService from '$lib/services/fileService';
	import * as markdownService from '$lib/services/markdownService';
	import * as configService from '$lib/services/configService';
	import * as utils from '$lib/services/utils';
	import type { FileNode } from '$lib/services/fileService';
	import type { AppConfig } from '$lib/services/configService';

	// 컴포넌트 import
	import FileTree from '../part/FileTree.svelte';
	import ContextMenu from '../part/ContextMenu.svelte';
	import FileDialogs from '../part/FileDialogs.svelte';
	import EditorToolbar from '../part/EditorToolbar.svelte';
	import EditorArea from '../part/EditorArea.svelte';
	import Sidebar from '../part/Sidebar.svelte';
	import SlideshowMode from '../part/SlideshowMode.svelte';
	import PreviewPane from '../part/PreviewPane.svelte';

	// 타입 정의
	type SidebarPanel = 'files' | 'slides' | 'settings' | 'help';

	// 마크다운 문서 상태
	let markdownContent = ``;

	// 현재 선택된 슬라이드 인덱스
	let selectedSlideIndex = 0;

	// 미리보기 표시 상태
	let showPreview = false;

	// 현재 파일이 이미지인지 여부
	let isImageFile = false;

	// 슬라이드쇼 모드 상태
	let isPresentationMode = false;

	// textarea 참조
	let textareaElement: HTMLTextAreaElement;

	// 테이블 그리드 선택 UI 상태
	let showTableGrid = false;
	let tableRows = 0;
	let tableCols = 0;
	const maxTableSize = 10;

	// 사이드바 패널 상태
	let activeSidebarPanel: SidebarPanel = 'files';

	// 설정 상태
	let workspacePath = '';
	let autoSaveEnabled = true;
	let fontSize = 14;
	let fontFamily = 'JetBrains Mono';
	let systemFonts: string[] = [];
	let configLoaded = false;
	let confirmDelete = true;
	let notificationsEnabled = true;

	// 파일 탐색기 상태
	let fileTree: FileNode[] = [];
	let currentFilePath: string | null = '';
	let isSaving = false;
	let isModified = false; // 파일 변경 상태
	let originalContent = ''; // 원본 파일 내용

	// 파일 다중 선택 상태
	let selectedFiles = new Set<string>();
	let lastClickedFile: string | null = null;

	// 컨텍스트 메뉴 상태
	let contextMenu: {
		x: number;
		y: number;
		type: 'file' | 'directory' | 'empty' | 'multiple-files' | 'editor';
		target?: FileNode;
	} | null = null;

	// 다이얼로그 상태
	let showRenameDialog = false;
	let showDeleteDialog = false;
	let showNewFileDialog = false;
	let showNewDirDialog = false;
	let renameInputValue = '';
	let newItemInputValue = '';
	let deleteTarget: FileNode | null = null;
	let renameTarget: FileNode | null = null;
	let targetDirectory: FileNode | null = null; // 파일/디렉터리 추가 시 대상 디렉터리
	let dontAskAgainDelete = false;

	// 자동저장 타이머
	let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

	// Toast 헬퍼 함수들 (알림 설정 체크)
	function showToast(type: 'success' | 'error' | 'info' | 'warning', message: string) {
		if (notificationsEnabled) {
			toast[type](message);
		}
	}

	function showSuccess(message: string) {
		showToast('success', message);
	}
	function showError(message: string) {
		showToast('error', message);
	}
	function showInfo(message: string) {
		showToast('info', message);
	}
	function showWarning(message: string) {
		showToast('warning', message);
	}

	// 마크다운을 슬라이드 배열로 분리
	$: slides =
		currentFilePath && markdownContent ? markdownService.splitIntoSlides(markdownContent) : [];

	// markdownContent 변경 시 자동저장 (debounce)
	$: if (autoSaveEnabled && currentFilePath && markdownContent) {
		if (autoSaveTimer) {
			clearTimeout(autoSaveTimer);
		}
		autoSaveTimer = setTimeout(() => {
			saveFile();
		}, 500); // 500ms 후에 저장
	}

	// 파일 변경 상태 확인 (자동저장 비활성화 시만)
	$: if (!autoSaveEnabled && currentFilePath && !isImageFile) {
		isModified = markdownContent !== originalContent;
	}

	// 미리보기 토글
	function togglePreview() {
		showPreview = !showPreview;
	}

	// 슬라이드쇼 토글
	function togglePresentation() {
		isPresentationMode = !isPresentationMode;
	}

	// 이전 슬라이드로 이동
	function previousSlide() {
		if (selectedSlideIndex > 0) {
			selectedSlideIndex--;
		}
	}

	// 다음 슬라이드로 이동
	function nextSlide() {
		if (selectedSlideIndex < slides.length - 1) {
			selectedSlideIndex++;
		}
	}

	// 단축키 처리
	function handleKeydown(event: KeyboardEvent) {
		// Cmd/Ctrl + B: 굵게
		if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
			event.preventDefault();
			makeBold();
			return;
		}

		// Cmd/Ctrl + I: 기울임
		if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
			event.preventDefault();
			makeItalic();
			return;
		}

		// Cmd/Ctrl + Shift + X: 취소선
		if (
			(event.metaKey || event.ctrlKey) &&
			event.shiftKey &&
			(event.key === 'x' || event.key === 'X')
		) {
			event.preventDefault();
			makeStrikethrough();
			return;
		}

		// Cmd/Ctrl + 1~4: 제목
		if (event.metaKey || event.ctrlKey) {
			if (event.key === '1') {
				event.preventDefault();
				makeHeading(1);
				return;
			}
			if (event.key === '2') {
				event.preventDefault();
				makeHeading(2);
				return;
			}
			if (event.key === '3') {
				event.preventDefault();
				makeHeading(3);
				return;
			}
			if (event.key === '4') {
				event.preventDefault();
				makeHeading(4);
				return;
			}
		}

		// Cmd/Ctrl + S: 파일 저장
		if ((event.metaKey || event.ctrlKey) && event.key === 's') {
			event.preventDefault();
			saveFile(true); // 수동 저장
			return;
		}

		// Cmd/Ctrl + N: 새 파일
		if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
			event.preventDefault();
			createNewFile();
			return;
		}

		// Cmd/Ctrl + P: 미리보기 토글
		if ((event.metaKey || event.ctrlKey) && event.key === 'p') {
			event.preventDefault();
			togglePreview();
			return;
		}

		// Cmd/Ctrl + Enter: 슬라이드 추가
		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			event.preventDefault();
			addSlide();
			return;
		}

		// F5 또는 Cmd/Ctrl + Shift + P: 슬라이드쇼 토글
		if (
			event.key === 'F5' ||
			((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'P')
		) {
			event.preventDefault();
			togglePresentation();
			return;
		}

		// ESC: 슬라이드쇼 종료
		if (event.key === 'Escape' && isPresentationMode) {
			event.preventDefault();
			isPresentationMode = false;
			return;
		}

		// 슬라이드쇼 모드에서 화살표 키로 슬라이드 이동
		if (isPresentationMode) {
			if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
				event.preventDefault();
				previousSlide();
			} else if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === ' ') {
				event.preventDefault();
				nextSlide();
			}
		}
	}

	// 슬라이드 선택
	function selectSlide(index: number) {
		selectedSlideIndex = index;

		// 편집기 커서를 해당 슬라이드 시작 위치로 이동
		if (!textareaElement) return;

		const cursorPosition = markdownService.findSlideStartPosition(markdownContent, index);

		// 커서 위치 설정 및 포커스
		textareaElement.focus();
		textareaElement.setSelectionRange(cursorPosition, cursorPosition);

		// 커서 위치가 보이도록 스크롤
		textareaElement.scrollTop =
			textareaElement.scrollHeight * (cursorPosition / markdownContent.length);
	}

	// 텍스트 영역 변경 처리
	function handleInput(event: Event) {
		const target = event.target as HTMLTextAreaElement;
		markdownContent = target.value;
	}

	// 텍스트 서식 적용 (토글 지원)
	function applyFormat(prefix: string, suffix: string = prefix) {
		if (!textareaElement) return;

		const result = markdownService.applyTextFormat(
			markdownContent,
			textareaElement.selectionStart,
			textareaElement.selectionEnd,
			prefix,
			suffix
		);

		// 전체 텍스트 교체 (undo 지원)
		textareaElement.focus();

		// 전체 내용 선택
		textareaElement.select();

		// 새 내용으로 교체 (undo 스택 유지)
		if (document.execCommand) {
			document.execCommand('insertText', false, result.newText);
		} else {
			textareaElement.value = result.newText;
		}

		// 커서 위치 조정
		textareaElement.setSelectionRange(result.cursorPos, result.selectionEnd);

		// markdownContent 동기화
		markdownContent = textareaElement.value;
	}

	// 굵게
	function makeBold() {
		applyFormat('**');
	}

	// 기울임
	function makeItalic() {
		applyFormat('*');
	}

	// 취소선
	function makeStrikethrough() {
		applyFormat('~~');
	}

	// 제목 (H1 ~ H4)
	function makeHeading(level: 1 | 2 | 3 | 4) {
		if (!textareaElement) return;

		const start = textareaElement.selectionStart;
		const end = textareaElement.selectionEnd;

		// 현재 줄의 시작 위치 찾기
		let lineStart = textareaElement.value.lastIndexOf('\n', start - 1) + 1;
		if (lineStart < 0) lineStart = 0;

		// 현재 줄의 끝 위치 찾기
		let lineEnd = textareaElement.value.indexOf('\n', end);
		if (lineEnd < 0) lineEnd = textareaElement.value.length;

		// 현재 줄 내용
		const currentLine = textareaElement.value.substring(lineStart, lineEnd);

		// 이미 제목인지 확인 (정규식: #이 1~6개 있고 공백이 뒤따름)
		const headingRegex = /^(#{1,6})\s/;
		const match = currentLine.match(headingRegex);

		let newLine = '';
		const targetPrefix = '#'.repeat(level) + ' ';

		if (match) {
			// 이미 제목인 경우
			if (match[1].length === level) {
				// 같은 레벨이면 제목 제거 (토글)
				newLine = currentLine.replace(headingRegex, '');
			} else {
				// 다른 레벨이면 레벨 변경
				newLine = currentLine.replace(headingRegex, targetPrefix);
			}
		} else {
			// 제목이 아닌 경우 추가
			newLine = targetPrefix + currentLine;
		}

		// 선택 범위 설정 (줄 전체 교체를 위해)
		textareaElement.setSelectionRange(lineStart, lineEnd);
		textareaElement.focus();

		// 텍스트 교체
		document.execCommand('insertText', false, newLine);

		// markdownContent 동기화
		markdownContent = textareaElement.value;
	}

	// 이미지 파일 선택 및 삽입
	async function insertImageFromFile() {
		if (!currentFilePath || !textareaElement) {
			showError('먼저 파일을 열어주세요.');
			return;
		}

		try {
			const imagePath = await fileService.selectImageFile();
			if (!imagePath) return;

			console.log('선택한 이미지:', imagePath);

			const relativePath = await fileService.saveClipboardImage(currentFilePath, imagePath);
			console.log('이미지 저장 성공, 경로:', relativePath);

			// 마크다운 이미지 구문을 커서 위치에 삽입
			const cursorPos = textareaElement.selectionStart;
			const imageMarkdown = `![](${relativePath})`;

			const newContent =
				markdownContent.substring(0, cursorPos) +
				imageMarkdown +
				markdownContent.substring(cursorPos);

			markdownContent = newContent;

			// 커서를 이미지 구문 뒤로 이동
			setTimeout(() => {
				textareaElement.focus();
				const newCursorPos = cursorPos + imageMarkdown.length;
				textareaElement.setSelectionRange(newCursorPos, newCursorPos);
			}, 0);

			// 파일 트리 새로고침 (새 이미지 디렉터리 표시)
			await loadFileTree();

			showSuccess('이미지가 삽입되었습니다.');
		} catch (error) {
			console.error('이미지 삽입 오류 상세:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			showError(`이미지 삽입 중 오류: ${errorMessage}`);
		}
	}

	// 테이블 버튼 클릭
	function toggleTableGrid() {
		showTableGrid = !showTableGrid;
		if (!showTableGrid) {
			tableRows = 0;
			tableCols = 0;
		}
	}

	// 테이블 그리드 호버
	function handleTableGridHover(row: number, col: number) {
		tableRows = row + 1;
		tableCols = col + 1;
	}

	// 테이블 삽입
	function insertTable(rows: number, cols: number) {
		if (!textareaElement || rows === 0 || cols === 0) return;

		const cursorPos = textareaElement.selectionStart;
		const table = markdownService.generateTableMarkdown(rows, cols);

		// 테이블 삽입
		const newText =
			markdownContent.substring(0, cursorPos) + table + markdownContent.substring(cursorPos);
		markdownContent = newText;

		// UI 닫기
		showTableGrid = false;
		tableRows = 0;
		tableCols = 0;

		// 포커스 복구
		setTimeout(() => {
			textareaElement.focus();
			textareaElement.setSelectionRange(cursorPos + table.length, cursorPos + table.length);
		}, 0);
	}

	// 슬라이드 추가
	function addSlide() {
		if (!textareaElement) return;

		const cursorPos = textareaElement.selectionStart;
		const slideDelimiter = '\n---\n';

		// 슬라이드 구분자 삽입
		const newText =
			markdownContent.substring(0, cursorPos) + slideDelimiter + markdownContent.substring(cursorPos);
		markdownContent = newText;

		// 포커스 복구 및 커서를 구분자 뒤로 이동
		setTimeout(() => {
			textareaElement.focus();
			const newCursorPos = cursorPos + slideDelimiter.length;
			textareaElement.setSelectionRange(newCursorPos, newCursorPos);
		}, 0);
	}

	// 커서 위치로 현재 슬라이드 번호 찾기
	function updateCurrentSlideFromCursor() {
		if (!textareaElement) return;

		const cursorPos = textareaElement.selectionStart;
		const slideIndex = markdownService.findSlideIndexAtCursor(markdownContent, cursorPos);

		if (slideIndex !== selectedSlideIndex) {
			selectedSlideIndex = slideIndex;
		}
	}

	// 사이드바 패널 선택
	function selectSidebarPanel(panel: SidebarPanel) {
		activeSidebarPanel = panel;
	}

	// 텍스트 영역 클릭 및 키 입력 처리
	function handleCursorMove() {
		updateCurrentSlideFromCursor();
	}

	// 마크다운 렌더링 (marked 라이브러리 사용)
	function renderMarkdown(md: string): string {
		return markdownService.renderMarkdown(md, currentFilePath || '');
	}

	// 클립보드 이미지 붙여넣기 처리
	async function handlePaste(event: ClipboardEvent) {
		if (!currentFilePath || !textareaElement) return;

		const items = event.clipboardData?.items;
		if (!items) return;

		// 클립보드에 이미지가 있는지 확인
		for (let i = 0; i < items.length; i++) {
			const item = items[i];

			if (item.type.startsWith('image/')) {
				event.preventDefault(); // 기본 붙여넣기 방지

				const blob = item.getAsFile();
				if (!blob) continue;

				try {
					console.log('이미지 붙여넣기 시작');
					console.log('현재 파일 경로:', currentFilePath);
					console.log('이미지 타입:', blob.type);
					console.log('이미지 크기:', blob.size, 'bytes');

					// 이미지를 ArrayBuffer로 변환
					const arrayBuffer = await blob.arrayBuffer();
					const uint8Array = new Uint8Array(arrayBuffer);
					const imageData = Array.from(uint8Array);

					// Rust 백엔드를 통해 이미지 저장
					const relativePath = await fileService.saveClipboardImage(currentFilePath, imageData);
					console.log('이미지 저장 성공, 경로:', relativePath);

					// 마크다운 이미지 구문을 커서 위치에 삽입
					const cursorPos = textareaElement.selectionStart;
					const imageMarkdown = `![](${relativePath})`;

					const newContent =
						markdownContent.substring(0, cursorPos) +
						imageMarkdown +
						markdownContent.substring(cursorPos);

					markdownContent = newContent;

					// 커서를 이미지 구문 뒤로 이동
					setTimeout(() => {
						textareaElement.focus();
						const newCursorPos = cursorPos + imageMarkdown.length;
						textareaElement.setSelectionRange(newCursorPos, newCursorPos);
					}, 0);

					// 파일 트리 새로고침 (새 이미지 디렉터리 표시)
					await loadFileTree();

					showSuccess('이미지가 삽입되었습니다.');
				} catch (error) {
					console.error('이미지 저장 오류 상세:', error);
					const errorMessage = error instanceof Error ? error.message : String(error);
					showError(`이미지 저장 중 오류: ${errorMessage}`);
				}
				break;
			}
		}
	}

	// 워크스페이스 선택 다이얼로그
	async function selectWorkspace() {
		try {
			const selected = await fileService.selectWorkspaceDirectory();
			if (selected) {
				workspacePath = selected;
				await saveConfig();
				await loadFileTree();
				showSuccess('워크스페이스가 변경되었습니다.');
			}
		} catch (error) {
			console.error('워크스페이스 선택 오류:', error);
			showError('워크스페이스 선택 중 오류가 발생했습니다.');
		}
	}

	// 설정 저장
	async function saveConfig() {
		try {
			const config: AppConfig = {
				workspace_path: workspacePath,
				auto_save_enabled: autoSaveEnabled,
				font_size: fontSize,
				font_family: fontFamily,
				confirm_delete: confirmDelete,
				notifications_enabled: notificationsEnabled
			};
			await configService.saveConfig(config);
			console.log('설정이 저장되었습니다:', config);
		} catch (error) {
			console.error('설정 저장 오류:', error);
			showError('설정 저장 중 오류가 발생했습니다.');
		}
	}

	// 설정 로드
	async function loadConfig() {
		try {
			const config = await configService.loadConfig();
			workspacePath = config.workspace_path;
			autoSaveEnabled = config.auto_save_enabled;
			fontSize = config.font_size;
			fontFamily = config.font_family;
			confirmDelete = config.confirm_delete ?? true;
			notificationsEnabled = config.notifications_enabled ?? true;
			configLoaded = true;
			console.log('설정이 로드되었습니다:', config);
		} catch (error) {
			console.error('설정 로드 오류:', error);
			// 기본값 사용
			const home = await homeDir();
			workspacePath = `${home}mdslide`;
			configLoaded = true;
		}
	}

	// 설정 변경 감지 및 저장 (디바운스)
	let saveConfigTimeout: number;
	$: if (
		configLoaded &&
		(workspacePath ||
			autoSaveEnabled !== undefined ||
			fontSize ||
			fontFamily ||
			confirmDelete !== undefined ||
			notificationsEnabled !== undefined)
	) {
		clearTimeout(saveConfigTimeout);
		saveConfigTimeout = setTimeout(() => {
			saveConfig();
		}, 500) as unknown as number;
	}

	// 시스템 폰트 로드
	async function loadSystemFonts() {
		try {
			systemFonts = await configService.loadSystemFonts();
		} catch (error) {
			console.error('폰트 목록 로드 오류:', error);
			// 기본 폰트 목록 사용
			systemFonts = ['JetBrains Mono', 'Monaco', 'Menlo', 'Consolas', 'monospace'];
		}
	}

	// 기본 워크스페이스 디렉터리 초기화
	async function initWorkspace() {
		try {
			// 설정 먼저 로드
			await loadConfig();

			// 워크스페이스 디렉터리 확인 및 생성
			console.log('워크스페이스 경로:', workspacePath);

			await fileService.ensureDirectory(workspacePath);
			console.log('워크스페이스 디렉터리 준비 완료:', workspacePath);

			await loadFileTree();
		} catch (error) {
			console.error('워크스페이스 초기화 오류:', error);
			showError('워크스페이스 초기화 중 오류가 발생했습니다.');
		}
	}

	// 파일 트리 로드
	async function loadFileTree(additionalExpandPath?: string) {
		if (!workspacePath) {
			console.log('워크스페이스 경로가 설정되지 않음');
			return;
		}

		try {
			console.log('파일 트리 로드 시작:', workspacePath);

			// 현재 펼쳐진 폴더들의 경로 저장
			const expandedPaths = fileService.getExpandedPaths(fileTree);

			// 추가로 펼쳐야 할 경로가 있으면 추가
			if (additionalExpandPath) {
				expandedPaths.add(additionalExpandPath);
			}

			// 새 파일 트리 로드
			let newTree = await fileService.buildFileTree(workspacePath);

			// 펼쳐진 상태 복원
			if (expandedPaths.size > 0) {
				newTree = await fileService.restoreExpandedState(newTree, expandedPaths);
			}

			fileTree = newTree;
			console.log('파일 트리 로드 성공:', fileTree.length, '개 항목');
		} catch (error) {
			console.error('파일 트리 로드 오류:', error);
			fileTree = [];
		}
	}

	// 파일 클릭 핸들러 (다중 선택 지원)
	function handleFileClick(event: MouseEvent, filePath: string) {
		const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
		const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

		if (event.shiftKey && lastClickedFile) {
			// Shift + 클릭: 범위 선택
			event.preventDefault();
			const flatFiles = fileService.getFlatFileList(fileTree);
			const startIdx = flatFiles.indexOf(lastClickedFile);
			const endIdx = flatFiles.indexOf(filePath);

			if (startIdx !== -1 && endIdx !== -1) {
				const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
				selectedFiles.clear();
				for (let i = min; i <= max; i++) {
					selectedFiles.add(flatFiles[i]);
				}
				selectedFiles = selectedFiles; // 리렌더 트리거
			}
		} else if (isCtrlOrCmd) {
			// Ctrl/Cmd + 클릭: 토글 선택
			event.preventDefault();

			// 첫 번째 Ctrl/Cmd 클릭이면 이전에 열린 파일도 선택 목록에 추가
			if (selectedFiles.size === 0 && lastClickedFile) {
				selectedFiles.add(lastClickedFile);
			}

			if (selectedFiles.has(filePath)) {
				selectedFiles.delete(filePath);
			} else {
				selectedFiles.add(filePath);
			}
			lastClickedFile = filePath;
			selectedFiles = selectedFiles; // 리렌더 트리거
		} else {
			// 일반 클릭: 파일 열기 + 선택 초기화
			selectedFiles.clear();
			lastClickedFile = filePath;
			selectedFiles = selectedFiles; // 리렌더 트리거
			openFile(filePath);
		}
	}

	// 디렉터리 확장/축소 토글
	async function toggleDirectory(node: FileNode) {
		if (!node.isDirectory) return;

		node.expanded = !node.expanded;

		if (node.expanded && !node.children) {
			node.children = await fileService.buildFileTree(node.path);
		}

		fileTree = fileTree; // 반응성 트리거
	}

	// 윈도우 타이틀 업데이트
	async function updateWindowTitle() {
		try {
			let title = 'mdslide';

			if (currentFilePath) {
				const fileName = utils.getFileName(currentFilePath);
				title = `mdslide - ${fileName}`;

				if (isSaving) {
					title += ' (저장중)';
				} else if (!autoSaveEnabled && isModified) {
					title += ' (변경됨)';
				}
			}

			await configService.setWindowTitle(title);
		} catch (error) {
			console.error('윈도우 타이틀 업데이트 오류:', error);
		}
	}

	// currentFilePath, isSaving, isModified 변경 시 윈도우 타이틀 업데이트
	$: {
		if (currentFilePath !== null || isSaving || isModified) {
			updateWindowTitle();
		}
	}

	// 파일 열기
	async function openFile(filePath: string) {
		try {
			const result = await fileService.openFile(filePath);

			isImageFile = result.isImage;
			currentFilePath = filePath;
			markdownContent = result.content;
			originalContent = result.content;
			isModified = false;

			await updateWindowTitle();

			if (result.isImage) {
				showSuccess('이미지를 열었습니다.');
			} else {
				showSuccess('파일을 열었습니다.');
			}
		} catch (error) {
			console.error('파일 열기 오류:', error);
			showError('파일을 열 수 없습니다.');
		}
	}
	// 파일 저장
	async function saveFile(isManualSave: boolean = false) {
		if (!currentFilePath) {
			showError('저장할 파일이 선택되지 않았습니다.');
			return;
		}

		try {
			isSaving = true;
			await updateWindowTitle();

			await fileService.saveFile(currentFilePath, markdownContent);

			isSaving = false;
			isModified = false;
			originalContent = markdownContent;
			await updateWindowTitle();

			// 수동 저장이거나 자동저장 모드가 아닐 때 성공 메시지 표시
			if (isManualSave || !autoSaveEnabled) {
				showSuccess('파일이 저장되었습니다.');
			}
		} catch (error) {
			isSaving = false;
			await updateWindowTitle();
			console.error('파일 저장 오류:', error);
			showError('파일 저장 중 오류가 발생했습니다.');
		}
	}

	// 컨텍스트 메뉴 관련 함수들
	function closeContextMenu() {
		contextMenu = null;
	}

	function handleContextMenu(
		event: MouseEvent,
		type: 'file' | 'directory' | 'empty' | 'multiple-files',
		target?: FileNode
	) {
		// 다중 선택된 파일에 우클릭한 경우
		if (type === 'file' && target && selectedFiles.size > 0 && selectedFiles.has(target.path)) {
			// 선택된 파일 중 하나에 우클릭: 다중 파일 삭제 메뉴
			event.preventDefault();
			contextMenu = {
				x: event.clientX,
				y: event.clientY,
				type: 'multiple-files',
				target: target
			};
			return;
		}

		event.preventDefault();
		contextMenu = {
			x: event.clientX,
			y: event.clientY,
			type: type,
			target: target
		};
	}

	// 편집기 컨텍스트 메뉴 핸들러
	function handleEditorContextMenu(event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();
		contextMenu = {
			x: event.clientX,
			y: event.clientY,
			type: 'editor'
		};
	}

	// 편집기 복사
	async function handleEditorCopy() {
		if (!textareaElement) return;
		closeContextMenu();
		textareaElement.focus();

		const start = textareaElement.selectionStart;
		const end = textareaElement.selectionEnd;

		if (start === end) return;

		const selectedText = textareaElement.value.substring(start, end);

		try {
			await navigator.clipboard.writeText(selectedText);
		} catch (err) {
			console.error('복사 실패:', err);
		}
	}

	// 편집기 잘라내기
	async function handleEditorCut() {
		if (!textareaElement) return;
		closeContextMenu();
		textareaElement.focus();

		const start = textareaElement.selectionStart;
		const end = textareaElement.selectionEnd;

		if (start === end) return;

		const selectedText = textareaElement.value.substring(start, end);

		try {
			await navigator.clipboard.writeText(selectedText);

			// 텍스트 삭제 (undo history 유지를 위해 insertText 사용)
			document.execCommand('insertText', false, '');

			// markdownContent 동기화
			markdownContent = textareaElement.value;
		} catch (err) {
			console.error('잘라내기 실패:', err);
		}
	}

	// 편집기 붙여넣기
	async function handleEditorPaste() {
		if (!textareaElement) return;
		closeContextMenu();
		textareaElement.focus();

		try {
			// 클립보드에서 텍스트 읽기
			const text = await navigator.clipboard.readText();

			// 현재 커서 위치에 텍스트 삽입 (undo history 유지를 위해 insertText 사용)
			document.execCommand('insertText', false, text);

			// markdownContent 동기화
			markdownContent = textareaElement.value;
		} catch (error) {
			console.error('붙여넣기 오류:', error);
		}
	}

	// 이름 변경 시작
	function startRename() {
		if (!contextMenu?.target) return;
		renameTarget = contextMenu.target;
		renameInputValue = contextMenu.target.name;
		showRenameDialog = true;
		closeContextMenu();
	}

	// 이름 변경 실행
	async function executeRename() {
		if (!renameTarget || !renameInputValue.trim()) return;

		try {
			const oldPath = renameTarget.path;
			const newPath = await fileService.renameFile(oldPath, renameInputValue.trim());

			// 현재 열린 파일이 이름이 변경된 파일이면 경로 업데이트
			if (currentFilePath === oldPath) {
				currentFilePath = newPath;
			}

			await loadFileTree();
			showSuccess('이름이 변경되었습니다.');
		} catch (error) {
			console.error('이름 변경 오류:', error);
			showError('이름 변경 중 오류가 발생했습니다.');
		} finally {
			showRenameDialog = false;
			renameTarget = null;
			renameInputValue = '';
		}
	}

	// 삭제 시작
	function startDelete() {
		if (!contextMenu?.target) return;

		// 다중 선택 컨텍스트 메뉴인 경우 deleteTarget을 null로 설정
		if (contextMenu.type === 'multiple-files') {
			deleteTarget = null;
		} else {
			deleteTarget = contextMenu.target;
		}

		if (confirmDelete) {
			showDeleteDialog = true;
		} else {
			// 다중 삭제인지 단일 삭제인지 판단하여 실행
			if (deleteTarget) {
				executeDelete();
			} else {
				executeDeleteMultiple();
			}
		}
		closeContextMenu();
	}

	// 다중 파일 삭제
	async function executeDeleteMultiple() {
		if (selectedFiles.size === 0) return;

		try {
			for (const filePath of selectedFiles) {
				await fileService.deleteFile(filePath);
			}
			showSuccess(`${selectedFiles.size}개 파일이 삭제되었습니다.`);
			selectedFiles.clear();
			lastClickedFile = null;
			selectedFiles = selectedFiles;
			await loadFileTree();
		} catch (error) {
			console.error('파일 삭제 오류:', error);
			showError('파일 삭제 중 오류가 발생했습니다.');
		} finally {
			showDeleteDialog = false;
			deleteTarget = null;
		}
	}

	// 삭제 실행
	async function executeDelete() {
		if (!deleteTarget) return;

		try {
			await fileService.deleteFile(deleteTarget.path);

			// 삭제된 파일이 현재 열린 파일이면 초기화
			if (currentFilePath === deleteTarget.path) {
				currentFilePath = null;
				markdownContent = '';
			}

			await loadFileTree();
			showSuccess('삭제되었습니다.');
		} catch (error) {
			console.error('삭제 오류:', error);
			showError('삭제 중 오류가 발생했습니다.');
		} finally {
			showDeleteDialog = false;
			deleteTarget = null;
			dontAskAgainDelete = false;
		}
	}

	// 삭제 확인 다이얼로그에서 확인 버튼 클릭
	function confirmDeleteAction() {
		if (dontAskAgainDelete) {
			confirmDelete = false;
		}
		if (deleteTarget) {
			executeDelete();
		} else if (selectedFiles.size > 0) {
			executeDeleteMultiple();
		}
	}

	// 새 파일 추가 다이얼로그 열기
	function openNewFileDialog() {
		// 컨텍스트 메뉴의 대상 디렉터리 저장
		if (contextMenu?.type === 'directory') {
			targetDirectory = contextMenu.target || null;
		} else {
			targetDirectory = null;
		}
		showNewFileDialog = true;
		newItemInputValue = '';
		closeContextMenu();
	}

	// 새 파일 생성 (다이얼로그에서)
	async function createNewFileFromDialog() {
		if (!newItemInputValue.trim()) return;

		try {
			let fileName = newItemInputValue.trim();

			// .md 확장자가 없으면 자동으로 추가
			if (!fileName.endsWith('.md')) {
				fileName = `${fileName}.md`;
			}

			// 대상 디렉터리가 있으면 해당 디렉터리 하위에, 없으면 워크스페이스 루트에 생성
			let basePath = workspacePath;
			const targetDirPath = targetDirectory?.path; // 펼쳐야 할 디렉터리 경로 저장
			if (targetDirectory) {
				basePath = targetDirectory.path;
			}

			const filePath = basePath.endsWith('/')
				? `${basePath}${fileName}`
				: `${basePath}/${fileName}`;

			await fileService.saveFile(filePath, '');

			// 파일이 추가된 디렉터리를 펼침
			await loadFileTree(targetDirPath);
			markdownContent = '';
			currentFilePath = filePath;
			await updateWindowTitle();
		} finally {
			showNewFileDialog = false;
			newItemInputValue = '';
			targetDirectory = null;
		}
	}

	// 새 디렉터리 추가 다이얼로그 열기
	function openNewDirDialog() {
		// 컨텍스트 메뉴의 대상 디렉터리 저장
		if (contextMenu?.type === 'directory') {
			targetDirectory = contextMenu.target || null;
		} else {
			targetDirectory = null;
		}
		showNewDirDialog = true;
		newItemInputValue = '';
		closeContextMenu();
	}

	// 새 디렉터리 생성
	async function createNewDirectory() {
		if (!newItemInputValue.trim()) return;

		try {
			const dirName = newItemInputValue.trim();
			// 대상 디렉터리가 있으면 해당 디렉터리 하위에, 없으면 워크스페이스 루트에 생성
			let basePath = workspacePath;
			const targetDirPath = targetDirectory?.path; // 펼쳐야 할 디렉터리 경로 저장
			if (targetDirectory) {
				basePath = targetDirectory.path;
			}

			const dirPath = basePath.endsWith('/') ? `${basePath}${dirName}` : `${basePath}/${dirName}`;

			await fileService.createDirectory(dirPath);

			// 디렉터리가 추가된 상위 디렉터리를 펼침
			await loadFileTree(targetDirPath);
			showSuccess(`디렉터리가 생성되었습니다: ${dirName}`);
		} catch (error) {
			console.error('디렉터리 생성 오류:', error);
			showError('디렉터리 생성 중 오류가 발생했습니다.');
		} finally {
			showNewDirDialog = false;
			newItemInputValue = '';
			targetDirectory = null;
		}
	}

	// 새 파일 생성
	async function createNewFile() {
		try {
			if (!workspacePath) {
				showError('워크스페이스가 설정되지 않았습니다.');
				return;
			}

			const fileName = utils.formatFileName();
			const filePath = workspacePath.endsWith('/')
				? `${workspacePath}${fileName}`
				: `${workspacePath}/${fileName}`;

			// 기본 슬라이드 내용으로 파일 생성
			const defaultContent = ``;

			await fileService.saveFile(filePath, defaultContent);
			markdownContent = defaultContent;
			currentFilePath = filePath;

			// 파일 트리 새로고침
			await loadFileTree();

			showSuccess(`파일이 생성되었습니다: ${fileName}`);
		} catch (error) {
			console.error('파일 생성 오류:', error);
			showError('파일 생성 중 오류가 발생했습니다.');
		}
	}

	// PDF 내보내기 상태
	let isExporting = false;

	// PDF 내보내기 (html2pdf 사용)
	// PDF 전용 스타일 (Tailwind나 외부 CSS 의존성 없이 독립적으로 렌더링하기 위함)
	const printStyles = `
		/* 레이아웃 초기화 */
		body, html { margin: 0; padding: 0; background: white; width: 100%; height: 100%; }
		* { box-sizing: border-box; }
		
		/* 인쇄 컨테이너 -- 보여주기용 */
		.print-container {
			display: block !important;
			position: absolute !important;
			top: 0 !important;
			left: 0 !important;
			width: 100% !important;
			background: white !important;
			z-index: 99999 !important;
		}

		/* 슬라이드 페이지 스타일 */
		.print-slide {
			page-break-after: always;
			height: 100vh; /* PDF 페이지 높이 */
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			padding: 40px; /* 여백 */
			font-family: 'JetBrains Mono', monospace, sans-serif;
			font-size: 16pt;
			line-height: 1.6;
			background: white;
			color: black !important; /* 강제 검정색 */
			border: none;
		}

		.print-slide:last-child {
			page-break-after: auto;
		}

		/* 마크다운 태그 기본 스타일 */
		.print-slide h1 { font-size: 3em; font-weight: bold; margin-bottom: 0.6em; color: black; }
		.print-slide h2 { font-size: 2.4em; font-weight: bold; margin-bottom: 0.6em; color: black; }
		.print-slide h3 { font-size: 1.8em; font-weight: bold; margin-bottom: 0.5em; color: black; }
		.print-slide h4 { font-size: 1.5em; font-weight: bold; margin-bottom: 0.5em; color: black; }
		.print-slide p { margin-bottom: 1em; width: 100%; color: #333; }
		.print-slide ul, .print-slide ol { margin-bottom: 1em; padding-left: 2em; width: 100%; color: #333; }
		.print-slide ul { list-style-type: disc; }
		.print-slide ol { list-style-type: decimal; }
		.print-slide img { max-width: 100%; max-height: 80vh; object-fit: contain; margin: 1em 0; }
		.print-slide pre { 
			background-color: #f5f5f5; 
			padding: 1.5em; 
			border-radius: 8px; 
			width: 100%; 
			white-space: pre-wrap;
			border: 1px solid #ddd;
			margin-bottom: 1em;
		}
		.print-slide code { 
			font-family: 'JetBrains Mono', monospace; 
			background-color: #f5f5f5;
			padding: 0.2em 0.4em;
			border-radius: 3px;
		}
		.print-slide pre code {
			background-color: transparent;
			padding: 0;
		}
		.print-slide blockquote { 
			border-left: 5px solid #ccc; 
			padding-left: 1em; 
			margin-left: 0;
			color: #555; 
			width: 100%; 
		}
		.print-slide table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
		.print-slide th, .print-slide td { border: 1px solid #000; padding: 10px; text-align: left; }
		.print-slide th { background-color: #f0f0f0; font-weight: bold; }
	`;

	// CSS 스타일 정화 함수 제거 (printStyles로 대체하므로 불필요)

	// PDF 내보내기 (html2pdf 사용)
	async function exportToPdf() {
		try {
			// Dynamic import to avoid SSR issues
			const html2pdf = (await import('html2pdf.js')).default;

			const element = document.querySelector('.print-container') as HTMLElement;
			if (!element) {
				throw new Error('Print container not found');
			}

			// 저장 경로 선택
			const fileName = currentFilePath
				? utils.getFileNameWithoutExtension(currentFilePath)
				: 'slides';
			const defaultName = `${fileName}.pdf`;
			const savePath = await fileService.savePdfFile(defaultName);

			// 사용자가 취소한 경우
			if (!savePath) return;

			isExporting = true;
			// DOM 업데이트 대기
			await new Promise((resolve) => setTimeout(resolve, 100));

			const opt = {
				margin: 0,
				filename: defaultName,
				image: { type: 'jpeg' as const, quality: 0.98 },
				html2canvas: {
					scale: 2,
					useCORS: true,
					logging: false,
					// 중요: 윈도우 너비를 설정하여 반응형 레이아웃 이슈 방지
					windowWidth: 1280,
					onclone: (doc: Document) => {
						// 1. 기존 스타일시트 모두 제거 (oklch 오류 및 스타일 충돌 방지)
						const links = doc.querySelectorAll('link[rel="stylesheet"], style');
						links.forEach((link) => link.remove());

						// 2. 안전한 PDF 전용 스타일 주입
						const styleFn = doc.createElement('style');
						styleFn.innerHTML = printStyles;
						doc.head.appendChild(styleFn);
					}
				},
				jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const },
				pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
			};

			const pdfBuffer = await html2pdf().set(opt).from(element).output('arraybuffer');
			const pdfArray = new Uint8Array(pdfBuffer as ArrayBuffer);
			await writeFile(savePath, pdfArray);

			showSuccess('PDF가 저장되었습니다.');
		} catch (e) {
			console.error('PDF 내보내기 실패:', e);
			showError('PDF 생성 중 오류가 발생했습니다.');
		} finally {
			isExporting = false;
		}
	}

	// 컴포넌트 마운트 시
	onMount(() => {
		initWorkspace();
		loadSystemFonts();
	});
</script>

<svelte:window
	on:keydown={handleKeydown}
	on:click={() => {
		if (contextMenu) closeContextMenu();
	}}
/>

{#if isPresentationMode}
	<SlideshowMode
		{slides}
		{selectedSlideIndex}
		{renderMarkdown}
		onClose={togglePresentation}
		onPrevSlide={previousSlide}
		onNextSlide={nextSlide}
	/>
{:else}
	<!-- 일반 편집 모드 -->
	<div class="flex h-screen bg-background">
		<!-- 사이드바 컴포넌트 -->
		<Sidebar
			bind:activeSidebarPanel
			{workspacePath}
			{currentFilePath}
			{slides}
			{selectedSlideIndex}
			{fileTree}
			{selectedFiles}
			{autoSaveEnabled}
			{notificationsEnabled}
			{fontSize}
			{fontFamily}
			{systemFonts}
			onSelectPanel={(panel) => selectSidebarPanel(panel)}
			onSlideClick={selectSlide}
			onWorkspaceChange={selectWorkspace}
			onAutoSaveToggle={() => (autoSaveEnabled = !autoSaveEnabled)}
			onNotificationsToggle={() => (notificationsEnabled = !notificationsEnabled)}
			onFileClick={handleFileClick}
			onDirectoryToggle={toggleDirectory}
			onContextMenu={handleContextMenu}
			onFontSizeChange={(size) => (fontSize = size)}
			onFontFamilyChange={(family) => (fontFamily = family)}
		/>

		<!-- 오른쪽: 편집 영역 & 미리보기 -->
		<div class="relative flex flex-1">
			<!-- 마크다운 편집 영역 -->
			<div class="flex flex-1 flex-col {showPreview ? 'border-r border-border' : ''}">
				<!-- 텍스트 서식 툴바 -->
				<EditorToolbar
					{showTableGrid}
					{tableRows}
					{tableCols}
					{maxTableSize}
					onBold={makeBold}
					onItalic={makeItalic}
					onStrikethrough={makeStrikethrough}
					onHeading={makeHeading}
					onImageInsert={insertImageFromFile}
					onAddSlide={addSlide}
					onTableToggle={toggleTableGrid}
					onTableGridHover={handleTableGridHover}
					onTableGridClick={() => insertTable(tableRows, tableCols)}
					onSave={() => saveFile(true)}
					onExportPdf={exportToPdf}
					onSlideshowToggle={togglePresentation}
					onPreviewToggle={togglePreview}
					{showPreview}
					hasSlides={slides.length > 0}
				/>

				<!-- 편집기/이미지 뷰어 영역 -->
				<EditorArea
					{isImageFile}
					{currentFilePath}
					bind:markdownContent
					{fontSize}
					{fontFamily}
					onInput={handleInput}
					onCursorMove={handleCursorMove}
					onPaste={handlePaste}
					onNewFile={createNewFile}
					onEditorContextMenu={handleEditorContextMenu}
					bind:textareaElement
				/>
			</div>

			<!-- 미리보기 영역 -->
			{#if showPreview}
				<div class="w-1/2 max-w-[768px] min-w-0 min-w-[384px] flex-shrink-0">
					<PreviewPane
						{markdownContent}
						{slides}
						{selectedSlideIndex}
						{renderMarkdown}
						onSlideClick={selectSlide}
					/>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- 컨텍스트 메뉴 -->
{#if contextMenu}
	<ContextMenu
		x={contextMenu.x}
		y={contextMenu.y}
		type={contextMenu.type}
		selectedFilesCount={selectedFiles.size}
		onRename={startRename}
		onDelete={startDelete}
		onNewFile={openNewFileDialog}
		onNewDirectory={openNewDirDialog}
		onCopy={handleEditorCopy}
		onCut={handleEditorCut}
		onPaste={handleEditorPaste}
		onClose={closeContextMenu}
	/>
{/if}

<!-- 다이얼로그들 -->
<FileDialogs
	{showRenameDialog}
	{showDeleteDialog}
	{showNewFileDialog}
	{showNewDirDialog}
	bind:renameInputValue
	bind:newItemInputValue
	deleteTargetName={deleteTarget?.name || ''}
	selectedFilesCount={selectedFiles.size}
	confirmDeleteEnabled={confirmDelete}
	bind:dontAskAgainDelete
	onRenameConfirm={executeRename}
	onDeleteConfirm={confirmDeleteAction}
	onNewFileConfirm={createNewFileFromDialog}
	onNewDirConfirm={createNewDirectory}
/>

<!-- 인쇄용 히든 컨테이너 -->
<div class="print-container {isExporting ? 'exporting' : 'hidden'}">
	{#each slides as slide}
		<div class="print-slide">
			{@html renderMarkdown(slide)}
		</div>
	{/each}
</div>

<style>
	:global(.line-clamp-2) {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* 인쇄 및 PDF 공통 스타일 */
	.print-slide {
		page-break-after: always;
		height: 100vh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 2rem;
		font-family: var(--font-family, 'JetBrains Mono');
		/* 슬라이드 내용 스타일링 */
		font-size: 1.2rem;
		line-height: 1.6;
		background: white;
		color: black;
	}

	/* 마지막 슬라이드는 페이지 넘김 없음 */
	.print-slide:last-child {
		page-break-after: auto;
	}

	/* 마크다운 스타일링 (SlideshowMode와 유사하게) */
	:global(.print-slide h1) {
		font-size: 2.5em;
		font-weight: bold;
		margin-bottom: 0.5em;
	}
	:global(.print-slide h2) {
		font-size: 2em;
		font-weight: bold;
		margin-bottom: 0.5em;
	}
	:global(.print-slide h3) {
		font-size: 1.75em;
		font-weight: bold;
		margin-bottom: 0.5em;
	}
	:global(.print-slide h4) {
		font-size: 1.5em;
		font-weight: bold;
		margin-bottom: 0.5em;
	}
	:global(.print-slide p) {
		margin-bottom: 1em;
		width: 100%;
	}
	:global(.print-slide ul),
	:global(.print-slide ol) {
		margin-bottom: 1em;
		padding-left: 2em;
		width: 100%;
	}
	:global(.print-slide ul) {
		list-style-type: disc;
	}
	:global(.print-slide ol) {
		list-style-type: decimal;
	}
	:global(.print-slide img) {
		max-width: 100%;
		max-height: 80vh;
		object-fit: contain;
	}
	:global(.print-slide pre) {
		background-color: #f5f5f5;
		padding: 1em;
		border-radius: 4px;
		overflow-x: auto;
		width: 100%;
	}
	:global(.print-slide code) {
		font-family: 'JetBrains Mono', monospace;
	}
	:global(.print-slide blockquote) {
		border-left: 4px solid #ccc;
		padding-left: 1em;
		color: #666;
		width: 100%;
	}
	:global(.print-slide table) {
		border-collapse: collapse;
		width: 100%;
		margin-bottom: 1em;
	}
	:global(.print-slide th),
	:global(.print-slide td) {
		border: 1px solid #ddd;
		padding: 8px;
		text-align: left;
	}
	:global(.print-slide th) {
		background-color: #f2f2f2;
	}

	/* PDF 내보내기 모드 */
	.print-container.exporting {
		display: block !important;
		position: fixed;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		z-index: 9999;
		background: white;
		overflow-y: auto;
	}

	@media print {
		/* 모든 UI 숨기기 */
		:global(body > *) {
			display: none !important;
		}

		/* 인쇄용 컨테이너 보이기 */
		.print-container {
			display: block !important;
			position: absolute;
			left: 0;
			top: 0;
			width: 100%;
		}
	}

	/* html2canvas가 oklch 색상 함수를 지원하지 않으므로, 인쇄 영역 내에서는 기본 색상을 sRGB로 강제 설정 */
	/* PDF 내보내기 시 적용될 스타일 */
	.print-container {
		color: black;
		background: white;
		/* oklch 변수를 sRGB로 오버라이드 (필요한 경우) */
		--background: white;
		--foreground: black;
		--primary: #5200cc;
		--secondary: #0088cc;
		--muted: #f5f5f5;
		--border: #ddd;
	}
</style>
