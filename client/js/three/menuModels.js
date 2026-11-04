import * as THREE from '../../vendor/three/three.module.js';

export function createMoon() {
  const geometry = new THREE.SphereGeometry(1, 96, 64);
  const craters = [];
  let seed = 91;
  const random = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
  for (let i = 0; i < 75; i++) {
    const z = random() * 2 - 1, angle = random() * Math.PI * 2;
    craters.push({ center: new THREE.Vector3(Math.sqrt(1-z*z)*Math.cos(angle), z, Math.sqrt(1-z*z)*Math.sin(angle)), radius: .035 + random() * .15 });
  }
  const positions = geometry.attributes.position;
  const colors = [];
  const normal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    normal.fromBufferAttribute(positions, i).normalize();
    let displacement = 0;
    let shade = .64 + .07 * Math.sin(normal.x * 13 + Math.sin(normal.y * 17)) * Math.cos(normal.z * 18);
    for (const crater of craters) {
      const distance = normal.distanceTo(crater.center) / crater.radius;
      if (distance < 1.3) {
        displacement += -.023 * Math.exp(-distance * distance * 4) + .009 * Math.exp(-Math.pow((distance - .9) * 7, 2));
        shade -= .14 * Math.exp(-distance * distance * 3);
      }
    }
    positions.setXYZ(i, normal.x * (1 + displacement), normal.y * (1 + displacement), normal.z * (1 + displacement));
    colors.push(shade * .98, shade, shade * 1.025);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
}

export function createSatellite() {
  const root = new THREE.Group();
  const model = new THREE.Group(); root.add(model);
  const blue = new THREE.MeshStandardMaterial({ color: 0x72b5e9, metalness: .35, roughness: .32 });
  const darkBlue = new THREE.MeshStandardMaterial({ color: 0x254e88, metalness: .5, roughness: .36 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xc8d5df, metalness: .7, roughness: .28 });
  const cell = new THREE.MeshStandardMaterial({ color: 0x17417b, metalness: .55, roughness: .23 });
  const line = new THREE.MeshStandardMaterial({ color: 0x8eb9da, metalness: .6, roughness: .35 });
  function box(w,h,d,x,y,z,material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);model.add(mesh);return mesh;
  }
  function cylinder(top,bottom,height,x,y,z,material) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,48),material);
    mesh.position.set(x,y,z);model.add(mesh);return mesh;
  }
  box(.95,1.55,.85,0,0,0,blue);
  for (const y of [-.58,.52]) box(.99,.14,.89,0,y,0,darkBlue);
  for (const x of [-.43,.43]) box(.045,1.5,.045,x,0,.45,metal);
  box(4.7,.075,.1,0,0,0,metal);
  for(const side of [-1,1]) {
    const center = side * 1.72;
    box(2.22,1.25,.09,center,0,0,darkBlue);
    for(let col=0;col<4;col++)for(let row=0;row<2;row++) {
      const x=center-.82+col*.55,y=-.3+row*.6;
      box(.49,.54,.025,x,y,.062,cell);
      for(let trace=1;trace<4;trace++)box(.47,.006,.005,x,y-.27+trace*.135,.078,line);
      box(.006,.52,.005,x,y,.078,line);
    }
  }
  const lensHousing = cylinder(.29,.29,.14,0,.08,.49,metal);lensHousing.rotation.x=Math.PI/2;
  const lens = cylinder(.23,.23,.15,0,.08,.57,new THREE.MeshStandardMaterial({color:0x06162c,metalness:.7,roughness:.12}));lens.rotation.x=Math.PI/2;
  const reflection = new THREE.Mesh(new THREE.SphereGeometry(.08,16,12),new THREE.MeshBasicMaterial({color:0x8acfff,transparent:true,opacity:.45}));
  reflection.scale.z=.12;reflection.position.set(-.07,.16,.66);model.add(reflection);
  cylinder(.3,.22,.2,0,.88,0,metal);
  cylinder(.2,.4,.3,0,-.94,0,blue);
  cylinder(.025,.025,.36,0,-1.22,0,metal);
  const tip=new THREE.Mesh(new THREE.SphereGeometry(.11,20,16),blue);tip.position.y=-1.43;model.add(tip);
  const status=new THREE.Mesh(new THREE.SphereGeometry(.025,12,8),new THREE.MeshBasicMaterial({color:0x98ffd0}));status.position.set(.3,-.25,.44);model.add(status);
  for(const x of [-.35,.35])for(const y of [-.4,.38]) {
    const bolt=cylinder(.025,.025,.025,x,y,.45,metal);bolt.rotation.x=Math.PI/2;
  }
  model.rotation.set(.2,-.28,-.25);
  root.userData.model=model;
  return root;
}
