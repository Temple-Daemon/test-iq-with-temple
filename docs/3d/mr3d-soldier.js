/*
 * Memory Rush 3D — soldiers.
 * Base mesh: CC0 Quaternius/KayKit Rig_Medium mannequin; CC0 animation
 * library from the same rig. Winter gear (helmet, vest, pack, rifle)
 * is procedural geometry parented to the skeleton bones.
 */
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const ASSETS = {
  mannequin: "assets/3d/Mannequin_Medium.glb",
  combat: "assets/3d/Rig_Medium_CombatRanged.glb",
  movementBasic: "assets/3d/Rig_Medium_MovementBasic.glb",
  movementAdv: "assets/3d/Rig_Medium_MovementAdvanced.glb",
  general: "assets/3d/Rig_Medium_General.glb",
};

let shared = null;

export async function loadSoldierAssets(loader) {
  if (shared) return shared;
  const [man, combat, mvB, mvA, gen] = await Promise.all([
    loader.loadAsync(ASSETS.mannequin),
    loader.loadAsync(ASSETS.combat),
    loader.loadAsync(ASSETS.movementBasic),
    loader.loadAsync(ASSETS.movementAdv),
    loader.loadAsync(ASSETS.general),
  ]);
  const clips = {};
  for (const f of [combat, mvB, mvA, gen]) {
    for (const c of f.animations) clips[c.name] = c;
  }
  shared = { mannequin: man.scene, clips };
  return shared;
}

/* keep the useful subset under short names */
const CLIP = {
  idle: "Idle_A",
  idleB: "Idle_B",
  walk: "Walking_A",
  walkB: "Walking_B",
  walkBack: "Walking_Backwards",
  run: "Running_A",
  runRifle: "Running_HoldingRifle",
  crouch: "Crouching",
  crawl: "Crawling",
  aim: "Ranged_2H_Aiming",
  shooting: "Ranged_2H_Shooting",
  shoot: "Ranged_2H_Shoot",
  reload: "Ranged_2H_Reload",
  hit: "Hit_A",
  death: "Death_A",
  spawn: "Spawn_Ground",
  jump: "Jump_Full_Short",
  strafeL: "Running_Strafe_Left",
  strafeR: "Running_Strafe_Right",
};

function bone(root, name) {
  let found = null;
  root.traverse(o => { if (!found && o.isBone && o.name === name) found = o; });
  return found;
}

function addMesh(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/* builds a rifle and returns { group, muzzle } */
function buildRifle() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.5, metalness: 0.45 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.9 });
  // receiver
  addMesh(g, new THREE.BoxGeometry(0.09, 0.11, 0.62), dark, 0, 0.02, -0.08);
  // stock
  addMesh(g, new THREE.BoxGeometry(0.08, 0.13, 0.24), grip, 0, -0.03, 0.38);
  // barrel + handguard
  addMesh(g, new THREE.CylinderGeometry(0.022, 0.022, 0.5, 8), dark, 0, 0.045, -0.62, Math.PI / 2, 0, 0);
  addMesh(g, new THREE.BoxGeometry(0.075, 0.085, 0.34), grip, 0, 0.025, -0.5);
  // mag
  addMesh(g, new THREE.BoxGeometry(0.07, 0.24, 0.11), dark, 0, -0.16, -0.05, 0.25, 0, 0);
  // optic
  addMesh(g, new THREE.BoxGeometry(0.06, 0.06, 0.16), dark, 0, 0.13, -0.1);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.045, -0.9);
  g.add(muzzle);
  g.scale.setScalar(2.4);          // the rig is ~2.25 units tall: match its scale
  g.rotation.set(0, Math.PI / 2, 0); // hand bones vary; default aim along -Z of parent
  return { group: g, muzzle };
}

