/* Controls math unit tests (pure functions, no DOM needed). */
import test from "node:test";
import assert from "node:assert/strict";
import { moveVector, headingFor, orbitPos } from "../docs/3d/mr3d-controls.js";

test("W moves away from camera (-Z) at yaw 0", () => {
  const v = moveVector({ forward: true, back: false, left: false, right: false }, 0);
  assert.ok(Math.abs(v.x) < 1e-9);
  assert.ok(v.z < -0.9);
});

test("S moves toward camera (+Z) at yaw 0", () => {
  const v = moveVector({ forward: false, back: true, left: false, right: false }, 0);
  assert.ok(v.z > 0.9);
});

test("A and D strafe sideways", () => {
  const l = moveVector({ forward: false, back: false, left: true, right: false }, 0);
  const r = moveVector({ forward: false, back: false, left: false, right: true }, 0);
  assert.ok(l.x < -0.9 && Math.abs(l.z) < 1e-9);
  assert.ok(r.x > 0.9 && Math.abs(r.z) < 1e-9);
});

test("diagonal input is normalized to at most 1", () => {
  const v = moveVector({ forward: true, back: false, left: false, right: true }, 0);
  const len = Math.hypot(v.x, v.z);
  assert.ok(len <= 1.0001 && len > 0.98);
});

test("yaw rotates the movement basis", () => {
  // yaw = PI/2: camera looks along -X; forward must be -X
  const v = moveVector({ forward: true, back: false, left: false, right: false }, Math.PI / 2);
  assert.ok(v.x < -0.9 && Math.abs(v.z) < 0.05);
});

test("joystick overrides keys and is normalized", () => {
  const v = moveVector({ forward: false, back: false, left: false, right: false }, 0,
    { x: 0.8, y: -1 }); // y: -1 = push up = forward
  const len = Math.hypot(v.x, v.z);
  assert.ok(len <= 1.0001 && len > 0.98);
  assert.ok(v.z < 0); // forward component
});

test("headingFor gives yaw with -Z = 0, +X = +90deg", () => {
  assert.equal(headingFor({ x: 0, z: -1 }), 0);
  const h = headingFor({ x: 1, z: 0 });
  assert.ok(Math.abs(h - Math.PI / 2) < 1e-9);
});

test("headingFor is null when standing still", () => {
  assert.equal(headingFor({ x: 0.01, z: 0 }), null);
});

test("orbitPos stays behind the target at yaw 0 and above ground", () => {
  const p = orbitPos(0, 0.35, 5, { x: 1, y: 0, z: 2 });
  assert.ok(p.z > 2);          // behind (+Z)
  assert.ok(p.y > 1.4);         // above the target's head height
});

test("orbitPos clamps pitch below the ground plane", () => {
  const p = orbitPos(0, -2, 5, { x: 0, y: 0, z: 0 });
  assert.ok(p.y > 0.6 && p.y < 1.4); // clamped to -0.15 rad, still above the snow
});
