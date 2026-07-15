# 슬라이드 내보내기 (Standalone HTML + PDF) 설계

날짜: 2026-07-15
상태: 승인됨

## 목적

mdslide로 만든 슬라이드를 앱이 없는 사람에게 전달하거나 문서로 제출할 수 있도록,
PPT 파일처럼 완결된 산출물로 내보낸다.

- **Standalone HTML**: 파일 하나. 브라우저에서 열면 슬라이드쇼 뷰어로 동작 (방향키/버튼 내비게이션)
- **PDF**: 16:9 페이지, 슬라이드당 1페이지

## 요구사항

1. 두 포맷 모두 단일 파일로 완결된다 — 로컬 이미지는 base64 data URI로 임베드
2. 완전 오프라인 동작 (외부 CDN/네트워크 의존 없음)
3. 새 런타임 의존성을 추가하지 않는다 (html2pdf.js는 기설치)
4. macOS / Windows 빌드에서 동일하게 동작

## 비목표 (Non-goals)

- 벡터 PDF (html2pdf.js는 래스터 기반. 벡터가 필요하면 내보낸 HTML을 브라우저에서 ⌘P — 뷰어에 인쇄 CSS 내장)
- 사용자 설정 폰트의 파일 임베드 (뷰어는 시스템 폰트 스택 사용)
- 페이지 규격 선택 UI (PDF는 16:9 고정)
- 슬라이드 전환 애니메이션

## 아키텍처

```
마크다운 (markdownContent, currentFilePath)
  → renderSlidesForExport()       슬라이드별 HTML 렌더 + 이미지 base64 임베드   ┐ 공통
     ├─ exportToHtml()            뷰어 템플릿에 삽입 → 저장 다이얼로그 → .html   │ 파이프
     └─ exportToPdf()             1280×720 렌더 박스 → html2pdf.js → .pdf      ┘ 라인
```

### 신규: `src/lib/services/exportService.ts`

| 함수 | 역할 |
|---|---|
| `renderSlidesForExport(markdown, filePath)` | `splitIntoSlides` → 슬라이드별 marked+DOMPurify 렌더. `<img src>`가 http/data가 아니면 md 파일 기준 상대경로를 해석해 plugin-fs `readFile`로 읽어 data URI로 치환. 반환: `{ slidesHtml: string[], failedImages: string[] }` |
| `buildViewerHtml(slidesHtml, title)` | standalone 뷰어 HTML 문자열 생성 (CSS/JS 전부 인라인) |
| `exportToHtml(markdown, filePath)` | 저장 다이얼로그(`saveHtmlFile`) → 뷰어 HTML 저장. 취소 시 false |
| `exportToPdf(markdown, filePath)` | 기존 tauri.svelte의 exportToPdf + printStyles를 이관·개선 (16:9). 취소 시 false |

### 변경

- `fileService.ts`: `saveHtmlFile(defaultName)` 추가 (기존 `savePdfFile` 패턴 동일)
- `EditorToolbar.svelte`: 주석 처리된 PDF 버튼 제거, **내보내기 버튼 + 드롭다운(HTML / PDF)** 추가
  — 테이블 그리드 팝오버와 같은 backdrop+popover 패턴, `hasSlides` false면 disabled
- `screen/tauri.svelte`: `exportToPdf`·`printStyles`·인쇄용 히든 컨테이너(`.print-container` div 및 관련
  `<style>`, ~200줄) 제거하고 exportService 호출로 대체. exportService가 자체적으로 오프스크린
  렌더 컨테이너를 생성·정리한다. `isExporting` 상태로 내보내기 중 중복 실행 방지 (HTML/PDF 공용)

## Standalone HTML 뷰어 스펙

