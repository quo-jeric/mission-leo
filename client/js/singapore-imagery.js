// Fixed, georeferenced historical mosaic. Pixel detail is independent of the
// simulated spacecraft's reported GSD; this is never a live imagery feed.
export const singaporeImagery = {
  id:'eox-s2cloudless-2016-singapore-v1',
  url:'/assets/maps/singapore-sentinel2-2016.jpg',
  west:103.55,east:103.99,south:1.08,north:1.52,
  width:4096,height:4096,approxPixelM:12,
};
let image=null,pending=null;
export function loadSingaporeImagery(){
  if(!pending)pending=new Promise((resolve,reject)=>{
    const candidate=new Image();candidate.onload=()=>{image=candidate;resolve(true);};
    candidate.onerror=()=>reject(Error('Singapore imagery unavailable'));
    candidate.src=singaporeImagery.url;
  });return pending;
}
export function imageryFootprint(center,swathKm,width,height){
  const degrees=swathKm/111.195,latHalf=degrees*height/Math.min(width,height)/2;
  const lonHalf=degrees*width/Math.min(width,height)/2/Math.max(.02,Math.cos(center.latDeg*Math.PI/180));
  return {west:center.lonDeg-lonHalf,east:center.lonDeg+lonHalf,south:center.latDeg-latHalf,north:center.latDeg+latHalf};
}
export function drawSingaporeImagery(canvas,center,swathKm){
  if(!image)return false;
  const b=imageryFootprint(center,swathKm,canvas.width,canvas.height),m=singaporeImagery;
  // Never stretch the regional image across places it does not cover.
  if(b.west<m.west||b.east>m.east||b.south<m.south||b.north>m.north)return false;
  const sx=(b.west-m.west)/(m.east-m.west)*image.width;
  const sy=(m.north-b.north)/(m.north-m.south)*image.height;
  const sw=(b.east-b.west)/(m.east-m.west)*image.width;
  const sh=(b.north-b.south)/(m.north-m.south)*image.height;
  canvas.getContext('2d').drawImage(image,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  return true;
}
