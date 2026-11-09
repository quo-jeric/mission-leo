// Natural Earth v5.1.2, 1:10 million land polygons. Geographic coastline map,
// not 10-metre data, elevation, buildings, or photographic imagery.
let polygons=null,pending=null,failed=false;
export function loadEarthSurface(){
  if(!pending)pending=fetch('/assets/maps/land-10m.json').then(r=>{if(!r.ok)throw Error('Coastline map unavailable');return r.json();}).then(data=>{
    polygons=data.map(rings=>{
      let west=180,east=-180,south=90,north=-90;
      for(const [lon,lat] of rings[0]){west=Math.min(west,lon);east=Math.max(east,lon);south=Math.min(south,lat);north=Math.max(north,lat);}
      const path=new Path2D();
      for(const ring of rings){ring.forEach(([lon,lat],i)=>i?path.lineTo(lon,lat):path.moveTo(lon,lat));path.closePath();}
      return {path,west,east,south,north};
    });return true;
  }).catch(error=>{failed=true;throw error;});
  return pending;
}
export function offsetSurface(lat,lon,eastKm,northKm){
  const distance=Math.hypot(eastKm,northKm)/6371, bearing=Math.atan2(eastKm,northKm),rad=Math.PI/180;
  const phi=lat*rad,lambda=lon*rad;
  const p=Math.asin(Math.sin(phi)*Math.cos(distance)+Math.cos(phi)*Math.sin(distance)*Math.cos(bearing));
  const l=lambda+Math.atan2(Math.sin(bearing)*Math.sin(distance)*Math.cos(phi),Math.cos(distance)-Math.sin(phi)*Math.sin(p));
  return {latDeg:p/rad,lonDeg:((l/rad+540)%360)-180};
}
export function drawEarthSurface(canvas,center,swathKm){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  c.fillStyle='#153e60';c.fillRect(0,0,w,h);
  if(!polygons){c.fillStyle='#d6e8ed';c.font='14px Arial';c.fillText(failed?'Geographic map unavailable — no terrain inferred':'Loading geographic coastline map…',16,60);return false;}
  const kmPerDeg=111.195,cos=Math.max(.02,Math.cos(center.latDeg*Math.PI/180));
  const scale=Math.min(w,h)/Math.max(1,swathKm), sx=kmPerDeg*cos*scale,sy=kmPerDeg*scale;
  const dx=w/(2*sx),dy=h/(2*sy);
  c.fillStyle='#64795a';
  for(const polygon of polygons){
    if(polygon.north<center.latDeg-dy||polygon.south>center.latDeg+dy)continue;
    for(const shift of [-360,0,360]){
      if(polygon.east+shift<center.lonDeg-dx||polygon.west+shift>center.lonDeg+dx)continue;
      c.save();c.translate(w/2+(shift-center.lonDeg)*sx,h/2+center.latDeg*sy);c.scale(sx,-sy);c.fill(polygon.path,'evenodd');c.restore();
    }
  }
  return true;
}
export function drawEarthAtlas(canvas){
  if(!polygons)return false;
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  c.fillStyle='#153e60';c.fillRect(0,0,w,h);c.fillStyle='#64795a';
  c.save();c.translate(w/2,h/2);c.scale(w/360,-h/180);for(const {path} of polygons)c.fill(path,'evenodd');c.restore();
  return true;
}
