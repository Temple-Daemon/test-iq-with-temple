const { JSDOM } = require("jsdom");
(async () => {
  const virtualConsole = new (require("jsdom").VirtualConsole)();
  virtualConsole.on("error", (...a) => console.log("PAGE ERROR:", ...a));
  virtualConsole.on("jsdomError", e => console.log("JSDOM ERROR:", e.message, e.detail && e.detail.stack ? "\n" + e.detail.stack.split("\n").slice(0,4).join("\n") : ""));
  const dom = await JSDOM.fromURL("https://temple-daemon.github.io/test-iq-with-temple/", {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole,
  });
  await new Promise(r => setTimeout(r, 4000)); // let scripts load
  const w = dom.window;
  console.log("MemoryRushCore set on window:", typeof w.MemoryRushCore !== "undefined");
  const btn = w.document.getElementById("startBtn");
  console.log("startBtn listeners attached:", typeof btn === "object" && btn !== null);
  btn.click();
  await new Promise(r => setTimeout(r, 800));
  const gameShown = !w.document.getElementById("gameScreen").classList.contains("hidden");
  console.log("game screen shown after click:", gameShown);
  process.exit(0);
})();
