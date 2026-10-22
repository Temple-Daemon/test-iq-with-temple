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
## 🪖 Tactical Combat Edition

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
