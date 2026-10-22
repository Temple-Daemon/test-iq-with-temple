/* ============================================================
   MEMORY RUSH — full victory run test (jsdom)
   Plays all 10 levels correctly through the REAL timing pipeline
   (live countdowns, combat sequences, level transitions) and
   asserts the victory state. Takes ~75s of real time because it
   respects the game's actual clocks.
   Run: node tests/victory-test.js
   ============================================================ */
const { JSDOM, VirtualConsole } = require("jsdom");
const path = require("path");
const { spawn } = require("child_process");

const failures = [];
const ok = (name, cond) => {
  console.log((cond ? "  ✔ " : "  ✖ ") + name);
  if (!cond) failures.push(name);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => console.log("  PAGE SCRIPT ERROR:", e.message));

  const ROOT = path.resolve(__dirname, "..");
  const server = spawn("python3", ["-m", "http.server", "8124"], { cwd: path.join(ROOT, "docs"), stdio: "ignore" });
  process.on("exit", () => server.kill());
  await sleep(500);

  const dom = await JSDOM.fromURL("http://localhost:8124/index.html", {
    runScripts: "dangerously", resources: "usable",
    pretendToBeVisual: true, virtualConsole: vc,
  });
  const w = dom.window;
  await sleep(700);
  const $ = id => w.document.getElementById(id);
  w.localStorage.clear();

  $("startBtn").click();
  await sleep(300);
  ok("run started at level 1", $("levelNum").textContent === "1");

  const SHOW = [3, 4, 4, 4, 3, 5, 4, 4, 4, 5]; // per-level memorize seconds
  let sawFiringSequence = false;

  for (let lvl = 1; lvl <= 10; lvl++) {
    // 1. capture the sequence during MEMORIZE (fronts hold values until the countdown ends)
    let seq = null;
    for (let i = 0; i < 60 && !seq; i++) {
      await sleep(100);
      const texts = [...w.document.querySelectorAll(".tile-front")].map(t => t.textContent);
      if (texts.length && texts.every(t => t !== "?")) seq = texts;
    }
    ok(`L${lvl}: sequence visible during memorize`, !!seq && seq.length > 0);

    // 2. wait for RECALL to unlock the input
    for (let i = 0; i < 80 && $("inputWrap").classList.contains("hidden"); i++) {
      await sleep(100);
    }
    ok(`L${lvl}: recall unlocked`, !$("inputWrap").classList.contains("hidden"));

    // 3. answer correctly
    $("answer").value = seq.join(" ");
    $("submitBtn").click();

    // sample the combat sequence once (on level 1)
    if (lvl === 1) {
      await sleep(340);
      sawFiringSequence = $("soldierWrap").className.includes("firing") &&
                          $("muzzleSoldier").className.includes("flash");
      await sleep(1600);
    } else {
      await sleep(SHOW[lvl - 1] * 1000 > 3000 ? 1500 : 1000);
    }

    // wait for the next level (or the victory screen) — combat takes 1900ms
    for (let i = 0; i < 50; i++) {
      const advanced = lvl < 10
        ? $("levelNum").textContent === String(lvl + 1)
        : !$("endScreen").classList.contains("hidden");
      if (advanced) break;
      await sleep(100);
    }
  }

  ok("combat fire sequence observed on L1", sawFiringSequence);
  ok("reached level 10", $("levelNum").textContent === "10" || !$("endScreen").classList.contains("hidden"));
  ok("victory end screen shown", !$("endScreen").classList.contains("hidden"));
  ok("victory kicker", $("endKicker").textContent === "PERFECT RUN");
  ok("final score 5500", $("statScore").textContent.trim() === "5500");
  ok("level reached 10/10", $("statLevel").textContent.trim() === "10 / 10");
  ok("levels cleared 10", $("statCleared").textContent.trim() === "10");
  ok("new best badge on empty storage", !$("bestBadge").classList.contains("hidden"));
  ok("enemy down at victory", $("enemyImg").src.includes("enemy-down"));
  ok("soldier standing at victory", $("soldierImg").src.includes("soldier.png") && !$("soldierImg").src.includes("soldier-down"));

  console.log(failures.length ? `\nFAIL: ${failures.length} check(s)` : "\nFULL VICTORY RUN PASSES");
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error("TEST CRASH:", e); process.exit(1); });
