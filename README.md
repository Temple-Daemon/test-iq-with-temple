# 🧠 Memory Rush

**Memory Rush** is a Python-based command-line memory game that challenges players to memorize and reproduce sequences of numbers, letters, and alphanumeric values across ten levels.

Think you have a sharp memory? Put it to the test!

## 🎮 Features

- 🧩 **10 Levels:** Progress through ten memory challenges.
- 🔢 **Number Sequences:** Memorize and reproduce sequences of numbers.
- 🔤 **Letter Sequences:** Test your ability to remember letters in the correct order.
- 🔀 **Mixed Sequences:** Take on challenges involving both letters and numbers.
- 🎲 **Random Generation:** Experience randomly generated sequences during gameplay.
- 🔁 **Replay Option:** Start another round when your game ends.

## 🛠️ Requirements

- Python 3
- A terminal or command-line interface

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Temple-Daemon/test-iq-with-temple.git
## ❄️ 3D Winter Warzone Edition

The tactical upgrade is now **fully 3D** (three.js, WebGL) with the entire
10-level memory core untouched:

- **Move freely between answers**: WASD / arrow keys (layout-independent
  `e.code`), Shift sprint, C/Ctrl crouch toggle, R reload, Space jump,
  mouse-look with pointer lock on the canvas, wheel zoom. The keyboard
  never steals keys from the answer input.
- **Mobile**: virtual joystick (left), drag-to-look (canvas), and
  FIRE / RELOAD / CROUCH / SPRINT / JUMP buttons pinned to the edges.
- **Winter warzone**: procedural snow terrain with a flat combat arena,
  snow-capped pines, trenches, sandbag barriers, a ruined building,
  wrecked hull, crates, distant smoke plumes, 1300-particle snowfall,
  three patrolling fighter jets, and soft overcast lighting with
  shadows on desktop. No extra texture downloads: everything is
  generated geometry.
- **Characters**: CC0 Quaternius/KayKit Rig_Medium mannequins with the
  CC0 animation library (idle/walk/run/crouch/aim/shoot/reload/jump/
  hit/death). The hero wears winter camo with a face decal generated
  from the founder's reference portrait (an approximate likeness).
  A 4-soldier allied squad patrols on waypoints; the enemy aims,
  tracks the hero, and fires back on a wrong answer.
- **Combat flow**: correct answer -> hero aims, fires (muzzle point
  light + camera shake), enemy is hit and dies, hero reloads, next
  level spawns a fresh enemy at a new position. Wrong answer -> enemy
  fires, hero falls, run over. A choreography lock keeps the combat
  animations from being overridden by the idle loop.
- **Graceful fallback**: if WebGL is missing or the 3D assets fail to
  load, the game silently keeps the original 2D battle scene. The 2D
  and 3D modes run the same memory core (`game-core.js`), scoring and
  personal-best tracking.
- **QA modes**: `?debug3d=1` shows a live 3D state strip
  (phase/hero/enemy/pending), `?faceview=1` parks the camera in front
  of the hero.

Asset licenses: mannequin and animation GLBs are CC0 (Quaternius
Ultimate Animated Character Pack, KayKit). three.js ships from CDN
via an import map. Version-bump `?v=` on every deploy that touches
the module chain: the CDN caches per exact URL.

## 🪖 Tactical Combat Edition (2D)

The web edition wraps the ten-level memory challenge in a tactical combat presentation:

- **Correct answer → combat sequence:** the soldier aims, fires with a muzzle flash and synthesized gunshot, reloads, and the enemy goes down. The next level starts once the sequence completes.
- **Wrong answer → the enemy fires back:** enemy muzzle flash, a hit vignette, a screen shake, and the soldier drops to a wounded pose before the results screen.
- **A fresh enemy moves into the arena every level**, with varying positions.
- **Scoring, personal bests, and level rules are untouched** (see below).

### 🎨 Art and audio pipeline

- The game is a **2D HTML/CSS/JS application** — no game engine, no WebGL, no build step. Characters are high-quality AI-generated original artwork (hero soldier, hostile mercenary, defeat poses), cut out via a chroma-key pass and quantized to small palette PNGs (~30 KB each).
- All sound effects are **synthesized at runtime with the Web Audio API** (`game-audio.js`) — gunshots, reload clicks, win/fail stings. No audio files are downloaded. Sound can be toggled in the HUD and the preference persists.
- The enemy faction is fictional and identity-concealed (balaclava, no national markings).
- Combat timing is guarded by the same run-token system as the rest of the game: replaying mid-sequence can never leak stale timers.

## 🌐 Web Edition

The game also ships as a browser version (no installation, no dependencies):

- **Play it:** [temple-daemon.github.io/test-iq-with-temple](https://temple-daemon.github.io/test-iq-with-temple/)
- **Location in repo:** `docs/` (also deployed on Vercel)
- **Stack:** plain HTML, CSS, and JavaScript — no framework, no build step

### 🧮 Scoring (web edition)

Scoring is transparent and deterministic:

- Clearing **level n** awards **n × 100 points** (level 1 = 100 pts … level 10 = 1,000 pts).
- A **perfect run** (all 10 levels) scores **5,500 points**.
- A failed run **keeps** the points of the levels already cleared.
- Your **personal best** is stored locally in your own browser (`localStorage`). No account, no data leaves your device.

### 🔎 Technical notes

- Game rules and state logic live in `docs/game-core.js` (pure, testable, no DOM).
- The UI layer lives in `docs/game.js`; styles in `docs/style.css`.
- The countdown is timestamp-based, so switching browser tabs cannot distort it.
- Empty submissions are ignored (with a hint) instead of instantly failing the run.

### 🧪 Tests

The core logic (sequence generation, answer parsing/validation, scoring, personal-best storage) is covered by an automated test suite using Node's built-in runner:

```bash
node --test tests/test-core.js          # 20 unit tests: rules, parsing, scoring, best storage
node tests/battle-test.js               # 24 integration checks: combat choreography, reset, defeat flow
node tests/victory-test.js              # full 10-level victory run through the real combat pipeline (~75s)
```

Manual QA (performed in a real browser): start, replay, wrong-answer reveal, full 10-level victory run, timer cleanup on restart, mobile viewport, keyboard-only play.
