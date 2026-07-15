<!-- src/routes/test-export/+page.svelte -->
<script lang="ts">
	// TEMP: exportService 검증용 임시 라우트 (Task 5에서 삭제)
	import { renderSlidesForExport, buildViewerHtml } from '$lib/services/exportService';

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

		(window as any).__buildViewer = async () => {
			const tall = Array.from({ length: 60 }, (_, i) => `- line ${i + 1}`).join('\n');
			const md = `# Tall 1\n\n${tall}\n---\n# Tall 2\n\n${tall}\n---\n# Short`;
			const { slidesHtml } = await renderSlidesForExport(md, null);
			return buildViewerHtml(slidesHtml, 'My <Deck> & Co');
		};
	}
</script>

<p>test-export harness</p>
