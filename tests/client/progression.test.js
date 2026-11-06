import {describe,it,expect} from 'vitest';
import {missionUnlocked,nextMission,completeMission} from '../../client/js/progression.js';
const complete={missionId:'urban',status:'COMPLETE',captured:true,deliveredMB:48,totalMB:48,completedAt:'2026-11-07T02:00:00Z'};
describe('campaign progression',()=>{
  it('unlocks in order and never unlocks from capture or partial delivery',()=>{
    const save={player:{credits:84250}};
    expect(missionUnlocked(save,'urban')).toBe(true);
    expect(missionUnlocked(save,'agriculture')).toBe(false);
    expect(completeMission(save,{...complete,status:'IN_ORBIT'})).toBe(save);
    expect(completeMission(save,{...complete,deliveredMB:47})).toBe(save);
    expect(missionUnlocked(save,'missing')).toBe(false);
  });
  it('records the first successful replay once and preserves finances and the original flight',()=>{
    const save={player:{credits:84250,stats:{launches:1}},orbitalFlight:{state:{status:'POWER_LOSS'}}};
    const result=completeMission(save,{...complete,replay:true});
    expect(result.player.credits).toBe(84250);
    expect(result.player.stats).toMatchObject({launches:1,contractsCompleted:1});
    expect(result.orbitalFlight).toEqual(save.orbitalFlight);
    expect(save.missionProgress).toBeUndefined();
    expect(nextMission(result,'urban').id).toBe('agriculture');
    expect(missionUnlocked(result,'disaster')).toBe(false);
    expect(completeMission(result,complete)).toBe(result);
  });
});
