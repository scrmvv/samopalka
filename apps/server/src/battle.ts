import { randomInt } from 'node:crypto';
import { HEROES, HERO_DICE, type BattleSnapshot, type BattleEvent, type HeroId, type CombatantSnapshot, type PendingAction, type BattleVisual } from '@samopalka/shared';
import { FOES, type FoeDefinition } from './foes.js';

export class BattleError extends Error {}

export function turnDurations(env: Record<string, string | undefined> = process.env) {
  const seconds = (key: string, fallback: number) => {
    const raw = env[key];
    if (raw === undefined || raw.trim() === '') return fallback;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 600 ? parsed : fallback;
  };
  return { normalMs: seconds('TURN_SECONDS', 60) * 1000, shortMs: seconds('SHORT_TURN_SECONDS', 60) * 1000 };
}

/**
 * Stage 3.2. Full turn order (hero -> personal monster(s), next hero -> boss after
 * last hero), floor transitions and terminal results are server-authoritative.
 * Foe names/HP are from the supplied monster table. Complex printed effects and
 * artifact rewards are deferred; fallback basic attacks are labeled as DEMO.
 */
export class BattleSession {
  private playerIds: string[];
  private readonly originalPlayerCount: number;
  private heroes: Map<string, HeroId>;
  private combatants = new Map<string, CombatantSnapshot>();
  private foeDefinitions = new Map<string, FoeDefinition>();
  private activeIndex = 0;
  private phase: BattleSnapshot['phase'] = 'roll';
  private deadlineAt: number | null = null;
  private dice: [number, number] | null = null;
  private pendingAction: PendingAction | null = null;
  private events: BattleEvent[] = [];
  private consecutiveMisses = new Map<string, number>();
  private floor = 1;
  private round = 1;
  private absent = new Set<string>();
  private eventId = 0;
  private result: BattleSnapshot['result'] = null;
  private pendingMonsterTurn: string | null = null;
  private readonly enemyPauseMs = 500;
  private readonly durations = turnDurations();

  constructor(
    players: { id: string; heroId: HeroId }[],
    private readonly now: () => number = Date.now,
    private readonly die: () => number = () => randomInt(1, 7),
    private readonly pickIndex: (length: number) => number = length => randomInt(0, length)
  ) {
    this.playerIds = players.map(p => p.id);
    this.originalPlayerCount = players.length;
    this.heroes = new Map(players.map(p => [p.id, p.heroId]));
    for (const player of players) {
      const hero = HEROES.find(h => h.id === player.heroId);
      if (!hero) throw new BattleError('Неизвестный герой.');
      this.combatants.set(player.id, {
        id: player.id, kind: 'hero', ownerId: player.id, name: hero.name,
        hp: hero.hp, maxHp: hero.hp, shield: 0, mana: 0, maxMana: 3, alive: true
      });
    }
    this.setupEnemies();
    this.prepareTurn(true);
    this.log('Начало первого этажа. Каждый герой сражается со своим монстром; босс ходит после полного круга.', 'system');
  }

  private log(text: string, kind: BattleEvent['kind'] = 'system', visual?: BattleVisual) {
    this.events.push({ id: ++this.eventId, text, kind, ...(visual ? { visual } : {}) });
    if (this.events.length > 120) this.events.shift();
  }

  private drawFoe(pool: FoeDefinition[]): FoeDefinition {
    if (!pool.length) throw new BattleError(`Недостаточно карт противников для этажа ${this.floor}.`);
    const index = this.pickIndex(pool.length);
    if (!Number.isInteger(index) || index < 0 || index >= pool.length) throw new BattleError('Ошибка выбора противника.');
    return pool.splice(index, 1)[0]!;
  }

