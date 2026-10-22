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

const {
  LEVELS, FINAL_MSG,
  sample, parseAnswer, checkAnswer,
  levelPoints, totalWinScore,
  storage, loadBest, saveBest,
} = window.MemoryRushCore;

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
  showScreen(gameScreen);
  startLevel();
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
    setTimeout(() => {
      if (myRun !== runId) return;
      level++;
      if (level >= LEVELS.length) {
        winScreen();
      } else {
        startLevel();
      }
    }, 1400);
  } else {
    tileRow.classList.add("bad");
    stageLabel.textContent = cfg.fail;
    feedbackEl.textContent = cfg.fail;
    feedbackEl.className = "feedback bad";
    setTimeout(() => {
      if (myRun !== runId) return;
      failScreen();
    }, 1600);
  }
}

/* ---------- end of run ---------- */

function runResult(victory) {
  return {
    score,
    levelReached: level + 1,
    cleared: victory ? LEVELS.length : level,
    victory,
  };
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
  paintDots();
  paintResults(true);
}

function failScreen() {
  paintDots();
  paintResults(false);
}

/* ---------- events ---------- */
startBtn.addEventListener("click", startGame);
replayBtn.addEventListener("click", startGame);
submitBtn.addEventListener("click", submitAnswer);
answerEl.addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); submitAnswer(); }
});

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

/* ---------- init ---------- */
buildDots();
paintStartBest();
