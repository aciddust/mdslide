import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { convertFileSrc } from '@tauri-apps/api/core';

// marked 설정
marked.setOptions({
	gfm: true,
	breaks: true
});

/**
 * 마크다운을 슬라이드 배열로 분리
 */
export function splitIntoSlides(content: string): string[] {
	return content.split(/^---$/gm).map((slide) => slide.trim());
}

/**
 * 마크다운 렌더링
 */
export function renderMarkdown(md: string, currentFilePath: string | null = null): string {
	const rawHtml = marked.parse(md) as string;
	let sanitized = DOMPurify.sanitize(rawHtml);

	// 상대 경로 이미지를 절대 경로로 변환
	if (currentFilePath) {
		const fileDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
		sanitized = sanitized.replace(
			/<img([^>]*?)src="(?!http|data:|asset:)([^"]+)"/g,
			(match, attrs, src) => {
				const absolutePath = src.startsWith('/') ? src : `${fileDir}/${src}`;
				const assetUrl = convertFileSrc(absolutePath);
				return `<img${attrs}src="${assetUrl}"`;
			}
		);
	}

	return sanitized;
}

/**
 * 커서 위치에서 슬라이드 인덱스 찾기
 */
export function findSlideIndexAtCursor(content: string, cursorPos: number): number {
	const separatorRegex = /^---$/gm;
	const matches = [...content.matchAll(separatorRegex)];
	const separatorPositions = matches.map((match) => match.index!);

	let slideIndex = 0;
	for (let i = 0; i < separatorPositions.length; i++) {
		if (cursorPos > separatorPositions[i]) {
			slideIndex = i + 1;
		} else {
			break;
		}
	}

	return slideIndex;
}

/**
 * 슬라이드 시작 위치 찾기
 */
export function findSlideStartPosition(content: string, slideIndex: number): number {
	if (slideIndex === 0) return 0;

	const separatorRegex = /^---$/gm;
	const matches = [...content.matchAll(separatorRegex)];
	const separatorPositions = matches.map((match) => match.index!);

	if (slideIndex <= separatorPositions.length) {
		const separatorPos = separatorPositions[slideIndex - 1];
		const afterSeparator = content.substring(separatorPos + 3);
		const contentStart = afterSeparator.match(/^\s*/)?.[0].length || 0;
		return separatorPos + 3 + contentStart;
	}

	return 0;
}

/**
 * 테이블 마크다운 생성
 */
export function generateTableMarkdown(rows: number, cols: number): string {
	let table = '\n| ';

	// 헤더 행
	for (let i = 0; i < cols; i++) {
		table += `Header ${i + 1} | `;
	}
	table += '\n';

	// 구분선 행
	table += '| ';
	for (let i = 0; i < cols; i++) {
		table += '---------- | ';
	}
	table += '\n';

	// 데이터 행
	for (let r = 0; r < rows - 1; r++) {
		table += '| ';
		for (let c = 0; c < cols; c++) {
			table += 'Cell | ';
		}
		table += '\n';
	}
	table += '\n';

	return table;
}

/**
 * 텍스트 서식 적용 (토글 지원)
 */
export function applyTextFormat(
	content: string,
	selectionStart: number,
	selectionEnd: number,
	prefix: string,
	suffix: string = prefix
): { newText: string; cursorPos: number; selectionEnd: number } {
	const selectedText = content.substring(selectionStart, selectionEnd);

	let newText: string;
	let cursorPos: number;
	let newSelectionEnd: number;

	if (selectedText) {
		// 선택된 텍스트 앞뒤에 서식 마커가 있는지 확인
		const beforeText = content.substring(selectionStart - prefix.length, selectionStart);
		const afterText = content.substring(selectionEnd, selectionEnd + suffix.length);

		if (beforeText === prefix && afterText === suffix) {
			// 이미 서식이 적용되어 있으면 제거
			newText =
				content.substring(0, selectionStart - prefix.length) +
				selectedText +
				content.substring(selectionEnd + suffix.length);
			cursorPos = selectionStart - prefix.length;
			newSelectionEnd = cursorPos + selectedText.length;
		} else {
			// 서식 적용
			newText =
				content.substring(0, selectionStart) +
				prefix +
				selectedText +
				suffix +
				content.substring(selectionEnd);
			cursorPos = selectionStart + prefix.length;
			newSelectionEnd = cursorPos + selectedText.length;
		}
	} else {
		// 선택된 텍스트가 없으면 커서 위치에 삽입
		newText =
			content.substring(0, selectionStart) + prefix + suffix + content.substring(selectionEnd);
		cursorPos = selectionStart + prefix.length;
		newSelectionEnd = cursorPos;
	}

	return { newText, cursorPos, selectionEnd: newSelectionEnd };
}