  private setupEnemies() {
    for (const [id, c] of [...this.combatants]) if (c.kind !== 'hero') this.combatants.delete(id);
    this.foeDefinitions.clear();
    const monsterDeck = FOES.filter(f=>f.floor===this.floor && !f.boss)
      .flatMap(f=>Array.from({length:f.count},()=>f));
    const bossDeck = FOES.filter(f=>f.floor===this.floor && f.boss);
    for (const playerId of this.playerIds) {
      const foe = this.drawFoe(monsterDeck);
      const id = `monster:${this.floor}:${playerId}`;
      this.foeDefinitions.set(id, foe);
      this.combatants.set(id, { id, kind: 'monster', ownerId: playerId, name: foe.name,
        hp: foe.hp, maxHp: foe.hp, shield: 0, mana: 0, maxMana: 0, alive: true });
    }
    const boss = this.drawFoe([...bossDeck]);
    this.foeDefinitions.set('boss', boss);
    this.combatants.set('boss', { id: 'boss', kind: 'boss', ownerId: null, name: boss.name,
      hp: boss.hp, maxHp: boss.hp, shield: 0, mana: 0, maxMana: 0, alive: true });
    this.log(`Этаж ${this.floor}: появился босс «${boss.name}» и монстры перед героями.`, 'system');
  }

  activePlayer() { return this.playerIds[this.activeIndex] ?? null; }
  private actor(id: string) { return this.combatants.get(id); }
  private livingHeroes() { return this.playerIds.filter(id => this.actor(id)?.alive); }
  private livingEnemies() { return [...this.combatants.values()].filter(c => c.kind !== 'hero' && c.alive); }
  private assertActive(playerId: string) {
    if (!['roll','choose','target'].includes(this.phase)) throw new BattleError('Сейчас нельзя выполнять ход.');
    if (this.activePlayer() !== playerId) throw new BattleError('Сейчас ход другого игрока.');
    if (!this.actor(playerId)?.alive) throw new BattleError('Выбывший герой не может ходить.');
    if (this.deadlineAt === null || this.now() >= this.deadlineAt) throw new BattleError('Время хода истекло.');
  }

  /** Neighbours are the nearest LIVING seats in the clockwise ring, even after deaths. */
  private neighboringIds(playerId: string): string[] {
    const alive = this.playerIds.filter(id => this.actor(id)?.alive);
    const index = alive.indexOf(playerId);
    if (index < 0 || alive.length < 2) return [];
    return [...new Set([alive[(index - 1 + alive.length) % alive.length]!, alive[(index + 1) % alive.length]!])];
  }

  private possibleTargets(playerId: string, action: PendingAction): string[] {
    if (!this.actor(playerId)?.alive) return [];
    if (['mana','empty','special'].includes(action.kind)) return [];
    const neighbors = this.neighboringIds(playerId);
    const heroes = [playerId, ...neighbors].filter(id => this.actor(id)?.alive);
    if (action.kind === 'heal' || action.kind === 'shield') return heroes;
    if (action.kind === 'strike') {
      const adjacent = [playerId, ...neighbors];
      const ownMonsters = [...this.combatants.values()].some(c => c.kind === 'monster' && c.alive && c.ownerId === playerId);
      const bossAlive = this.actor('boss')?.alive;
      // Once the boss is defeated and the acting hero has no personal monsters,
      // everyone else and every remaining monster become reachable.
      const longRange = !bossAlive && !ownMonsters;
      const foes = [...this.combatants.values()].filter(c => c.kind === 'monster' && c.alive && (longRange || (c.ownerId !== null && adjacent.includes(c.ownerId)))).map(c => c.id);
      const heroTargets = longRange ? this.livingHeroes().filter(id=>id!==playerId) : neighbors;
      const boss = !ownMonsters && bossAlive ? ['boss'] : [];
      return [...new Set([...foes, ...boss, ...heroTargets.filter(id => id !== playerId && this.actor(id)?.alive)])];
    }
    return [];
  }

