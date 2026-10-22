/* ============================================================
   MEMORY RUSH — core unit tests
   Run with:  node --test tests/
   (uses Node's built-in test runner, no dependencies)
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../docs/game-core.js");

const {
  LEVELS, sample, parseAnswer, checkAnswer,
  levelPoints, totalWinScore,
  loadBest, saveBest, isBetter, validateLevels,
} = core;

/* ---------- 1. level configuration sanity ---------- */
test("there are exactly 10 levels and the config is valid", () => {
  assert.equal(LEVELS.length, 10);
  assert.deepEqual(validateLevels(), []);
});

/* ---------- 2. sequence generation ---------- */
test("sample returns the right number of items, all drawn from the pool", () => {
  for (const cfg of LEVELS) {
    for (let trial = 0; trial < 200; trial++) {
      const seq = sample(cfg.pool, cfg.size);
      assert.equal(seq.length, cfg.size, `level pool ${JSON.stringify(cfg.pool)}`);
      for (const item of seq) {
        assert.ok(cfg.pool.includes(item), `item ${item} not in pool`);
      }
    }
  }
});

test("sample with duplicate pool values can produce duplicates but never more than the pool holds", () => {
  const pool = [3, 2, 0, 0, 9, 4]; // level 2: two zeros
  for (let trial = 0; trial < 200; trial++) {
    const seq = sample(pool, 5);
    const zeros = seq.filter(v => v === 0).length;
    assert.ok(zeros <= 2, "more duplicate zeros than the pool contains");
  }
});

/* ---------- 3. answer parsing (mirrors the CLI) ---------- */
test("parseAnswer handles spaces, tabs, newlines, mixed case, digits", () => {
  assert.deepEqual(parseAnswer("4 1 3 2"), [4, 1, 3, 2]);
  assert.deepEqual(parseAnswer("  4   1\t3\n2 "), [4, 1, 3, 2]);
  assert.deepEqual(parseAnswer("B 9 a"), ["b", 9, "a"]);       // letters lowercased
  assert.deepEqual(parseAnswer("04 3"), [4, 3]);                 // leading zero like int() in Python
  assert.deepEqual(parseAnswer(""), []);
  assert.deepEqual(parseAnswer("    "), []);
});

test("parseAnswer output equals pool item types (numbers stay numbers)", () => {
  assert.deepEqual(parseAnswer("9 0 4 3 2"), [9, 0, 4, 3, 2]);
  assert.deepEqual(parseAnswer("neurogen"), ["neurogen"]);      // single token, no split
  assert.deepEqual(parseAnswer("n e u r o g e n"), ["n", "e", "u", "r", "o", "g", "e", "n"]);
});

/* ---------- 4. answer validation ---------- */
test("checkAnswer requires exact order and length", () => {
  const seq = [4, 1, 3, 2];
  assert.ok(checkAnswer([4, 1, 3, 2], seq));
  assert.ok(!checkAnswer([2, 3, 1, 4], seq));      // wrong order
  assert.ok(!checkAnswer([4, 1, 3], seq));          // too short
  assert.ok(!checkAnswer([4, 1, 3, 2, 5], seq));    // too long
  assert.ok(!checkAnswer([], seq));                 // empty is never correct
});

test("checkAnswer handles mixed sequences case-insensitively via parseAnswer", () => {
  const seq = ["a", 1, 4, "b", "c", 9, 3];         // level 6
  assert.ok(checkAnswer(parseAnswer("A 1 4 B c 9 3"), seq));
  assert.ok(!checkAnswer(parseAnswer("a 1 4 b c 9"), seq));     // missing one
  assert.ok(!checkAnswer(parseAnswer("1 a 4 b c 9 3"), seq));   // wrong order
});

test("duplicate values in a sequence must be reproduced exactly", () => {
  const seq = [3, 2, 0, 0, 9];
  assert.ok(checkAnswer([3, 2, 0, 0, 9], seq));
  assert.ok(!checkAnswer([3, 2, 0, 9, 0], seq));    // order matters even for duplicates
});

/* ---------- 5. scoring ---------- */
test("levelPoints: clearing level n is worth n * 100", () => {
  assert.equal(levelPoints(0), 100);
  assert.equal(levelPoints(9), 1000);
});

test("a perfect run scores 5500", () => {
  assert.equal(totalWinScore(), 5500);
  // accumulated score after clearing levels 1..k
  let score = 0;
  for (let i = 0; i < 10; i++) score += levelPoints(i);
  assert.equal(score, 5500);
});

/* ---------- 6. personal best storage ---------- */
// Fake storage object matching the localStorage interface.
function fakeStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    _dump: () => map,
  };
}

const run = (score, victory, levelReached, cleared) =>
  ({ score, levelReached, cleared, victory });

test("no storage available: loadBest returns null, saveBest returns false, nothing throws", () => {
  assert.equal(loadBest(null), null);
  assert.equal(saveBest(run(5500, true, 10, 10), null), false);
  assert.equal(loadBest(undefined), null); // storage() also fails in Node -> null
});

test("saveBest stores and loadBest round-trips a result", () => {
  const store = fakeStorage();
  const result = run(5500, true, 10, 10);
  assert.equal(saveBest(result, store), true);
  assert.deepEqual(loadBest(store), result);
});

test("a higher score replaces the record, a lower score does not", () => {
  const store = fakeStorage();
  saveBest(run(100, false, 1, 1), store);
  assert.equal(saveBest(run(600, false, 3, 2), store), true);
  assert.equal(loadBest(store).score, 600);
  assert.equal(saveBest(run(300, false, 2, 1), store), false);
  assert.equal(loadBest(store).score, 600);
});

test("tie-break: a full victory beats an equal-score partial run", () => {
  const best = run(5500, false, 9, 9);
  const challenger = run(5500, true, 10, 10);
  assert.ok(isBetter(challenger, best));
  assert.ok(!isBetter(best, challenger));
});

test("corrupted storage entries are treated as no record instead of crashing", () => {
  const map = new Map([["memory-rush-best", "{not json"]]);
  const store = {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
  };
  assert.equal(loadBest(store), null);
});

test("score 0 runs never become a personal best", () => {
  const store = fakeStorage();
  assert.equal(saveBest(run(0, false, 1, 0), store), false);
  assert.equal(loadBest(store), null);
});

/* ---------- 7. random sequences always validate against their level ---------- */
test("generated sequences always pass checkAnswer for their own parse", () => {
  for (const cfg of LEVELS) {
    const seq = sample(cfg.pool, cfg.size);
    const typed = seq.map(String).join(" ");
    assert.ok(checkAnswer(parseAnswer(typed), seq), `roundtrip failed for ${typed}`);
  }
});
