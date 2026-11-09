import * as THREE from '../../vendor/three/three.module.js';
import { earthMaps } from './menuScene.js';
import { createAssemblyModel, disposeModel } from './hangarModels.js';
import { gmst, sunVector } from '../orbit-engine.js';

export function createOrbitScene(host, plan, catalog, points, {onPick}={}) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  const canvas=renderer.domElement; canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','3D Earth and satellite orbit. Drag to rotate; scroll to zoom; arrow keys rotate.');host.append(canvas);
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(40,1,.001,100);
  const {texture,clouds}=earthMaps();
  const earth=new THREE.Mesh(new THREE.SphereGeometry(1,64,40),new THREE.MeshStandardMaterial({map:texture,roughness:.95}));scene.add(earth);
  scene.add(new THREE.AmbientLight('#adc6db',.65));
  const sun=new THREE.DirectionalLight('#fff1d6',3);scene.add(sun);
  // Inspection fill keeps the launched hardware readable in eclipse, without
  // changing the solar flux used by the flight engine.
  const fill=new THREE.DirectionalLight('#d8edff',2);scene.add(fill);scene.add(fill.target);
  const frame=new THREE.Group();scene.add(frame);
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.013,12,8),new THREE.MeshBasicMaterial({color:'#e9c987'}));
  const surfacePosition=(target,radius=1.012)=>{const lat=target.latDeg*Math.PI/180,lon=target.lonDeg*Math.PI/180;return new THREE.Vector3(Math.cos(lat)*Math.cos(lon)*radius,Math.sin(lat)*radius,-Math.cos(lat)*Math.sin(lon)*radius);};
  marker.position.copy(surfacePosition(plan.target));earth.add(marker);
  marker.userData.destination='target';
  const regionMarkers=(plan.targets||[]).map(target=>{const dot=new THREE.Mesh(new THREE.SphereGeometry(.009,10,6),new THREE.MeshBasicMaterial({color:'#95b9a4'}));dot.position.copy(surfacePosition(target));dot.userData.destination=target.id;earth.add(dot);return dot;});
  // Singapore target/station are co-located; concentric symbols avoid moving
  // either location away from its catalog coordinates.
  const station=new THREE.Mesh(new THREE.TorusGeometry(.027,.005,8,32),new THREE.MeshBasicMaterial({color:'#67d5e7'}));
  station.position.copy(surfacePosition(plan.station||{latDeg:1.3,lonDeg:103.77},1.016));
  station.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),station.position.clone().normalize());station.userData.destination='station';earth.add(station);
  const link=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#67d5e7',transparent:true,opacity:.6}));scene.add(link);
  const raycaster=new THREE.Raycaster();
  const xyz=r=>new THREE.Vector3(r[0]/6378137,r[2]/6378137,-r[1]/6378137);
  const orbit=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#78c6d5',transparent:true,opacity:.5}));frame.add(orbit);
  const sat=createAssemblyModel(Object.values(plan.components).map(id=>catalog.find(p=>p.id===id)).filter(Boolean));
  const bounds=new THREE.Box3().setFromObject(sat),center=bounds.getCenter(new THREE.Vector3());sat.position.sub(center);
  const satellite=new THREE.Group();satellite.add(sat);satellite.scale.setScalar(.055/bounds.getSize(new THREE.Vector3()).length());frame.add(satellite);
  const halo=new THREE.Mesh(new THREE.SphereGeometry(.017,12,8),new THREE.MeshBasicMaterial({color:'#fff1b0'}));frame.add(halo);
  const views={follow:{yaw:.55,pitch:.3,distance:.16},overview:{yaw:.65,pitch:.28,distance:3.8}};
  let mode='follow',lastPoint=points[0],lastOrbit=-1,drag=null,press=null,moved=false,telemetry={};
  const zoom=factor=>{const state=views[mode];state.distance=Math.max(mode==='follow'?.085:2.5,Math.min(mode==='follow'?.4:7,state.distance*factor));};
  function draw(point=lastPoint,status=telemetry) {
    telemetry=status;
    lastPoint=point;
    earth.rotation.y=gmst(point.time);
    const v=xyz(point.rECI);satellite.position.copy(v);halo.position.copy(v);satellite.lookAt(0,0,0);
    const s=sunVector(point.time);sun.position.copy(xyz(s).multiplyScalar(6378137));
    const orbitIndex=Math.floor((point.time-points[0].time)/plan.metrics.periodSec);
    if(orbitIndex!==lastOrbit){lastOrbit=orbitIndex;const start=points[0].time+orbitIndex*plan.metrics.periodSec;const path=points.filter(p=>p.time>=start&&p.time<=start+plan.metrics.periodSec).map(p=>xyz(p.rECI));orbit.geometry.dispose();orbit.geometry=new THREE.BufferGeometry().setFromPoints(path);}
    const {yaw,pitch,distance}=views[mode];
    if(mode==='follow'){
      const fit=distance/Math.min(1,camera.aspect);
      const offset=new THREE.Vector3(Math.cos(pitch)*Math.sin(yaw),Math.sin(pitch),-Math.cos(pitch)*Math.cos(yaw)).multiplyScalar(fit).applyQuaternion(satellite.quaternion);
      camera.position.copy(v).add(offset);
      if(camera.position.length()<1.025)camera.position.setLength(1.025);
      camera.lookAt(v);
    }else{
      camera.position.set(distance*Math.cos(pitch)*Math.sin(yaw),distance*Math.sin(pitch),distance*Math.cos(pitch)*Math.cos(yaw));camera.lookAt(0,0,0);
    }
    halo.visible=mode==='overview';fill.visible=mode==='follow';fill.position.copy(camera.position);fill.target.position.copy(v);
    station.visible=mode==='overview';
    link.visible=mode==='overview'&&Boolean(telemetry.contact);
    if(link.visible){earth.updateMatrixWorld(true);const ground=earth.localToWorld(station.position.clone());const curve=new THREE.QuadraticBezierCurve3(ground,ground.clone().add(v).multiplyScalar(.5).setLength(1.13),v);link.geometry.dispose();link.geometry=new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));link.material.opacity=telemetry.transmitting?.55+.3*Math.sin(point.time*.7):.35;}
    host.dataset.camera=mode;
    renderer.render(scene,camera);
  }
  function resize(){const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw();}
  canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];press=[...drag];moved=false;canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(!drag)return;if(Math.hypot(e.clientX-press[0],e.clientY-press[1])>6)moved=true;const state=views[mode];state.yaw-=(e.clientX-drag[0])*.006;state.pitch=Math.max(-1.3,Math.min(1.3,state.pitch+(e.clientY-drag[1])*.006));drag=[e.clientX,e.clientY];draw();};
  canvas.onpointerup=e=>{if(press&&!moved&&mode==='overview'){const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);scene.updateMatrixWorld(true);const hits=raycaster.intersectObjects([marker,station,...regionMarkers,earth],false);if(hits[0]?.object.userData.destination)onPick?.(hits[0].object.userData.destination);}drag=null;press=null;};
  canvas.onpointercancel=()=>{drag=null;press=null;};
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.08:.92);draw();},{passive:false});
  canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;e.preventDefault();const state=views[mode];if(e.key==='ArrowLeft')state.yaw-=.1;if(e.key==='ArrowRight')state.yaw+=.1;if(e.key==='ArrowUp')state.pitch=Math.min(1.3,state.pitch+.1);if(e.key==='ArrowDown')state.pitch=Math.max(-1.3,state.pitch-.1);if(e.key==='+')zoom(.9);if(e.key==='-')zoom(1.1);draw();};
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();host.dataset.graphics='lost';});
  canvas.addEventListener('webglcontextrestored',()=>{delete host.dataset.graphics;resize();});
  texture.userData.onSurfaceReady=()=>draw();
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  return {update:draw,setTarget:target=>{marker.position.copy(surfacePosition(target));draw();},focusDestination:kind=>{earth.updateMatrixWorld(true);const position=earth.localToWorld((kind==='station'?station:marker).position.clone());views.overview.yaw=Math.atan2(position.x,position.z);views.overview.pitch=Math.asin(position.y/position.length());draw();},setMode:value=>{if(!Object.hasOwn(views,value))return;mode=value;drag=null;draw();},reset:()=>{views[mode]=mode==='follow'?{yaw:.55,pitch:.3,distance:.16}:{yaw:.65,pitch:.28,distance:3.8};draw();},dispose:()=>{observer.disconnect();disposeModel(scene);texture.dispose();clouds.dispose();renderer.dispose();canvas.remove();}};
}