  snapshot(): BattleSnapshot {
    return {
      floor: this.floor, round: this.round, activePlayerId: this.activePlayer(), phase: this.phase,
      deadlineAt: this.deadlineAt, serverTime: this.now(),
      rolls: this.dice ? [...this.dice] as [number, number] : null,
      events: [...this.events], missedTurns: Object.fromEntries(this.consecutiveMisses),
      combatants: [...this.combatants.values()].map(c => ({ ...c })),
      pendingAction: this.pendingAction ? { ...this.pendingAction } : null,
      availableTargetIds: this.phase === 'target' && this.activePlayer() && this.pendingAction
        ? this.possibleTargets(this.activePlayer()!, this.pendingAction) : [],
      result: this.result
    };
  }

  roll(playerId: string, playerName: string) {
    this.assertActive(playerId);
    if (this.phase !== 'roll') throw new BattleError('Кубики уже брошены. Выберите результат.');
    const first = this.die(), second = this.die();
    if (![first, second].every(v => Number.isInteger(v) && v >= 1 && v <= 6)) throw new BattleError('Ошибка броска кубиков.');
    this.dice = [first, second];
    this.phase = 'choose';
    this.log(`${playerName} бросает два кубика: ${first} и ${second}.`, 'dice');
  }

  choose(playerId: string, index: unknown, playerName: string) {
    this.assertActive(playerId);
    if (this.phase !== 'choose' || !this.dice) throw new BattleError('Сначала бросьте кубики.');
    if (index !== 0 && index !== 1) throw new BattleError('Нужно выбрать один из двух кубиков.');
    const faceNumber = this.dice[index];
    const hero = this.heroes.get(playerId);
    const effect = hero ? HERO_DICE[hero][faceNumber - 1] : null;
    if (!effect) throw new BattleError('У героя отсутствует выбранная грань.');
    this.log(`${playerName} выбирает «${effect.label}» (грань ${faceNumber}).`, 'action');
    const pending: PendingAction = { kind: effect.kind, value: effect.value, label: effect.label };
    this.pendingAction = pending;
    if (effect.kind === 'mana') {
      const target = this.actor(playerId)!;
      target.mana += effect.value;
      this.log(`${playerName} получает ${effect.value} маны (сейчас ${target.mana}).`, 'action', { type: 'mana', targetId: playerId });
      this.completeAction(playerId);
    } else if (effect.kind === 'empty') {
      this.log('Пустая грань: эффект отсутствует.', 'action');
      this.completeAction(playerId);
    } else if (effect.kind === 'special') {
      this.log(`Специальное слово «${effect.label}» пока ожидает реализацию в 3.3.`, 'system');
      this.completeAction(playerId);
    } else {
      this.phase = 'target';
      if (!this.possibleTargets(playerId, pending).length) {
        this.log('Нет доступных целей; действие завершено без эффекта.', 'system');
        this.completeAction(playerId);
      }
    }
  }

  /** Return to the already rolled pair without rerolling or resetting the timer. */
  cancelChoice(playerId: string) {
    this.assertActive(playerId);
    if (this.phase !== 'target' || !this.dice || !this.pendingAction) {
      throw new BattleError('Отменить можно только выбор цели до применения действия.');
    }
    this.phase = 'choose';
    this.pendingAction = null;
    this.log('Выбор грани отменён. Можно выбрать другой выпавший результат.', 'system');
  }

  /** Damage is the same calculation for all monsters, bosses and heroes. */
  private damage(target: CombatantSnapshot, amount: number, sourceName: string) {
    const absorbed = Math.min(target.shield, amount);
    const applied = Math.min(target.hp, Math.max(0, amount - absorbed));
    target.shield -= absorbed;
    target.hp -= applied;
    if (target.hp <= 0) { target.hp = 0; target.alive = false; }
    this.log(`${sourceName} → «${target.name}»: ${applied} урона${absorbed ? `, щит поглотил ${absorbed}` : ''}.`, 'action', { type: 'strike', targetId: target.id });
    if (!target.alive) {
      this.log(`${target.name} погибает.`, 'system');
      if (target.kind === 'hero') this.transferMonsters(target.id);
    }
  }

