# APK Archeologist: The Demo

> *"Your scientists were so preoccupied with whether or not they could decompile it, they didn't stop to think if they should."*
> — Definitely not a chaos mathematician

## What You're Looking At

This is a complete end-to-end demonstration of the APK Archeologist pipeline. We built an actual game — **Dino Dash** — a Chrome-dino-style runner where you tap to jump over cacti. Then we fed it through the wood chipper (decompilation), and tried to put it back together again.

Like cloning dinosaurs from mosquito DNA preserved in amber, we're extracting code from a compiled APK and filling in the gaps with educated guesses. The results are... *instructive*.

## The Pipeline

```
                          ┌──────────────────┐
                          │   Dino Dash      │
                          │   (Kotlin src)   │
                          └────────┬─────────┘
                                   │
                            Gradle Build
                                   │
                                   ▼
                          ┌──────────────────┐
                          │   game.apk       │
                          │   (compiled)     │
                          └────────┬─────────┘
                                   │
                         apk-archeologist
                            analyze
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                     ▼
    ┌──────────────┐    ┌──────────────┐     ┌──────────────────┐
    │   Ingest     │    │  Decompile   │     │     Scan         │
    │  (unpack,    │    │  (JADX →     │     │  (find URLs,     │
    │   manifest)  │    │   Java src)  │     │   auth, APIs)    │
    └──────────────┘    └──────┬───────┘     └──────────────────┘
                               │
                               ▼
                     ┌──────────────────┐
                     │   Reconstruct    │
                     │  (Java→Kotlin,   │
                     │   fill gaps)     │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │    Compare       │
                     │  (original vs    │
                     │   reconstructed) │
                     └──────────────────┘
```

## Prerequisites

- **Node.js 18+** — for the CLI tool
- **Java 17+** — for building the game & JADX
- **Android SDK** (platform 34) — for the APK build
- **JADX** — for decompilation ([install](https://github.com/skylot/jadx/releases))

## Step-by-Step Demo

### 1. Build the Specimen

First, we need our dinosaur. Er, our APK.

```bash
cd sample-game
bash setup.sh        # or setup.bat on Windows
./gradlew assembleDebug
```

The APK materializes at `app/build/outputs/apk/debug/app-debug.apk`. Behold — life, uh, *compiled*.

### 2. Analyze the APK

Now we feed the APK to our tools. We spare no expense.

```bash
cd ..
npm run dev -- analyze sample-game/app/build/outputs/apk/debug/app-debug.apk -o demo-output -v
```

This runs the full pipeline:
1. **Ingest** — Unpacks the APK, reads the manifest, identifies the engine (Native Java/Kotlin)
2. **Decompile** — JADX converts DEX bytecode back to Java source
3. **Scan** — Regex army marches through decompiled code hunting for URLs, endpoints, auth patterns
4. **Report** — Generates detailed Markdown + JSON reports

Check the output:
```bash
cat demo-output/analysis/report.md
```

You should see it found the Dino Dash API surface:
- `https://api.dinodash.archeologist.dev/v2/*` — main API
- `https://cdn.dinodash.archeologist.dev/assets/v1/*` — CDN
- `https://analytics.dinodash.archeologist.dev/v1/*` — analytics
- `wss://realtime.dinodash.archeologist.dev/v1/multiplayer` — WebSocket
- JWT Bearer auth, API key headers, OAuth flows, session tokens

It discovers an entire backend architecture from a dead APK. Nature finds a way.

### 3. Reconstruct from DNA Fragments

Here's where we go full Hammond. We take the decompiled Java and try to rebuild a working Kotlin project:

```bash
npm run dev -- reconstruct demo-output -o demo-reconstructed
```

The reconstructor:
- Parses every decompiled `.java` file for structure (classes, methods, fields)
- Categorizes components (Activity, View, Service, Network, Model, etc.)
- Converts Java skeletons to Kotlin
- Detects reconstruction gaps (obfuscated names, empty bodies, generic types)
- Generates a buildable project structure
- Calculates a **fidelity score** — how much of the original DNA survived

### 4. Compare: Original vs Frankenstein

Side by side. The moment of truth.

```bash
npm run dev -- compare \
  sample-game/app/src/main/java \
  demo-reconstructed/src/main/java \
  -o comparison.md
```

Open `comparison.md` and you'll see:
- Per-file similarity percentages
- Shared symbol counts
- Visual progress bars
- A list of what made it through and what got lost in compilation

The class names survive. The method signatures *mostly* survive. The field types *sometimes* survive. The method bodies? Those are the frog DNA — the gaps we had to fill. Different frog, different outcome.

### 5. Run Side by Side

You can install both the original and reconstructed APKs on an emulator:

```bash
# Original
adb install sample-game/app/build/outputs/apk/debug/app-debug.apk

# Reconstructed (after building it)
cd demo-reconstructed
# ... add AndroidManifest.xml, resources, and build
# Then install the reconstructed version on a second emulator or device
```

Or compare the source trees directly:
```bash
# Visual diff in VS Code
code --diff sample-game/app/src/main/java/com/archeologist/dinodash/GameEngine.kt \
            demo-reconstructed/src/main/java/com/archeologist/dinodash/GameEngine.kt
```

## What This Proves

1. **Endpoint Discovery Works** — The scanner finds every API endpoint, WebSocket URL, CDN path, and auth pattern the game uses. Even without a running server, you now know what the server *looked like*.

2. **Structure Survives Compilation** — Class hierarchies, method signatures, and field declarations are largely recoverable from compiled bytecode. The architecture of the game is preserved in amber.

3. **Behavior is Lossy** — Method bodies get mangled. Variable names get obfuscated. Comments are gone forever. The implementation details — the actual *game logic* — that's where you need the AI-powered frog DNA to fill in the gaps.

4. **Preservation is Possible** — With the endpoint catalog and auth flow analysis, you have everything you need to build a mock server that lets the game run again after the real servers go dark.

Clever girl.

## Files

```
sample-game/                 The original Kotlin game source
├── app/src/main/java/...   Game code (GameEngine, GameView, API layer)
├── app/build.gradle.kts    Build config
├── setup.sh / setup.bat    Build environment setup
└── gradlew                 Gradle wrapper

demo-output/                 Analysis output (generated)
├── manifest.json           Parsed Android manifest
├── meta.json               Engine detection, hashes
├── analysis/
│   ├── report.md           Human-readable analysis
│   ├── report.json         Machine-readable analysis
│   ├── endpoints.json      All discovered API endpoints
│   ├── urls.json           All discovered URLs
│   └── auth-flow.json      Authentication patterns
└── reconstructed/          Reconstructed project (generated)

comparison.md               Side-by-side comparison report (generated)
```

## The Moral

Life breaks free. Life expands to new territories. Painfully, perhaps even dangerously.

But also: when game servers shut down and millions of hours of creative work face extinction, maybe it's worth finding a way.

Even if that way involves frog DNA.
