# Portfolio Handoff — APK Archeologist

## Context

Kerry's portfolio site at `/home/kerry/programming/portfolio` has a page for each project. Your page is **APK Archeologist** (`pages/apk-archeologist.html`) — currently an amber retro theme with Press Start 2P pixel font, grid overlay, and archaeological dig layers.

You're a CLI tool, not a web app — so we can't iframe a running instance. But you *do* have something amazing: the `web/` demo with the side-by-side comparison viewer and two playable HTML5 games. That's our embed. Plus, we'll use your analysis output for a rich technical showcase.

## What I Need From You

### 1. Generate `portfolio-manifest.json` at your repo root

```json
{
  "schema": 1,
  "project": "apk-archeologist",
  "title": "APK Archeologist",
  "embed": {
    "type": "static-html",
    "src": "web/index.html",
    "fallback": "summary"
  },
  "summary": {
    "tagline": "Extract endpoint DNA from compiled APKs",
    "description": "A TypeScript CLI that unpacks Android APKs, decompiles with JADX, scans for URLs/endpoints/auth patterns, and generates structured reports. Includes a web demo with side-by-side original vs AI-reconstructed game comparison.",
    "techStack": ["TypeScript", "Node.js 18+", "Commander.js", "JADX", "Vitest"],
    "features": [
      "Full pipeline: ingest → decompile → scan → report",
      "URL and endpoint pattern discovery via regex scanning",
      "Auth pattern detection (API keys, OAuth, JWT)",
      "Markdown + JSON report generation",
      "Original vs AI-reconstructed comparison viewer",
      "Playable HTML5 Dino Dash demo (original + 'frog DNA' version)",
      "Plugin system for custom analyzers"
    ],
    "architecture": "CLI built with Commander.js. Pipeline stages: APK unzip (adm-zip) → JADX decompilation → regex-based scanning for endpoints/auth → Handlebars report generation. Web demo is fully self-contained HTML5 Canvas games with comparison UI."
  },
  "media": {
    "screenshots": [
      "portfolio-assets/comparison-viewer.png",
      "portfolio-assets/dino-dash-original.png",
      "portfolio-assets/dino-dash-reconstructed.png",
      "portfolio-assets/terminal-output.png"
    ],
    "videos": [],
    "thumbnail": "portfolio-assets/thumb.png"
  },
  "github": "https://github.com/jeremybrachle/apk-archaeologist",
  "localPath": "C:\\Users\\kerry\\Documents\\apk-archeologist",
  "commands": {
    "install": "npm install",
    "dev": "npx serve web -p 5004",
    "build": "npm run build"
  }
}
```

Fill in with your own accurate details.

### 2. Verify the web demo is self-contained

The portfolio will load `web/index.html` directly (either by copying it into portfolio assets or by serving it). Verify that:

- `web/index.html` works when opened directly in a browser (no server required)
- All CSS/JS is inline or uses relative paths within `web/`
- The `original/index.html` and `reconstructed/index.html` games load correctly
- No external CDN dependencies or API calls

From my read of the code, the web demo is fully self-contained — all inline HTML/CSS/JS with canvas rendering. Just confirm.

### 3. Generate a sample analysis report

Run your `analyze` command on the included `sample-game/` (Dino Dash) and save the output so the portfolio can display a real report:

```bash
npm run dev -- analyze ./sample-game/ -o ./portfolio-assets/sample-report/
```

This should produce:
- `portfolio-assets/sample-report/report.md`
- `portfolio-assets/sample-report/report.json`
- `portfolio-assets/sample-report/endpoints.json`

If the full pipeline needs JADX installed and you don't have it, that's fine — run whichever stages work and save whatever output you get. Even a partial report is useful for the portfolio showcase.

### 4. Create `portfolio-assets/` directory with screenshots

```
portfolio-assets/
  comparison-viewer.png       (the side-by-side web viewer)
  dino-dash-original.png      (the original game mid-play)
  dino-dash-reconstructed.png (the bug-eyed frog DNA version)
  terminal-output.png         (CLI running the analyze command)
  thumb.png                   (400x300-ish thumbnail for project card)
  sample-report/              (output from step 3)
```

If you can't take screenshots programmatically, create the directory and note what to capture.

### 5. Consider a difference table export

Your web demo has a "Difference Table" view showing the 13 frog DNA artifacts. If this data exists as structured JSON anywhere, include it in `portfolio-assets/differences.json`. The portfolio could render it as a stylized comparison table in the amber theme.

If it's only in the HTML, that's fine — we'll use the web viewer embed instead.

## How The Portfolio Will Use This

1. The portfolio copies/references your `web/` directory for the live embed
2. The APK Archeologist page shows the comparison viewer inline
3. Below the embed, it shows the sample analysis report rendered in the amber theme
4. If the web demo can't load → falls back to the current amber dig layers + feature cards
5. On production deploy, the web demo files are included in the portfolio's `dist/`

## What NOT To Change

- Don't modify the web demo's visual style for the portfolio
- Don't change your CLI tool's behavior
- The manifest, assets, and optional sample report are the only new files
- No code changes required

## Report Back

When done, tell me:
1. The manifest file was created at `portfolio-manifest.json`
2. Confirmed web demo is self-contained (works without server)
3. Whether a sample report was generated
4. What screenshots/assets were created (or what needs manual capture)
5. Whether a differences.json was extracted
6. Any issues or concerns
