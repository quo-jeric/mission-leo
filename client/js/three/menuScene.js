import * as THREE from '../../vendor/three/three.module.js';
import { createMoon, createSatellite } from './menuModels.js';

// All textures are local, generated once, and require no remote services.
function earthMaps() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#123b66'; ctx.fillRect(0, 0, 2048, 1024);
  const land = [
    [[-168,68],[-145,71],[-128,60],[-126,49],[-117,32],[-105,23],[-98,16],[-87,21],[-81,25],[-80,33],[-66,45],[-58,52],[-78,62],[-96,72],[-120,75]],
    [[-82,12],[-70,11],[-61,5],[-50,0],[-35,-7],[-41,-22],[-52,-34],[-66,-55],[-74,-48],[-76,-26],[-81,-6]],
    [[-53,60],[-42,61],[-22,78],[-42,84],[-60,77]],
    [[-17,35],[2,37],[12,33],[33,31],[44,12],[51,11],[43,-12],[35,-24],[20,-35],[12,-28],[8,-5],[-5,5],[-17,16]],
    [[-10,36],[-10,44],[0,49],[5,55],[18,60],[22,70],[38,69],[40,56],[29,43],[20,38],[12,44],[8,42],[0,38]],
    [[30,70],[60,73],[94,77],[125,72],[151,61],[179,66],[170,53],[145,46],[135,35],[120,23],[108,19],[105,6],[98,10],[91,23],[79,8],[72,23],[60,25],[48,30],[36,41]],
    [[113,-22],[123,-13],[136,-12],[145,-17],[154,-28],[149,-38],[132,-34],[116,-35]],
    [[47,-13],[50,-16],[47,-26],[44,-23]],
    [[130,32],[142,46],[146,43],[140,34]],
    [[95,5],[106,-6],[119,-9],[130,-5],[119,1],[110,7]],
    [[-180,-71],[-130,-73],[-85,-71],[-60,-64],[-20,-73],[35,-69],[80,-67],[130,-70],[180,-71],[180,-90],[-180,-90]]
  ];
  const project = ([lon, lat]) => [(lon + 180) / 360 * 2048, (90 - lat) / 180 * 1024];
  ctx.fillStyle = '#68816a';
  for (const polygon of land) {
    ctx.beginPath(); polygon.forEach((point, i) => { const [x,y] = project(point); i ? ctx.lineTo(x,y) : ctx.moveTo(x,y); }); ctx.closePath(); ctx.fill();
  }
  // Desert belts and polar ice soften the atlas into a shaded globe texture.
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = '#b3a77b';
  ctx.beginPath(); [[-15,29],[30,29],[40,15],[12,17],[-10,20]].forEach((point,i) => { const [x,y] = project(point); i ? ctx.lineTo(x,y) : ctx.moveTo(x,y); }); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#dce9eb'; ctx.fillRect(0,0,2048,37); ctx.fillRect(0,964,2048,60);
  let seed = 21;
  const random = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
  for (let i=0; i<48000; i++) {
    ctx.fillStyle = random() > .5 ? '#ffffff0b' : '#0000000b';
    ctx.fillRect(random()*2048, random()*1024, 1+random()*4, 1+random()*3);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const cloudsCanvas = document.createElement('canvas'); cloudsCanvas.width = 1024; cloudsCanvas.height = 512;
  const cloudCtx = cloudsCanvas.getContext('2d');
  for(let i=0;i<900;i++) {
    const x=random()*1024, y=40+random()*430, r=8+random()*24;
    const gradient=cloudCtx.createRadialGradient(x,y,0,x,y,r);
    gradient.addColorStop(0,'rgba(255,255,255,.28)'); gradient.addColorStop(1,'rgba(255,255,255,0)');
    cloudCtx.fillStyle=gradient; cloudCtx.save(); cloudCtx.translate(x,y); cloudCtx.scale(2.7,.55); cloudCtx.translate(-x,-y); cloudCtx.fillRect(x-r,y-r,r*2,r*2); cloudCtx.restore();
  }
  return {texture, clouds:new THREE.CanvasTexture(cloudsCanvas)};
}

