/*
 * Memory Rush 3D — boot module.
 * Initializes the WebGL warzone when the browser supports it and
 * publishes window.MR3D for game.js. On any failure it stays silent
 * and game.js keeps the working 2D battle scene.
 */
import * as THREE from "three";
import { Warzone } from "./mr3d-game.js?v=3";

function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) { return false; }
}

async function boot() {
  if (!webglOK()) {
    document.dispatchEvent(new CustomEvent("mr3d:failed", { detail: { reason: "no-webgl" } }));
    return;
  }
  const canvas = document.getElementById("warzone");
  if (!canvas) return;
  const ui = {
    joystick: document.getElementById("joy"),
    knob: document.getElementById("joyKnob"),
    buttons: {
      fire: document.getElementById("btnFire"),
      reload: document.getElementById("btnReload"),
      crouch: document.getElementById("btnCrouch"),
      sprint: document.getElementById("btnSprint"),
      jump: document.getElementById("btnJump"),
    },
  };
  const hooks = {
    onFire: () => window.playSound && window.playSound("shot"),
    onReload: () => window.playSound && window.playSound("reload"),
    onEnemyFire: () => window.playSound && window.playSound("enemyShot"),
    onEnemyDown: () => window.playSound && window.playSound("thud"),
  };
  try {
    const war = new Warzone(canvas, ui, hooks);
    window.MR3D = {
      ready: false,
      begin: () => { if (!window.MR3D.ready) return; war.startedOnce = true; war.begin(); },
      correct: () => { if (window.MR3D.ready) war.correctAnswer(); },
      wrong: () => { if (window.MR3D.ready) { war.runPhase = "lost"; war.wrongAnswer(); } },
      victory: () => { if (window.MR3D.ready) war.victory(); },
      playing: () => war.runPhase,
    };
    await war.init();
    if (/[?&]faceview=1/.test(window.location.search)) war.faceView = true;
    window.MR3D.ready = true;
    document.body.classList.add("mode-3d");
    if (matchMedia("(pointer: coarse)").matches) document.body.classList.add("touch");
    document.dispatchEvent(new CustomEvent("mr3d:ready"));
  } catch (e) {
    console.warn("MR3D: falling back to 2D battle:", e);
    document.body.classList.remove("mode-3d");
    document.dispatchEvent(new CustomEvent("mr3d:failed", { detail: { reason: String(e) } }));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
