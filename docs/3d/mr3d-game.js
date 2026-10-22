/*
 * Memory Rush 3D — battle orchestration.
 * Owns the hero (player-controlled), the allied squad (autonomous),
 * the enemy, the camera, and the combat choreography triggered by
 * the memory game: correct answer -> hero shoots, enemy falls;
 * wrong answer -> hero is hit and dies; victory -> idle celebration.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildScene } from "./mr3d-scene.js?v=3";
import { loadSoldierAssets, makeSoldier } from "./mr3d-soldier.js?v=3";
import { createInput } from "./mr3d-controls.js?v=3";

const FACE_TEX = "assets/3d/hero-face.png";

const SQUAD_DEF = [
  { pos: [-6.5, -6], tint: 0xd9dee3, camo: 0xdde3e7, helmet: true, goggles: true,  pack: true,  route: [[-6.5, -6], [-2, -11], [4, -8]] },
  { pos: [8, -9],  tint: 0xb7c2b8, camo: 0xc9d3cb, helmet: true, goggles: false, pack: false, route: [[8, -9], [12, -4], [3, -3]] },
  { pos: [-3, -13], tint: 0x9fb0c4, camo: 0xb4c2d4, helmet: true, goggles: true,  pack: true,  route: [[-3, -13], [-9, -10], [-11, -3]] },
  { pos: [11, -14], tint: 0xcfc4ae, camo: 0xd9d2c0, helmet: true, goggles: false, pack: true,  route: [[11, -14], [6, -16], [1, -12]] },
];

export class Warzone {
  constructor(canvas, ui, hooks) {
    this.canvas = canvas;
    this.ui = ui;
    this.hooks = hooks || {};
    this.mobile = matchMedia("(pointer: coarse)").matches ||
                  innerWidth < 820;
    this.ready = false;
    this.failed = false;
    this.clock = new THREE.Clock();
    this.t = 0;
    this.hero = null;
    this.squad = [];
    this.enemy = null;
    this.shake = 0;
    this.runPhase = "idle"; // idle | playing | won | lost
  }

  async init() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: !this.mobile, powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.6 : 2));
    renderer.setSize(innerWidth, innerHeight);
    if (!this.mobile) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;

    this.env = buildScene(THREE, this.mobile);
    this.loader = new GLTFLoader();
    const assets = await loadSoldierAssets(this.loader);
    this.assets = assets;

    /* hero */
    this.hero = makeSoldier(assets, {
      uniform: 0xb9c4bd, skin: 0x6f4b33, face: FACE_TEX,
      camo: 0xcfd8da, camoDark: 0x5d6a5f,
      helmet: true, goggles: true, backpack: true, pouches: true, rifle: true,
    }, this.loader, THREE);
    this.hero.root.position.set(0, 0, 12);
    this.scene = this.env.scene;
    this.scene.add(this.hero.root);
    await (this.hero.faceDecalPromise || Promise.resolve());

    /* squad */
    for (const def of SQUAD_DEF) {
      const s = makeSoldier(this.assets, {
        uniform: def.tint, skin: 0xd9b08c,
        camo: def.camo, camoDark: 0x6b7377,
        helmet: def.helmet, goggles: def.goggles, backpack: def.pack, pouches: true, rifle: true,
      }, this.loader, THREE);
      s.root.position.set(def.pos[0], 0, def.pos[1]);
      s.route = def.route.map(p => new THREE.Vector2(p[0], p[1]));
      s.routeIdx = 0;
      s.state = "walk";
      s.play("runRifle");
      this.scene.add(s.root);
      this.squad.push(s);
    }

    /* enemy */
    this.enemy = this.makeEnemy();
    this.scene.add(this.enemy.root);

    /* input */
    this.input = createInput(this.canvas, this.ui);
    this.heroVel = new THREE.Vector3();
    this.heroYaw = 0;

    addEventListener("resize", () => {
      renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });

    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 400);
    this.camera.position.set(0, 3, 18);

    this.ready = true;
    this.loop();
  }

  makeEnemy() {
    const s = makeSoldier(this.assets, {
      uniform: 0x4a535e, skin: 0xc9a684,
      camo: 0x525c68, camoDark: 0x2e343c,
      helmet: true, goggles: true, backpack: false, pouches: true, rifle: true,
    }, this.loader, THREE);
    s.root.position.set(0, 0, -26);
    s.root.rotation.y = Math.PI; // face the player side
    s.play("aim");
    s.alive = true;
    s.fading = null;
    return s;
  }

  /* ---- memory-game integration API ---- */

  begin() {
    // fresh run: hero back to start, enemy repositions and aims
    this.runPhase = "playing";
    this.hero.root.position.set(0, 0, 12);
    this.hero.root.rotation.y = 0;
    this.hero.play("idle");
    this.spawnEnemy();
    this.shake = 0;
  }

  spawnEnemy() {
    if (!this.enemy.deadRemoved) {
      // restore material opacity from a previous death
      this.enemy.root.traverse(o => { if (o.isMesh) { o.material.transparent = false; o.material.opacity = 1; } });
    }
    const x = (Math.random() * 2 - 1) * 14;
    const z = -22 - Math.random() * 7;
    this.enemy.root.position.set(x, 0, z);
    this.enemy.root.rotation.y = Math.PI;
    this.enemy.play("aim");
    this.enemy.alive = true;
    this.enemy.deadRemoved = false;
  }

  correctAnswer() {
    // choreographed kill: hero aims, fires, enemy falls, hero reloads
    this.faceEnemy();
    const seq = [
      [0, () => { this.hero.play("aim", 0.12); }],
      [320, () => {
        this.hero.play("shoot", 0.06);
        this.flash(this.hero);
        this.hooks.onFire && this.hooks.onFire();
        this.shake = Math.min(1, this.shake + 0.35);
      }],
      [560, () => { this.enemy.alive = false; this.enemy.play("hit", 0.1); }],
      [760, () => { this.enemy.play("death", 0.15); this.hooks.onEnemyDown && this.hooks.onEnemyDown(); }],
      [1400, () => { this.hero.play("reload", 0.12); this.hooks.onReload && this.hooks.onReload(); }],
      [2300, () => { this.hero.play("idle", 0.2); }],
    ];
    this.runSeq(seq);
  }

  wrongAnswer() {
    // the hero is hit and falls; enemy stays standing
    const seq = [
      [0, () => { this.enemy.play("shooting", 0.1); this.flash(this.enemy); this.hooks.onEnemyFire && this.hooks.onEnemyFire(); }],
      [340, () => { this.hero.play("hit", 0.06); this.shake = 1; }],
      [620, () => { this.hero.play("death", 0.12); this.hooks.onHeroDown && this.hooks.onHeroDown(); }],
    ];
    this.runSeq(seq);
  }

  victory() {
    this.runPhase = "won";
    this.enemy.alive = false;
    this.hero.play("idleB");
    this.squad.forEach(s => { s.state = "idle"; s.play("idle"); });
  }

  faceEnemy() {
    if (!this.enemy) return;
    const p = this.hero.root.position;
    const dx = this.enemy.root.position.x - p.x;
    const dz = this.enemy.root.position.z - p.z;
    this.hero.root.rotation.y = Math.atan2(dx, -dz);
    this.heroYaw = this.hero.root.rotation.y;
  }

  flash(soldier) {
    if (!soldier.muzzle || !soldier.muzzle.parent) return;
    const world = soldier.muzzle.getWorldPosition(new THREE.Vector3());
    const light = new THREE.PointLight(0xffd9a0, 14, 6, 2);
    light.position.copy(world);
    this.scene.add(light);
    setTimeout(() => this.scene.remove(light), 70);
    this.hooks.onFlash && this.hooks.onFlash(world);
  }

  runSeq(steps) {
    steps.forEach(([ms, fn]) => this.pending.push({ at: this.t + ms / 1000, fn }));
    this.pending.sort((a, b) => a.at - b.at);
  }

  get pending() {
    if (!this._pending) this._pending = [];
    return this._pending;
  }

  /* ---- per-frame update ---- */

  updateHero(dt, input) {
    const hero = this.hero;
    const v = input.move;
    const speed = Math.hypot(v.x, v.z);
    if (this.runPhase === "lost") {
      hero.mixer.update(dt);
      return;
    }
    const walkSpeed = input.crouch ? 1.7 : (input.sprint ? 7.0 : 3.2);
    if (speed > 0.03) {
      const targetYaw = Math.atan2(v.x, -v.z);
      let dy = targetYaw - hero.root.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      hero.root.rotation.y += dy * Math.min(1, dt * 10);
      const nx = hero.root.position.x + v.x * walkSpeed * dt;
      const nz = hero.root.position.z + v.z * walkSpeed * dt;
      hero.root.position.x = Math.max(-30, Math.min(30, nx));
      hero.root.position.z = Math.max(-30, Math.min(30, nz));
      const flat = Math.hypot(v.x, v.z);
      if (input.crouch) hero.play("crouch", 0.2);
      else if (input.sprint) hero.play("runRifle", 0.25);
      else hero.play("walk", 0.25);
    } else {
      if (input.crouch) hero.play("crouch", 0.25);
      else hero.play("idle", 0.3);
    }
    if (input.jumpEdge && speed <= 0.03) { hero.play("jump", 0.1); }
    if (input.reloadEdge) { hero.play("reload", 0.08); this.hooks.onReload && this.hooks.onReload(); }
    if (input.fireEdge && this.runPhase === "playing") {
      hero.play("shoot", 0.05);
      this.flash(hero);
      this.hooks.onFire && this.hooks.onFire();
      setTimeout(() => { if (this.runPhase === "playing") hero.play("idle", 0.2); }, 420);
    }
    hero.mixer.update(dt);
  }

  updateSquad(dt) {
    for (const s of this.squad) {
      const target = s.route[s.routeIdx];
      const p = s.root.position;
      const dx = target.x - p.x, dz = target.y - p.z;
      const d = Math.hypot(dx, dz);
      if (s.state === "walk") {
        if (d < 0.6) {
          s.state = "hold";
          s.holdUntil = this.t + 2.5 + Math.random() * 4;
          s.play(Math.random() < 0.35 ? "crouch" : "idleB", 0.3);
          if (s.state === "hold") s.root.rotation.y = Math.atan2(dx, -dz) + (Math.random() - 0.5);
        } else {
          const yaw = Math.atan2(dx, -dz);
          s.root.rotation.y = yaw;
          p.x += (dx / d) * 1.4 * dt;
          p.z += (dz / d) * 1.4 * dt;
        }
      } else if (s.state === "hold" && this.t > s.holdUntil) {
        s.routeIdx = (s.routeIdx + 1) % s.route.length;
        s.state = "walk";
        s.play("runRifle", 0.3);
      }
      s.mixer.update(dt);
    }
  }

  updateCamera(dt, input) {
    const p = this.hero.root.position;
    if (this.faceView) {
      // QA mode: camera in front of the hero, looking at his face
      const yaw = this.hero.root.rotation.y;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      this.camera.position.set(p.x + fx * 3.4, p.y + 1.5, p.z + fz * 3.4);
      this.camera.lookAt(p.x, p.y + 1.35, p.z);
      return;
    }
    const target = new THREE.Vector3(p.x, p.y + 1.35, p.z);
    if (this.runPhase === "idle" && !this.startedOnce) {
      // menu: slow cinematic orbit
      const a = this.t * 0.12;
      this.camera.position.set(p.x + Math.sin(a) * 8.5, 3.2 + Math.sin(a * 0.6) * 0.5, p.z + Math.cos(a) * 8.5);
      this.camera.lookAt(target);
      return;
    }
    const dist = input.dist || 5.2;
    const cy = Math.cos(input.pitch);
    const cx = p.x + Math.sin(input.yaw) * dist * cy;
    const cz = p.z + Math.cos(input.yaw) * dist * cy;
    const desired = new THREE.Vector3(cx, p.y + 1.6 + Math.sin(input.pitch) * dist, cz);
    desired.y = Math.max(desired.y, 0.6);
    this.camera.position.lerp(desired, Math.min(1, dt * 9));
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.12;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.1;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
    this.camera.lookAt(target);
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    this.t += dt;
    if (!this.ready) return;

    // pending choreography
    while (this.pending.length && this.pending[0].at <= this.t) {
      this.pending.shift().fn();
    }

    const input = this.input.consume();
    if (this.runPhase === "playing" || this.runPhase === "idle") {
      this.updateHero(dt, input);
    } else {
      this.hero.mixer.update(dt);
    }
    this.updateSquad(dt);
    if (this.enemy.alive) {
      // enemy tracks the hero
      const p = this.hero.root.position, e = this.enemy.root.position;
      const yaw = Math.atan2(p.x - e.x, -(p.z - e.z));
      this.enemy.root.rotation.y = yaw;
    }
    this.enemy.mixer.update(dt);

    this.updateCamera(dt, input);
    this.env.update(dt, this.t, this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }
}