function addGear(root, opts, THREE_REF) {
  const camo = new THREE.MeshStandardMaterial({ color: opts.camo, roughness: 0.92 });
  const camoDark = new THREE.MeshStandardMaterial({ color: opts.camoDark, roughness: 0.95 });
  const head = bone(root, "head");
  const chest = bone(root, "chest");
  const spine = bone(root, "spine");
  const hips = bone(root, "hips");
  const handR = bone(root, "hand.r");

  /* The rig is ~2.25 units tall with the head bone at the neck:
     the head mesh spans +0.42 (center) to +0.96 above the bone, and the
     face points -Z (verified from the live render). Gear is sized to
     those real proportions. */
  if (head && opts.helmet !== "none") {
    const h = new THREE.Group();
    addMesh(h, new THREE.SphereGeometry(0.47, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), camo, 0, 0.42, 0);
    const snow = addMesh(h, new THREE.SphereGeometry(0.49, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.35),
      new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.97 }), 0, 0.44, 0);
    snow.scale.y = 0.55;
    addMesh(h, new THREE.BoxGeometry(0.62, 0.1, 0.34), camoDark, 0, 0.30, -0.36); // brim, front = -Z
    if (opts.goggles) addMesh(h, new THREE.BoxGeometry(0.5, 0.13, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.3 }), 0, 0.47, -0.42);
    head.add(h);
  }
  if (chest) {
    const v = new THREE.Group();
    addMesh(v, new THREE.BoxGeometry(0.78, 0.88, 0.56), camoDark, 0, -0.04, 0);
    addMesh(v, new THREE.BoxGeometry(0.62, 0.24, 0.12), camo, 0, -0.12, -0.34); // mag pouches, front = -Z
    addMesh(v, new THREE.BoxGeometry(0.62, 0.2, 0.12), camo, 0, 0.24, -0.34);
    chest.add(v);
  }
  if (spine && opts.backpack) {
    addMesh(spine, new THREE.BoxGeometry(0.62, 0.78, 0.34), camoDark, 0, 0.02, 0.44); // back = +Z
  }
  if (hips && opts.pouches) {
    addMesh(hips, new THREE.BoxGeometry(0.56, 0.26, 0.36), camoDark, 0, -0.14, 0.24);
  }
  if (handR && opts.rifle) {
    const { group, muzzle } = buildRifle();
    handR.add(group);
    return muzzle;
  }
  return null;
}

/* face decal: partial sphere in front of the head bone */
function addFace(root, textureURL, loader, THREE_REF) {
  return new Promise(resolve => {
    const head = bone(root, "head");
    if (!head || !textureURL) return resolve(null);
    loader.load(textureURL, tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const cap = new THREE.SphereGeometry(0.46, 24, 16,
        Math.PI * 0.5 + Math.PI * 0.34, Math.PI * 0.32 * 2,
        Math.PI * 0.22, Math.PI * 0.4);
      const mat = new THREE.MeshStandardMaterial({
        map: tex, transparent: true, roughness: 0.75, metalness: 0,
        polygonOffset: true, polygonOffsetFactor: -2,
      });
      const face = new THREE.Mesh(cap, mat);
      face.rotation.y = Math.PI * 0.5 + Math.PI * 0.34;
      face.position.y = 0.42; // center of the head mesh relative to the head bone
      head.add(face);
      resolve(face);
    }, undefined, () => resolve(null));
  });
}

export function makeSoldier(assets, opts, loader, THREE_REF) {
  const model = SkeletonUtils.clone(assets.mannequin);
  model.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });
  /* the rig is ~2.25 units tall; wrap it so the soldier stands ~1.75m
     in world units (movement speeds and camera distances assume that) */
  const root = new THREE.Group();
  root.add(model);
  root.scale.setScalar(0.78);

  /* recolor: one material for gear-ish body, separate for the head */
  const uniform = new THREE.MeshStandardMaterial({
    color: opts.uniform, roughness: 0.92,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: opts.skin, roughness: 0.75,
  });
  root.traverse(o => {
    if (o.isMesh) {
      o.material = o.name.includes("Head") ? skin : uniform;
    }
  });

  const muzzle = addGear(root, opts, THREE_REF);
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [key, clipName] of Object.entries(CLIP)) {
    const clip = assets.clips[clipName];
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    a.enabled = true;
    if (["idle", "walk", "run", "runRifle", "crouch", "shooting", "aim", "crawl",
         "idleB", "walkB", "strafeL", "strafeR", "walkBack"].includes(key)) {
      a.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    actions[key] = a;
  }

  let current = null;
  const S = {
    root, muzzle, actions, mixer, opts,
    play(name, fade = 0.22, speed = 1) {
      const next = actions[name];
      if (!next) return null;
      if (current === next) { next.paused = false; return next; }
      next.reset();
      next.setEffectiveTimeScale(speed);
      if (current) { next.crossFadeFrom(current, fade, false); }
      next.play();
      current = next;
      S.currentName = name;
      return next;
    },
    stop() { if (current) { current.fadeOut(0.2); current = null; } },
    faceDecalPromise: null,
  };
  if (opts.face) {
    S.faceDecalPromise = addFace(root, opts.face, loader, THREE_REF);
  }
  return S;
}