  private transferMonsters(playerId: string) {
    const idx = this.playerIds.indexOf(playerId);
    const clockwise = [...this.playerIds.slice(idx+1), ...this.playerIds.slice(0,idx)].find(id=>this.actor(id)?.alive);
    const other = clockwise ?? this.livingHeroes()[0];
    if (!other) return;
    for (const c of this.combatants.values()) {
      if (c.kind === 'monster' && c.alive && c.ownerId === playerId) {
        c.ownerId = other;
        this.log(`${c.name} переходит к следующему живому герою.`, 'system');
      }
    }
  }

  target(playerId: string, rawTargetId: unknown, playerName: string) {
    this.assertActive(playerId);
    if (this.phase !== 'target' || !this.pendingAction) throw new BattleError('Сначала выберите грань с действием.');
    if (typeof rawTargetId !== 'string' || !this.possibleTargets(playerId, this.pendingAction).includes(rawTargetId)) {
      throw new BattleError('Недопустимая цель для выбранного действия.');
    }
    const action = this.pendingAction;
    const target = this.actor(rawTargetId)!;
    if (action.kind === 'strike') {
      this.damage(target, action.value, playerName);
    } else if (action.kind === 'heal') {
      const recovered = Math.min(action.value, target.maxHp - target.hp);
      target.hp += recovered;
      this.log(`${playerName}: лечение «${target.name}» на ${recovered} здоровья.`, 'action', { type: 'heal', targetId: target.id });
    } else if (action.kind === 'shield') {
      target.shield += action.value;
      this.log(`${playerName}: «${target.name}» получает ${action.value} щита (всего ${target.shield}).`, 'action', { type: 'shield', targetId: target.id });
    } else throw new BattleError('Этот эффект не требует цели.');
    this.completeAction(playerId);
  }

  private checkTerminal(): boolean {
    const living = this.livingHeroes();
    if (living.length === 0) { this.finish('party_wiped', [], 'Все герои погибли. Партия окончена.'); return true; }
    if (this.originalPlayerCount >= 2 && living.length === 1) {
      this.finish('last_survivor', living, 'Остался последний выживший герой. Партия окончена.'); return true;
    }
    if (this.livingEnemies().length === 0) {
      if (this.floor === 6) this.finish('six_floors', living, 'Шестой этаж пройден! Победа отряда.');
      else { this.phase = 'rest'; this.deadlineAt = null; this.dice = null; this.pendingAction = null; this.pendingMonsterTurn = null; this.log(`Этаж ${this.floor} пройден. Начинается привал.`, 'system'); }
      return true;
    }
    return false;
  }

  private finish(reason: NonNullable<BattleSnapshot['result']>['reason'], winnerIds: string[], message: string) {
    this.result = { reason, winnerIds };
    this.phase = 'finished'; this.deadlineAt = null; this.dice = null; this.pendingAction = null; this.pendingMonsterTurn = null;
    this.log(message, 'system');
  }

  private attackByEnemy(enemy: CombatantSnapshot, target: CombatantSnapshot) {
    const rule = this.foeDefinitions.get(enemy.id);
    if (!rule || !enemy.alive || !target.alive) return;
    const demo = rule.simulated ? ' (упрощённая тестовая атака; особые эффекты — в 3.3)' : '';
    this.damage(target, rule.baseDamage, `${enemy.name}${demo}`);
  }

  private monsterPhase(playerId: string) {
    const target = this.actor(playerId);
    if (!target?.alive) return;
    const monsters = [...this.combatants.values()].filter(c => c.kind === 'monster' && c.alive && c.ownerId === playerId);
    for (const monster of monsters) {
      if (!target.alive) break;
      this.log(`Ход монстра «${monster.name}».`, 'turn', {type:'turn',targetId:monster.id});
      this.attackByEnemy(monster, target);
    }
  }

