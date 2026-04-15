# APK Archeologist — Test Plan

> "Your scientists were so preoccupied with whether they could, they didn't stop to think if they should."

This test plan walks through every step: from prerequisites to running both games side-by-side to the future GitHub Actions pipeline vision.

---

## Phase 0: Download & Install Prerequisites

### 0.1 — Node.js & CLI Tool

```bash
# Node 18+ required
node --version

# Install dependencies and build the CLI
cd apk-archeologist
npm install
npm run build

# Verify CLI is functional (should print help with 7 commands)
npx apk-archeologist --help
```

**Expected output:** Commands listed: `analyze`, `ingest`, `decompile`, `scan`, `report`, `reconstruct`, `compare`

### 0.2 — Web Demo (Minimal Path — No Android SDK)

This is the fastest way to see the demo. All you need is a browser.

```bash
# Option A: use the npm script (installs 'serve' on first run)
npm run demo:web

# Option B: just open the file directly
# Windows:
start web/index.html
# macOS:
open web/index.html
# Linux:
xdg-open web/index.html
```

**Expected:** Browser opens with side-by-side game comparison at `http://localhost:3000` (Option A) or as a local file (Option B).

> **If this is all you need for a demo, skip to Phase 3.**

### 0.3 — JADX (Decompiler) — Optional

Only needed if you want to run the actual decompile + reconstruct CLI pipeline.

```bash
# macOS
brew install jadx

# Linux
sudo apt install jadx
# or download from: https://github.com/skylot/jadx/releases

# Windows — download the zip from the releases page above, extract, add to PATH

# Verify
jadx --version
```

### 0.4 — Android SDK & Build Tools — Optional

Only needed if you want to compile and run the native Android APK.

| Tool | Version | Install |
|------|---------|---------|
| Java JDK | 17+ | `sdk install java 17.0.11-tem` or download from Adoptium |
| Android SDK | 34 | Via Android Studio or `sdkmanager "platforms;android-34"` |
| Android Build Tools | 34.0.0 | `sdkmanager "build-tools;34.0.0"` |
| Gradle | 8.7 | Bundled via `gradlew` wrapper |
| Android Emulator | any | `sdkmanager "emulator" "system-images;android-34;google_apis;x86_64"` |

```bash
# Set ANDROID_HOME
export ANDROID_HOME=$HOME/Android/Sdk   # Linux/macOS
# or
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk   # Windows

# Create an emulator (one-time)
avdmanager create avd -n test_device -k "system-images;android-34;google_apis;x86_64"
```

---

## Phase 1: Run the Original Game & Verify Playability

### Path A — Web Version (Recommended for Demos)

```bash
npm run demo:web
# Navigate to http://localhost:3000/original/
```

**Verification checklist:**
- [ ] Dino appears on screen (green, rounded body, single visible eye)
- [ ] Tap/click/spacebar makes the dino jump
- [ ] Cacti scroll from right to left
- [ ] Birds appear after score reaches ~50
- [ ] Score increments in top-right
- [ ] Collision with obstacle triggers game over
- [ ] "Tap to restart" works
- [ ] Squash-stretch animation visible on jump/land
- [ ] Tail wags behind the dino
- [ ] Parallax clouds drift in background
- [ ] Small rocks visible on the ground line

### Path B — Android APK (Full Pipeline)

```bash
cd sample-game

# Build the APK
./gradlew assembleDebug

# Start emulator
emulator -avd test_device &

# Wait for boot, then install
adb wait-for-device
adb install app/build/outputs/apk/debug/app-debug.apk

# Launch the game
adb shell am start -n com.archeologist.dinodash/.MainActivity
```

**Same verification checklist as Path A above.**

---

## Phase 2: Decompile & Run the Reconstructed Game

### 2.1 — Decompile the APK (CLI Pipeline)

