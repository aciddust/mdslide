# mdslide

> Markdown-based slide presentation tool

A desktop app for quickly creating slideshows using Markdown.

## Key Features

### Markdown Editor

- Real-time Markdown editing
- Slide separation using `---`
- Syntax highlighting and formatting tools
- Live preview

### File Management

- Manage workspace directory (default: `~/mdslide`)
- Project navigation with a file tree view
- Open / Save files (⌘/Ctrl + S)
- Create new files (⌘/Ctrl + N)

### Settings

- Set workspace path via system dialog
- Auto-save option
- Font size and font family settings
- Settings persisted to `~/.mdslide_config.json`

### Presentation

- Full-screen slideshow mode (F5)
- Keyboard navigation (arrow keys, spacebar)
- Slide preview

### Shortcuts

- `⌘/Ctrl + N`: New file
- `⌘/Ctrl + S`: Save
- `⌘/Ctrl + B`: Bold
- `⌘/Ctrl + I`: Italic
- `⌘/Ctrl + P`: Toggle preview
- `F5`: Start slideshow
- `ESC`: Exit slideshow

---

## Development Guide

### Backend (Tauri + Rust)

Use Cargo for project management.

Work under:

```bash
pwd
mdslide/src-tauri
```

Common commands:

| Task | Command |
| - | - |
| Install package | `cargo install <PACKAGE_NAME>` |
| Build | `cargo build` |
| Run | `cargo run` |
| Change icon | `cargo tauri icon <ICON_PATH>` |
| Build release | `cargo build --release` |

### Frontend (sveltekit + tailwindcss + shadcn)

Use npm for frontend development.

Work at project root:

```bash
pwd
mdslide
```

UI code is under `mdslide/src`.

Common commands:

| Task | Command |
| - | - |
| Install deps | `npm install` |
| Add package | `npm install <PACKAGE_NAME>` |
| Build | `npm run build` |
| Dev | `npm run dev` |

---

## Deployment

Run `npm run build` from the `mdslide` directory to generate the frontend `build` folder.

Then build the Tauri Rust app from `mdslide/src-tauri`:

```bash
cd mdslide/src-tauri
cargo build --release
```

If you need Windows targets:

```bash
cargo build --release --target x86_64-pc-windows-gnu
cargo build --release --target i686-pc-windows-gnu
```

The release artifacts appear in `mdslide/src-tauri/target/release`. Use those files for distribution.
