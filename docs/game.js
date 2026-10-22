(function () {
"use strict";

/* ============================================================
   MEMORY RUSH — web edition (UI layer)
   ------------------------------------------------------------
   Pure rules live in game-core.js. This file only renders state
   and wires events.

   Robustness decisions:
   - runId tokens: every async callback (timers, reveals) checks it
     still belongs to the current run, so restarting can never let
     stale timers change screens or advance levels.
   - The countdown is timestamp-based (Date.now) instead of counting
     interval ticks, so switching tabs or backgrounding the browser
     cannot stretch or double-run it.
   - Empty submissions are ignored with a visible hint instead of
     instantly failing the run.
   ============================================================ */

const CORE = window.MemoryRushCore;
const { LEVELS, FINAL_MSG, sample, parseAnswer, checkAnswer, levelPoints, totalWinScore, storage, loadBest, saveBest } = CORE;

/* ---------- dom ---------- */
const startScreen = document.getElementById("startScreen");
const gameScreen  = document.getElementById("gameScreen");
const endScreen   = document.getElementById("endScreen");

const startBtn  = document.getElementById("startBtn");
const replayBtn = document.getElementById("replayBtn");
const submitBtn = document.getElementById("submitBtn");

const levelTrack = document.getElementById("levelTrack");
const levelNum   = document.getElementById("levelNum");
const scoreVal   = document.getElementById("scoreVal");
const stageLabel = document.getElementById("stageLabel");
const tileRow    = document.getElementById("tileRow");
const feedbackEl = document.getElementById("feedback");
const timerWrap  = document.getElementById("timerWrap");
const timerFill  = document.getElementById("timerFill");
const timerCount = document.getElementById("timerCount");
const inputWrap  = document.getElementById("inputWrap");
const answerEl   = document.getElementById("answer");

const endKicker   = document.getElementById("endKicker");
const endTitle    = document.getElementById("endTitle");
const endSub      = document.getElementById("endSub");
const statLevel   = document.getElementById("statLevel");
const statCleared = document.getElementById("statCleared");
const statScore   = document.getElementById("statScore");
const statBest    = document.getElementById("statBest");
const bestBadge   = document.getElementById("bestBadge");
const startBest   = document.getElementById("startBest");

/* battle stage (visuals only — game state stays in this file) */
const battleShake = document.querySelector(".shell");
const soldierWrap = document.getElementById("soldierWrap");
const soldierImg  = document.getElementById("soldierImg");
const enemyWrap   = document.getElementById("enemyWrap");
const enemyImg    = document.getElementById("enemyImg");
const muzzleSoldier = document.getElementById("muzzleSoldier");
const muzzleEnemy  = document.getElementById("muzzleEnemy");
const hitVignette  = document.getElementById("hitVignette");
const soundBtn     = document.getElementById("soundBtn");

const AUDIO = window.MemoryRushAudio || null; // synthesized SFX; game works without it

const SPRITES = {
  soldier: "assets/soldier.png?v=5",
  soldierDown: "assets/soldier-down.png?v=5",
  enemy: "assets/enemy.png?v=5",
  enemyDown: "assets/enemy-down.png?v=5",
};
const SCENE = [
  "assets/ally-kneel.png?v=1",
  "assets/ally-guard.png?v=1",
  "assets/ally-advance.png?v=1",
  "assets/jet.png?v=1",
];
let spritesPreloaded = false;
function preloadSprites() {
  if (spritesPreloaded) return;
  spritesPreloaded = true;
  Object.keys(SPRITES).forEach(k => { const im = new Image(); im.src = SPRITES[k]; });
  SCENE.forEach(src => { const im = new Image(); im.src = src; });
}

/* ambient jet flyby audio — quiet, infrequent, only while the page is visible */
let jetAmbienceOn = false;
function startJetAmbience() {
  if (jetAmbienceOn) return;
  jetAmbienceOn = true;
  setInterval(() => {
    if (!document.hidden) playSound("jetFlyby");
  }, 22000);
}

/* runId-guarded battle timer: combat beats can never leak into the next run */
function battleAfter(ms, myRun, fn) {
  setTimeout(() => { if (myRun === runId) fn(); }, ms);
}

function playSound(name) {
  if (AUDIO && typeof AUDIO[name] === "function") {
    try { AUDIO[name](); } catch (e) { /* audio must never break the game */ }
  }
}

/* ---------- state ---------- */
let level = 0;            // 0-based index
let score = 0;            // points banked by cleared levels
let sequence = [];         // current level's sequence
let locked = false;        // input disabled during reveals
let memorizeUntil = 0;     // timestamp when the countdown ends
let timerId = null;         // countdown interval handle
let runId = 0;              // increments every new run; guards stale callbacks

/* ---------- helpers ---------- */
function buildDots() {
  levelTrack.innerHTML = "";
  for (let i = 0; i < LEVELS.length; i++) {
    const dot = document.createElement("span");
    dot.className = "dot";
    levelTrack.appendChild(dot);
  }
}
function paintDots() {
  [...levelTrack.children].forEach((dot, i) => {
    dot.className = "dot" +
      (i < level ? " done" : i === level ? " current" : "");
  });
}

function clearTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
}

function showScreen(el) {
  [startScreen, gameScreen, endScreen].forEach(s => s.classList.add("hidden"));
  el.classList.remove("hidden");
  // re-trigger fade animation
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
}

function paintScore() {
  scoreVal.textContent = score;
}

function paintStartBest() {
  const best = loadBest();
  if (best) {
    startBest.textContent = `PERSONAL BEST · ${best.score} PTS`;
    startBest.classList.remove("hidden");
  } else {
    startBest.classList.add("hidden");
  }
}

/* ---------- game flow ---------- */

function startGame() {
  runId++;                 // invalidates every pending callback from the previous run
  level = 0;
  score = 0;
  clearTimer();
  buildDots();
  paintScore();
  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  resetBattle();
  if (window.MR3D && window.MR3D.ready) { try { window.MR3D.begin(); } catch (e) {} }
  preloadSprites();
  if (AUDIO) { try { AUDIO.unlock(); } catch (e) {} } // audio must start from a user gesture
  startJetAmbience();
  playSound("windLoop");
  showScreen(gameScreen);
  startLevel();
}

/* ---------- battle stage control ----------
   All of this is presentation: gameplay lives in game-core + this
   file's level flow. Classes are reset wholesale so a replay can
   never inherit a fallen enemy or mid-fire soldier. */
function resetBattle() {
  soldierImg.src = SPRITES.soldier;
  soldierWrap.className = "combatant-wrap soldier-wrap";
  enemyImg.src = SPRITES.enemy;
  enemyWrap.className = "combatant-wrap enemy-wrap"; // opacity 0 until spawned
  [muzzleSoldier, muzzleEnemy, hitVignette].forEach(el => el.classList.remove("flash"));
  battleShake.classList.remove("shake-shell");
}

/* A fresh hostile moves into the arena for each level. The offset
   varies per level so the enemy keeps feeling alive. */
function spawnEnemy() {
  enemyImg.src = SPRITES.enemy;
  enemyWrap.className = "combatant-wrap enemy-wrap";
  enemyWrap.style.right = (5 + (level % 3) * 3) + "%";   // 5%, 8%, 11% cycle
  enemyWrap.style.bottom = (2 + (level % 2) * 5) + "vh"; // slight depth change
  void enemyWrap.offsetWidth;                            // restart the animation
  enemyWrap.classList.add("spawned");
}

/* Player fires: aim, crack, hit, reload, enemy down. next() runs the
   level transition once the sequence finishes. */
function combatFire(myRun, next) {
  if (window.MR3D && window.MR3D.ready) {
    try { window.MR3D.correct(); } catch (e) {}
    battleAfter(2100, myRun, next);
    return;
  }
  soldierWrap.classList.add("aiming");
  battleAfter(280, myRun, () => {
    soldierWrap.classList.add("firing");
    muzzleSoldier.classList.add("flash");
    playSound("shot");
    enemyWrap.classList.remove("aiming");
    enemyWrap.classList.add("hit");
  });
  battleAfter(760, myRun, () => {
    soldierWrap.classList.remove("firing");
    soldierWrap.classList.add("reloading");
    playSound("reload");
  });
  battleAfter(1150, myRun, () => {
    enemyImg.src = SPRITES.enemyDown;
    enemyWrap.classList.remove("hit");
    enemyWrap.classList.add("fallen");
  });
  battleAfter(1900, myRun, next);
}

/* Enemy fires back and the player goes down — shown before the results screen. */
function combatEnemyWins(myRun, next) {
  if (window.MR3D && window.MR3D.ready) {
    try { window.MR3D.wrong(); } catch (e) {}
    battleAfter(2400, myRun, next);
    return;
  }
  battleAfter(300, myRun, () => enemyWrap.classList.add("aiming"));
  battleAfter(650, myRun, () => {
    muzzleEnemy.classList.add("flash");
    playSound("enemyShot");
    hitVignette.classList.add("flash");
    battleShake.classList.add("shake-shell");
  });
  battleAfter(1150, myRun, () => {
    soldierImg.src = SPRITES.soldierDown; // wounded pose — alive, no gore
    soldierWrap.classList.add("reloading"); // slight settle, reuse gentle motion
  });
  battleAfter(2300, myRun, next);
}

function startLevel() {
  const cfg = LEVELS[level];
  const myRun = runId;
  sequence = sample(cfg.pool, cfg.size);
  locked = true;
  paintDots();
  levelNum.textContent = level + 1;
  stageLabel.textContent = "MEMORIZE";
  tileRow.className = "tile-row";
  tileRow.innerHTML = "";
  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  inputWrap.classList.add("hidden");
  timerWrap.classList.remove("hidden");
  answerEl.value = "";
  spawnEnemy();

  // build tiles
  sequence.forEach((item, i) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.style.animationDelay = `${i * 90}ms`;
    tile.innerHTML = `
      <div class="tile-inner">
        <div class="tile-face tile-front">${item}</div>
        <div class="tile-face tile-back">?</div>
      </div>`;
    tileRow.appendChild(tile);
  });

  // countdown — timestamp-based so tab switching can't distort it
  const total = cfg.show;
  memorizeUntil = Date.now() + total * 1000;
  timerCount.textContent = total;
  paintTimerBar(total);
  clearTimer();
  timerId = setInterval(() => tickCountdown(myRun, total), 250);
  tickCountdown(myRun, total); // paint immediately, don't wait 250ms
}