```bash
# From project root
cd ..

# Create output directory
mkdir -p demo-output

# Run the full decompile pipeline
npx apk-archeologist decompile \
  --input sample-game/app/build/outputs/apk/debug/app-debug.apk \
  --output demo-output/decompiled

# Reconstruct from decompiled sources
npx apk-archeologist reconstruct \
  --input demo-output/decompiled \
  --output demo-output/reconstructed

# Compare original vs reconstructed
npx apk-archeologist compare \
  --original sample-game/app/src/main/java \
  --reconstructed demo-output/reconstructed
```

**Expected:**
- `decompile` produces Java source files under `demo-output/decompiled/`
- `reconstruct` produces Kotlin files under `demo-output/reconstructed/` with gap annotations
- `compare` prints a similarity report showing file-by-file match percentages

### 2.2 — Run the Reconstructed Game (Web)

```bash
npm run demo:web
# Navigate to http://localhost:3000/reconstructed/
```

**Verification — Spot the "Frog DNA":**

These 13 differences should be visible compared to the original:

| # | What Changed | Original | Reconstructed | Why |
|---|-------------|----------|---------------|-----|
| 1 | Dino body shape | Rounded (radius 8) | Angular (radius 3) | `cornerRadius` lost in obfuscation |
| 2 | Squash-stretch | Subtle (15%/12%) | Exaggerated (35%/30%) | Multiplier constants stripped |
| 3 | Eye size | Normal (r=6) | Bug-eyed (r=8) | AI over-estimated from decomp |
| 4 | Eye count | One (side view) | Two (front view assumed) | AI inferred binocular vision |
| 5 | Leg count | Two | Three | AI merged animation frames |
| 6 | Tail direction | Curves down | Curves up | Sign flip in `a()` method |
| 7 | Stitch marks | None | Purple stitches across body | Visual marker of reconstruction |
| 8 | Frog DNA glow | None | Purple highlight pulse | Visual marker of gap-filling |
| 9 | Cloud shape | Rounded | Square | `borderRadius` lost |
| 10 | Ground rocks | Normal density | Dense + oversized | Modulo constant wrong |
| 11 | Score speed | Normal (+0.1/frame) | 17% slower (+0.12 threshold) | Frame-rate constant guessed wrong |
| 12 | Bird spawn | Score ≥ 50 | Score ≥ 30 | Threshold from obfuscated `b()` |
| 13 | Color palette | True green/brown | Teal-shifted dino, lighter cacti | Hex constants truncated |

---

## Phase 3: Side-by-Side Comparison

### 3.1 — Launch the Comparison View

```bash
npm run demo:web
# Navigate to http://localhost:3000
# (the root page is the side-by-side viewer)
```

### 3.2 — Use the Comparison Controls

| Button | What It Does |
|--------|-------------|
| **Side by Side** | Both games running simultaneously in split view |
| **Original Only** | Full-width original game |
| **Reconstructed Only** | Full-width reconstructed game |
| **Difference Table** | Shows the 13 frog-DNA differences with explanations |

### 3.3 — Comparison Verification

- [ ] Both games run independently (play one while the other idles)
- [ ] Visual differences are immediately apparent (stitch marks, extra eye, wrong tail)
- [ ] Gameplay differences emerge over time (birds appear earlier, score is slower)
- [ ] Switching between views works without losing game state
- [ ] Difference table is readable and matches what you see in-game

### 3.4 — CLI Comparison Report

```bash
# Generate a markdown comparison report
npx apk-archeologist compare \
  --original sample-game/app/src/main/java \
  --reconstructed demo-output/reconstructed \
  --format markdown \
  --output demo-output/comparison-report.md
```

---

## Phase 4: Future — GitHub Actions Pipeline

### Vision

An automated pipeline that takes any APK as input and produces a playable web reconstruction as output.

```
┌─────────┐    ┌───────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│  Input   │───▶│ Decompile │───▶│ Reconstruct  │───▶│  Web Build  │───▶│  Deploy  │
│   APK    │    │  (JADX)   │    │ (AI + Gaps)  │    │ (Canvas/JS) │    │ (Pages)  │
└─────────┘    └───────────┘    └──────────────┘    └─────────────┘    └──────────┘
```

