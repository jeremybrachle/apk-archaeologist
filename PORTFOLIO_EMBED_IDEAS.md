# Portfolio Embed Ideas — APK Archeologist

## What Exists

- Two fully playable HTML5 Canvas games (original + "frog DNA" reconstructed)
- A comparison viewer with side-by-side iframes + a 13-row difference table
- Everything self-contained, inline JS/CSS, zero dependencies

---

## Option 1: "Progressive Mutation" Slider ⭐

A single game canvas with a slider from 0% → 100% "frog DNA contamination." As you drag the slider, the dino morphs in real time — body rounds out → goes angular, one eye → two eyes appear, 2 legs → third leg sprouts, tail flips direction, squash-stretch goes wild, clouds go square, rocks get dense. Each artifact fades in individually. You'd interpolate between the original and reconstructed constants live. Labels pop up at each threshold ("Eye duplication detected at 35%").

**Why it works:** Interactive, visual, tells the story without reading anything. Demo gold.

---

## Option 2: Fake Terminal → Live Reconstruction ⭐⭐ (Top Pick)

An animated "terminal" panel that types out the decompilation process in real time:

- `$ apk-archeologist analyze dino-dash.apk`
- Lines scroll: unpacking APK, running JADX, scanning endpoints...
- Code snippets flash by with obfuscated names (`a.b(c.d, e)`)
- Then: "Filling gaps with frog DNA..." and the game canvas starts rendering as each artifact is applied — the dino starts correct and visibly degrades step by step
- The difference table rows light up one by one as each mutation kicks in

**Why it works:** Theatrical, narrative-driven, matches the amber retro terminal aesthetic perfectly. The visitor *experiences* the tool's purpose rather than just seeing a game.

---

## Option 3: Synced Dual Playback

Both games rendered on a single split canvas sharing the same input. You press space once, both dinos jump simultaneously. The visual differences become immediately obvious because the context is identical — same obstacles, same timing, but the reconstructed dino is bug-eyed, three-legged, and wobbling.

**Why it works:** Simpler to build than #1 or #2 and still very effective. Differences are undeniable when the context is identical.

---

## Option 4: "Excavation Layers" Reveal

Matches the existing portfolio theme (dig layers). The page starts showing the reconstructed game. As you scroll down (or click "dig deeper"), layers peel away revealing the original code underneath — CSS clip-path animations that expose the original game canvas beneath the reconstructed one. Each layer corresponds to one of the 13 artifacts, with annotations in the amber theme explaining what the AI got wrong.

**Why it works:** Ties directly into the archaeological metaphor and the portfolio's visual language.

---

## Option 5: Just Embed What Exists

The existing side-by-side viewer is already good. Two playable games, click between views, difference table. Quick win with zero new code.

**Why it works:** Zero effort, already functional. But doesn't tell the story the way the other options do.

---

## Recommendation

**Option 2** (fake terminal → live reconstruction) is the most portfolio-worthy because it tells a narrative.

**Option 1** (mutation slider) is the most fun and interactive.

They could be combined: terminal animation plays first, then hands off to the mutation slider for exploration.