function tickCountdown(myRun, total) {
  if (myRun !== runId) { clearTimer(); return; } // stale run: stop touching the UI
  const remainingMs = memorizeUntil - Date.now();
  paintTimerBar(Math.max(remainingMs / 1000, 0), total);
  const secs = Math.max(Math.ceil(remainingMs / 1000), 0);
  timerCount.textContent = secs;
  if (remainingMs <= 0) {
    clearTimer();
    hideTiles(myRun);
  }
}

function paintTimerBar(remainingSec, totalSec) {
  const pct = Math.max(Math.min(remainingSec / totalSec, 1), 0) * 100;
  timerFill.style.width = pct + "%";
}

function hideTiles(myRun) {
  [...tileRow.children].forEach((tile, i) => {
    setTimeout(() => {
      if (myRun !== runId) return;
      tile.classList.add("hidden-tile");
      const front = tile.querySelector(".tile-front");
      if (front) front.textContent = "?"; // JS-level clear: numbers are gone no matter what
    }, i * 80);
  });
  setTimeout(() => {
    if (myRun !== runId) return;
    stageLabel.textContent = "RECALL";
    inputWrap.classList.remove("hidden");
    locked = false;
    answerEl.focus();
  }, sequence.length * 80 + 150);
}

function submitAnswer() {
  if (locked) return;

  const guess = parseAnswer(answerEl.value);
  if (guess.length === 0) {
    // An empty answer is never accepted and never ends the run.
    feedbackEl.textContent = "TYPE THE SEQUENCE FIRST — SPACE SEPARATED";
    feedbackEl.className = "feedback warn";
    answerEl.classList.remove("shake");
    void answerEl.offsetWidth; // restart the animation
    answerEl.classList.add("shake");
    answerEl.focus();
    return;
  }

  const cfg = LEVELS[level];
  const myRun = runId;
  locked = true;
  inputWrap.classList.add("hidden");
  timerWrap.classList.add("hidden");

  // reveal the correct sequence
  [...tileRow.children].forEach((t, i) => {
    t.classList.remove("hidden-tile");
    const front = t.querySelector(".tile-front");
    if (front) front.textContent = sequence[i];
  });

  const correct = checkAnswer(guess, sequence);

  if (correct) {
    score += levelPoints(level);
    paintScore();
    tileRow.classList.add("ok");
    stageLabel.textContent = cfg.win;
    feedbackEl.textContent = `+${levelPoints(level)} PTS`;
    feedbackEl.className = "feedback ok";
    // correct answer -> the soldier fires and the enemy goes down
    combatFire(myRun, () => {
      level++;
      if (level >= LEVELS.length) {
        winScreen();
      } else {
        startLevel();
      }
    });
  } else {
    tileRow.classList.add("bad");
    stageLabel.textContent = cfg.fail;
    feedbackEl.textContent = cfg.fail;
    feedbackEl.className = "feedback bad";
    // wrong answer -> the enemy fires and the run is over
    combatEnemyWins(myRun, failScreen);
  }
}

