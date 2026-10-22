/* ============================================================
   MEMORY RUSH — web edition
   Faithful port of memory-rush.py by Izuchukwu Christian
   ============================================================ */

// Level config mirrors the CLI exactly:
// pool + sample size + memorize time (seconds) + feedback messages.
const LEVELS = [
  { pool: [1, 2, 3, 4, 5],                         size: 4, show: 3, win: "EXCELLENT.",                              fail: "You failed." },
  { pool: [3, 2, 0, 0, 9, 4],                      size: 5, show: 4, win: "EXCELLENT.",                              fail: "You failed." },
  { pool: [1, 1, 3, 2, 6, 4],                      size: 5, show: 4, win: "EXCELLENT.",                              fail: "You failed." },
  { pool: [9, 5, 6, 3, 7, 8],                      size: 6, show: 4, win: "EXCELLENT.",                              fail: "You failed." },
  { pool: [2, 5, 1, 6, 0],                         size: 5, show: 3, win: "EXCELLENT.",                              fail: "You failed." },
  { pool: ["a", 1, 4, "b", "c", 9, 3],             size: 7, show: 5, win: "YOU'RE ON FIRE!",                         fail: "I KNEW YOU DIDN'T HAVE THE BALLS TO PASS THIS LEVEL" },
  { pool: ["t", "e", "m", "p", "l", "e"],          size: 6, show: 4, win: "YOU'RE GOOD!",                             fail: "YOU FLOPPED." },
  { pool: ["k", "e", "r", "n", "e", "l"],          size: 6, show: 4, win: "WONDERFUL!",                              fail: "FAILED... YOU'RE A BABY LOL" },
  { pool: ["s", "u", "m", "m", "e", "r"],          size: 6, show: 4, win: "ONE MORE STEP TO GO!",                    fail: "WRONG... WE'RE ALMOST THERE." },
  { pool: ["n", "e", "u", "r", "o", "g", "e", "n"], size: 8, show: 5, win: "YOUR IQ LEVEL IS GOOD FOR ANY SKILL — YOU ARE AMAZING!", fail: "CAN'T BELIEVE YOU FAILED THIS ONE." },
];

const FINAL_MSG = "YOU BEAT MEMORY RUSH";

/* ---------- dom ---------- */
const startScreen = document.getElementById("startScreen");
const gameScreen  = document.getElementById("gameScreen");
const endScreen   = document.getElementById("endScreen");

const startBtn  = document.getElementById("startBtn");
const replayBtn = document.getElementById("replayBtn");
const submitBtn = document.getElementById("submitBtn");

const levelTrack = document.getElementById("levelTrack");
const levelNum   = document.getElementById("levelNum");
const stageLabel = document.getElementById("stageLabel");
const tileRow    = document.getElementById("tileRow");
const timerWrap  = document.getElementById("timerWrap");
const timerFill  = document.getElementById("timerFill");
const timerCount = document.getElementById("timerCount");
const inputWrap  = document.getElementById("inputWrap");
const answerEl   = document.getElementById("answer");

const endKicker = document.getElementById("endKicker");
const endTitle  = document.getElementById("endTitle");
const endSub    = document.getElementById("endSub");

/* ---------- state ---------- */
let level = 0;          // 0-based index
let sequence = [];      // current level's sequence
let locked = false;    // input disabled during reveals
let timerId = null;

/* ---------- helpers ---------- */

// Equivalent of Python's random.sample: pick `size` unique
// positions from the pool (duplicate values still possible).
function sample(pool, size) {
  const idx = pool.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, size).map(i => pool[i]);
}

// Parse user input like the CLI: lowercase, split on
// whitespace, convert numeric tokens to numbers.
function parseAnswer(raw) {
  return raw.trim().toLowerCase().split(/\s+/).filter(Boolean).map(tok => {
    if (/^\d+$/.test(tok)) return Number(tok);
    return tok;
  });
}

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

/* ---------- game flow ---------- */

function startGame() {
  level = 0;
  buildDots();
  showScreen(gameScreen);
  startLevel();
}

function startLevel() {
  const cfg = LEVELS[level];
  sequence = sample(cfg.pool, cfg.size);
  locked = true;
  paintDots();
  levelNum.textContent = level + 1;
  stageLabel.textContent = "MEMORIZE";
  tileRow.className = "tile-row";
  tileRow.innerHTML = "";
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

  // countdown
  const total = cfg.show;
  let remaining = total;
  timerCount.textContent = remaining;
  timerFill.style.transition = "none";
  timerFill.style.width = "100%";
  requestAnimationFrame(() => {
    timerFill.style.transition = `width ${total}s linear`;
    timerFill.style.width = "0%";
  });

  timerId = setInterval(() => {
    remaining--;
    timerCount.textContent = Math.max(remaining, 0);
    if (remaining <= 0) {
      clearTimer();
      hideTiles();
    }
  }, 1000);
}

function hideTiles() {
  [...tileRow.children].forEach((tile, i) => {
    setTimeout(() => tile.classList.add("hidden-tile"), i * 80);
  });
  setTimeout(() => {
    stageLabel.textContent = "RECALL";
    inputWrap.classList.remove("hidden");
    locked = false;
    answerEl.focus();
  }, sequence.length * 80 + 150);
}

function submitAnswer() {
  if (locked) return;
  const cfg = LEVELS[level];
  const guess = parseAnswer(answerEl.value);

  // reveal correct sequence
  [...tileRow.children].forEach(t => t.classList.remove("hidden-tile"));

  const correct =
    guess.length === sequence.length &&
    guess.every((v, i) => v === sequence[i]);

  locked = true;
  inputWrap.classList.add("hidden");
  timerWrap.classList.add("hidden");

  if (correct) {
    tileRow.classList.add("ok");
    stageLabel.textContent = cfg.win;
    setTimeout(() => {
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
    setTimeout(() => failScreen(), 1600);
  }
}

function winScreen() {
  paintDots();
  endScreen.classList.add("win");
  endKicker.textContent = "PERFECT RUN";
  endTitle.textContent = FINAL_MSG;
  endSub.textContent = "All 10 levels cleared. Your IQ level is good for any skill.";
  showScreen(endScreen);
}

function failScreen() {
  paintDots();
  endScreen.classList.remove("win");
  endKicker.textContent = "RUN OVER";
  endTitle.textContent = "YOU FLOPPED";
  const cfg = LEVELS[level];
  endSub.textContent = `${cfg.fail} You reached level ${level + 1} of ${LEVELS.length}.`;
  showScreen(endScreen);
}

function showScreen(el) {
  [startScreen, gameScreen, endScreen].forEach(s => s.classList.add("hidden"));
  el.classList.remove("hidden");
  // re-trigger fade animation
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
}

/* ---------- events ---------- */
startBtn.addEventListener("click", startGame);
replayBtn.addEventListener("click", startGame);
submitBtn.addEventListener("click", submitAnswer);
answerEl.addEventListener("keydown", e => {
  if (e.key === "Enter") submitAnswer();
});

/* init */
buildDots();