### Proposed Workflow File

```yaml
# .github/workflows/archeologist.yml
name: APK Archeologist Pipeline

on:
  workflow_dispatch:
    inputs:
      apk_url:
        description: 'URL to APK file (or upload as artifact)'
        required: true
      game_name:
        description: 'Human-readable game name'
        required: true

jobs:
  excavate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install JADX
        run: |
          wget -q https://github.com/skylot/jadx/releases/download/v1.5.0/jadx-1.5.0.zip
          unzip -q jadx-1.5.0.zip -d /opt/jadx
          echo "/opt/jadx/bin" >> $GITHUB_PATH

      - name: Install & Build CLI
        run: |
          npm ci
          npm run build

      - name: Download APK
        run: wget -q -O input.apk "${{ github.event.inputs.apk_url }}"

      - name: Decompile
        run: npx apk-archeologist decompile --input input.apk --output decompiled/

      - name: Analyze
        run: npx apk-archeologist analyze --input decompiled/ --output analysis.json

      - name: Scan Endpoints
        run: npx apk-archeologist scan --input decompiled/ --output endpoints.json

      - name: Reconstruct
        run: npx apk-archeologist reconstruct --input decompiled/ --output reconstructed/

      - name: Generate Report
        run: |
          npx apk-archeologist report \
            --input analysis.json \
            --endpoints endpoints.json \
            --format markdown \
            --output report.md

      # Future: auto-generate web-playable version from reconstructed source
      # - name: Build Web Version
      #   run: npx apk-archeologist web-build --input reconstructed/ --output web-dist/

      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: "${{ github.event.inputs.game_name }}-excavation"
          path: |
            decompiled/
            reconstructed/
            analysis.json
            endpoints.json
            report.md

  # Future: deploy to GitHub Pages
  # deploy:
  #   needs: excavate
  #   runs-on: ubuntu-latest
  #   steps:
  #     - uses: actions/deploy-pages@v4
```

### Distribution & Legal Considerations

| Approach | Legality | Reach | Notes |
|----------|----------|-------|-------|
| **GitHub Pages (static HTML)** | Safe — you're hosting your own reconstruction | Anyone with the URL | Best for demos and portfolios |
| **NPM package** | Safe — the tool itself contains no copyrighted game code | Developers | Distribute the archeologist tool, not the excavated games |
| **Docker image** | Safe — same as NPM | DevOps-friendly | `docker run apk-archeologist --input game.apk` |
| **Distributing original APKs** | **Risky** — APKs contain copyrighted assets | N/A | Never redistribute someone else's APK |
| **Distributing decompiled source** | **Risky** — derived work of copyrighted code | N/A | Keep it private or use only your own games |
| **Distributing reconstructed code** | **Gray area** — transformative work but based on original | Case-by-case | Safest with your own games or expired/abandoned ones |

**Recommendation:** For the demo, use only the bundled `sample-game` (Dino Dash) which is MIT-licensed and built specifically for this project. The pipeline should never auto-publish reconstructions of third-party games.

---

## Quick Reference — Command Cheat Sheet

```bash
# === Fastest demo (browser only) ===
npm run demo:web                    # Serve web/ on port 3000
# Open http://localhost:3000        # Side-by-side comparison

# === CLI pipeline ===
npx apk-archeologist analyze --input <apk>
npx apk-archeologist decompile --input <apk> --output <dir>
npx apk-archeologist scan --input <dir>
npx apk-archeologist reconstruct --input <dir> --output <dir>
npx apk-archeologist compare --original <dir> --reconstructed <dir>
npx apk-archeologist report --input <json> --format markdown

# === Build Android APK ===
cd sample-game && ./gradlew assembleDebug

# === Run tests ===
npm test                            # 48 tests, all passing
npm run typecheck                   # TypeScript validation
```
