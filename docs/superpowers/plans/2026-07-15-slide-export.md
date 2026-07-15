# 슬라이드 내보내기 (Standalone HTML + PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 슬라이드를 단일 파일 산출물(슬라이드쇼 뷰어 HTML, 16:9 PDF)로 내보내는 기능.

**Architecture:** 새 `exportService.ts`가 "마크다운 → 슬라이드별 HTML 렌더 + 로컬 이미지 base64 임베드" 공통 파이프라인을 제공하고, 그 위에 HTML 뷰어 템플릿 생성과 html2pdf.js 기반 16:9 PDF 생성이 올라간다. 기존 `tauri.svelte`의 비활성 PDF 코드(~200줄)는 서비스로 이관 후 제거한다.

**Tech Stack:** SvelteKit(Svelte 5 legacy mode) + TypeScript, marked + DOMPurify, @tauri-apps/plugin-fs·plugin-dialog, html2pdf.js(기설치), 검증은 Playwright(Chromium/WebKit) 스크립트.

**Spec:** `docs/superpowers/specs/2026-07-15-slide-export-design.md`

## Global Constraints

- 새 런타임 의존성 추가 금지 (html2pdf.js는 이미 dependencies에 있음)
- 산출물은 완전 오프라인 동작 (외부 CDN/네트워크 참조 금지)
- 뷰어 HTML은 Tailwind 미의존 — 정적 CSS만 인라인
- PDF 페이지 규격: 254 × 142.875 mm (= 720 × 405 pt, 16:9), 슬라이드당 1페이지
- keydown 처리에는 반드시 `event.isComposing || event.keyCode === 229` IME 가드 포함
- 슬라이드 전환 시 스크롤 컨테이너 `scrollTop = 0` 리셋
- UI 문구는 한국어, 토스트는 기존 `showSuccess`/`showError`/`showWarning` 패턴 사용
- 모든 태스크 완료 시 `npm run check` 0 errors 유지 (기존 warning 23개는 무관)
- 이 레포에는 테스트 프레임워크가 없다. 검증은 임시 테스트 라우트(`src/routes/test-export/`) + Playwright 스크립트(스크래치패드)로 하고, Task 5에서 라우트를 제거한다
- Playwright 스크립트 실행 위치: `$SCRATCHPAD` (세션 스크래치패드, `npm i playwright@1.61.1` 완료된 상태. 없으면 `cd $SCRATCHPAD && npm i playwright@1.61.1`)
- dev 서버: `npm run dev` (포트 5173). 이미 떠 있으면 재사용

---

### Task 1: exportService — 슬라이드 렌더 + 이미지 base64 임베드

**Files:**
- Create: `src/lib/services/exportService.ts`
- Create: `src/routes/test-export/+page.svelte` (임시 검증 라우트 — Task 5에서 삭제)
- Test: `$SCRATCHPAD/verify-task1.mjs`

**Interfaces:**
- Consumes: `splitIntoSlides(content: string): string[]` (markdownService), `readFile(path): Promise<Uint8Array>` (@tauri-apps/plugin-fs)
- Produces (후속 태스크가 사용):
  - `type ReadBinaryFn = (path: string) => Promise<Uint8Array>`
  - `interface RenderedSlides { slidesHtml: string[]; failedImages: string[] }`
  - `renderSlidesForExport(markdown: string, filePath: string | null, readBinary?: ReadBinaryFn): Promise<RenderedSlides>`

- [ ] **Step 1: exportService.ts 생성 (렌더 + 임베드 파이프라인)**

```ts
// src/lib/services/exportService.ts
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
```

- [ ] **Step 2: 임시 검증 라우트 생성**

브라우저에서 plugin-fs를 쓸 수 없으므로 mock `readBinary`를 주입해 파이프라인을 검증한다.

