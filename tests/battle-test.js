/* ============================================================
   MEMORY RUSH — battle integration test (jsdom)
   Boots the real index.html from disk (real script scoping like a
   browser), plays one correct level through the full combat
   sequence, then loses level 2 and checks the defeat choreography.
   Run: node tests/battle-test.js
   ============================================================ */
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const failures = [];
const ok = (name, cond) => {
  console.log((cond ? "  ✔ " : "  ✖ ") + name);
  if (!cond) failures.push(name);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => console.log("  PAGE SCRIPT ERROR:", e.message));

  // serve docs/ over plain HTTP (jsdom needs a real origin for localStorage),
  // then boot it with runScripts:"dangerously" so <script src> tags execute in
  // true browser-like global scopes — catches cross-script const redeclaration.
  const { spawn } = require("child_process");
  const server = spawn("python3", ["-m", "http.server", "8123"], { cwd: path.join(ROOT, "docs"), stdio: "ignore" });
  await sleep(500);
  const dom = await JSDOM.fromURL("http://localhost:8123/index.html", {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  process.on("exit", () => server.kill());
  const w = dom.window;
  await sleep(700); // let the three scripts settle

  ok("core module loaded", typeof w.MemoryRushCore !== "undefined");
  ok("audio module loaded", typeof w.MemoryRushAudio !== "undefined");

  const $ = id => w.document.getElementById(id);
  w.localStorage.clear();

  // --- start a run ---
  $("startBtn").click();
  await sleep(1200);
  ok("game screen shown", !$("gameScreen").classList.contains("hidden"));
  ok("enemy spawned for level 1", $("enemyWrap").className.includes("spawned"));
  ok("muzzle exists for both combatants", !!$("muzzleSoldier") && !!$("muzzleEnemy"));
  ok("three allied soldiers on the field",
     w.document.querySelectorAll(".ally").length === 3);
  ok("three fighter jets in the sky",
     w.document.querySelectorAll(".jet").length === 3);
  ok("allies are distinct files (not repeated cutouts)",
     new Set([...w.document.querySelectorAll(".ally")].map(a => a.src)).size === 3);

  // --- read the L1 sequence off the tiles and answer correctly ---
  const seq = [...w.document.querySelectorAll(".tile-front")].map(t => t.textContent);
  ok("sequence tiles rendered", seq.length === 4);
  await sleep(2600); // countdown is 3s for level 1

  // --- correct answer triggers the fire sequence ---
  $("answer").value = seq.join(" ");
  $("submitBtn").click();
  await sleep(420); // 280ms aim + fire
  ok("soldier fired (firing class)", $("soldierWrap").className.includes("firing"));
  ok("muzzle flash fired", $("muzzleSoldier").className.includes("flash"));
  ok("enemy took the hit", $("enemyWrap").className.includes("hit"));
  await sleep(800); // reload window
  ok("soldier reloaded", $("soldierWrap").className.includes("reloading"));
  await sleep(600);
  ok("enemy down sprite swapped", $("enemyImg").src.includes("enemy-down"));
  await sleep(1200); // next level transition (1900ms total)
  ok("advanced to level 2", $("levelNum").textContent === "2");

  // --- lose level 2: enemy fires back ---
  // level 2 shows for 4s; wait until RECALL unlocks the input
  for (let i = 0; i < 40 && $("inputWrap").classList.contains("hidden"); i++) {
    await sleep(200);
  }
  ok("level 2 input unlocked", !$("inputWrap").classList.contains("hidden"));
  $("answer").value = "zz zz zz zz zz";
  $("submitBtn").click();
  await sleep(900); // 650ms enemy shot
  ok("enemy muzzle flash fired", $("muzzleEnemy").className.includes("flash"));
  ok("hit vignette shown", $("hitVignette").className.includes("flash"));
  ok("screen shook", w.document.querySelector(".shell").className.includes("shake-shell"));
  await sleep(700);
  ok("soldier wounded sprite swapped", $("soldierImg").src.includes("soldier-down"));
  await sleep(1000); // results at 2300ms
  ok("end screen shown", !$("endScreen").classList.contains("hidden"));
  ok("results show level 2 / 10", $("statLevel").textContent.trim() === "2 / 10");
  ok("banked score kept (100)", $("statScore").textContent.trim() === "100");

  // --- replay resets the battle ---
  $("replayBtn").click();
  await sleep(600);
  ok("replay resets soldier pose", $("soldierImg").src.includes("soldier.png"));
  ok("replay resets enemy", $("enemyImg").src.includes("enemy.png") &&
     !$("enemyWrap").className.includes("fallen"));
  ok("replay resets to level 1", $("levelNum").textContent === "1");

  console.log(failures.length ? `\nFAIL: ${failures.length} check(s)` : "\nALL BATTLE CHECKS PASS");
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error("TEST CRASH:", e); process.exit(1); });
