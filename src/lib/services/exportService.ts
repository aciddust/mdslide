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

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

const VIEWER_CSS = `
	* { margin: 0; padding: 0; box-sizing: border-box; }
	body { background: #000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
	.stage { display: flex; align-items: center; justify-content: center; height: 100vh; padding: 2rem; }
	#card { background: #fff; color: #1a1a1a; width: 100%; max-width: 1400px; max-height: 85vh; overflow-y: auto; border-radius: 8px; padding: 4rem 5rem; box-shadow: 0 25px 50px rgba(0,0,0,.5); font-size: clamp(16px, 1.4vw, 24px); line-height: 1.8; }
	.slide { display: none; }
	.slide.active { display: block; }
	.slide h1 { font-size: 2.2em; font-weight: 700; margin-bottom: .5em; }
	.slide h2 { font-size: 1.8em; font-weight: 700; margin-bottom: .5em; }
	.slide h3 { font-size: 1.5em; font-weight: 700; margin-bottom: .5em; }
	.slide h4 { font-size: 1.25em; font-weight: 700; margin-bottom: .5em; }
	.slide p { margin-bottom: 1em; }
	.slide ul, .slide ol { margin-bottom: 1em; padding-left: 1.6em; }
	.slide li { margin-bottom: .25em; }
	.slide blockquote { border-left: 4px solid #ccc; padding-left: 1em; color: #666; margin-bottom: 1em; }
	.slide pre { background: #f5f5f5; padding: 1em; border-radius: 6px; overflow-x: auto; margin-bottom: 1em; }
	.slide code { font-family: ui-monospace, 'JetBrains Mono', Menlo, monospace; font-size: .9em; background: #f0f0f0; padding: .1em .35em; border-radius: 4px; }
	.slide pre code { background: none; padding: 0; }
	.slide table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
	.slide th, .slide td { border: 1px solid #ddd; padding: .5em .75em; text-align: left; }
	.slide th { background: #f2f2f2; font-weight: 700; }
	.slide img { max-width: 100%; max-height: 60vh; object-fit: contain; }
	.slide a { color: #5200cc; }
	.viewer-ui button { border: none; cursor: pointer; }
	#counter { position: fixed; top: 1rem; right: 1rem; background: rgba(0,0,0,.5); color: #fff; padding: .5rem .75rem; border-radius: 6px; font-size: 14px; }
	#prev, #next { position: fixed; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,.5); color: #fff; border-radius: 50%; width: 48px; height: 48px; font-size: 20px; }
	#prev:hover, #next:hover { background: rgba(0,0,0,.7); }
	#prev { left: 1rem; }
	#next { right: 1rem; }
	@media print {
		.viewer-ui { display: none !important; }
		body { background: #fff; }
		.stage { display: block; height: auto; padding: 0; }
		#card { max-width: none; max-height: none; overflow: visible; border-radius: 0; box-shadow: none; padding: 2rem; }
		.slide { display: block !important; page-break-after: always; }
		.slide:last-child { page-break-after: auto; }
	}
`;

const VIEWER_JS = `
	(function () {
		var slides = document.querySelectorAll('.slide');
		var card = document.getElementById('card');
		var counter = document.getElementById('counter');
		var prevBtn = document.getElementById('prev');
		var nextBtn = document.getElementById('next');
		var current = 0;

		function show(n) {
			if (n < 0 || n >= slides.length) return;
			slides[current].classList.remove('active');
			current = n;
			slides[current].classList.add('active');
			card.scrollTop = 0;
			counter.textContent = (current + 1) + ' / ' + slides.length;
			prevBtn.style.visibility = current === 0 ? 'hidden' : 'visible';
			nextBtn.style.visibility = current === slides.length - 1 ? 'hidden' : 'visible';
		}

		document.addEventListener('keydown', function (e) {
			if (e.isComposing || e.keyCode === 229) return;
			if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); show(current - 1); }
			else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); show(current + 1); }
			else if (e.key === 'Home') { e.preventDefault(); show(0); }
			else if (e.key === 'End') { e.preventDefault(); show(slides.length - 1); }
			else if (e.key === 'f' || e.key === 'F') {
				if (document.fullscreenElement) { document.exitFullscreen(); }
				else { document.documentElement.requestFullscreen(); }
			}
		});
		prevBtn.addEventListener('click', function () { show(current - 1); });
		nextBtn.addEventListener('click', function () { show(current + 1); });
		show(0);
	})();
`;

/**
 * 단일 파일 슬라이드쇼 뷰어 HTML 생성
 */
export function buildViewerHtml(slidesHtml: string[], title: string): string {
	const sections = slidesHtml
		.map((html, i) => `<section class="slide${i === 0 ? ' active' : ''}">${html}</section>`)
		.join('\n');

	return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${VIEWER_CSS}</style>
</head>
<body>
<div class="viewer-ui">
	<div id="counter">1 / ${slidesHtml.length}</div>
	<button id="prev" aria-label="이전 슬라이드">&#8592;</button>
	<button id="next" aria-label="다음 슬라이드">&#8594;</button>
</div>
<div class="stage"><main id="card">
${sections}
</main></div>
<script>${VIEWER_JS}</script>
</body>
</html>`;
}
