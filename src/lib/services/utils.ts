/**
 * 파일명 포맷 생성 (타임스탬프 기반)
 */
export function formatFileName(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');

	return `${year}${month}${day}-${hours}${minutes}${seconds}.md`;
}

/**
 * Debounce 함수
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout>;

	return function executedFunction(...args: Parameters<T>) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};

		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * 파일명에서 확장자 제거
 */
export function getFileNameWithoutExtension(fileName: string): string {
	const lastDot = fileName.lastIndexOf('.');
	if (lastDot === -1) return fileName;
	return fileName.substring(0, lastDot);
}

/**
 * 경로에서 파일명 추출
 */
export function getFileName(path: string): string {
	return path.substring(path.lastIndexOf('/') + 1);
}

/**
 * 경로에서 디렉터리 경로 추출
 */
export function getDirectoryPath(path: string): string {
	return path.substring(0, path.lastIndexOf('/'));
}
