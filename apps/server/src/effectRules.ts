import type { CombatantSnapshot, StatusEffect } from '@samopalka/shared';
import type { FoeDefinition } from './foes.js';

/** Interprets only the first printed enemy action. Separate properties are handled explicitly. */
export type FoeAction = {
  strike: boolean;
  amount: number;
  allHeroes: boolean;
  scatter: boolean;
  poison: boolean;
  weakness: boolean;
  pain: boolean;
  paralysis: boolean;
  sleep: boolean;
  decay: boolean;
  selfHeal: boolean;
  dying: boolean;
};
export function printedFoeAction(def: FoeDefinition): FoeAction {
  const printed = /^\s*"([^"]+)"/.exec(def.description)?.[1] ?? '';
  // Multi-part sentences such as Чумной доктор contain a second ability after ';'.
  const parts = printed.split(';')[0]!.split(',').map(s => s.trim().toLocaleLowerCase('ru-RU'));
  const numbers = [...printed.matchAll(/(?:^|[,\s])([0-9]+)(?=$|[,\s])/g)].map(m => Number(m[1]));
  const amount = numbers.at(-1) ?? 0;
  const has = (word: string) => parts.some(p => p === word.toLowerCase());
  const strike = has('удар');
  return {
    strike,
    amount: strike && Number.isInteger(amount) && amount > 0 ? amount : 0,
    allHeroes: has('все герои'), scatter: has('разброс'),
    poison: has('яд'), weakness: has('слабость'), pain: has('боль'),
    paralysis: has('паралич'), sleep: has('сон'), decay: has('гниение'),
    selfHeal: has('самолечение'), dying: has('издыхание')
  };
}

export function statusValue(entity: CombatantSnapshot, kind: StatusEffect['kind']): number {
  return (entity.effects ?? []).filter(e => e.kind === kind).reduce((sum,e) => sum + e.amount, 0);
}
export function addEffect(entity: CombatantSnapshot, kind: StatusEffect['kind'], amount: number, sourceId?:string) {
  if (amount <= 0) return;
  entity.effects ??= [];
  const previous = entity.effects.find(e => e.kind === kind);
  if (previous) previous.amount += amount;
  else entity.effects.push({kind,amount,...(sourceId?{sourceId}:{})});
}
export function clearEffect(entity: CombatantSnapshot, kind: StatusEffect['kind']) {
  entity.effects = (entity.effects??[]).filter(e=>e.kind!==kind);
}
export function consumeEffect(entity: CombatantSnapshot, kind: StatusEffect['kind'], amount=1): boolean {
  const current = (entity.effects??[]).find(e=>e.kind===kind);
  if (!current || current.amount <= 0) return false;
  current.amount -= amount;
  if(current.amount<=0) clearEffect(entity,kind);
  return true;
}
export function armorFor(def: FoeDefinition | undefined): number {
  const match = /Броня:\s*Получает на\s*(\d+)\s*урона?/iu.exec(def?.description??'');
  return match ? Number(match[1]) : 0;
}
export function hasFoeTrait(def: FoeDefinition | undefined, trait: string): boolean {
  return Boolean(def?.description.includes(trait));
}