- **레이아웃**: 검정 배경 + 흰 슬라이드 카드(max-height 85vh, 내부 스크롤) — 앱 슬라이드쇼 모드와 동일한 감성. 16:9 고정 아님(화면 맞춤)
- **내비게이션**: ←/↑ 이전, →/↓/Space 다음, Home/End 처음/끝, `F` 전체화면(Fullscreen API). 좌우 오버레이 버튼(경계에서 자동 숨김), 우상단 `3 / 12` 카운터
- **keydown 가드**: `event.isComposing || event.keyCode === 229` 무시 (CJK IME 중복 이벤트 — 앱 본체와 동일한 이유)
- **스크롤 리셋**: 슬라이드 전환 시 카드 `scrollTop = 0`
- **마크다운 스타일**: Tailwind 미의존. 제목(h1–h4)/문단/리스트/표/코드블록/인라인코드/인용/이미지/링크를 커버하는 정적 CSS를 템플릿에 내장. 폰트는 시스템 스택(`-apple-system, 'Segoe UI', sans-serif`, 코드는 `ui-monospace, monospace`)
- **인쇄 CSS 내장**: `@media print`에서 뷰어 UI 숨기고 전체 슬라이드를 페이지당 1장으로 나열 → 브라우저 ⌘P로 벡터 PDF 획득 가능
- **`<title>`**: 원본 파일명(확장자 제외)
- **XSS**: 슬라이드 HTML은 DOMPurify sanitize를 거친 것만 삽입 (기존 renderMarkdown과 동일 수준)

## PDF 스펙

- **페이지**: jsPDF 커스텀 format 254 × 142.875 mm (10 × 5.625 in, 가로가 긴 16:9 규격), 슬라이드당 1페이지
- **렌더링**: 숨김 컨테이너에 슬라이드마다 1280×720px 고정 박스(flex 중앙 정렬)로 렌더 → html2canvas scale 2 → jsPDF
- **넘침 정책**: 콘텐츠가 720px를 넘으면 잘린다(PPT와 동일). 잘림이 발생한 슬라이드 번호를 완료 토스트에 경고로 표시 (`scrollHeight > clientHeight` 검사)
- **oklch 우회**: 기존 방식 유지 — html2canvas `onclone`에서 앱 스타일시트 제거 후 PDF 전용 스타일 주입
- **이미지**: base64 임베드 상태라 asset 프로토콜/CORS 이슈 없음

## 에러 처리

| 상황 | 동작 |
|---|---|
| 저장 다이얼로그 취소 | 아무 동작 없음 (토스트 없음) |
| 이미지 파일 읽기 실패 | 해당 `<img>`는 원본 src 유지, 완료 토스트에 "이미지 N개를 임베드하지 못했습니다" 경고 |
| 슬라이드 없음 (파일 미선택) | 내보내기 버튼 disabled (`hasSlides` 기존 패턴) |
| 내보내기 진행 중 재클릭 | `isExporting`으로 무시 |
| 렌더/저장 중 예외 | 콘솔 로그 + 실패 토스트 (기존 exportToPdf 패턴) |

## 검증 계획

1. `npm run check` (svelte-check 0 errors 유지)
2. **HTML**: 이미지 포함 샘플 md로 내보내기 → Playwright(Chromium + WebKit)로 열어 자동 검증
   — 방향키/버튼 내비게이션, 카운터, 이미지가 data URI인지, 긴 슬라이드 스크롤 후 전환 시 scrollTop 리셋, file:// 프로토콜에서 동작
3. **PDF**: 페이지 수 = 슬라이드 수, 페이지 크기 = 16:9 확인 (pypdf 등), 잘림 경고 동작 확인, 실물 육안 확인
4. 실제 앱(tauri dev)에서 드롭다운 → 두 포맷 내보내기 스모크 테스트

## 결정 기록

- **A안 채택** (공통 서비스 + html2pdf.js 재활성화). B안(window.print 벡터)은 WebKit `@page` 크기 제어 불안정 + 크로스플랫폼 리스크로 기각, C안(브라우저 인쇄 위임)은 뷰어 인쇄 CSS로 장점만 흡수
- PDF 16:9 (A4 아님) — 사용자 선택
- 뷰어는 화면 맞춤 카드 (16:9 고정 아님) — 앱 슬라이드쇼와 일관성 우선, 사용자 승인
- 넘침 = 잘림 + 경고 — 사용자 승인
