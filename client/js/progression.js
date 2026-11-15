import { scenarios } from './data/scenarios.js';

export function missionUnlocked(save,id){
  const index=scenarios.findIndex(mission=>mission.id===id);
  return index>=0&&scenarios.slice(0,index).every(mission=>save?.missionProgress?.[mission.id]?.completed===true);
}
export function nextMission(save,id){
  const index=scenarios.findIndex(mission=>mission.id===id);
  const next=scenarios[index+1];
  return index>=0&&save?.missionProgress?.[id]?.completed===true&&next&&missionUnlocked(save,next.id)?next:null;
}
// A first successful replay can finish an unfinished contract. Subsequent
// completions never duplicate counts or award funds.
export function completeMission(save,{missionId,status,captured,deliveredMB,totalMB,completedAt,replay=false}){
  // Seasonal missions use their own deadline/weighted-coverage completion gate.
  if(missionId!=='urban')return save;
  if(!missionUnlocked(save,missionId)||status!=='COMPLETE'||!captured||!Number.isFinite(deliveredMB)||!Number.isFinite(totalMB)||totalMB<=0||deliveredMB<totalMB-1e-8)return save;
  if(save?.missionProgress?.[missionId]?.completed===true)return save;
  return {...save,player:{...save.player,stats:{...save.player?.stats,contractsCompleted:(save.player?.stats?.contractsCompleted||0)+1}},missionProgress:{...save.missionProgress,[missionId]:{...save.missionProgress?.[missionId],completed:true,completedAt,deliveredMB,completionSource:replay?'mission-replay':'campaign'}}};
}
