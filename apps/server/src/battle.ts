import { randomInt } from 'node:crypto';
import { HERO_DICE, type BattleSnapshot, type BattleEvent, type HeroId } from '@samopalka/shared';

export class BattleError extends Error {}

/** Testing defaults: 60 seconds for each turn. Override with TURN_SECONDS and SHORT_TURN_SECONDS for release (15/5). */
export function turnDurations(env: Record<string, string | undefined> = process.env) {
  const seconds = (key: string, fallback: number) => {
    const raw = env[key];
    if (raw === undefined || raw.trim() === '') return fallback;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 600 ? parsed : fallback;
  };
  return { normalMs: seconds('TURN_SECONDS', 60) * 1000, shortMs: seconds('SHORT_TURN_SECONDS', 60) * 1000 };
}


/** Stage 2 is a turn-and-dice engine. It intentionally NEVER applies combat effects. */
export class BattleSession {
  private playerIds: string[];
  private heroes: Map<string, HeroId>;
  private activeIndex = 0;
  private phase: BattleSnapshot['phase'] = 'roll';
  private deadlineAt: number | null = null;
  private dice: [number, number] | null = null;
  private events: BattleEvent[] = [];
  private consecutiveMisses = new Map<string, number>();
  private round = 1;
  private absent = new Set<string>();
  private eventId = 0;
  private readonly durations = turnDurations();

  constructor(players: { id: string; heroId: HeroId }[], private readonly now: () => number = Date.now, private readonly die: () => number = () => randomInt(1, 7)) {
    this.playerIds = players.map(p => p.id);
    this.heroes = new Map(players.map(p => [p.id, p.heroId]));
    this.deadlineAt = now() + this.durations.normalMs;
    this.log('Сражение начинается. Первый этаж.', 'system');
    this.log('Ход первого героя. Бросьте два кубика.', 'turn');
  }

  private log(text: string, kind: BattleEvent['kind'] = 'system') {
    this.events.push({ id: ++this.eventId, text, kind });
    if (this.events.length > 50) this.events.shift();
  }

  activePlayer() { return this.playerIds[this.activeIndex] ?? null; }
  private assertActive(playerId: string) {
    if (this.phase === 'paused') throw new BattleError('Сейчас партия ожидает игроков.');
    if (this.activePlayer() !== playerId) throw new BattleError('Сейчас ход другого игрока.');
    if (this.deadlineAt === null || this.now() >= this.deadlineAt) throw new BattleError('Время хода истекло.');
  }

  snapshot(): BattleSnapshot {
    return {
      floor: 1,
      round: this.round,
      activePlayerId: this.activePlayer(),
      phase: this.phase,
      deadlineAt: this.deadlineAt,
      serverTime: this.now(),
      rolls: this.dice ? [...this.dice] as [number, number] : null,
      events: [...this.events],
      missedTurns: Object.fromEntries(this.consecutiveMisses)
    };
  }

  roll(playerId: string, playerName: string) {
    this.assertActive(playerId);
    if (this.phase !== 'roll') throw new BattleError('Кубики уже брошены. Выберите результат.');
    const first = this.die();
    const second = this.die();
    if (![first, second].every(v => Number.isInteger(v) && v >= 1 && v <= 6)) throw new BattleError('Ошибка броска кубиков.');
    this.dice = [first, second];
    this.phase = 'choose';
    this.log(`${playerName} бросает два кубика: ${first} и ${second}.`, 'dice');
  }

  choose(playerId: string, index: unknown, playerName: string) {
    this.assertActive(playerId);
    if (this.phase !== 'choose' || !this.dice) throw new BattleError('Сначала бросьте кубики.');
    if (index !== 0 && index !== 1) throw new BattleError('Нужно выбрать один из двух кубиков.');
    const face = this.dice[index];
    const hero = this.heroes.get(playerId);
    const effect = hero ? HERO_DICE[hero][face - 1] : null;
    if (!effect) throw new BattleError('У героя отсутствует выбранная грань.');
    this.consecutiveMisses.set(playerId, 0);
    this.log(`${playerName} выбирает «${effect.label}» (грань ${face}).`, 'action');
    this.nextTurn();
  }

  pass(playerId: string, playerName: string) {
    this.assertActive(playerId);
    this.consecutiveMisses.set(playerId, 0);
    this.log(`${playerName} завершает ход без действия.`, 'system');
    this.nextTurn();
  }

  /** Call periodically on the server. Returns connected player IDs to kick after second consecutive missed turn. */
  tick(isConnected: (id: string) => boolean, nameOf: (id: string) => string): string[] {
    if (this.phase === 'paused' || this.deadlineAt === null || this.now() < this.deadlineAt) return [];
    const active = this.activePlayer();
    if (!active) return [];
    const online = isConnected(active);
    const misses = online ? (this.consecutiveMisses.get(active) ?? 0) + 1 : (this.consecutiveMisses.get(active) ?? 0);
    if (online) this.consecutiveMisses.set(active, misses);
    this.log(`${nameOf(active)}: время вышло, ход пропущен.`, 'timeout');
    this.nextTurn();
    return online && misses >= 2 ? [active] : [];
  }

  disconnected(playerId: string) {
    this.absent.add(playerId);
    if (this.activePlayer() === playerId && this.deadlineAt !== null) {
      this.deadlineAt = Math.min(this.deadlineAt, this.now() + this.durations.shortMs);
    }
  }

  reconnected(playerId: string) { this.absent.delete(playerId); }

  /** Keep the turn position stable when someone leaves the party. */
  remove(playerId: string, label: string) {
    const idx = this.playerIds.indexOf(playerId);
    if (idx === -1) return;
    const wasActive = idx === this.activeIndex;
    this.playerIds.splice(idx, 1);
    this.heroes.delete(playerId);
    this.absent.delete(playerId);
    this.consecutiveMisses.delete(playerId);
    this.log(`${label} покидает отряд.`, 'system');
    if (this.playerIds.length === 0) {
      this.activeIndex = 0;
      this.phase = 'paused';
      this.deadlineAt = null;
      this.dice = null;
      return;
    }
    if (idx < this.activeIndex) this.activeIndex--;
    if (this.activeIndex >= this.playerIds.length) this.activeIndex = 0;
    if (wasActive) this.prepareTurn();
  }

  private nextTurn() {
    if (!this.playerIds.length) return;
    this.activeIndex = (this.activeIndex + 1) % this.playerIds.length;
    if (this.activeIndex === 0) this.round++;
    this.prepareTurn();
  }

  private prepareTurn() {
    this.phase = 'roll';
    this.dice = null;
    const active = this.activePlayer();
    if (!active) { this.phase = 'paused'; this.deadlineAt = null; return; }
    const missed = this.consecutiveMisses.get(active) ?? 0;
    this.deadlineAt = this.now() + (missed > 0 || this.absent.has(active) ? this.durations.shortMs : this.durations.normalMs);
    this.log(`Следующий ход (${(missed > 0 || this.absent.has(active) ? this.durations.shortMs : this.durations.normalMs) / 1000} сек.).`, 'turn');
  }
}
