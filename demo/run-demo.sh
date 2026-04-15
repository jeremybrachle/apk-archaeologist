#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# APK Archeologist — Full Demo Pipeline
# "Spared no expense."
# ──────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GAME_DIR="$ROOT_DIR/sample-game"
OUTPUT_DIR="$ROOT_DIR/demo-output"
RECONSTRUCTED_DIR="$ROOT_DIR/demo-reconstructed"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

banner() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════${NC}"
    echo ""
}

step() {
    echo -e "${GREEN}▸${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

fail() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

banner "APK ARCHEOLOGIST — DEMO PIPELINE"
echo "Welcome... to Jurassic Parse."
echo ""

# ── Step 0: Check prerequisites ──
banner "Step 0: Checking prerequisites"

command -v node >/dev/null 2>&1 || fail "Node.js not found. Install Node.js 18+."
step "Node.js: $(node --version)"

command -v npm >/dev/null 2>&1 || fail "npm not found."
step "npm: $(npm --version)"

if command -v jadx >/dev/null 2>&1; then
    step "JADX: found"
    HAS_JADX=true
else
    warn "JADX not found — decompilation will be skipped"
    warn "Install: https://github.com/skylot/jadx/releases"
    HAS_JADX=false
fi

# ── Step 1: Install dependencies ──
banner "Step 1: Installing dependencies"
cd "$ROOT_DIR"
npm install
step "Dependencies installed"

# ── Step 2: Build the game APK ──
banner "Step 2: Building Dino Dash"

APK_PATH="$GAME_DIR/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_PATH" ]; then
    step "APK already built: $APK_PATH"
else
    if [ -f "$GAME_DIR/gradlew" ] && [ -f "$GAME_DIR/gradle/wrapper/gradle-wrapper.jar" ]; then
        step "Building with Gradle..."
        cd "$GAME_DIR"
        ./gradlew assembleDebug
        cd "$ROOT_DIR"

        if [ -f "$APK_PATH" ]; then
            step "APK built: $APK_PATH"
        else
            warn "Gradle build did not produce an APK."
            warn "You may need to run 'cd sample-game && bash setup.sh && ./gradlew assembleDebug' manually."
            warn "Continuing with analysis-only demo (skip-decompile)..."
        fi
    else
        warn "Gradle wrapper not bootstrapped. Run: cd sample-game && bash setup.sh"
        warn "Skipping APK build — you can analyze the source directly."
    fi
fi

# ── Step 3: Analyze the APK ──
banner "Step 3: Analyzing the specimen"
echo "Objects in mirror are closer than they appear."
echo ""

cd "$ROOT_DIR"

if [ -f "$APK_PATH" ]; then
    if [ "$HAS_JADX" = true ]; then
        step "Running full analysis pipeline..."
        npx tsx src/index.ts analyze "$APK_PATH" -o "$OUTPUT_DIR" -v
    else
        step "Running analysis without decompilation..."
        npx tsx src/index.ts analyze "$APK_PATH" -o "$OUTPUT_DIR" --skip-decompile -v
    fi
else
    warn "No APK found. Run 'cd sample-game && bash setup.sh && ./gradlew assembleDebug' first."
    warn "Or analyze any APK: npm run dev -- analyze <path-to-apk>"
    exit 0
fi

step "Analysis complete"
echo ""
echo "Reports:"
step "  Markdown: $OUTPUT_DIR/analysis/report.md"
step "  JSON:     $OUTPUT_DIR/analysis/report.json"

# ── Step 4: Reconstruct ──
banner "Step 4: Reconstruction"
echo "Filling in the sequence gaps with frog DNA..."
echo ""

if [ -d "$OUTPUT_DIR/jadx" ] || [ -d "$OUTPUT_DIR/extracted" ]; then
    npx tsx src/index.ts reconstruct "$OUTPUT_DIR" -o "$RECONSTRUCTED_DIR"
    step "Reconstructed project: $RECONSTRUCTED_DIR"
else
    warn "No decompiled sources to reconstruct."
    warn "Install JADX and re-run for the full experience."
fi

# ── Step 5: Compare ──
banner "Step 5: Comparison"
echo "Clever girl."
echo ""

ORIGINAL_SRC="$GAME_DIR/app/src/main/java"
RECONSTRUCTED_SRC="$RECONSTRUCTED_DIR/src/main/java"

if [ -d "$RECONSTRUCTED_SRC" ]; then
    npx tsx src/index.ts compare "$ORIGINAL_SRC" "$RECONSTRUCTED_SRC" -o "$ROOT_DIR/comparison-report.md"
    step "Comparison report: $ROOT_DIR/comparison-report.md"
else
    warn "No reconstructed sources to compare."
fi

# ── Done ──
banner "Demo Complete"
echo ""
echo "What you have:"
echo "  1. A real playable game (sample-game/)"
echo "  2. Its decompiled analysis (demo-output/)"
echo "  3. A reconstructed version (demo-reconstructed/)"
echo "  4. A side-by-side comparison (comparison-report.md)"
echo ""
echo "Life, uh, finds a way."