```svelte
<!-- src/routes/test-export/+page.svelte -->
<script lang="ts">
	// TEMP: exportService 검증용 임시 라우트 (Task 5에서 삭제)
	import { renderSlidesForExport } from '$lib/services/exportService';

	const SAMPLE_MD = [
		'# Slide 1\n\n![logo](images/logo.png)\n\n![remote](https://example.com/r.png)',
		'# Slide 2\n\n![missing](images/nope.png)\n\n- item'
	].join('\n---\n');

	// 1x1 PNG mock — images/logo.png만 성공, 나머지는 실패
	const PNG_BYTES = Uint8Array.from(atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
	), (c) => c.charCodeAt(0));

	if (typeof window !== 'undefined') {
		(window as any).__renderForExport = async () => {
			const mockRead = async (path: string) => {
				if (path.endsWith('images/logo.png')) return PNG_BYTES;
				throw new Error('not found: ' + path);
			};
			return await renderSlidesForExport(SAMPLE_MD, '/fake/dir/deck.md', mockRead);
		};
	}
</script>

<p>test-export harness</p>
```

- [ ] **Step 3: 검증 스크립트 작성**

```js
// $SCRATCHPAD/verify-task1.mjs
import { chromium } from 'playwright';
import assert from 'node:assert';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173/test-export');
await page.waitForFunction(() => typeof window.__renderForExport === 'function');

const r = await page.evaluate(() => window.__renderForExport());

assert.equal(r.slidesHtml.length, 2, 'slide count');
assert.ok(r.slidesHtml[0].includes('data:image/png;base64,'), 'local image embedded as data URI');
assert.ok(r.slidesHtml[0].includes('https://example.com/r.png'), 'remote image untouched');
assert.ok(r.slidesHtml[1].includes('images/nope.png'), 'failed image keeps original src');
assert.deepEqual(r.failedImages, ['images/nope.png'], 'failed image collected');
assert.ok(!r.slidesHtml[0].includes('<script'), 'sanitized');
assert.equal(errors.length, 0, 'no page errors');
console.log('TASK1 PASS');
await browser.close();
```

- [ ] **Step 4: 검증 실행**

Run: `npm run dev` 백그라운드 기동 후 `cd $SCRATCHPAD && node verify-task1.mjs`
Expected: `TASK1 PASS`

- [ ] **Step 5: 타입 체크**

Run: `npm run check 2>&1 | tail -1`
Expected: `svelte-check found 0 errors ...`

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/exportService.ts src/routes/test-export/+page.svelte
git commit -m "feat: add export pipeline — slide render with base64 image embedding"
```

---

### Task 2: buildViewerHtml — standalone 슬라이드쇼 뷰어 템플릿

**Files:**
- Modify: `src/lib/services/exportService.ts` (함수 추가)
- Modify: `src/routes/test-export/+page.svelte` (훅 추가)
- Test: `$SCRATCHPAD/verify-task2.mjs`

**Interfaces:**
- Consumes: Task 1의 `RenderedSlides.slidesHtml`
- Produces: `buildViewerHtml(slidesHtml: string[], title: string): string` — 완결된 HTML 문서 문자열

- [ ] **Step 1: exportService.ts에 뷰어 템플릿 추가**

```ts
// exportService.ts에 추가

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
```

- [ ] **Step 2: 테스트 라우트에 훅 추가**

`src/routes/test-export/+page.svelte`의 `if (typeof window ...)` 블록 안에 추가:

```ts
import { buildViewerHtml } from '$lib/services/exportService';
// ...
(window as any).__buildViewer = async () => {
	const tall = Array.from({ length: 60 }, (_, i) => `- line ${i + 1}`).join('\n');
	const md = `# Tall 1\n\n${tall}\n---\n# Tall 2\n\n${tall}\n---\n# Short`;
	const { slidesHtml } = await renderSlidesForExport(md, null);
	return buildViewerHtml(slidesHtml, 'My <Deck> & Co');
};
```

- [ ] **Step 3: 검증 스크립트 작성 — file://로 열어 실사용 검증**

```js
// $SCRATCHPAD/verify-task2.mjs
import { chromium, webkit } from 'playwright';
import assert from 'node:assert';
import { writeFileSync } from 'node:fs';

