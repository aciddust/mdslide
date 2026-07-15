import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { readFile } from '@tauri-apps/plugin-fs';
import { splitIntoSlides } from './markdownService';

export type ReadBinaryFn = (path: string) => Promise<Uint8Array>;

export interface RenderedSlides {
	slidesHtml: string[];
	failedImages: string[];
}

const MIME_BY_EXT: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	apng: 'image/apng',
	bmp: 'image/bmp',
	webp: 'image/webp',
	svg: 'image/svg+xml'
};

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

/**
 * HTML 내 로컬 이미지를 base64 data URI로 치환.
 * http(s)/data: 는 그대로 두고, 읽기 실패한 경로는 failedImages에 수집하고 원본 유지.
 */
async function embedImages(
	html: string,
	fileDir: string,
	readBinary: ReadBinaryFn,
	failedImages: string[]
): Promise<string> {
	const imgRegex = /<img([^>]*?)src="(?!https?:|data:)([^"]+)"/g;
	const matches = [...html.matchAll(imgRegex)];
	let result = html;

	for (const match of matches) {
		const [full, attrs, src] = match;
		const absolutePath = src.startsWith('/') ? src : `${fileDir}/${src}`;
		const ext = src.split('.').pop()?.toLowerCase() ?? '';
		const mime = MIME_BY_EXT[ext];

		try {
			if (!mime) throw new Error(`unsupported extension: ${ext}`);
			const bytes = await readBinary(absolutePath);
			const dataUri = `data:${mime};base64,${toBase64(bytes)}`;
			result = result.replace(full, `<img${attrs}src="${dataUri}"`);
		} catch (error) {
			console.error('이미지 임베드 실패:', absolutePath, error);
			failedImages.push(src);
		}
	}

	return result;
}

/**
 * 마크다운을 내보내기용 슬라이드 HTML 배열로 렌더 (이미지 임베드 포함)
 */
export async function renderSlidesForExport(
	markdown: string,
	filePath: string | null,
	readBinary: ReadBinaryFn = readFile
): Promise<RenderedSlides> {
	const fileDir = filePath ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
	const failedImages: string[] = [];
	const slidesHtml: string[] = [];

	for (const slide of splitIntoSlides(markdown)) {
		const rawHtml = marked.parse(slide) as string;
		const sanitized = DOMPurify.sanitize(rawHtml);
		slidesHtml.push(await embedImages(sanitized, fileDir, readBinary, failedImages));
	}

	return { slidesHtml, failedImages };
}