/* ---------- end of run ---------- */

function runResult(victory) {
  return CORE.runResult(level, score, victory);
}

function paintResults(victory) {
  const cfg = LEVELS[level];
  const result = runResult(victory);
  const isNewBest = saveBest(result);
  const best = loadBest();

  statLevel.textContent = `${result.levelReached} / ${LEVELS.length}`;
  statCleared.textContent = result.cleared;
  statScore.textContent = result.score;
  statBest.textContent = best ? best.score : "—";
  bestBadge.classList.toggle("hidden", !isNewBest);

  if (victory) {
    endKicker.textContent = "PERFECT RUN";
    endTitle.textContent = FINAL_MSG;
    endSub.textContent = `All 10 levels cleared · ${totalWinScore()} PTS is a perfect score. Your IQ level is good for any skill.`;
    endScreen.classList.add("win");
  } else {
    endKicker.textContent = "RUN OVER";
    endTitle.textContent = "YOU FLOPPED";
    endSub.textContent = `${cfg.fail} You reached level ${level + 1} of ${LEVELS.length}.`;
    endScreen.classList.remove("win");
  }
  showScreen(endScreen);
  replayBtn.focus(); // keyboard players land right on the replay action
}

function winScreen() {
  if (window.MR3D && window.MR3D.ready) { try { window.MR3D.victory(); } catch (e) {} }
  paintDots();
  playSound("stingWin");
  paintResults(true);
}