// 1) 뷰어 HTML 생성
const gen = await chromium.launch();
const genPage = await gen.newPage();
await genPage.goto('http://localhost:5173/test-export');
await genPage.waitForFunction(() => typeof window.__buildViewer === 'function');
const html = await genPage.evaluate(() => window.__buildViewer());
await gen.close();
const outPath = new URL('./exported-viewer.html', import.meta.url).pathname;
writeFileSync(outPath, html);
assert.ok(html.includes('My &lt;Deck&gt; &amp; Co'), 'title escaped');
assert.ok(!html.includes('http'), 'no external references');

// 2) 두 엔진에서 file://로 열어 검증
for (const engine of [chromium, webkit]) {
	const browser = await engine.launch();
	const page = await browser.newPage();
	await page.goto('file://' + outPath);
	assert.equal(await page.locator('.slide').count(), 3, 'slide sections');
	assert.equal(await page.textContent('#counter'), '1 / 3', 'initial counter');
	// 긴 슬라이드 스크롤 → 다음 → scrollTop 리셋 확인
	await page.evaluate(() => { const c = document.getElementById('card'); c.scrollTop = c.scrollHeight; });
	await page.keyboard.press('ArrowRight');
	assert.equal(await page.textContent('#counter'), '2 / 3', 'keyboard nav');
	assert.equal(await page.evaluate(() => document.getElementById('card').scrollTop), 0, 'scroll reset');
	// 버튼 내비 + 경계 버튼 숨김
	await page.click('#next');
	assert.equal(await page.textContent('#counter'), '3 / 3', 'button nav');
	assert.equal(await page.evaluate(() => document.getElementById('next').style.visibility), 'hidden', 'next hidden at end');
	await browser.close();
}
console.log('TASK2 PASS');
```

- [ ] **Step 4: 검증 실행**

Run: `cd $SCRATCHPAD && node verify-task2.mjs`
Expected: `TASK2 PASS`

- [ ] **Step 5: 타입 체크**

Run: `npm run check 2>&1 | tail -1`
Expected: `svelte-check found 0 errors ...`

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/exportService.ts src/routes/test-export/+page.svelte
git commit -m "feat: add standalone slideshow viewer HTML template"
```

---

### Task 3: HTML 내보내기 배선 — saveHtmlFile + exportToHtml + 툴바 드롭다운

**Files:**
- Modify: `src/lib/services/fileService.ts` (saveHtmlFile 추가)
- Modify: `src/lib/services/exportService.ts` (exportToHtml 추가)
- Modify: `src/lib/components/part/EditorToolbar.svelte` (내보내기 드롭다운)
- Modify: `src/lib/components/screen/tauri.svelte` (핸들러 연결)

**Interfaces:**
- Consumes: Task 1–2의 `renderSlidesForExport`, `buildViewerHtml`; 기존 `utils.getFileName`, `utils.getFileNameWithoutExtension`
- Produces:
  - `fileService.saveHtmlFile(defaultName: string): Promise<string | null>`
  - `exportService.exportToHtml(markdown: string, filePath: string): Promise<{ saved: boolean; failedImages: string[] }>`
  - EditorToolbar props: `onExportHtml: () => void`, `onExportPdf: () => void` (기존 `onExportPdf` 유지)

- [ ] **Step 1: fileService.ts에 saveHtmlFile 추가** (savePdfFile 바로 아래)

```ts
/**
 * HTML 파일 저장 다이얼로그
 */
export async function saveHtmlFile(defaultName: string): Promise<string | null> {
	return (await save({
		defaultPath: defaultName,
		filters: [
			{
				name: 'HTML',
				extensions: ['html']
			}
		]
	})) as string | null;
}
```

- [ ] **Step 2: exportService.ts에 exportToHtml 추가**

