(function () {
"use strict";

/* ============================================================
   MEMORY RUSH — game core (pure logic, no DOM)
   ------------------------------------------------------------
   Rules, sequence generation, answer validation, scoring and
   personal-best persistence live here so they can be unit-tested
   with Node (see tests/test-core.js) and reused by any UI.
   Levels mirror memory-rush.py by Izuchukwu Christian exactly.
   ============================================================ */

// pool + sample size + memorize time (seconds) + feedback messages.
const LEVELS = [
  { pool: [1, 2, 3, 4, 5],                          size: 4, show: 3, win: "EXCELLENT.",       fail: "You failed." },
  { pool: [3, 2, 0, 0, 9, 4],                       size: 5, show: 4, win: "EXCELLENT.",       fail: "You failed." },
  { pool: [1, 1, 3, 2, 6, 4],                       size: 5, show: 4, win: "EXCELLENT.",       fail: "You failed." },
  { pool: [9, 5, 6, 3, 7, 8],                       size: 6, show: 4, win: "EXCELLENT.",       fail: "You failed." },
  { pool: [2, 5, 1, 6, 0],                          size: 5, show: 3, win: "EXCELLENT.",       fail: "You failed." },
  { pool: ["a", 1, 4, "b", "c", 9, 3],              size: 7, show: 5, win: "YOU'RE ON FIRE!",  fail: "I KNEW YOU DIDN'T HAVE THE BALLS TO PASS THIS LEVEL" },
  { pool: ["t", "e", "m", "p", "l", "e"],           size: 6, show: 4, win: "YOU'RE GOOD!",     fail: "YOU FLOPPED." },
  { pool: ["k", "e", "r", "n", "e", "l"],           size: 6, show: 4, win: "WONDERFUL!",       fail: "FAILED... YOU'RE A BABY LOL" },
  { pool: ["s", "u", "m", "m", "e", "r"],           size: 6, show: 4, win: "ONE MORE STEP TO GO!", fail: "WRONG... WE'RE ALMOST THERE." },
  { pool: ["n", "e", "u", "r", "o", "g", "e", "n"], size: 8, show: 5, win: "YOUR IQ LEVEL IS GOOD FOR ANY SKILL — YOU ARE AMAZING!", fail: "CAN'T BELIEVE YOU FAILED THIS ONE." },
];

const FINAL_MSG = "YOU BEAT MEMORY RUSH";
const LEVEL_POINTS = 100; // clearing level n awards n * LEVEL_POINTS points
const BEST_KEY = "memory-rush-best";

// Equivalent of Python's random.sample: pick `size` unique
// positions from the pool (duplicate values can still appear
// when the pool itself contains duplicates, e.g. level 2).
function sample(pool, size) {
  const idx = pool.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, size).map(i => pool[i]);
}

// Parse user input like the CLI: lowercase, split on any
// whitespace, convert numeric tokens to numbers.
function parseAnswer(raw) {
  return String(raw).trim().toLowerCase().split(/\s+/).filter(Boolean).map(tok => {
    if (/^\d+$/.test(tok)) return Number(tok);
    return tok;
  });
}

// Order and length both matter; no partial credit.
function checkAnswer(guess, sequence) {
  return guess.length === sequence.length &&
         guess.every((v, i) => v === sequence[i]);
}

// ---------- scoring ----------
// Transparent rules: clearing level n is worth n * 100 points
// (level 1 = 100 ... level 10 = 1000). A perfect run scores 5500.
// A failed run keeps the points of the levels already cleared.
function levelPoints(levelIndex) {
  return (levelIndex + 1) * LEVEL_POINTS;
}
function totalWinScore() {
  return LEVELS.reduce((sum, _, i) => sum + levelPoints(i), 0);
}

// ---------- personal best (localStorage, with graceful fallback) ----------
// Returns a working storage object or null when localStorage is
// unavailable (private mode, disabled, Node, etc). Never throws.
function storage() {
  try {
    const probe = "__mr_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch (e) {
    return null;
  }
}

// `store` is injectable for testing; defaults to browser storage.
function loadBest(store) {
  const s = store !== undefined ? store : storage();
  if (!s) return null;
  try {
    const raw = JSON.parse(s.getItem(BEST_KEY));
    if (raw &&
        typeof raw.score === "number" && raw.score >= 0 &&
        typeof raw.levelReached === "number" &&
        typeof raw.cleared === "number" &&
        typeof raw.victory === "boolean") {
      return raw;
    }
  } catch (e) { /* corrupted entry -> treat as no record */ }
  return null;
}

// Returns true when a new personal best was actually stored.
function saveBest(result, store) {
  if (!isBetter(result, loadBest(store))) return false;
  const s = store !== undefined ? store : storage();
  if (!s) return false;
  try {
    s.setItem(BEST_KEY, JSON.stringify(result));
    return true;
  } catch (e) {
    return false;
  }
}

function isBetter(result, best) {
  if (!best) return result.score > 0;
  if (result.score !== best.score) return result.score > best.score;
  return result.victory && !best.victory; // tie-break: a full clear beats a partial run
}

// ---------- run result ----------
// levelIndex is 0-based; on victory the loop has already advanced past
// the last level, so "level reached" is clamped to 10/10.
function runResult(levelIndex, score, victory) {
  return {
    score,
    levelReached: victory ? LEVELS.length : Math.min(levelIndex + 1, LEVELS.length),
    cleared: victory ? LEVELS.length : levelIndex,
    victory,
  };
}

// ---------- config sanity ----------
// Catches config mistakes (bad sizes, empty pools, non-2s show times...).
function validateLevels() {
  const errors = [];
  if (LEVELS.length !== 10) errors.push(`expected 10 levels, found ${LEVELS.length}`);
  LEVELS.forEach((cfg, i) => {
    const n = i + 1;
    if (!Array.isArray(cfg.pool) || cfg.pool.length === 0) errors.push(`level ${n}: empty pool`);
    else if (cfg.size < 1 || cfg.size > cfg.pool.length) errors.push(`level ${n}: size ${cfg.size} invalid for pool of ${cfg.pool.length}`);
    if (!Number.isFinite(cfg.show) || cfg.show < 1) errors.push(`level ${n}: bad show time ${cfg.show}`);
    if (typeof cfg.win !== "string" || typeof cfg.fail !== "string") errors.push(`level ${n}: missing win/fail message`);
  });
  return errors;
}

/* ---------- export: browser global + Node module ---------- */
const MemoryRushCore = {
  LEVELS, FINAL_MSG, LEVEL_POINTS, BEST_KEY,
  sample, parseAnswer, checkAnswer,
  levelPoints, totalWinScore, runResult,
  storage, loadBest, saveBest, isBetter,
  validateLevels,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = MemoryRushCore;
} else if (typeof window !== "undefined") {
  window.MemoryRushCore = MemoryRushCore;
}

})();
