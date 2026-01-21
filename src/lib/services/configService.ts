import { invoke } from '@tauri-apps/api/core';
import { homeDir } from '@tauri-apps/api/path';

export interface AppConfig {
	workspace_path: string;
	auto_save_enabled: boolean;
	font_size: number;
	font_family: string;
	confirm_delete: boolean;
	notifications_enabled: boolean;
}

/**
 * 설정 로드
 */
export async function loadConfig(): Promise<AppConfig> {
	try {
		return await invoke<AppConfig>('load_config');
	} catch (error) {
		console.error('설정 로드 오류:', error);
		const home = await homeDir();
		return {
			workspace_path: `${home}/mdslide`,
			auto_save_enabled: true,
			font_size: 14,
			font_family: 'JetBrains Mono',
			confirm_delete: true,
			notifications_enabled: true
		};
	}
}

/**
 * 설정 저장
 */
export async function saveConfig(config: AppConfig): Promise<void> {
	await invoke('save_config', { config });
	console.log('설정이 저장되었습니다:', config);
}

/**
 * 시스템 폰트 목록 로드
 */
export async function loadSystemFonts(): Promise<string[]> {
	try {
		return await invoke<string[]>('get_system_fonts');
	} catch (error) {
		console.error('폰트 목록 로드 오류:', error);
		return ['JetBrains Mono', 'Monaco', 'Menlo', 'Consolas', 'monospace'];
	}
}

/**
 * 윈도우 타이틀 설정
 */
export async function setWindowTitle(title: string): Promise<void> {
	await invoke('set_window_title', { title });
}