파일 상단 import에 추가: `import { writeTextFile } from '@tauri-apps/plugin-fs';`, `import { saveHtmlFile } from './fileService';`

```ts
export interface ExportOutcome {
	saved: boolean;
	failedImages: string[];
}

/**
 * standalone HTML로 내보내기. 저장 취소 시 { saved: false }
 */
export async function exportToHtml(markdown: string, filePath: string): Promise<ExportOutcome> {
	const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
	const baseName = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;

	const savePath = await saveHtmlFile(`${baseName}.html`);
	if (!savePath) return { saved: false, failedImages: [] };

	const { slidesHtml, failedImages } = await renderSlidesForExport(markdown, filePath);
	await writeTextFile(savePath, buildViewerHtml(slidesHtml, baseName));
	return { saved: true, failedImages };
}
```

- [ ] **Step 3: EditorToolbar에 내보내기 드롭다운 추가**

`EditorToolbar.svelte` — 기존 주석 처리된 PDF 버튼(`<!-- <button ... onExportPdf ... -->`)을 삭제하고, 저장 버튼 앞에 아래 드롭다운을 추가한다. 새 prop `export let onExportHtml: () => void;`를 props 목록(`onExportPdf` 옆)에 추가. 메뉴 상태는 로컬로 관리:

```svelte
<script lang="ts">
	// 기존 import에 FileDown이 이미 있음. props에 추가:
	export let onExportHtml: () => void;
	// (onExportPdf는 기존 prop 유지)

	let showExportMenu = false;
</script>

<!-- 저장 버튼 앞에 삽입 -->
<div class="relative">
	<button
		class="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors {showExportMenu
			? 'bg-accent'
			: ''} {hasSlides
			? 'hover:bg-accent hover:text-accent-foreground'
			: 'cursor-not-allowed opacity-50'}"
		on:click={hasSlides ? () => (showExportMenu = !showExportMenu) : undefined}
		disabled={!hasSlides}
		data-tooltip="내보내기"
		data-tooltip-position="left"
	>
		<FileDown class="h-4 w-4" />
	</button>
	{#if showExportMenu}
		<div
			class="fixed inset-0 z-40"
			on:click={() => (showExportMenu = false)}
			role="button"
			tabindex="-1"
			on:keydown={() => {}}
			aria-label="닫기"
		></div>
		<div
			class="absolute top-full right-0 z-50 mt-2 w-44 rounded-md border border-border bg-popover p-1 shadow-lg"
		>
			<button
				class="w-full rounded px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
				on:click={() => { showExportMenu = false; onExportHtml(); }}
			>
				HTML로 내보내기
			</button>
			<button
				class="w-full rounded px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
				on:click={() => { showExportMenu = false; onExportPdf(); }}
			>
				PDF로 내보내기
			</button>
		</div>
	{/if}
</div>
```

기존 `handleKeydown`의 Escape 처리에 메뉴 닫기 추가:

```ts
function handleKeydown(event: KeyboardEvent) {
	if (showTableGrid && event.key === 'Escape') {
		event.preventDefault();
		event.stopPropagation();
		onTableToggle();
	}
	if (showExportMenu && event.key === 'Escape') {
		event.preventDefault();
		event.stopPropagation();
		showExportMenu = false;
	}
}
```

- [ ] **Step 4: tauri.svelte 배선**

`import * as exportService from '$lib/services/exportService';`를 서비스 import 블록에 추가하고, `exportToPdf` 함수 근처에 핸들러 추가:

```ts
// HTML로 내보내기
async function handleExportHtml() {
	if (isExporting || !currentFilePath) return;
	isExporting = true;
	try {
		const result = await exportService.exportToHtml(markdownContent, currentFilePath);
		if (result.saved) {
			if (result.failedImages.length > 0) {
				showWarning(`이미지 ${result.failedImages.length}개를 임베드하지 못했습니다.`);
			}
			showSuccess('HTML 파일로 내보냈습니다.');
		}
	} catch (error) {
		console.error('HTML 내보내기 실패:', error);
		showError('HTML 내보내기 중 오류가 발생했습니다.');
	} finally {
		isExporting = false;
	}
}
```

