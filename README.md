# apk-archeologist

> *"Your scientists were so preoccupied with whether or not they could decompile it, they didn't stop to think if they should."*

Analyze mobile game APKs for long-term preservation. Extract endpoint DNA from compiled amber. Fill in the gaps. Life finds a way.

## What It Does

Takes a mobile game APK and produces:

- A decompiled source tree (Java + C# if Unity)
- A catalog of every server endpoint the game contacts
- An analysis of the authentication flow
- An inventory of extractable assets (audio, textures, data)
- A runnable mock server scaffold that can replace the original backend
- A detailed report documenting everything discovered

## Why

Mobile games with online dependencies become unplayable when servers shut down.
This tool helps developers understand what a game needs from the network and build
a local replacement — so the game can keep running after the original servers are gone.

## Quick Start

```bash
npm install -g apk-archeologist

# Full analysis pipeline
apk-archeologist analyze ./my-game.apk --output ./results/

# View the report
cat ./results/analysis/report.md

# Reconstruct a buildable project from decompiled sources
apk-archeologist reconstruct ./results/ -o ./rebuilt/

# Compare original vs reconstructed
apk-archeologist compare ./original-src ./rebuilt/src/main/java -o comparison.md
```

## Live Demo

This repo ships with **Dino Dash** — a real playable Android game built specifically to demonstrate the full pipeline. See the [demo walkthrough](demo/README.md) for the complete experience, or just run:

```bash
bash demo/run-demo.sh    # Linux/macOS/WSL
# or
demo\run-demo.ps1        # Windows
```

## Commands

| Command | Description |
|---------|-------------|
| `analyze` | Run the full pipeline (ingest → decompile → scan → report) |
| `ingest` | Unpack and identify the APK |
| `decompile` | Run decompilation tools |
| `scan` | Search decompiled code for network endpoints |
| `report` | Generate analysis report |
| `reconstruct` | Rebuild a project from decompiled sources |
| `compare` | Compare original vs reconstructed source |

### Examples

```bash
# Full analysis with verbose output
apk-archeologist analyze ./game.apk -o ./output -v

# Just unpack and inspect metadata
apk-archeologist ingest ./game.apk -o ./workdir

# Scan an already-decompiled working directory
apk-archeologist scan ./workdir

# Generate reports from existing scan results
apk-archeologist report ./workdir --format markdown,json

# Skip decompilation (analyze extracted APK contents only)
apk-archeologist analyze ./game.apk -o ./output --skip-decompile

# Reconstruct from decompiled output
apk-archeologist reconstruct ./output -o ./rebuilt

# Compare original source against reconstructed
apk-archeologist compare ./original/src ./rebuilt/src/main/java -o diff.md
```

## Supported Engines

| Engine | Decompilation | Asset Extraction | Endpoint Discovery |
|--------|---------------|------------------|--------------------|
| Unity (Mono) | Full C# source | Audio, textures, data | Yes |
| Unity (IL2CPP) | C# stubs + string literals | Audio, textures, data | Yes |
| Native Java/Kotlin | Full Java source | Resources | Yes |
| Unreal | Planned | Planned | Planned |
| Godot | Planned | Planned | Planned |

## Prerequisites

The CLI handles APK unpacking and source scanning natively. For full decompilation, install these external tools:

| Tool | Purpose | Install |
|------|---------|---------|
| [JADX](https://github.com/skylot/jadx) | Java/Kotlin decompilation | `brew install jadx` or [GitHub Releases](https://github.com/skylot/jadx/releases) |
| [AssetRipper](https://github.com/AssetRipper/AssetRipper) | Unity asset extraction | [GitHub Releases](https://github.com/AssetRipper/AssetRipper/releases) |
| [Il2CppDumper](https://github.com/Perfare/Il2CppDumper) | IL2CPP metadata recovery | [GitHub Releases](https://github.com/Perfare/Il2CppDumper/releases) |

If a tool is not installed, the corresponding step is skipped with a warning.

## Architecture

```
CLI Entry Point
  │
  ├── Ingest       → Unpack APK, parse manifest, detect engine
  ├── Decompile    → Run JADX / AssetRipper / Il2CppDumper
  ├── Scan         → Regex + pattern matching for URLs and endpoints
  ├── Report       → Generate Markdown + JSON analysis reports
  ├── Reconstruct  → Rebuild project from decompiled sources
  └── Compare      → Diff original vs reconstructed side-by-side
```

Each pipeline stage reads and writes JSON intermediates to a working directory,
making it possible to run stages independently or re-run individual steps.

## Output Structure

```
analysis-output/
├── manifest.json          Parsed AndroidManifest.xml
├── meta.json              Engine detection, hashes, SDK levels
├── extracted/             Raw APK contents
├── jadx/                  JADX decompiled Java source
├── unity/                 AssetRipper output (if Unity)
├── il2cpp/                Il2CppDumper output (if IL2CPP)
├── analysis/
│   ├── report.md          Human-readable analysis report
│   ├── report.json        Machine-readable analysis data
│   ├── endpoints.json     Discovered API endpoints
│   ├── urls.json          All discovered URLs
│   ├── auth-flow.json     Authentication pattern matches
│   └── scan-summary.json  Scan statistics
└── reconstructed/         Rebuilt project (from reconstruct step)
    ├── build.gradle.kts   Auto-generated build file
    ├── reconstruction-meta.json  Fidelity scores and gap analysis
    └── src/main/java/...  Kotlin source skeletons
```

## Sample Game

The `sample-game/` directory contains **Dino Dash** — a Chrome-dino-style runner built in Kotlin. It serves as a controlled test specimen for the full pipeline: build → decompile → analyze → reconstruct → compare.

The game includes realistic API endpoints, JWT auth, session management, leaderboard services, analytics tracking, and a WebSocket connection — giving the scanner plenty to discover.

See [demo/README.md](demo/README.md) for the full walkthrough.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- analyze ./test.apk

# Run tests
npm test

# Type-check
npm run typecheck

# Build for distribution
npm run build
```

## Legal

This tool is intended for personal archival, research, and educational purposes under fair use principles. It performs the same operations as established open-source tools (JADX, AssetRipper, Il2CppDumper). Users are responsible for complying with applicable laws and the terms of service of any software they analyze. This project does not condone or facilitate piracy.

## License

MIT
