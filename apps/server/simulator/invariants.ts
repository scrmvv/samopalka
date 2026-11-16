import type { BattleSnapshot } from '@samopalka/shared';

export type Invariant = (state: BattleSnapshot) => string[];

/** Assertions run after EVERY engine transition. Add more after 3.4/3.5. */
export const invariants: Record<string, Invariant> = {
  uniqueIds(state) {
    const ids=state.combatants.map(c=>c.id);
    return ids.length===new Set(ids).size ? [] : ['Duplicate combatant IDs'];
  },
  stats(state) {
    return state.combatants.flatMap(c => {
      const issues:string[]=[];
      for (const field of ['hp','maxHp','shield','mana','maxMana'] as const) {
        if (!Number.isFinite(c[field]) || !Number.isInteger(c[field])) issues.push(`${c.id}: invalid ${field}=${c[field]}`);
      }
      if(c.maxHp<1 || c.hp<0 || c.hp>c.maxHp) issues.push(`${c.id}: HP out of bounds ${c.hp}/${c.maxHp}`);
      if(c.shield<0 || c.mana<0 || c.maxMana<0) issues.push(`${c.id}: negative resource`);
      if(c.alive !== (c.hp>0)) issues.push(`${c.id}: alive flag disagrees with HP`);
      for(const effect of c.effects??[]) if (!Number.isInteger(effect.amount) || effect.amount<=0) issues.push(`${c.id}: invalid effect ${effect.kind}`);
      return issues;
    });
  },
  phases(state) {
    const errors:string[]=[];
    if (state.floor<1 || state.floor>6) errors.push(`Floor outside 1..6: ${state.floor}`);
    if (state.round<1) errors.push(`Invalid round: ${state.round}`);
    if (state.phase==='choose' && !state.rolls) errors.push('Choose phase without rolls');
    if (state.phase==='target' && !state.pendingAction) errors.push('Target phase without action');
    if (state.phase==='finished' && !state.result) errors.push('Finished without result');
    if (state.phase==='rest' && state.floor===6) errors.push('Rest after sixth floor');
    if (state.phase==='finished' && state.deadlineAt!==null) errors.push('Finished with running timer');
    if (state.phase==='roll'||state.phase==='choose'||state.phase==='target') {
      if (!state.activePlayerId) errors.push('Active turn without player');
      if (state.deadlineAt===null) errors.push('Active turn without deadline');
    }
    const allIds=new Set(state.combatants.map(c=>c.id));
    for(const target of state.availableTargetIds) {
      const entity=state.combatants.find(c=>c.id===target);
      if(!allIds.has(target)||!entity?.alive) errors.push(`Invalid available target: ${target}`);
    }
    return errors;
  },
  artifactDraft(state){
    const issues:string[]=[];
    if(state.phase==='rest'){
      if(!state.campRest)issues.push('Rest without camp roll state');
      if(state.campRest?.completed===false && state.rewardDraft)issues.push('Artifact draft opened before all camp rolls');
      if(state.campRest?.completed && !state.rewardDraft)issues.push('Camp completed without artifact draft');
      if(state.rewardDraft){
        if(state.rewardDraft.playerId && !state.combatants.some(c=>c.id===state.rewardDraft!.playerId && c.kind==='hero'))issues.push('Reward picker is not a hero');
        if(!state.rewardDraft.completed && state.rewardDraft.offers.length!==4)issues.push(`Expected 4 artifact offers, got ${state.rewardDraft.offers.length}`);
        if(new Set(state.rewardDraft.offers.map(a=>a.id)).size!==state.rewardDraft.offers.length)issues.push('Duplicate offers');
        if(state.rewardDraft.offers.some(a=>a.tier!==state.floor))issues.push('Wrong artifact tier');
      }
    }
    for(const [id,items] of Object.entries(state.inventories??{})){
      if(new Set(items.map(a=>a.instanceId)).size!==items.length)issues.push(`${id}: duplicate artifact instance`);
      for(const a of items){
        if(a.faceIndex!==undefined&&(!Number.isInteger(a.faceIndex)||a.faceIndex<0||a.faceIndex>5))issues.push(`${id}: invalid artifact face index`);
        if(a.kind==='face'&&(!a.face||!Number.isInteger(a.face.value)||a.face.value<0))issues.push(`${id}: invalid replacement face`);
      }
    }
    return issues;
  },
  currentFloorEnemies(state) {
    if (state.phase==='finished' || state.phase==='rest') return [];
    return state.combatants.filter(c=>c.kind==='monster' && c.alive && !c.id.startsWith(`monster:${state.floor}:`))
      .map(c=>`Monster ${c.id} leaked from a different floor (current ${state.floor})`);
  },
};

export function checkInvariants(state:BattleSnapshot, extra: readonly Invariant[] = []): string[] {
  const failures: string[]=[];
  for(const [name,fn] of Object.entries(invariants)) for (const issue of fn(state)) failures.push(`${name}: ${issue}`);
  for (let i=0;i<extra.length;i++) for(const issue of extra[i]!(state)) failures.push(`extension${i}: ${issue}`);
  return failures;
}