템플릿의 `<EditorToolbar ...>`에 `onExportHtml={handleExportHtml}` 추가 (기존 `onExportPdf={exportToPdf}`는 이 태스크에서는 그대로 둔다 — PDF는 Task 4에서 교체).

- [ ] **Step 5: 타입 체크**

Run: `npm run check 2>&1 | tail -1`
Expected: `svelte-check found 0 errors ...`

- [ ] **Step 6: 실앱 스모크 테스트**

Run: `CC=/usr/bin/cc CXX=/usr/bin/c++ RUSTFLAGS="-C linker=/usr/bin/cc" npm run tauri:dev` (백그라운드)
수동 확인: 이미지가 포함된 md 파일 열기 → 내보내기 버튼 → "HTML로 내보내기" → 저장 → 저장된 파일을 브라우저로 열어 방향키 내비게이션·이미지 표시 확인. 저장 다이얼로그 취소 시 토스트가 안 뜨는 것도 확인.
Expected: 내보낸 HTML이 브라우저에서 슬라이드쇼로 동작

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/fileService.ts src/lib/services/exportService.ts src/lib/components/part/EditorToolbar.svelte src/lib/components/screen/tauri.svelte
git commit -m "feat: wire standalone HTML export with toolbar export dropdown"
```

---

### Task 4: PDF 내보내기 이관·개선 (16:9) + 레거시 제거

**Files:**
- Modify: `src/lib/services/exportService.ts` (exportToPdf 추가)
- Modify: `src/lib/components/screen/tauri.svelte` (레거시 exportToPdf·printStyles·print-container 제거, 새 핸들러 연결)
- Test: `$SCRATCHPAD/verify-task4.sh`

**Interfaces:**
- Consumes: Task 1의 `renderSlidesForExport`, 기존 `fileService.savePdfFile`, `writeFile`(@tauri-apps/plugin-fs)
- Produces: `exportService.exportToPdf(markdown: string, filePath: string): Promise<{ saved: boolean; failedImages: string[]; overflowSlides: number[] }>`

- [ ] **Step 1: exportService.ts에 PDF 스타일 + exportToPdf 추가**

import 추가: `import { writeFile } from '@tauri-apps/plugin-fs';`, `import { savePdfFile } from './fileService';`

```ts
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
	const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
	const baseName = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;

	const savePath = await savePdfFile(`${baseName}.pdf`);
	if (!savePath) return { saved: false, failedImages: [], overflowSlides: [] };

	const { slidesHtml, failedImages } = await renderSlidesForExport(markdown, filePath);

	// 오프스크린 렌더 컨테이너 (화면 밖 배치 — 레이아웃은 계산되지만 보이지 않음)
	const container = document.createElement('div');
	container.style.cssText = 'position: fixed; left: 0; top: 0; z-index: -1000; opacity: 0; pointer-events: none;';
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
		// 이미지 로드 대기 (base64라 즉시지만 디코드 시간 확보)
		await new Promise((resolve) => setTimeout(resolve, 100));

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
			jsPDF: { unit: 'mm' as const, format: [254, 142.875], orientation: 'landscape' as const },
			pagebreak: { mode: ['css', 'legacy'] }
		};

		const pdfBuffer = await html2pdf().set(opt).from(container).output('arraybuffer');
		await writeFile(savePath, new Uint8Array(pdfBuffer as ArrayBuffer));
		return { saved: true, failedImages, overflowSlides };
	} finally {
		container.remove();
	}
}
```

- [ ] **Step 2: tauri.svelte 레거시 제거 + 새 핸들러**

제거 대상 (모두 `tauri.svelte`):
1. `printStyles` const 전체 (`// PDF 및 인쇄용 통합 스타일` 주석부터 백틱 닫힘까지)
2. `async function exportToPdf() { ... }` 전체
3. 템플릿의 `<!-- 인쇄용 히든 컨테이너 -->` div (`.print-container` `{#each}` 블록)
4. `<style>` 내 `.print-slide`·`.print-container` 관련 규칙 전부와 `@media print` 블록 (`.line-clamp-2`는 유지)

