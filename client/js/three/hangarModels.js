import * as THREE from '../../vendor/three/three.module.js';

// Procedural visual children of catalog-sized wrappers. No remote model assets.
export function createPartModel(part) {
  const root = new THREE.Group();
  root.userData.part = part;
  const spec = part.visual?.ghostPrimitive || {};
  const dimensions = spec.dimensions || part.dimensionsM || [.1, .1, .1];
  const [w, h, d] = dimensions.map(value => Math.max(.004, value));
  const material = (color, metalness = .5, roughness = .38) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const shell = material(spec.color || '#9caeb5', spec.metalness ?? .6, spec.roughness ?? .4);
  const silver = material('#c8d4d9', .8, .28);
  const gold = material('#d7af59', .65, .35);
  const dark = material('#172b38', .45, .36);
  const board = material('#286757', .2, .65);
  const cell = material(part.cellType === 'silicon' ? '#173b71' : '#283568', .55, .23);
  const lens = material('#062a40', .8, .12);
  function mesh(geometry, mat, x = 0, y = 0, z = 0) {
    const item = new THREE.Mesh(geometry, mat); item.position.set(x, y, z); root.add(item); return item;
  }
  const box = (a, b, c, mat, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(a, b, c), mat, x, y, z);
  const cylinder = (a, b, height, mat, x = 0, y = 0, z = 0) => mesh(new THREE.CylinderGeometry(a, b, height, 32), mat, x, y, z);
  function bolts(width, height, depth) {
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      const bolt = cylinder(.003, .003, .003, silver, x * width * .4, y * height * .4, depth / 2 + .002);
      bolt.rotation.x = Math.PI / 2;
    }
  }
  switch (part.category) {
    case 'bus': {
      const hull = box(w * .94, h * .96, d * .94, dark);
      hull.userData.hullPanel = true;
      // Separate insulation panels leave the metallic load-bearing rails visible.
      for (const x of [-1, 1]) {
        const panel = box(.002, h * .86, d * .86, gold, x * w * .477, 0, 0);
        panel.userData.hullPanel = true;
        for (let n = 1; n < 6; n++) {
          const seam = box(.0025, h * .82, .001, shell, x * w * .487, 0, d * (n / 6 - .5) * .82);
          seam.userData.hullPanel = true;
        }
      }
      for (const z of [-1, 1]) {
        const panel = box(w * .84, h * .86, .002, shell, 0, 0, z * d * .477);
        panel.userData.hullPanel = true;
      }
      for (const x of [-1, 1]) for (const z of [-1, 1]) box(.008, h + .014, .008, silver, x * w / 2, 0, z * d / 2);
      for (const y of [-1, 1]) {
        box(w + .014, .009, d + .014, silver, 0, y * h / 2, 0);
        const cap = box(w * .7, .002, d * .7, gold, 0, y * (h / 2 + .006), 0);
        cap.userData.hullPanel = true;
      }
      for (let y = -h / 2 + .04; y < h / 2; y += .08) box(w + .002, .003, d + .002, dark, 0, y, 0);
      bolts(w, h, d); break;
    }
    case 'eps_solar': {
      box(w, h, Math.max(d, .004), silver);
      const cols = Math.max(2, Math.min(8, Math.round(w / .045)));
      const rows = Math.max(2, Math.min(8, Math.round(h / .045)));
      for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
        const px = (x + .5) * w / cols - w / 2, py = (y + .5) * h / rows - h / 2;
        box(w / cols * .89, h / rows * .89, .001, cell, px, py, d / 2 + .001);
        box(w / cols * .84, .0007, .0005, gold, px, py, d / 2 + .002);
      }
      const hinge = box(.025, h * .7, .01, dark, -w / 2, 0, 0);
      hinge.userData.solarHinge = true; break;
    }
    case 'payload': {
      box(w, h, d, shell); bolts(w, h, d);
      if (part.payloadType === 'optical') {
        const radius = Math.min(w, h) * .35;
        const barrel = cylinder(radius, radius * 1.08, d * .45, dark, 0, 0, d * .65); barrel.rotation.x = Math.PI / 2;
        const rim = cylinder(radius * 1.04, radius * 1.04, .008, silver, 0, 0, d * .88); rim.rotation.x = Math.PI / 2;
        const glass = cylinder(radius * .84, radius * .84, .009, lens, 0, 0, d * .9); glass.rotation.x = Math.PI / 2;
      } else {
        box(w * .85, h * .8, .01, gold, 0, 0, d / 2 + .008);
        for (let n = 0; n < 5; n++) box(w * .75, .002, .003, silver, 0, h * (n / 6 - .33), d / 2 + .015);
      } break;
    }
    case 'eps_battery': {
      box(w, h, d, shell);
      const count = Math.max(2, Math.min(8, Math.ceil((part.capacityWh || 20) / 25)));
      for (let n = 0; n < count; n++) {
        const pack = cylinder(Math.min(w / count * .4, d * .35), Math.min(w / count * .4, d * .35), h * .85, gold, (n + .5) * w / count - w / 2, 0, d * .35);
        pack.rotation.z = .03;
      }
      box(w * .65, .009, d * .65, dark, 0, h / 2 + .006, 0);
      box(.012, .012, .012, gold, w * .28, h / 2 + .015, 0); break;
    }
    case 'cdh': {
      box(w, Math.max(h * .25, .006), d, board);
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) box(w * .18, .008, d * .18, dark, x * w * .27, h * .15, z * d * .27);
      box(w * .75, .01, .008, gold, 0, 0, d / 2);
      for (const x of [-1, 1]) for (const z of [-1, 1]) cylinder(.003, .003, .018, silver, x * w * .43, 0, z * d * .43);
      break;
    }
    case 'comms': {
      box(w, Math.max(h * .3, .012), d, shell);
      if (/dish|gain/i.test(part.name)) {
        const dish = mesh(new THREE.SphereGeometry(Math.max(w, d) * .65, 32, 16, 0, Math.PI * 2, 0, Math.PI * .4), silver, 0, h * .4, 0);
        dish.rotation.x = Math.PI;
        cylinder(.002, .002, h + .08, gold, 0, h * .6, 0);
      } else if (/whip|uhf|vhf/i.test(part.name)) {
        for (const side of [-1, 1]) { const antenna = cylinder(.0015, .0015, Math.max(h, .18), silver, side * w * .3, .07, 0); antenna.rotation.z = side * .65; }
      } else { box(w * .85, .004, d * .85, gold, 0, h * .2, 0); }
      break;
    }
    case 'tcs': {
      box(w, h, d, /mli|blanket/i.test(part.name) ? gold : shell);
      for (let n = 0; n < 7; n++) box(w * .85, .002, .004, /heater/i.test(part.name) ? gold : silver, 0, h * (n / 8 - .375), d / 2 + .003);
      bolts(w, h, d); break;
    }
    case 'propulsion': {
      if (/^adcs_/.test(part.id)) {
        box(w, h * .3, d, dark);
        if (/detumble/i.test(part.name)) {
          for (const side of [-1, 1]) {
            cylinder(.004, .004, h, gold, side * w * .32, 0, d * .3);
            box(w * .8, .008, .008, gold, 0, h * .25, -d * .3);
          }
        } else {
          for (let n = 0; n < 3; n++) {
            const wheel = cylinder(Math.min(w, d) * .25, Math.min(w, d) * .25, h * .2, silver, (n - 1) * w * .25, h * .2, 0);
            wheel.rotation.z = (n - 1) * Math.PI / 4;
          }
        }
        break;
      }
      if (spec.type === 'cylinder') cylinder(w, w, h, shell);
      else box(w, h, d, shell);
      const nozzle = cylinder(Math.min(w, d) * .12, Math.min(w, d) * .3, h * .4, dark, 0, -h * .65, 0);
      box(w * .65, .01, d * .65, gold, 0, h / 2, 0);
      nozzle.userData.nozzle = true; break;
    }
    default: box(w, h, d, shell);
  }
  // Retain conceptual bounds without forcing rendered details into collision math.
  root.userData.dimensions = [w, h, d];
  root.traverse(object => { if (object.isMesh) object.userData.part = part; });
  return root;
}