export function createMenuScene() {
  const host = document.querySelector('.space');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'}); } catch { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000,0);
  renderer.domElement.className = 'planet-scene';
  renderer.domElement.setAttribute('aria-hidden','true');
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,4000); camera.position.z=1500;
  scene.add(new THREE.AmbientLight(0x7c9fc6,1.1));
  const sunlight = new THREE.DirectionalLight(0xffebcf,3.2); sunlight.position.set(800,500,700); scene.add(sunlight);
  const {texture, clouds} = earthMaps();
  const geometry = new THREE.SphereGeometry(1,64,48);
  const moon = createMoon(); scene.add(moon);
  const satellite = createSatellite(); scene.add(satellite);
  const earth = new THREE.Group();
  const globe = new THREE.Mesh(geometry,new THREE.MeshPhongMaterial({map:texture,color:0xffffff,specular:0x4c7799,shininess:22}));
  globe.rotation.y=2.6; globe.rotation.z=.18; earth.add(globe);
  const cloudSphere = new THREE.Mesh(geometry,new THREE.MeshPhongMaterial({map:clouds,transparent:true,opacity:.65,depthWrite:false}));
  cloudSphere.scale.setScalar(1.009); cloudSphere.rotation.z=.18; earth.add(cloudSphere);
  const atmosphere = new THREE.Mesh(geometry,new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,
    vertexShader:'varying vec3 n; varying vec3 v; void main(){ vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p; }',
    fragmentShader:'varying vec3 n; varying vec3 v; void main(){ float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.); gl_FragColor=vec4(.16,.55,1.,rim*.65); }'
  })); atmosphere.scale.setScalar(1.027); earth.add(atmosphere); scene.add(earth);
  const sunMaterial = new THREE.ShaderMaterial({uniforms:{time:{value:0}},
    vertexShader:'varying vec3 p; varying vec3 n; void main(){p=position; n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 p; varying vec3 n; uniform float time;
      float hash(vec3 q){return fract(sin(dot(q,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 q){vec3 i=floor(q),f=fract(q); f=f*f*(3.-2.*f); return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){float t=noise(p*19.+time*.15)*.6+noise(p*55.-time*.1)*.3+noise(p*130.)*.1; float limb=pow(max(n.z,0.),.3); vec3 col=mix(vec3(1.,.29,.025),vec3(1.,.88,.37),t); gl_FragColor=vec4(col*(.65+.45*limb),1.);}`
  });
  const sun = new THREE.Mesh(geometry,sunMaterial); scene.add(sun);
  const glowCanvas=document.createElement('canvas'); glowCanvas.width=256; glowCanvas.height=256;
  const glowCtx=glowCanvas.getContext('2d'); const gradient=glowCtx.createRadialGradient(128,128,30,128,128,128);
  gradient.addColorStop(0,'rgba(255,202,85,.65)');gradient.addColorStop(.45,'rgba(255,159,46,.25)');gradient.addColorStop(1,'rgba(255,135,24,0)');glowCtx.fillStyle=gradient;glowCtx.fillRect(0,0,256,256);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})); glow.position.z=-20; scene.add(glow);
  function resize(){
    const width=host.clientWidth,height=host.clientHeight;
    renderer.setSize(width,height);camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
    const hostRect=host.getBoundingClientRect();
    for(const [selector,object] of [['.earth',earth],['.sun',sun],['.moon',moon]]){
      const r=host.querySelector(selector).getBoundingClientRect();
      object.position.set(r.left-hostRect.left+r.width/2-width/2,height/2-(r.top-hostRect.top+r.height/2),0);object.scale.setScalar(r.width/2);
      object.userData.baseX=object.position.x;
      object.userData.baseY=object.position.y;
    }
    const satelliteRect=host.querySelector('.satellite').getBoundingClientRect();
    satellite.position.set(satelliteRect.left-hostRect.left+satelliteRect.width/2-width/2,height/2-(satelliteRect.top-hostRect.top+satelliteRect.height/2),100);
    satellite.scale.setScalar(satelliteRect.width/6.5);
    satellite.userData.baseY=satellite.position.y;
    updateCelestialMotion();
    renderer.render(scene,camera);
  }
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,last=0,elapsed=0;
  function updateCelestialMotion(){
    // Small offsets preserve the mockup composition at every screen size.
    const drift=Math.min(moon.scale.x*.18,9);
    moon.position.x=moon.userData.baseX+Math.sin(elapsed*.24)*drift;
    moon.position.y=moon.userData.baseY+Math.sin(elapsed*.48)*drift*.7;
    moon.rotation.set(Math.sin(elapsed*.22)*.045,elapsed*.07,Math.sin(elapsed*.3)*.035);
    sun.rotation.y=elapsed*.045;
    sun.rotation.z=Math.sin(elapsed*.18)*.04;
    sunMaterial.uniforms.time.value=elapsed;
    const pulse=.5+.5*Math.sin(elapsed*.9);
    glow.position.x=sun.position.x;glow.position.y=sun.position.y;
    glow.scale.setScalar(sun.scale.x*(3.7+pulse*.24));
    glow.material.opacity=.78+pulse*.22;
  }
  function draw(now){
    frame=0;
    const delta=last?Math.min((now-last)/1000,.05):0;last=now;
    const animated=!document.body.classList.contains('still')&&!reducedMotion.matches;
    if(animated){
      elapsed+=delta;globe.rotation.y+=delta*.025;cloudSphere.rotation.y+=delta*.035;sunMaterial.uniforms.time.value=elapsed;
      updateCelestialMotion();
      satellite.position.y=satellite.userData.baseY+Math.sin(elapsed*.65)*satellite.scale.x*.07;
      satellite.userData.model.rotation.y=-.28+Math.sin(elapsed*.3)*.13;
      satellite.userData.model.rotation.z=-.25+Math.sin(elapsed*.45)*.025;
    }
    renderer.render(scene,camera);
    if(animated&&!document.hidden)frame=requestAnimationFrame(draw);
  }
  function resume(){if(frame)cancelAnimationFrame(frame);last=0;if(!document.hidden)frame=requestAnimationFrame(draw);}
  const observer=new MutationObserver(resume);observer.observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',resume);reducedMotion.addEventListener('change',resume);
  addEventListener('resize',resize);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();host.classList.remove('has-3d');if(frame)cancelAnimationFrame(frame);});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{resize();host.classList.add('has-3d');resume();});
  resize();host.classList.add('has-3d');resume();
  addEventListener('pagehide',()=>{
    if(frame)cancelAnimationFrame(frame);observer.disconnect();removeEventListener('resize',resize);document.removeEventListener('visibilitychange',resume);reducedMotion.removeEventListener('change',resume);
    const geometries=new Set(),materials=new Set(),textures=new Set();
    scene.traverse(object=>{
      if(object.geometry)geometries.add(object.geometry);
      if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);
    });
    for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}
    for(const resource of [...geometries,...textures])resource.dispose();renderer.dispose();
  },{once:true});
}
