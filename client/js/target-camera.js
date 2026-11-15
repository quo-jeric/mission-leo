import { loadEarthSurface, drawEarthSurface, offsetSurface } from './earth-surface.js';
import { loadSingaporeImagery, drawSingaporeImagery, singaporeImagery } from './singapore-imagery.js';
// Version-1 saved captures retain their original illustrative image.
function terrain(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1000;
  const c=canvas.getContext('2d');c.fillStyle='#24464e';c.fillRect(0,0,1000,1000);
  c.fillStyle='#52664d';c.beginPath();c.moveTo(0,0);c.lineTo(950,0);c.lineTo(920,400);c.lineTo(680,630);c.lineTo(530,1000);c.lineTo(0,1000);c.closePath();c.fill();
  let seed=73;const random=()=>((seed=seed*16807%2147483647)/2147483647);
  for(let y=20;y<960;y+=35)for(let x=15;x<900;x+=35){if(x>950-y*.42)continue;c.fillStyle=random()>.4?'#a1a18c':'#6c8172';c.fillRect(x,y,18+random()*10,15+random()*12);}
  c.strokeStyle='#b3b29c';c.lineWidth=5;
  for(let p=0;p<1000;p+=70){c.beginPath();c.moveTo(0,p);c.lineTo(1000,p-80);c.stroke();c.beginPath();c.moveTo(p,0);c.lineTo(p-120,1000);c.stroke();}
  c.strokeStyle='#345f69';c.lineWidth=24;c.beginPath();c.moveTo(100,0);c.bezierCurveTo(800,300,200,600,750,1000);c.stroke();return canvas;
}
export function cameraFrame(aim,altitudeKm,swathKm){
  const rad=Math.PI/180;
  return {eastKm:altitudeKm*(Math.tan(aim.xDeg*rad)-Math.tan(aim.aimXDeg*rad)),northKm:altitudeKm*(Math.tan(aim.yDeg*rad)-Math.tan(aim.aimYDeg*rad)),swathKm,version:1};
}
function paint(canvas,map,frame,overlay,ready=false){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  c.fillStyle='#17313b';c.fillRect(0,0,w,h);
  const side=Math.min(w,h),scale=side/frame.swathKm;
  c.save();c.translate(w/2-frame.eastKm*scale,h/2+frame.northKm*scale);
  c.drawImage(map,-30*scale,-30*scale,60*scale,60*scale);
  if(overlay){c.strokeStyle='#f2ce85';c.lineWidth=2;c.setLineDash([8,5]);c.strokeRect(-5*scale,-5*scale,10*scale,10*scale);c.setLineDash([]);c.fillStyle='#ffe2a5';c.font='12px Arial';c.fillText('TARGET · 10 × 10 km',-5*scale+5,-5*scale+17);}
  c.restore();
  if(overlay){c.strokeStyle=ready?'#a2efb6':'#d7f1f5';c.lineWidth=ready?3:1;c.strokeRect(w/2-side/2+2,h/2-side/2+2,side-4,side-4);c.beginPath();c.moveTo(w/2-12,h/2);c.lineTo(w/2+12,h/2);c.moveTo(w/2,h/2-12);c.lineTo(w/2,h/2+12);c.stroke();}
}
function geographicFrame(canvas,frame,target,overlay,ready,detailed=true,viewSwathKm=frame.swathKm){
  const center=offsetSurface(target.latDeg,target.lonDeg,frame.eastKm,frame.northKm);
  const imagery=detailed&&drawSingaporeImagery(canvas,center,viewSwathKm);
  canvas.dataset.imagery=String(Boolean(imagery));
  if(!imagery)drawEarthSurface(canvas,center,viewSwathKm);
  if(!overlay)return;
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,side=Math.min(w,h),scale=side/viewSwathKm,sensor=frame.swathKm*scale;
  c.strokeStyle='#eacb88';c.lineWidth=2;c.setLineDash([8,5]);c.strokeRect(w/2-frame.eastKm*scale-5*scale,h/2+frame.northKm*scale-5*scale,10*scale,10*scale);c.setLineDash([]);
  c.strokeStyle=ready?'#a2efb6':'#d7f1f5';c.strokeRect(w/2-sensor/2+2,h/2-sensor/2+2,Math.max(0,sensor-4),Math.max(0,sensor-4));
  c.beginPath();c.moveTo(w/2-12,h/2);c.lineTo(w/2+12,h/2);c.moveTo(w/2,h/2-12);c.lineTo(w/2,h/2+12);c.stroke();
}
export function createTargetCamera(host,onAim){
  const map=terrain(),canvas=document.createElement('canvas');canvas.className='target-camera-canvas';canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Illustrative instrument camera. Gold outline is the target; white square is the sensor footprint. Drag terrain or click to adjust aim; pinch to zoom.');canvas.hidden=true;host.append(canvas);
  const reveal=document.createElement('section');reveal.className='orbit-image-reveal';reveal.hidden=true;
  const feedback=document.createElement('div');feedback.className='target-camera-feedback';feedback.hidden=true;feedback.innerHTML='<p>Fit the gold target inside the sensor frame, then capture.</p><strong role="status" aria-live="polite" aria-atomic="true"></strong>';host.append(feedback);
  const shutter=document.createElement('div');shutter.className='target-camera-shutter';shutter.setAttribute('aria-hidden','true');host.append(shutter);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let flashAnimation=null;
  const cancelFlash=()=>{flashAnimation?.cancel();flashAnimation=null;};reduced.addEventListener('change',cancelFlash);
  reveal.innerHTML='<h2>Image captured</h2><canvas width="320" height="320" role="img" aria-label="Captured illustrative terrain preview"></canvas><p class="capture-meta"></p><p>Simulated terrain · not real satellite imagery</p>';
  const attribution='<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> by <a href="https://eox.at" target="_blank" rel="noopener">EOX IT Services GmbH</a> · Contains modified Copernicus Sentinel data 2016 &amp; 2017 · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>';
  const credit=document.createElement('div');credit.className='orbit-imagery-credit';credit.innerHTML=attribution;credit.hidden=true;host.append(credit);
  const captureCredit=document.createElement('p');captureCredit.className='capture-imagery-credit';captureCredit.innerHTML=attribution;captureCredit.hidden=true;reveal.append(captureCredit);
  const zoomTools=document.createElement('div');zoomTools.className='target-camera-zoom';zoomTools.hidden=true;zoomTools.setAttribute('role','group');zoomTools.setAttribute('aria-label','Target camera view zoom');
  zoomTools.innerHTML='<button type="button" aria-label="Zoom out target camera">−</button><output aria-label="Target camera view scale">1×</output><button type="button" aria-label="Zoom in target camera">+</button><button type="button" aria-label="Reset target camera zoom">Reset</button><span>View zoom · capture unchanged</span>';host.append(zoomTools);
  const [zoomOut,zoomIn,zoomReset]=zoomTools.querySelectorAll('button');
  let current=null,active=false,lastCapture=null,zoom=1;
  function setZoom(value){if(current?.state.captured)return;zoom=Math.max(.25,Math.min(2,value));redraw();}
  zoomOut.onclick=()=>setZoom(zoom/Math.SQRT2);zoomIn.onclick=()=>setZoom(zoom*Math.SQRT2);zoomReset.onclick=()=>setZoom(1);
  const redraw=()=>{
    if(!current)return;
    const {aim,point,plan,readiness,state}=current;
    const viewZoom=state.captured?1:zoom;
    zoomTools.hidden=!active||state.captured;
    zoomTools.querySelector('output').textContent=`${Number(viewZoom.toFixed(2))}×`;
    zoomOut.disabled=zoom<=.25;zoomIn.disabled=zoom>=2;canvas.dataset.viewZoom=String(viewZoom);
    const frame=state.captured?state.captureFrame:cameraFrame(aim,point.geodetic.altM/1000,plan.metrics.swathKm);
    const rect=host.getBoundingClientRect();canvas.width=Math.max(1,Math.round(rect.width));canvas.height=Math.max(1,Math.round(rect.height));
    const c=canvas.getContext('2d');
    const traveling=!state.captured&&!aim.available;
    feedback.hidden=!active||traveling;
    if(traveling){
      // Illustrative flyover texture, driven by the propagated ground position.
      // It does not depict the distant target or claim real geographic imagery.
      const rad=Math.PI/180,alt=point.geodetic.altM/1000;
      const center=offsetSurface(point.geodetic.latDeg,point.geodetic.lonDeg,alt*Math.tan(aim.xDeg*rad),alt*Math.tan(aim.yDeg*rad));
      const imagery=drawSingaporeImagery(canvas,center,plan.metrics.swathKm/viewZoom);canvas.dataset.imagery=String(imagery);
      if(!imagery)drawEarthSurface(canvas,center,plan.metrics.swathKm/viewZoom);
      if(point.isEclipse){c.fillStyle='#03101c88';c.fillRect(0,0,canvas.width,canvas.height);}
    }
    else if(frame){if(state.captured&&frame.version===1){paint(canvas,map,frame,false);canvas.dataset.imagery='false';}else geographicFrame(canvas,frame,plan.target,!state.captured,readiness.ready,!state.captured||frame.version>=3,frame.swathKm/viewZoom);}
    else{c.fillStyle='#112c37';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#c3d8df';c.font='14px Arial';c.textAlign='center';c.fillText('Preview unavailable for this older capture',canvas.width/2,canvas.height/2);c.textAlign='start';}
    feedback.dataset.ready=String(readiness.ready||state.status==='COMPLETE');
    feedback.querySelector('p').textContent=state.captured?'Captured image · saved framing': 'Fit the gold target inside the sensor frame, then capture.';
    const message=state.status==='COMPLETE'?'✓ Image delivered':readiness.reason;
    const label=feedback.querySelector('strong');if(label.textContent!==message)label.textContent=message;
    c.fillStyle='#08151cdd';c.fillRect(0,0,canvas.width,32);c.fillStyle='#d9e9ed';c.font='12px Arial';
    c.fillText(state.status==='COMPLETE'?'MISSION COMPLETE · IMAGE DELIVERED':state.captured?'CAPTURED IMAGE · READY FOR DOWNLINK':aim.available?'TARGET CAMERA · drag or click to aim':'TARGET OUTSIDE CAPTURE WINDOW',12,21);
    const detailed=canvas.dataset.imagery==='true';credit.hidden=!active||!detailed;
    c.fillText(detailed?'HISTORICAL 2016/17 IMAGERY · ~12 m SOURCE PIXELS · NOT LIVE':state.captured&&frame?.version===1?'LEGACY ILLUSTRATIVE CAPTURE':'NATURAL EARTH COASTLINE MAP · NOT PHOTOGRAPHY',12,canvas.height-(detailed?45:12));
  };
  function aimAt(event){if(!current||current.state.captured||current.state.status!=='IN_ORBIT')return;const r=canvas.getBoundingClientRect(),side=Math.min(r.width,r.height),{aim,point,plan}=current,alt=point.geodetic.altM/1000,rad=Math.PI/180;const dx=(event.clientX-r.left-r.width/2)/side*plan.metrics.swathKm/zoom,dy=-(event.clientY-r.top-r.height/2)/side*plan.metrics.swathKm/zoom;onAim(Math.atan(Math.tan(aim.xDeg*rad)+dx/alt)/rad,Math.atan(Math.tan(aim.yDeg*rad)+dy/alt)/rad);}
  const touches=new Map();let pinchDistance=0,pinched=false;
  const canAim=()=>active&&current&&!current.state.captured&&current.state.status==='IN_ORBIT';
  function dragAim(dx,dy){
    if(!canAim())return;
    const {aim,point,plan}=current,side=Math.min(canvas.clientWidth,canvas.clientHeight),alt=point.geodetic.altM/1000,rad=Math.PI/180;
    if(!side)return;
    const kmPerPixel=plan.metrics.swathKm/zoom/side;
    // Grab the terrain: dragging east shifts the sensor west, and vice versa.
    onAim(Math.atan(Math.tan(aim.xDeg*rad)-dx*kmPerPixel/alt)/rad,Math.atan(Math.tan(aim.yDeg*rad)+dy*kmPerPixel/alt)/rad);
  }
  canvas.onpointerdown=event=>{
    if(!canAim()||(event.pointerType==='mouse'&&event.button!==0))return;
    canvas.setPointerCapture(event.pointerId);
    touches.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,dragged:false});
    if(touches.size>=2){const [a,b]=[...touches.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);pinched=true;delete canvas.dataset.dragging;}
  };
  canvas.onpointermove=event=>{
    const old=touches.get(event.pointerId);if(!old)return;
    const moved=Math.hypot(event.clientX-old.startX,event.clientY-old.startY)>6;
    touches.set(event.pointerId,{...old,x:event.clientX,y:event.clientY,dragged:old.dragged||moved});
    if(touches.size>=2){const [a,b]=[...touches.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance>0)setZoom(zoom*distance/pinchDistance);pinchDistance=distance;}
    else if(!pinched&&(old.dragged||moved)){
      canvas.dataset.dragging='true';
      dragAim(event.clientX-(old.dragged?old.x:old.startX),event.clientY-(old.dragged?old.y:old.startY));
    }
  };
  function endPointer(event,cancelled=false){
    const p=touches.get(event.pointerId);
    if(p&&!cancelled&&!pinched&&!p.dragged&&canAim())aimAt(event);
    touches.delete(event.pointerId);
    if(!touches.size){pinched=false;pinchDistance=0;delete canvas.dataset.dragging;}
  }
  canvas.onpointerup=event=>endPointer(event);
  canvas.onpointercancel=event=>endPointer(event,true);
  canvas.onlostpointercapture=event=>endPointer(event,true);
  canvas.addEventListener('wheel',event=>{if(!active)return;event.preventDefault();event.stopPropagation();setZoom(zoom*(event.deltaY>0?1/Math.SQRT2:Math.SQRT2));},{passive:false});
  canvas.onkeydown=event=>{if(['+','=','-','0'].includes(event.key)){event.preventDefault();setZoom(event.key==='0'?1:zoom*(event.key==='-'?1/Math.SQRT2:Math.SQRT2));return;}const directions={ArrowLeft:[-.2,0],ArrowRight:[.2,0],ArrowUp:[0,.2],ArrowDown:[0,-.2]};if(!current||!directions[event.key]||current.state.captured||current.state.status!=='IN_ORBIT')return;event.preventDefault();const [x,y]=directions[event.key];onAim(current.aim.xDeg+x/zoom,current.aim.yDeg+y/zoom);};
  const observer=new ResizeObserver(()=>{if(active)redraw();});observer.observe(host);
  function describeCapture(){
    if(current?.state.captureFrame?.version!==3)return;
    const detailed=reveal.querySelector('canvas').dataset.imagery==='true';
    reveal.querySelector('.capture-meta + p').textContent=detailed?'Historical 2016/17 imagery; approx. 12 m source pixels. Reported GSD is simulated, not source-image resolution.':'Historical imagery loading or unavailable — coastline fallback shown. Reported GSD is simulated.';
    reveal.querySelector('canvas').setAttribute('aria-label',detailed?'Captured historical Singapore satellite imagery':'Captured geographic coastline fallback');
  }
  let disposed=false;
  loadEarthSurface().then(()=>{
    if(disposed)return;
    if(active)redraw();lastCapture=null;
    if(current?.state.captured&&current.state.captureFrame?.version>=2)geographicFrame(reveal.querySelector('canvas'),current.state.captureFrame,current.plan.target,false,false,current.state.captureFrame.version>=3);
    describeCapture();
  }).catch(()=>{if(!disposed){host.dataset.mapError='true';if(active){const c=canvas.getContext('2d');c.fillStyle='#d6e8ed';c.fillText('Geographic map unavailable — no terrain inferred',16,80);}}});
  loadSingaporeImagery().then(()=>{
    if(disposed)return;
    if(active)redraw();lastCapture=null;
    if(current?.state.captured&&current.state.captureFrame?.version>=3)geographicFrame(reveal.querySelector('canvas'),current.state.captureFrame,current.plan.target,false,false,true);
    describeCapture();
  }).catch(()=>{if(!disposed){host.dataset.imageryError='true';describeCapture();}});
  return {reveal,resetZoom(){setZoom(1);},get viewZoom(){return zoom;},flash(){cancelFlash();if(active&&!reduced.matches)flashAnimation=shutter.animate([{opacity:.16},{opacity:0}],{duration:180,easing:"ease-out"});},captureSource(){return canvas.dataset.imagery==='true'?singaporeImagery.id:null;},active(value){active=value;zoomTools.hidden=!value||Boolean(current?.state.captured);touches.clear();delete canvas.dataset.dragging;pinched=false;pinchDistance=0;credit.hidden=!value||canvas.dataset.imagery!=='true';canvas.hidden=!value;feedback.hidden=!value;if(!value)cancelFlash();host.dataset.instrument=String(value);if(value)redraw();},update(aim,point,plan,state,readiness={ready:false,reason:"Align the target"}){current={aim,point,plan,state,readiness};captureCredit.hidden=state.captureFrame?.version!==3;reveal.querySelector(".capture-meta + p").textContent=state.captureFrame?.version===3?"Historical 2016/17 imagery; approx. 12 m source pixels. Reported GSD is simulated, not source-image resolution.":"Geographic coastline map or legacy illustration; not photographic imagery.";if(active)redraw();reveal.hidden=!state.captured;if(!state.captured){lastCapture=null;return;}const key=JSON.stringify([state.captureTime,state.captureFrame]);if(key===lastCapture)return;lastCapture=key;const image=reveal.querySelector('canvas');image.hidden=!state.captureFrame;if(state.captureFrame){if(state.captureFrame.version===1)paint(image,map,state.captureFrame,false);else geographicFrame(image,state.captureFrame,plan.target,false,false,state.captureFrame.version>=3);}describeCapture();reveal.querySelector('.capture-meta').textContent=`${state.captureGsdM?.toFixed(2)??'—'} m GSD · quality ${state.captureScore??'—'}/100 · ${state.captureAimMode==='auto'?'assisted':'manual'}${state.captureFrame?'':' · Preview unavailable for this older capture'}`;},dispose(){disposed=true;cancelFlash();reduced.removeEventListener("change",cancelFlash);observer.disconnect();zoomTools.remove();touches.clear();canvas.remove();feedback.remove();shutter.remove();credit.remove();reveal.remove();delete host.dataset.instrument;}};
}
