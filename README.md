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
node --test tests/test-core.js
```

Manual QA (performed in a real browser): start, replay, wrong-answer reveal, full 10-level victory run, timer cleanup on restart, mobile viewport, keyboard-only play.