  private bossPhase() {
    const boss = this.actor('boss');
    const rule = this.foeDefinitions.get('boss');
    if (!boss?.alive || !rule) return;
    const candidates = this.livingHeroes();
    if (!candidates.length) return;
    this.log(`Ход босса «${boss.name}».`, 'turn', { type:'turn',targetId:'boss' });
    if (rule.allHeroes) {
      for (const id of candidates) {
        const target = this.actor(id);
        if (target?.alive) this.attackByEnemy(boss, target);
      }
      return;
    }
    const targetId = rule.description.includes('наименьшим')
      ? [...candidates].sort((a,b) => this.actor(a)!.hp-this.actor(b)!.hp)[0]!
      : rule.description.includes('наибольшим')
        ? [...candidates].sort((a,b) => this.actor(b)!.hp-this.actor(a)!.hp)[0]!
        : candidates[this.pickIndex(candidates.length)]!;
    this.attackByEnemy(boss, this.actor(targetId)!);
  }

  private completeAction(playerId: string, resetMisses = true) {
    if (resetMisses) this.consecutiveMisses.set(playerId, 0);
    const source = this.actor(playerId);
    if (source && source.mana > source.maxMana) {
      const overflow = source.mana - source.maxMana;
      source.mana = source.maxMana;
      this.log(`Избыточная мана (${overflow}) сброшена в конце хода.`, 'system');
    }
    this.pendingAction = null;
    if (this.checkTerminal()) return;
    // Short, server-controlled transition prevents simultaneous hero/enemy events
    // and leaves room for a visible hit/turn animation on every client.
    this.phase = 'enemy';
    this.pendingMonsterTurn = playerId;
    this.deadlineAt = this.now() + this.enemyPauseMs;

  }

  pass(playerId: string, playerName: string) {
    this.assertActive(playerId);
    this.log(`${playerName} завершает ход без действия.`, 'system');
    this.completeAction(playerId);
  }

  /** After a cleared floor: revives heroes and heals 2 + d6. Artifact rewards come in 3.4. */
  continueFloor() {
    if (this.phase !== 'rest') throw new BattleError('Следующий этаж пока недоступен.');
    if (this.floor >= 6) throw new BattleError('Шестой этаж уже пройден.');
    this.floor++;
    for (const id of this.playerIds) {
      const hero = this.actor(id);
      if (!hero) continue;
      const rolled = this.die();
      if (!Number.isInteger(rolled) || rolled < 1 || rolled > 6) throw new BattleError('Ошибка броска на привале.');
      const wasDead = !hero.alive;
      hero.alive = true;
      hero.hp = Math.min(hero.maxHp, hero.hp + 2 + rolled);
      this.log(`${hero.name}: ${wasDead?'возвращается в отряд, ':''}восстанавливает здоровье (2 + ${rolled}) → ${hero.hp}/${hero.maxHp}.`, 'system');
    }
    this.setupEnemies();
    this.pendingMonsterTurn = null;
    this.dice = null;
    this.pendingAction = null;
    this.round = 1;
    this.activeIndex = (this.activeIndex + 1) % this.playerIds.length;
    this.consecutiveMisses.clear();
    this.log('Артефакты и выбор наград будут добавлены в 3.4; пока переход проходит без них.', 'system');
    this.prepareTurn(true);
  }

  tick(isConnected: (id: string) => boolean, nameOf: (id: string) => string): string[] {
    if (this.phase === 'enemy') {
      if (this.deadlineAt === null || this.now() < this.deadlineAt) return [];
      const defender = this.pendingMonsterTurn;
      this.pendingMonsterTurn = null;
      if (defender) this.monsterPhase(defender);
      if (!this.checkTerminal()) this.advanceTurn();
      return [];
    }
    if (!['roll','choose','target'].includes(this.phase) || this.deadlineAt === null || this.now() < this.deadlineAt) return [];
    const active = this.activePlayer();
    if (!active) return [];
    const online = isConnected(active);
    const misses = online ? (this.consecutiveMisses.get(active) ?? 0) + 1 : (this.consecutiveMisses.get(active) ?? 0);
    if (online) this.consecutiveMisses.set(active, misses);
    this.pendingAction = null;
    this.log(`${nameOf(active)}: время вышло, ход пропущен.`, 'timeout');
    // Monster attacks still happen after a skipped hero turn.
    this.completeAction(active, false);
    return online && misses >= 2 ? [active] : [];
  }

