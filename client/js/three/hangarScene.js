import * as THREE from '../../vendor/three/three.module.js';
import { createPartModel, createAssemblyModel, disposeModel } from './hangarModels.js';

export function createHangarScene(host, { onPick, onUnavailable, onAvailable } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive 3D satellite. Drag or use arrow keys to rotate. Scroll or use plus and minus to zoom. Home resets the view.');
  host.append(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .001, 200);
  scene.add(new THREE.HemisphereLight(0xc9e8ff, 0x34352b, 2));
  for (const [color, intensity, position] of [[0xffe6bd, 3.4, [2, 3, 4]], [0x89c9fa, 2.5, [-3, 1, -2]], [0xffffff, 1, [1, -2, 2]]]) {
    const light = new THREE.DirectionalLight(color, intensity); light.position.set(...position); scene.add(light);
  }
  let model = new THREE.Group(); scene.add(model);
  let installed = [], preview = null, exploded = false, wireframe = false, cutaway = false;
  let yaw = .35, pitch = .25, distance = 1, radius = .3, active = true, lost = false, disposed = false;
  let fittedDistance = 1, zoomFactor = 1, viewKey = 'assembly', sceneKey = '';
  const views = new Map();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let highlightFrame = 0, restoreHighlight = null;
  const center = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const pointers = new Map();
  let dragDistance = 0, pinch = 0;
  function draw() {
    if (!active || lost || disposed || document.hidden) return;
    camera.position.set(center.x + Math.sin(yaw) * Math.cos(pitch) * distance, center.y + Math.sin(pitch) * distance, center.z + Math.cos(yaw) * Math.cos(pitch) * distance);
    camera.lookAt(center); renderer.render(scene, camera);
  }
  function resize() {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    fit(false); draw();
  }
  function fit(reset = true) {
    if (reset) { yaw = .35; pitch = .25; zoomFactor = 1; }
    // Fit projected corners rather than a bounding sphere, which made a flat
    // winged spacecraft unnecessarily small in a wide workbench.
    const bounds = new THREE.Box3().setFromObject(model);
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanX = tanY * camera.aspect;
    camera.position.copy(center).add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)));
    camera.lookAt(center);
    const inverse = camera.quaternion.clone().invert();
    let required = .01;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const point = new THREE.Vector3(x, y, z).sub(center).applyQuaternion(inverse);
      required = Math.max(required, Math.abs(point.x) / tanX + point.z, Math.abs(point.y) / tanY + point.z);
    }
    fittedDistance = required * 1.15;
    distance = fittedDistance * zoomFactor;
  }
  function styleModels() {
    model.traverse(object => {
      if (!object.isMesh) return;
      object.material.wireframe = wireframe;
      const hull = !preview && object.userData.hullPanel === true;
      object.material.transparent = hull && cutaway && installed.length > 1;
      object.material.opacity = object.material.transparent ? .2 : 1;
      object.material.depthWrite = !object.material.transparent;
    });
  }
  function rebuild() {
    stopHighlight();
    scene.remove(model); disposeModel(model);
    model = preview ? createPartModel(preview) : createAssemblyModel(installed, { exploded });
    scene.add(model);
    const bounds = new THREE.Box3().setFromObject(model);
    if (preview) bounds.getCenter(center); else center.set(0, 0, 0);
    radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, .05);
    styleModels(); fit(false); draw();
  }
  function zoom(factor) {
    distance = THREE.MathUtils.clamp(distance * factor, radius * 1.25, radius * 14);
    zoomFactor = distance / fittedDistance;
    draw();
  }
  function stopHighlight() {
    cancelAnimationFrame(highlightFrame); highlightFrame = 0;
    restoreHighlight?.(); restoreHighlight = null;
  }
  function highlight(partId) {
    stopHighlight();
    if (reducedMotion.matches || !active || lost || document.hidden) return;
    const materials = new Set();
    model.traverse(object => { if (object.isMesh && object.userData.part?.id === partId) materials.add(object.material); });
    const originals = [...materials].map(material => ({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite, emissive: material.emissive.clone(), intensity: material.emissiveIntensity }));
    restoreHighlight = () => {
      for (const item of originals) {
        Object.assign(item.material, { opacity: item.opacity, transparent: item.transparent, depthWrite: item.depthWrite, emissiveIntensity: item.intensity });
        item.material.emissive.copy(item.emissive);
      }
    };
    const started = performance.now();
    function frame(now) {
      if (!active || lost || document.hidden || disposed) { stopHighlight(); return; }
      const progress = THREE.MathUtils.clamp((now - started) / 200, 0, 1);
      for (const item of originals) {
        item.material.transparent = true;
        item.material.depthWrite = false;
        item.material.opacity = item.opacity * (.3 + .7 * progress);
        item.material.emissive.set('#d9b86f');
        item.material.emissiveIntensity = Math.sin(progress * Math.PI) * .4;
      }
      if (progress === 1) stopHighlight();
      draw();
      if (progress < 1) highlightFrame = requestAnimationFrame(frame);
    }
    frame(started);
  }
  function down(event) {
    canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); dragDistance = 0;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  }
  function move(event) {
    const old = pointers.get(event.pointerId); if (!old) return;
    const dx = event.clientX - old.x, dy = event.clientY - old.y;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); dragDistance += Math.abs(dx) + Math.abs(dy);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], current = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0 && current > 0) zoom(pinch / current); pinch = current;
    } else { yaw -= dx * .009; pitch = THREE.MathUtils.clamp(pitch + dy * .009, -1.35, 1.35); draw(); }
  }
  function up(event) {
    const clicking = pointers.size === 1 && dragDistance < 5 && !preview;
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!clicking) return;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    const hits = raycaster.intersectObject(model, true);
    const hit = hits.find(item => item.object.userData.part?.category !== 'bus') || hits[0];
    if (hit?.object.userData.part) onPick?.(hit.object.userData.part);
  }
  const wheel = event => { event.preventDefault(); zoom(Math.exp(event.deltaY * .001)); };
  function key(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') yaw -= .15;
    if (event.key === 'ArrowRight') yaw += .15;
    if (event.key === 'ArrowUp') pitch = Math.min(1.35, pitch + .15);
    if (event.key === 'ArrowDown') pitch = Math.max(-1.35, pitch - .15);
    if (event.key === '+' || event.key === '=') zoom(.9);
    if (event.key === '-') zoom(1.1);
    if (event.key === 'Home') fit(); draw();
  }
  function contextLost(event) { event.preventDefault(); lost = true; onUnavailable?.(); }
  function contextRestored() { lost = false; host.classList.add('has-3d'); onAvailable?.(); resize(); }
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => pointers.clear());
  canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('keydown', key);
  canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored);
  const observer = new ResizeObserver(resize); observer.observe(host);
  function visibilityChanged() { if (document.hidden) stopHighlight(); else draw(); }
  const motionChanged = () => { stopHighlight(); draw(); };
  document.addEventListener('visibilitychange', visibilityChanged);
  reducedMotion.addEventListener('change', motionChanged);
  rebuild(); resize();
  return {
    update(parts, candidate = null) {
      const nextView = candidate ? `part:${candidate.id}` : 'assembly';
      if (nextView !== viewKey) {
        views.set(viewKey, { yaw, pitch, zoomFactor });
        ({ yaw, pitch, zoomFactor } = views.get(nextView) || { yaw: .35, pitch: .25, zoomFactor: 1 });
        viewKey = nextView;
      }
      installed = parts; preview = candidate;
      const key = `${viewKey}:${parts.map(part => part.id).sort().join('|')}:${exploded}`;
      if (key !== sceneKey) { sceneKey = key; rebuild(); } else draw();
      canvas.setAttribute('aria-label', candidate ? `3D preview: ${candidate.name}. Drag or use arrow keys to rotate. Scroll or use plus and minus to zoom.` : '3D satellite assembly. Drag or use arrow keys to rotate; plus and minus to zoom. Click a component to select its subsystem.');
    },
    options(values) {
      stopHighlight();
      const changed = values.exploded !== undefined && values.exploded !== exploded;
      exploded = values.exploded ?? exploded; cutaway = values.cutaway ?? cutaway; wireframe = values.wireframe ?? wireframe;
      if (changed) {
        sceneKey = `${viewKey}:${installed.map(part => part.id).sort().join('|')}:${exploded}`;
        rebuild();
      } else { styleModels(); draw(); }
    },
    reset() { fit(); draw(); },
    zoom,
    highlight,
    setActive(value) { active = value; if (active) resize(); else stopHighlight(); },
    dispose() { disposed = true; stopHighlight(); observer.disconnect(); document.removeEventListener('visibilitychange', visibilityChanged); reducedMotion.removeEventListener('change', motionChanged); disposeModel(model); renderer.dispose(); canvas.remove(); },
  };
}