추가 — `handleExportHtml` 옆에:

```ts
// PDF로 내보내기
async function handleExportPdf() {
	if (isExporting || !currentFilePath) return;
	isExporting = true;
	try {
		const result = await exportService.exportToPdf(markdownContent, currentFilePath);
		if (result.saved) {
			if (result.failedImages.length > 0) {
				showWarning(`이미지 ${result.failedImages.length}개를 임베드하지 못했습니다.`);
			}
			if (result.overflowSlides.length > 0) {
				showWarning(`슬라이드 ${result.overflowSlides.join(', ')}번의 내용이 페이지를 넘어 잘렸습니다.`);
			}
			showSuccess('PDF가 저장되었습니다.');
		}
	} catch (error) {
		console.error('PDF 내보내기 실패:', error);
		showError('PDF 생성 중 오류가 발생했습니다.');
	} finally {
		isExporting = false;
	}
}
```

템플릿: `onExportPdf={exportToPdf}` → `onExportPdf={handleExportPdf}`.
`isExporting` 선언은 유지하되 더 이상 안 쓰는 `.exporting` CSS 규칙도 제거.

- [ ] **Step 3: 타입 체크**

Run: `npm run check 2>&1 | tail -1`
Expected: `svelte-check found 0 errors ...`
주의: `format: [254, 142.875]`가 `@types/html2pdf.js` 타입과 안 맞으면 `format: [254, 142.875] as [number, number]`로 캐스팅.

- [ ] **Step 4: 실앱에서 PDF 생성 + 규격 검증**

tauri dev에서 이미지 포함 md로 "PDF로 내보내기" → `~/Downloads/test-deck.pdf` 저장 후:

```bash
# $SCRATCHPAD/verify-task4.sh
PDF="$1"
echo "--- MediaBox (expect 720 x 405 pt) ---"
strings "$PDF" | grep -m1 -o 'MediaBox[^]]*]'
echo "--- page count (expect slide count) ---"
mdls -name kMDItemNumberOfPages "$PDF"
```

Run: `bash $SCRATCHPAD/verify-task4.sh ~/Downloads/test-deck.pdf`
Expected: MediaBox에 `720`과 `405` 포함, 페이지 수 = 슬라이드 수. 720px 넘치는 슬라이드를 만들어 잘림 경고 토스트도 확인.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/exportService.ts src/lib/components/screen/tauri.svelte
git commit -m "feat: 16:9 PDF export via exportService, remove legacy print code"
```

---

### Task 5: 정리 + 통합 검증 + 문서

**Files:**
- Delete: `src/routes/test-export/+page.svelte` (디렉터리째)
- Modify: `README.md` (기능 목록에 내보내기 추가)

**Interfaces:**
- Consumes: Task 1–4 전부 완료 상태
- Produces: 릴리스 가능한 작업 트리

- [ ] **Step 1: 임시 테스트 라우트 삭제**

```bash
rm -rf src/routes/test-export
```

- [ ] **Step 2: README 기능 목록 갱신**

`README.md`의 `### Presentation` 섹션 아래에 추가:

```markdown
### Export

- Standalone HTML export — single self-contained file, opens as a slideshow viewer in any browser (images embedded)
- PDF export — 16:9 pages, one slide per page
```

- [ ] **Step 3: 최종 체크**

Run: `npm run check 2>&1 | tail -1` → `0 errors`
Run: `npm run build 2>&1 | tail -1` → `✔ done`
실앱 스모크: HTML/PDF 내보내기 각 1회, 빈 파일(슬라이드 없음)에서 버튼 disabled 확인.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove export test harness, document export feature"
```
