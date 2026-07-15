import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { readFile, writeTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { splitIntoSlides } from './markdownService';
import { saveHtmlFile, savePdfFile } from './fileService';
import { getFileName, getFileNameWithoutExtension } from './utils';

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

export interface ExportOutcome {
	saved: boolean;
	failedImages: string[];
}

/**
 * standalone HTML로 내보내기. 저장 취소 시 { saved: false }
 */
export async function exportToHtml(markdown: string, filePath: string): Promise<ExportOutcome> {
	const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
	const baseName = fileName.includes('.')
		? fileName.substring(0, fileName.lastIndexOf('.'))
		: fileName;

	const savePath = await saveHtmlFile(`${baseName}.html`);
	if (!savePath) return { saved: false, failedImages: [] };

	const { slidesHtml, failedImages } = await renderSlidesForExport(markdown, filePath);
	await writeTextFile(savePath, buildViewerHtml(slidesHtml, baseName));
	return { saved: true, failedImages };
}

// html2canvas가 oklch를 지원하지 않으므로 onclone에서 앱 스타일을 제거하고 이것만 주입한다
const PDF_STYLES = `
	* { margin: 0; padding: 0; box-sizing: border-box; }
	.pdf-slide { width: 1280px; height: 720px; overflow: hidden; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 48px 80px; background: #fff; color: #000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; font-size: 20px; line-height: 1.7; page-break-after: always; }
	.pdf-slide:last-child { page-break-after: auto; }
	.pdf-slide h1 { font-size: 2.2em; font-weight: 700; margin-bottom: .5em; }
	.pdf-slide h2 { font-size: 1.8em; font-weight: 700; margin-bottom: .5em; }
	.pdf-slide h3 { font-size: 1.5em; font-weight: 700; margin-bottom: .5em; }
	.pdf-slide h4 { font-size: 1.25em; font-weight: 700; margin-bottom: .5em; }
	.pdf-slide p { margin-bottom: 1em; width: 100%; }
	.pdf-slide ul, .pdf-slide ol { margin-bottom: 1em; padding-left: 1.6em; width: 100%; }
	.pdf-slide blockquote { border-left: 4px solid #ccc; padding-left: 1em; color: #666; width: 100%; }
	.pdf-slide pre { background: #f5f5f5; padding: 1em; border-radius: 6px; overflow-x: auto; width: 100%; }
	.pdf-slide code { font-family: ui-monospace, Menlo, monospace; font-size: .9em; }
	.pdf-slide table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
	.pdf-slide th, .pdf-slide td { border: 1px solid #000; padding: 8px 12px; text-align: left; }
	.pdf-slide th { background: #f0f0f0; font-weight: 700; }
	.pdf-slide img { max-width: 100%; max-height: 480px; object-fit: contain; }
`;

/**
 * 16:9 PDF로 내보내기 (슬라이드당 1페이지, 넘치는 콘텐츠는 잘림).
 * 저장 취소 시 { saved: false }
 */
export async function exportToPdf(
	markdown: string,
	filePath: string
): Promise<{ saved: boolean; failedImages: string[]; overflowSlides: number[] }> {
	const baseName = getFileNameWithoutExtension(getFileName(filePath));

	const savePath = await savePdfFile(`${baseName}.pdf`);
	if (!savePath) return { saved: false, failedImages: [], overflowSlides: [] };

	const { slidesHtml, failedImages } = await renderSlidesForExport(markdown, filePath);

	// 오프스크린 렌더 컨테이너 (화면 밖 배치 — 레이아웃은 계산되지만 보이지 않음)
	const container = document.createElement('div');
	container.style.cssText =
		'position: fixed; left: 0; top: 0; z-index: -1000; opacity: 0; pointer-events: none;';
	const style = document.createElement('style');
	style.textContent = PDF_STYLES;
	container.appendChild(style);

	const overflowSlides: number[] = [];
	for (const html of slidesHtml) {
		const slide = document.createElement('div');
		slide.className = 'pdf-slide';
		slide.innerHTML = html;
		container.appendChild(slide);
	}
	document.body.appendChild(container);

	try {
		// 이미지 디코드 완료 대기 (대용량 base64 이미지가 빈 이미지로 캡처되지 않도록)
		await Promise.all(
			Array.from(container.querySelectorAll('img')).map((img) => img.decode().catch(() => {}))
		);

		// 넘침 감지
		container.querySelectorAll('.pdf-slide').forEach((el, i) => {
			if (el.scrollHeight > el.clientHeight) overflowSlides.push(i + 1);
		});

		const html2pdf = (await import('html2pdf.js')).default;
		const opt = {
			margin: 0,
			image: { type: 'jpeg' as const, quality: 0.98 },
			html2canvas: {
				scale: 2,
				useCORS: true,
				logging: false,
				windowWidth: 1280,
				onclone: (doc: Document) => {
					doc.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => el.remove());
					const s = doc.createElement('style');
					s.textContent = PDF_STYLES;
					doc.head.appendChild(s);
				}
			},
			jsPDF: {
				unit: 'mm' as const,
				format: [254, 142.875] as [number, number],
				orientation: 'landscape' as const
			},
			pagebreak: { mode: ['css', 'legacy'] }
		};

		const pdfBuffer = await html2pdf().set(opt).from(container).output('arraybuffer');
		await writeFile(savePath, new Uint8Array(pdfBuffer as ArrayBuffer));
		return { saved: true, failedImages, overflowSlides };
	} finally {
		container.remove();
	}
}