function failScreen() {
  paintDots();
  playSound("stingFail");
  paintResults(false);
}

/* ---------- events ---------- */
startBtn.addEventListener("click", startGame);

/* sound toggle: reflects the audio module's persisted mute state */
function paintSoundBtn() {
  if (AUDIO) soundBtn.textContent = AUDIO.getMuted() ? "🔇" : "🔊";
}
paintSoundBtn();
soundBtn.addEventListener("click", () => {
  if (!AUDIO) return;
  AUDIO.setMuted(!AUDIO.getMuted());
  paintSoundBtn();
});
replayBtn.addEventListener("click", startGame);
submitBtn.addEventListener("click", submitAnswer);
answerEl.addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); submitAnswer(); }
});

/* QA debug mode: ?flashdebug=1 pins both muzzle flashes visible with
   the enemy spawned, so flash placement can be screenshot-verified
   without racing the 280ms fire window. No effect on normal play. */
if (/[?&]flashdebug=1/.test(window.location.search)) {
  document.body.classList.add("flash-debug");
  enemyWrap.classList.add("spawned");
  muzzleSoldier.classList.add("flash");
  muzzleEnemy.classList.add("flash");
}

// If the tab was backgrounded during the countdown, correct the
// timer display the moment the player returns.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" &&
      !gameScreen.classList.contains("hidden") &&
      timerId !== null) {
    const total = LEVELS[level].show;
    tickCountdown(runId, total);
  }
});

/* ---------- 3D warzone integration ----------
 * The 3D module (3d/mr3d-main.js) publishes window.MR3D when WebGL
 * initialized successfully. Everything below degrades to the original
 * 2D battle choreography when MR3D is absent (old browsers, jsdom tests). */
const MODE_3D = { on: !!window.MR3D };
document.addEventListener("mr3d:ready", () => {
  MODE_3D.on = true;
  // module finished loading mid-run: sync the 3D battle to the active run
  if (window.MR3D && !gameScreen.classList.contains("hidden")) window.MR3D.begin();
});
document.addEventListener("mr3d:failed", () => { MODE_3D.on = false; });

function fx3d(fn2d) { return MODE_3D.on ? null : fn2d; }

/* ---------- init ---------- */
buildDots();
paintStartBest();

})();