// A visual assembly, separate from isolated catalog parts and engineering totals.
export function createAssemblyModel(parts, { exploded = false } = {}) {
  const root = new THREE.Group();
  const bus = parts.find(part => part.category === 'bus');
  const dims = bus?.dimensionsM || [.1, .2, .1];
  const upright = dims[2] > dims[1];
  const [w, h, d] = upright ? [dims[0], dims[2], dims[1]] : dims;
  const add = (part, x, y, z) => {
    const item = createPartModel(part);
    item.position.set(x, y, z); root.add(item); return item;
  };
  const bracket = (part, from, to, thickness = .014) => {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const support = new THREE.Mesh(new THREE.BoxGeometry(thickness, direction.length() + .012, thickness), new THREE.MeshStandardMaterial({ color: '#c4cbd0', metalness: .75, roughness: .3 }));
    support.position.copy(start).add(end).multiplyScalar(.5);
    if (direction.lengthSq()) support.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    support.userData.part = part;
    support.userData.mountFor = part.id;
    root.add(support);
    return support;
  };
  for (const part of parts) {
    const [pw, ph, pd] = part.visual?.ghostPrimitive?.dimensions || [.1, .1, .1];
    if (part.category === 'eps_solar' && part.mountingStyle !== 'body') {
      // Split one catalog array across two connected wings; generation and area
      // are still counted once by the engineering model.
      const gap = w * .28;
      for (const side of [-1, 1]) {
        const x = side * (w / 2 + gap + pw / 4);
        const wing = add(part, exploded ? x * 1.6 : x, 0, 0);
        wing.scale.x = .5;
        wing.userData.wingSide = side;
        // The root-side hinge must be on the inner edge of BOTH wings.
        wing.traverse(mesh => { if (mesh.userData.solarHinge) mesh.position.x = -side * pw / 2; });
        // Both halves face the same sunward side; no extra array is installed.
        if (!exploded) {
          const arm = bracket(part, [side * (w / 2 - .006), 0, 0], [side * (w / 2 + gap + .008), 0, 0], .018);
          for (const armEnd of [w / 2, w / 2 + gap]) {
            const hinge = new THREE.Mesh(new THREE.CylinderGeometry(.011, .011, .027, 20), arm.material);
            hinge.position.set(side * armEnd, 0, 0); hinge.userData.part = part; root.add(hinge);
          }
        }
      }
      continue;
    }
    if (part.category === 'bus') {
      const item = add(part, 0, 0, 0);
      if (upright) item.rotation.x = Math.PI / 2;
      continue;
    }
    const item = add(part, 0, 0, 0);
    // Internal hardware stays inside the hull; only apertures protrude.
    if (part.category === 'payload') {
      const scale = Math.min(w * .72 / pw, h * .6 / ph, d * .85 / pd, 1);
      item.scale.setScalar(scale);
      item.position.set(0, -h * .08, d / 2 - pd * scale * .48);
    } else if (part.category === 'eps_battery' || part.category === 'cdh' || /^adcs_/.test(part.id)) {
      const scale = Math.min(w * .7 / pw, h * .3 / ph, d * .7 / pd, 1);
      item.scale.setScalar(scale);
      item.position.set(0, part.category === 'eps_battery' ? -h * .27 : h * .25, 0);
    } else if (part.category === 'comms') {
      // Seat the actual geometry's base on a visible mounting pedestal.
      const bounds = new THREE.Box3().setFromObject(item);
      item.position.y = h / 2 + .008 - bounds.min.y;
      if (!exploded) bracket(part, [0, h / 2 - .008, 0], [0, h / 2 + .014, 0], Math.min(w * .45, d * .45, .04));
    } else if (part.category === 'eps_solar') {
      item.scale.set(Math.min(w * .85 / pw, 1), Math.min(h * .85 / ph, 1), 1);
      item.position.set(0, 0, -d / 2 - pd / 2 - .002);
      if (!exploded) bracket(part, [0, 0, -d / 2 + .008], [0, 0, -d / 2 - pd / 2 - .008], Math.min(w, h) * .25);
    } else if (part.category === 'tcs') {
      item.scale.set(Math.min(d * .8 / pw, 1), Math.min(h * .8 / ph, 1), Math.min(.008 / pd, 1));
      item.rotation.y = -Math.PI / 2;
      item.position.set(-w / 2 - pd * item.scale.z / 2 - .003, 0, 0);
      if (!exploded) bracket(part, [-w / 2 + .008, 0, 0], [item.position.x - .004, 0, 0], Math.min(d, h) * .2);
    } else if (part.category === 'propulsion') {
      item.scale.setScalar(Math.min(w * .6 / pw, .8));
      item.position.set(0, -h / 2 + ph * item.scale.y * .35, 0);
      if (!exploded) bracket(part, [0, -h / 2 + .008, 0], [0, -h / 2 - .006, 0], w * .25);
    }
    if (exploded) {
      if (part.category === 'eps_battery') item.position.x += w * 1.3;
      else if (part.category === 'cdh' || /^adcs_/.test(part.id)) item.position.x -= w * 1.3;
      else if (part.category === 'payload') item.position.z += d * 1.2;
      else item.position.multiplyScalar(1.8);
    }
  }
  if (!parts.length) {
    root.add(new THREE.Mesh(new THREE.BoxGeometry(.1, .2, .1), new THREE.MeshStandardMaterial({ color: '#9bbac2', wireframe: true, transparent: true, opacity: .35 })));
  }
  return root;
}

export function disposeModel(root) {
  const geometries = new Set(), materials = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat);
  });
  for (const item of geometries) item.dispose();
  for (const item of materials) item.dispose();
}
