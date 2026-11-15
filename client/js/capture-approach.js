const seconds=n=>{n=Math.max(0,Math.ceil(n));return n>=3600?`${Math.floor(n/3600)} h ${Math.floor(n/60)%60} min`:`${Math.floor(n/60)} min ${n%60} s`;};
// Only actual predicted imaging windows belong here, never request-open times.
export function captureApproach({active,captured,ready,available,reason,nextTime,now,remainingSec=0,distanceKm=0}){
  if(!active||captured)return {phase:'idle',title:captured?'Image captured':'Flight stopped',detail:captured?'Send the image to Earth.':'',beat:0,progress:0};
  if(ready)return {phase:'ready',title:'Ready — capture now',detail:`${seconds(remainingSec)} left in this imaging window`,beat:650,progress:100};
  if(available){
    const aligning=reason==='Center the gold target inside the sensor frame';
    return {phase:aligning?'align':'blocked',title:aligning?'Target in range — aim now':reason,detail:aligning?`Center the gold target · ${seconds(remainingSec)} left`:'Capture is unavailable until this condition clears.',beat:aligning?1000:0,progress:100};
  }
  const eta=Number.isFinite(nextTime)&&nextTime>=now?nextTime-now:null;
  return {phase:eta!==null&&eta<=300?'near':'travel',title:eta===null?'No imaging window predicted':`Capture window in ${seconds(eta)}`,
    detail:`${Math.round(distanceKm).toLocaleString()} km to target · simulated time`,beat:eta!==null&&eta<=300?(eta<=60?650:1400):0,
    progress:eta===null?0:Math.max(0,Math.min(100,(1-eta/300)*100))};
}
