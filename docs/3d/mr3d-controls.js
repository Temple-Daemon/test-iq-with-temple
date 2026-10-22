/*
 * Memory Rush 3D — controls: keyboard, mouse-look, touch joystick.
 * The movement math lives in pure exported functions so tests can run
 * in Node without a DOM.
 */

/* Pure: camera-relative movement vector from key state.
 * yaw: camera yaw in radians (0 = camera behind the hero looking -Z).
 * Returns unit-speed vector {x, z} in world space (length <= 1). */
export function moveVector(keys, yaw, joy = { x: 0, y: 0 }) {
  let fwd = 0, side = 0;
  if (keys.forward) fwd += 1;
  if (keys.back) fwd -= 1;
  if (keys.right) side += 1;
  if (keys.left) side -= 1;
  // joystick overrides keys when pushed
  fwd += -joy.y;
  side += joy.x;
  const len = Math.hypot(fwd, side);
  if (len > 1) { fwd /= len; side /= len; }
  // camera sits at target + (sin(yaw), cos(yaw))*dist, so its forward
  // on the ground plane is (-sin(yaw), -cos(yaw)); right is perpendicular.
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  return { x: fx * fwd + rx * side, z: fz * fwd + rz * side };
}

/* Pure: hero heading for a movement direction, or null when standing. */
export function headingFor(v) {
  if (Math.hypot(v.x, v.z) < 0.05) return null;
  return Math.atan2(v.x, -v.z); // heading where -Z = 0
}

/* Pure: orbit camera position around a target. */
export function orbitPos(yaw, pitch, dist, target = { x: 0, y: 0, z: 0 }) {
  const p = Math.max(-0.15, Math.min(1.2, pitch));
  const cy = Math.cos(p);
  return {
    x: target.x + Math.sin(yaw) * dist * cy,
    y: target.y + 1.4 + Math.sin(p) * dist,
    z: target.z + Math.cos(yaw) * dist * cy,
  };
}

/* Live input state. */
export function createInput(canvas, ui) {
  const keys = { forward: false, back: false, left: false, right: false };
  const st = {
    yaw: 0, pitch: 0.35, dist: 5.2,
    joy: { x: 0, y: 0 },
    sprint: false, crouch: false,
    fire: false, fireEdge: false,
    reloadEdge: false, jumpEdge: false,
    pointerLocked: false, touchLook: null,
  };

  const KEYMAP = {
    KeyW: "forward", ArrowUp: "forward",
    KeyS: "back", ArrowDown: "back",
    KeyA: "left", ArrowLeft: "left",
    KeyD: "right", ArrowRight: "right",
  };

  function onKey(e, down) {
    if (KEYMAP[e.code]) {
      keys[KEYMAP[e.code]] = down;
      if (e.code.startsWith("Arrow")) e.preventDefault();
    }
    if (down && e.code === "Space") { st.jumpEdge = true; e.preventDefault(); }
    if (down && (e.code === "KeyC" || e.code === "ControlLeft")) st.crouch = !st.crouch;
    if (down && e.code === "KeyR") st.reloadEdge = true;
    st.sprint = e.shiftKey;
    // do not steal keys from the answer input
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") {
      keys.forward = keys.back = keys.left = keys.right = false;
    }
  }
  window.addEventListener("keydown", e => onKey(e, true));
  window.addEventListener("keyup", e => onKey(e, false));

  /* mouse look (desktop) */
  canvas.addEventListener("click", () => {
    if (!window.matchMedia("(pointer: coarse)").matches &&
        document.pointerLockElement !== canvas) {
      canvas.requestPointerLock && canvas.requestPointerLock();
    }
  });
  document.addEventListener("pointerlockchange", () => {
    st.pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener("mousemove", e => {
    if (!st.pointerLocked) return;
    st.yaw -= e.movementX * 0.0026;
    st.pitch += e.movementY * 0.0020;
  });
  canvas.addEventListener("mousedown", e => {
    if (e.button === 0 && st.pointerLocked) { st.fire = true; st.fireEdge = true; }
  });
  window.addEventListener("mouseup", e => { if (e.button === 0) st.fire = false; });
  window.addEventListener("wheel", e => {
    st.dist = Math.max(2.6, Math.min(9, st.dist + Math.sign(e.deltaY) * 0.5));
  }, { passive: true });

  /* touch look: drag anywhere on the canvas outside the joystick */
  canvas.addEventListener("touchstart", e => {
    for (const t of e.changedTouches) {
      if (!st.touchLook) st.touchLook = { id: t.identifier, x: t.clientX, y: t.clientY };
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", e => {
    if (!st.touchLook) return;
    for (const t of e.changedTouches) {
      if (t.identifier === st.touchLook.id) {
        st.yaw -= (t.clientX - st.touchLook.x) * 0.005;
        st.pitch += (t.clientY - st.touchLook.y) * 0.004;
        st.touchLook.x = t.clientX; st.touchLook.y = t.clientY;
      }
    }
  }, { passive: true });
  canvas.addEventListener("touchend", e => {
    for (const t of e.changedTouches) {
      if (st.touchLook && t.identifier === st.touchLook.id) st.touchLook = null;
    }
  }, { passive: true });

  /* virtual joystick + buttons when provided (mobile markup) */
  if (ui && ui.joystick) {
    const joy = ui.joystick, knob = ui.knob;
    const R = 52;
    let jid = null;
    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    joy.addEventListener("touchstart", e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      jid = t.identifier;
    }, { passive: false });
    joy.addEventListener("touchmove", e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== jid) continue;
        const r = joy.getBoundingClientRect();
        let dx = t.clientX - (r.left + r.width / 2);
        let dy = t.clientY - (r.top + r.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > R) { dx = dx / len * R; dy = dy / len * R; }
        setKnob(dx, dy);
        st.joy.x = dx / R; st.joy.y = dy / R;
      }
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === jid) {
          jid = null; st.joy.x = 0; st.joy.y = 0; setKnob(0, 0);
        }
      }
    };
    joy.addEventListener("touchend", end);
    joy.addEventListener("touchcancel", end);
  }
  if (ui && ui.buttons) {
    const hold = (el, on, off) => {
      el.addEventListener("touchstart", e => { e.preventDefault(); on(); }, { passive: false });
      const done = () => off && off();
      el.addEventListener("touchend", done);
      el.addEventListener("touchcancel", done);
    };
    hold(ui.buttons.fire, () => { st.fire = true; st.fireEdge = true; }, () => { st.fire = false; });
    hold(ui.buttons.sprint, () => { st.sprint = true; }, () => { st.sprint = false; });
    ui.buttons.crouch.addEventListener("touchstart", e => { e.preventDefault(); st.crouch = !st.crouch; }, { passive: false });
    ui.buttons.reload.addEventListener("touchstart", e => { e.preventDefault(); st.reloadEdge = true; }, { passive: false });
    ui.buttons.jump && ui.buttons.jump.addEventListener("touchstart", e => { e.preventDefault(); st.jumpEdge = true; }, { passive: false });
  }

  return {
    keys,
    consume() {
      const out = {
        move: moveVector(keys, st.yaw, st.joy),
        yaw: st.yaw, pitch: st.pitch, dist: st.dist,
        sprint: st.sprint, crouch: st.crouch, fire: st.fire,
        fireEdge: st.fireEdge, reloadEdge: st.reloadEdge, jumpEdge: st.jumpEdge,
      };
      st.fireEdge = false; st.reloadEdge = false; st.jumpEdge = false;
      return out;
    },
    state: st,
  };
}
