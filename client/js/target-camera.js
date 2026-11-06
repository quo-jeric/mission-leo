// Deterministic illustrative terrain, not remote imagery or a geographic basemap.
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
export function createTargetCamera(host,onAim){
  const map=terrain(),canvas=document.createElement('canvas');canvas.className='target-camera-canvas';canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Illustrative instrument camera. Gold outline is the target; white square is the sensor footprint. Click to adjust aim.');canvas.hidden=true;host.append(canvas);
  const reveal=document.createElement('section');reveal.className='orbit-image-reveal';reveal.hidden=true;
  const feedback=document.createElement('div');feedback.className='target-camera-feedback';feedback.hidden=true;feedback.innerHTML='<p>Fit the gold target inside the sensor frame, then capture.</p><strong role="status" aria-live="polite" aria-atomic="true"></strong>';host.append(feedback);
  const shutter=document.createElement('div');shutter.className='target-camera-shutter';shutter.setAttribute('aria-hidden','true');host.append(shutter);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let flashAnimation=null;
  const cancelFlash=()=>{flashAnimation?.cancel();flashAnimation=null;};reduced.addEventListener('change',cancelFlash);
  reveal.innerHTML='<h2>Image captured</h2><canvas width="320" height="320" role="img" aria-label="Captured illustrative terrain preview"></canvas><p class="capture-meta"></p><p>Simulated terrain · not real satellite imagery</p>';
  let current=null,active=false,lastCapture=null;
  const redraw=()=>{
    if(!current)return;
    const {aim,point,plan,readiness,state}=current;
    const frame=state.captured?state.captureFrame:cameraFrame(aim,point.geodetic.altM/1000,plan.metrics.swathKm);
    const rect=host.getBoundingClientRect();canvas.width=Math.max(1,Math.round(rect.width));canvas.height=Math.max(1,Math.round(rect.height));
    const c=canvas.getContext('2d');
    if(frame)paint(canvas,map,frame,!state.captured,readiness.ready);
    else{c.fillStyle='#112c37';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#c3d8df';c.font='14px Arial';c.textAlign='center';c.fillText('Preview unavailable for this older capture',canvas.width/2,canvas.height/2);c.textAlign='start';}
    feedback.dataset.ready=String(readiness.ready||state.status==='COMPLETE');
    feedback.querySelector('p').textContent=state.captured?'Captured image · saved framing': 'Fit the gold target inside the sensor frame, then capture.';
    const message=state.status==='COMPLETE'?'✓ Image delivered':readiness.reason;
    const label=feedback.querySelector('strong');if(label.textContent!==message)label.textContent=message;
    c.fillStyle='#08151cdd';c.fillRect(0,0,canvas.width,32);c.fillStyle='#d9e9ed';c.font='12px Arial';
    c.fillText(state.status==='COMPLETE'?'MISSION COMPLETE · IMAGE DELIVERED':state.captured?'CAPTURED IMAGE · READY FOR DOWNLINK':aim.available?'TARGET CAMERA · click to aim':'TARGET OUTSIDE CAPTURE WINDOW',12,21);
    c.fillText('SIMULATED TERRAIN',12,canvas.height-12);
  };
  canvas.onpointerdown=event=>{if(!current||current.state.captured||current.state.status!=='IN_ORBIT')return;const r=canvas.getBoundingClientRect(),side=Math.min(r.width,r.height),{aim,point,plan}=current,alt=point.geodetic.altM/1000,rad=Math.PI/180;const dx=(event.clientX-r.left-r.width/2)/side*plan.metrics.swathKm,dy=-(event.clientY-r.top-r.height/2)/side*plan.metrics.swathKm;onAim(Math.atan(Math.tan(aim.xDeg*rad)+dx/alt)/rad,Math.atan(Math.tan(aim.yDeg*rad)+dy/alt)/rad);};
  canvas.onkeydown=event=>{const directions={ArrowLeft:[-.2,0],ArrowRight:[.2,0],ArrowUp:[0,.2],ArrowDown:[0,-.2]};if(!current||!directions[event.key]||current.state.captured||current.state.status!=='IN_ORBIT')return;event.preventDefault();const [x,y]=directions[event.key];onAim(current.aim.xDeg+x,current.aim.yDeg+y);};
  const observer=new ResizeObserver(()=>{if(active)redraw();});observer.observe(host);
  return {reveal,flash(){cancelFlash();if(active&&!reduced.matches)flashAnimation=shutter.animate([{opacity:.16},{opacity:0}],{duration:180,easing:"ease-out"});},active(value){active=value;canvas.hidden=!value;feedback.hidden=!value;if(!value)cancelFlash();host.dataset.instrument=String(value);if(value)redraw();},update(aim,point,plan,state,readiness={ready:false,reason:"Align the target"}){current={aim,point,plan,state,readiness};if(active)redraw();reveal.hidden=!state.captured;if(!state.captured){lastCapture=null;return;}const key=JSON.stringify([state.captureTime,state.captureFrame]);if(key===lastCapture)return;lastCapture=key;const image=reveal.querySelector('canvas');image.hidden=!state.captureFrame;if(state.captureFrame)paint(image,map,state.captureFrame,false);reveal.querySelector('.capture-meta').textContent=`${state.captureGsdM?.toFixed(2)??'—'} m GSD · quality ${state.captureScore??'—'}/100 · ${state.captureAimMode==='auto'?'assisted':'manual'}${state.captureFrame?'':' · Preview unavailable for this older capture'}`;},dispose(){cancelFlash();reduced.removeEventListener("change",cancelFlash);observer.disconnect();canvas.remove();feedback.remove();shutter.remove();reveal.remove();delete host.dataset.instrument;}};
}
