/*
 * Memory Rush 3D — the winter warzone scene.
 * Procedural geometry only: no extra downloads, fast on mobile.
 * Layout: flat combat arena near origin; hills, tree line, trenches,
 * ruins and smoke plumes ring it at mid and far distance for depth.
 */
import * as THREE from "three";

function seeded(s) {
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function noise2(x, z) {
  // cheap smooth-ish terrain noise from sin hash
  const h = (a, b) => Math.sin(a * 12.9898 + b * 78.233) * 43758.5453 % 1;
  const i = Math.floor(x), j = Math.floor(z);
  const fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = Math.abs(h(i, j)), b = Math.abs(h(i + 1, j));
  const c = Math.abs(h(i, j + 1)), d = Math.abs(h(i + 1, j + 1));
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function terrainHeight(x, z) {
  // flat play area within ~26m; rolling hills beyond, up to 7m far away
  const d = Math.hypot(x, z);
  const k = Math.max(0, Math.min(1, (d - 26) / 50));
  const s = k * k * (3 - 2 * k); // smoothstep
  return s * (2.5 * noise2(x * 0.045, z * 0.045) + 4.5 * noise2(x * 0.012 + 7, z * 0.012 + 3));
}

function radialTexture(inner, outer, draw) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, inner, 64, 64, outer);
  draw(g, ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function buildScene(THREE_REF, mobile) {
  const scene = new THREE.Scene();
  const SKY = 0x8fa6bd;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, mobile ? 34 : 46, mobile ? 130 : 185);

  /* soft overcast winter light */
  scene.add(new THREE.HemisphereLight(0xd9e4f2, 0x6b6157, 1.05));
  const sun = new THREE.DirectionalLight(0xf2f5ff, 1.35);
  sun.position.set(28, 42, 18);
  if (!mobile) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
    sun.shadow.camera.far = 140;
    sun.shadow.bias = -0.0004;
  }
  scene.add(sun);

  /* terrain */
  const size = 240, seg = mobile ? 72 : 110;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
  }
  geo.computeVertexNormals();
  const snow = new THREE.MeshStandardMaterial({ color: 0xeceff2, roughness: 0.96, metalness: 0 });
  const ground = new THREE.Mesh(geo, snow);
  ground.receiveShadow = true;
  scene.add(ground);

  /* scattered dirty-snow patches for visual interest */
  const patch = new THREE.MeshStandardMaterial({ color: 0xcdd2d8, roughness: 1 });
  const rnd = seeded(20261022);
  for (let i = 0; i < (mobile ? 10 : 16); i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(1.5 + rnd() * 3.2, 12), patch);
    p.rotation.x = -Math.PI / 2;
    const a = rnd() * Math.PI * 2, d = 6 + rnd() * 22;
    p.position.set(Math.cos(a) * d, 0.02 + terrainHeight(Math.cos(a) * d, Math.sin(a) * d), Math.sin(a) * d);
    scene.add(p);
  }

  /* pine trees: instanced trunks + green canopy + snow caps */
  const TREE_N = mobile ? 26 : 46;
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.24, 2.4, 6);
  const coneGeo = new THREE.ConeGeometry(1.5, 3.4, 8);
  const snowConeGeo = new THREE.ConeGeometry(1.05, 1.7, 8);
  const trunks = new THREE.InstancedMesh(trunkGeo,
    new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 }), TREE_N);
  const canopies = new THREE.InstancedMesh(coneGeo,
    new THREE.MeshStandardMaterial({ color: 0x2d4a35, roughness: 1 }), TREE_N);
  const caps = new THREE.InstancedMesh(snowConeGeo, snow, TREE_N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < TREE_N; i++) {
    let x, z, tries = 0;
    do {
      const a = rnd() * Math.PI * 2, d = 34 + rnd() * 76;
      x = Math.cos(a) * d; z = Math.sin(a) * d; tries++;
    } while (Math.hypot(x, z) < 32 && tries < 8);
    const y = terrainHeight(x, z), s = 0.8 + rnd() * 0.9;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
    m.compose(v.set(x, y + 1.1 * s, z), q, sc.set(s, s, s));
    trunks.setMatrixAt(i, m);
    m.compose(v.set(x, y + (2.2 + 1.6) * s, z), q, sc.set(s, s, s));
    canopies.setMatrixAt(i, m);
    m.compose(v.set(x, y + (2.2 + 2.6) * s, z), q, sc.set(s, s, s));
    caps.setMatrixAt(i, m);
  }
  if (!mobile) { canopies.castShadow = true; trunks.castShadow = true; }
  scene.add(trunks, canopies, caps);

  /* trenches: sunken dark boxes with snow lips */
  const trenchMat = new THREE.MeshStandardMaterial({ color: 0x39312a, roughness: 1 });
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xdfe4e9, roughness: 0.95 });
  function trench(x, z, len, rot) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 1.7), trenchMat);
    body.position.y = -0.55; body.receiveShadow = true; g.add(body);
    const l = new THREE.Mesh(new THREE.BoxGeometry(len + 0.6, 0.3, 2.1), lipMat);
    l.position.y = 0.02; g.add(l);
    g.position.set(x, terrainHeight(x, z), z);
    g.rotation.y = rot;
    scene.add(g);
  }
  trench(0, -30, 14, 0.12);
  trench(-24, -12, 10, 1.2);
  trench(22, 8, 12, -0.6);

  /* sandbag-style barriers near the arena */
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x8d8271, roughness: 1 });
  const bagTop = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 1 });
  function barrier(x, z, w, rot) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.75, 0.55), bagMat);
    b.position.y = 0.38; b.castShadow = true; g.add(b);
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.62), bagTop);
    t.position.y = 0.83; g.add(t);
    g.position.set(x, terrainHeight(x, z), z);
    g.rotation.y = rot;
    scene.add(g);
  }
  barrier(-5.5, 4, 4.2, 0.35);
  barrier(6, 5.5, 4.6, -0.28);
  barrier(0.5, 13.5, 5.2, 0.06);
  barrier(-12, -4, 3.4, 1.1);

  /* ruined building at mid distance */
  const ruinMat = new THREE.MeshStandardMaterial({ color: 0x6f6a64, roughness: 1 });
  const ruinGroup = new THREE.Group();
  function wall(w, h, x, y, z, ry) {
    const wallM = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), ruinMat);
    wallM.position.set(x, y, z); wallM.rotation.y = ry;
    wallM.castShadow = true; wallM.receiveShadow = true;
    ruinGroup.add(wallM);
  }
  const RX = -30, RZ = -18;
  wall(9, 3.6, 0, 1.8, -4, 0);
  wall(4, 2.4, -2.6, 1.2, 0, 0);
  wall(3, 1.5, 4, 0.75, 0, 0);
  wall(9, 2.6, 4.2, 1.3, -2, Math.PI / 2);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.4, 1.6), ruinMat);
  roof.position.set(3.2, 3.4, -3.2); roof.rotation.z = 0.22;
  ruinGroup.add(roof);
  ruinGroup.position.set(RX, terrainHeight(RX, RZ), RZ);
  ruinGroup.rotation.y = 0.5;
  scene.add(ruinGroup);

  /* abandoned equipment: crates, barrel, wrecked hull */
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x555b46, roughness: 1 });
  function crate(x, z, s, ry) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
    c.position.set(x, terrainHeight(x, z) + s / 2 + 0.3, z);
    c.rotation.y = ry; c.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(s + 0.04, 0.1, s + 0.04), snow);
    cap.position.y = s / 2 + 0.06;
    c.add(cap);
    scene.add(c);
  }
  crate(-9, -14, 1.2, 0.4);
  crate(-9.9, -14.8, 1.0, -0.2);
  crate(14, -8, 1.4, 0.9);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x50565c, roughness: 0.7 }));
  barrel.position.set(13.2, terrainHeight(13.2, -6.4) + 0.6, -6.4);
  barrel.rotation.z = 0.35; barrel.castShadow = true;
  scene.add(barrel);
  const hull = new THREE.Group();
  const hm = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.4, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x4c5348, roughness: 1 }));
  hm.position.y = 0.7; hull.add(hm);
  const hsnow = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 2.4), snow);
  hsnow.position.y = 1.45; hull.add(hsnow);
  hull.position.set(27, terrainHeight(27, -20) + 0.2, -20);
  hull.rotation.set(0.06, 0.8, 0.05);
  scene.add(hull);

  /* distant smoke plumes */
  const smokeTex = radialTexture(6, 62, (g, ctx) => {
    g.addColorStop(0, "rgba(90,90,95,0.5)");
    g.addColorStop(1, "rgba(90,90,95,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  });
  const plumes = [];
  [[-62, -52, 0.9], [48, -70, 1.25], [70, 30, 0.7]].forEach(([sx, sz, s]) => {
    const y0 = terrainHeight(sx, sz);
    const col = new THREE.Group();
    col.position.set(sx, y0, sz);
    for (let k = 0; k < 4; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: smokeTex, transparent: true, opacity: 0.55, depthWrite: false,
      }));
      sp.scale.set(9 * s, 9 * s, 1);
      sp.position.set((k - 1.5) * 1.6, 2 + k * 3.4, 0);
      sp.userData.phase = k * 0.7;
      col.add(sp);
      plumes.push(sp);
    }
    scene.add(col);
  });

  /* falling snow */
  const SNOW_N = mobile ? 600 : 1300;
  const spGeo = new THREE.BufferGeometry();
  const spPos = new Float32Array(SNOW_N * 3);
  const spOff = new Float32Array(SNOW_N);
  for (let i = 0; i < SNOW_N; i++) {
    spPos[i * 3] = (Math.random() - 0.5) * 90;
    spPos[i * 3 + 1] = Math.random() * 26;
    spPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
    spOff[i] = Math.random() * Math.PI * 2;
  }
  spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3));
  const snowPts = new THREE.Points(spGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.14, transparent: true, opacity: 0.85,
    sizeAttenuation: true, depthWrite: false,
  }));
  scene.add(snowPts);

  /* fighter jets on patrol circles */
  const jets = [];
  const jetGray = new THREE.MeshStandardMaterial({ color: 0x707a85, roughness: 0.55, metalness: 0.35 });
  function makeJet(scale) {
    const g = new THREE.Group();
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 7.4, 8), jetGray);
    fus.rotation.x = Math.PI / 2;
    g.add(fus);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 1.7), jetGray);
    wing.position.z = 0.7;
    g.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.9), jetGray);
    tail.position.z = -3.1; tail.position.y = 0.1;
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1.4), jetGray);
    fin.position.z = -3.2;
    g.add(fin);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.4, 8), jetGray);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = 4.3;
    g.add(nose);
    g.scale.setScalar(scale);
    scene.add(g);
    return g;
  }
  const jetCfg = [
    { r: 150, h: 72, speed: 0.055, scale: 1.6, phase: 0 },
    { r: 210, h: 92, speed: -0.038, scale: 1.2, phase: 2.1 },
    { r: 120, h: 58, speed: 0.075, scale: 1.0, phase: 4.4 },
  ];
  for (const c of jetCfg) jets.push({ obj: makeJet(c.scale), cfg: c });

  return {
    scene, sun,
    update(dt, t, camPos) {
      // snowfall drifts around the camera position
      const p = snowPts.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - dt * (1.6 + 0.4 * Math.sin(spOff[i]));
        let x = p.getX(i) + dt * Math.sin(t * 0.4 + spOff[i]) * 0.35;
        if (y < 0) {
          y = 24 + Math.random() * 3;
          x = camPos.x + (Math.random() - 0.5) * 80;
          p.setZ(i, camPos.z + (Math.random() - 0.5) * 80);
        }
        // keep the field around the camera
        if (Math.abs(x - camPos.x) > 45) x = camPos.x + (Math.random() - 0.5) * 80;
        p.setX(i, x); p.setY(i, y);
      }
      p.needsUpdate = true;
      // smoke sway
      for (const s of plumes) {
        s.position.x = Math.sin(t * 0.28 + s.userData.phase) * 1.4 + s.userData.phase * 0.8;
        s.material.opacity = 0.38 + 0.18 * Math.sin(t * 0.5 + s.userData.phase);
      }
      // jets
      for (const j of jets) {
        const a = t * j.cfg.speed * Math.PI * 2 + j.cfg.phase;
        j.obj.position.set(Math.cos(a) * j.cfg.r, j.cfg.h, Math.sin(a) * j.cfg.r);
        j.obj.rotation.y = -a + (j.cfg.speed > 0 ? Math.PI : 0);
        j.obj.rotation.z = j.cfg.speed > 0 ? -0.28 : 0.28;
      }
    },
  };
}