  disconnected(playerId: string) {
    this.absent.add(playerId);
    if (this.activePlayer() === playerId && this.deadlineAt !== null) this.deadlineAt = Math.min(this.deadlineAt, this.now() + this.durations.shortMs);
  }
  reconnected(playerId: string) { this.absent.delete(playerId); }

  remove(playerId: string, label: string) {
    const idx = this.playerIds.indexOf(playerId);
    if (idx === -1) return;
    const wasActive = idx === this.activeIndex;
    // Leaving a party is different from death: those entities are removed.
    this.combatants.delete(playerId);
    // Remove the leaving player's current-floor monster(s), not obsolete IDs.
    for (const c of [...this.combatants.values()]) {
      if (c.kind === 'monster' && c.id === `monster:${this.floor}:${playerId}`) {
        this.combatants.delete(c.id);
        this.foeDefinitions.delete(c.id);
      }
    }
    for (const c of this.combatants.values()) {
      if (c.kind === 'monster' && c.ownerId === playerId) {
        c.ownerId = this.playerIds.find(id => id !== playerId && this.actor(id)?.alive) ?? null;
      }
    }
    this.playerIds.splice(idx, 1);
    this.heroes.delete(playerId);
    this.absent.delete(playerId);
    this.consecutiveMisses.delete(playerId);
    this.log(`${label} покидает отряд.`, 'system');
    if (!this.playerIds.length) {
      this.activeIndex = 0; this.phase = 'paused'; this.deadlineAt = null;
      this.dice = null; this.pendingAction = null; return;
    }
    if (idx < this.activeIndex) this.activeIndex--;
    if (this.activeIndex >= this.playerIds.length) this.activeIndex = 0;
    if (this.phase === 'finished' || this.phase === 'rest') return;
    if (this.phase === 'enemy') {
      // A player may leave (or be kicked) during the half-second response delay.
      // Resume from the next remaining participant instead of skipping a seat.
      if (wasActive) {
        this.pendingMonsterTurn = null;
        if (this.checkTerminal()) return;
        if (idx >= this.playerIds.length) {
          this.bossPhase();
          if (this.checkTerminal()) return;
          this.round++;
        }
        this.prepareTurn(true);
      }
      return;
    }
    if (this.checkTerminal()) return;
    if (wasActive) this.prepareTurn(true);
  }

  private advanceTurn() {
    if (!this.playerIds.length) return;
    // Boss acts once per full clockwise circuit, after the last player's monsters.
    let next = (this.activeIndex + 1) % this.playerIds.length;
    if (next === 0) {
      this.bossPhase();
      if (this.checkTerminal()) return;
      this.round++;
    }
    let safety = 0;
    while (!this.actor(this.playerIds[next]!)?.alive && safety++ < this.playerIds.length) {
      next = (next + 1) % this.playerIds.length;
      if (next === 0) {
        this.bossPhase();
        if (this.checkTerminal()) return;
        this.round++;
      }
    }
    this.activeIndex = next;
    this.prepareTurn();
  }

  private prepareTurn(first = false) {
    this.phase = 'roll'; this.dice = null; this.pendingAction = null;
    const active = this.activePlayer();
    if (!active || !this.actor(active)?.alive) { this.phase = 'paused'; this.deadlineAt = null; return; }
    const missed = this.consecutiveMisses.get(active) ?? 0;
    const ms = missed > 0 || this.absent.has(active) ? this.durations.shortMs : this.durations.normalMs;
    this.deadlineAt = this.now() + ms;
    this.log(first ? 'Первый ход этажа: бросьте два кубика.' : `Следующий ход (${ms / 1000} сек.).`, 'turn', {type:'turn',targetId:active});
  }
}
