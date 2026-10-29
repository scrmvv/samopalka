import { randomBytes, randomUUID } from 'node:crypto';
import { HEROES, type HeroId, type PlayerPublic, type RoomSnapshot, type RoomStatus } from '@samopalka/shared';
import { BattleSession, BattleError } from './battle.js';
import { FOES } from './foes.js';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECONNECT_MS = 60_000;
const ROOM_LIMIT = 100;

type Participant = {
  id: string;
  token: string;
  nickname: string;
  heroId: HeroId | null;
  ready: boolean;
  socketId: string | null;
  disconnectedAt: number | null;
};
type Room = {
  code: string;
  name: string;
  maxPlayers: number;
  hostId: string;
  status: RoomStatus;
  players: Participant[];
  updatedAt: number;
  game?: BattleSession;
};

export class RoomError extends Error {}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private sockets = new Map<string, { code: string; id: string }>();
  constructor(private readonly notify: (code: string) => void = () => {}, private readonly clock: () => number = Date.now, private readonly onKick?: (socketId: string, reason: string) => void, private readonly debugEnabled = false) {}

  private code(): string {
    for (let tries = 0; tries < 100; tries++) {
      const bytes = randomBytes(6);
      const code = Array.from(bytes, byte => CHARS[byte % CHARS.length]).join('');
      if (!this.rooms.has(code)) return code;
    }
    throw new RoomError('Не удалось создать код комнаты. Попробуйте ещё раз.');
  }

  private nickname(raw: unknown): string {
    if (typeof raw !== 'string' || raw.trim().length < 2 || raw.trim().length > 20) {
      throw new RoomError('Никнейм должен содержать от 2 до 20 символов.');
    }
    return raw.trim();
  }

  private token(raw: unknown): string {
    if (typeof raw !== 'string' || !/^[\w-]{16,128}$/.test(raw)) {
      throw new RoomError('Ошибка сессии. Обновите страницу и попробуйте ещё раз.');
    }
    return raw;
  }

  private requireRoom(code: unknown): Room {
    if (typeof code !== 'string') throw new RoomError('Некорректный код комнаты.');
    const room = this.rooms.get(code.trim().toUpperCase());
    if (!room) throw new RoomError('Комната не найдена или уже закрыта.');
    return room;
  }

  private requireMember(socketId: string): { room: Room; player: Participant } {
    const connection = this.sockets.get(socketId);
    if (!connection) throw new RoomError('Сначала подключитесь к комнате.');
    const room = this.requireRoom(connection.code);
    const player = room.players.find(p => p.id === connection.id && p.socketId === socketId);
    if (!player) throw new RoomError('Сессия больше неактивна. Переподключитесь.');
    return { room, player };
  }

  private requireLobby(room: Room) {
    if (room.status !== 'lobby') throw new RoomError('Партия уже запущена.');
  }

  private requireHost(room: Room, player: Participant) {
    if (room.hostId !== player.id) throw new RoomError('Это действие доступно только хосту.');
  }

  private touch(room: Room) {
    room.updatedAt = this.clock();
    this.notify(room.code);
  }

  snapshot(code: string): RoomSnapshot | null {
    const r = this.rooms.get(code.toUpperCase());
    if (!r) return null;
    return {
      code: r.code, name: r.name, maxPlayers: r.maxPlayers, status: r.status,
      campaign: 'Путь проклятых', updatedAt: r.updatedAt,
      ...(r.game ? { game: r.game.snapshot() } : {}),
      ...(this.debugEnabled ? {debug: {foes: FOES.map(f=>({id:f.id,name:f.name,floor:f.floor,hp:f.hp,boss:f.boss}))}} : {}),
      players: r.players.map((p): PlayerPublic => ({
        id: p.id, nickname: p.nickname, heroId: p.heroId,
        ready: p.ready, connected: p.socketId !== null, isHost: p.id === r.hostId
      }))
    };
  }

  create(input: { nickname: unknown; name: unknown; maxPlayers: unknown; token: unknown }, socketId: string) {
    if (this.rooms.size >= ROOM_LIMIT) throw new RoomError('Достигнут предел открытых комнат.');
    const nickname = this.nickname(input.nickname);
    const token = this.token(input.token);
    const maxPlayers = Number(input.maxPlayers);
    if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 6) throw new RoomError('В комнате может быть от 2 до 6 игроков.');
    if (typeof input.name !== 'string' || input.name.trim().length < 3 || input.name.trim().length > 48) {
      throw new RoomError('Название комнаты должно содержать от 3 до 48 символов.');
    }
    const code = this.code();
    const id = randomUUID();
    const room: Room = {
      code, name: input.name.trim(), maxPlayers, hostId: id, status: 'lobby', updatedAt: this.clock(),
      players: [{ id, nickname, token, heroId: null, ready: false, socketId, disconnectedAt: null }]
    };
    this.rooms.set(code, room);
    this.sockets.set(socketId, { code, id });
    this.touch(room);
    return { code, playerId: id, oldSocketId: null as string | null };
  }

  join(input: { code: unknown; nickname: unknown; token: unknown }, socketId: string) {
    const room = this.requireRoom(input.code);
    const token = this.token(input.token);
    let player = room.players.find(p => p.token === token);
    let oldSocketId: string | null = null;
    if (player) {
      oldSocketId = player.socketId;
      if (oldSocketId) this.sockets.delete(oldSocketId);
      player.socketId = socketId;
      player.disconnectedAt = null;
      room.game?.reconnected(player.id);
    } else {
      this.requireLobby(room);
      if (room.players.length >= room.maxPlayers) throw new RoomError('В комнате нет свободных мест.');
      const nickname = this.nickname(input.nickname);
      if (room.players.some(p => p.nickname.toLowerCase() === nickname.toLowerCase())) {
        throw new RoomError('Этот никнейм уже занят в комнате.');
      }
      player = { id: randomUUID(), token, nickname, heroId: null, ready: false, socketId, disconnectedAt: null };
      room.players.push(player);
    }
    this.sockets.set(socketId, { code: room.code, id: player.id });
    this.touch(room);
    return { code: room.code, playerId: player.id, oldSocketId };
  }

  chooseHero(socketId: string, heroId: unknown) {
    const { room, player } = this.requireMember(socketId);
    this.requireLobby(room);
    if (typeof heroId !== 'string' || !HEROES.some(h => h.id === heroId)) throw new RoomError('Такой герой не найден.');
    player.heroId = heroId as HeroId;
    player.ready = false;
    this.touch(room);
    return room.code;
  }

  setReady(socketId: string, ready: unknown) {
    const { room, player } = this.requireMember(socketId);
    this.requireLobby(room);
    if (!player.heroId) throw new RoomError('Сначала выберите героя.');
    if (typeof ready !== 'boolean') throw new RoomError('Неверное значение готовности.');
    player.ready = ready;
    this.touch(room);
    return room.code;
  }

  settings(socketId: string, input: { name?: unknown; maxPlayers?: unknown }) {
    const { room, player } = this.requireMember(socketId);
    this.requireLobby(room);
    this.requireHost(room, player);
    if (input.name !== undefined) {
      if (typeof input.name !== 'string' || input.name.trim().length < 3 || input.name.trim().length > 48) {
        throw new RoomError('Название комнаты должно содержать от 3 до 48 символов.');
      }
      room.name = input.name.trim();
    }
    if (input.maxPlayers !== undefined) {
      const n = Number(input.maxPlayers);
      if (!Number.isInteger(n) || n < 2 || n > 6 || n < room.players.length) {
        throw new RoomError('Количество мест: от 2 до 6, не меньше числа участников.');
      }
      room.maxPlayers = n;
    }
    this.touch(room);
    return room.code;
  }

  start(socketId: string) {
    const { room, player } = this.requireMember(socketId);
    this.requireLobby(room);
    this.requireHost(room, player);
    if (room.players.length < 2) throw new RoomError('Для запуска нужны хотя бы два игрока.');
    if (room.players.some(p => !p.ready || !p.heroId || !p.socketId)) {
      throw new RoomError('Все игроки должны выбрать героя, быть в сети и нажать «Готов».');
    }
    room.status = 'started';
    room.game = new BattleSession(room.players.map(p => ({ id: p.id, heroId: p.heroId! })), this.clock);
    this.touch(room);
    return room.code;
  }

  /** Host can return a completed match to the same lobby without losing its room code. */
  replay(socketId: string) {
    const { room, player } = this.requireMember(socketId);
    this.requireHost(room, player);
    if (room.status !== 'started' || room.game?.snapshot().phase !== 'finished') {
      throw new RoomError('Новая партия доступна только после завершения текущей.');
    }
    // Keep participant identities, connections, hero picks and host. Reset readiness,
    // so no one is put into a new game without explicitly confirming again.
    room.status = 'lobby';
    room.game = undefined;
    for (const participant of room.players) participant.ready = false;
    this.touch(room);
    return room.code;
  }

  private battleMember(socketId: string) {
    const { room, player } = this.requireMember(socketId);
    if (room.status !== 'started' || !room.game) throw new RoomError('Сначала начните партию.');
    // The battle engine never trusts a player ID supplied by the browser.
    return { room, player, game: room.game };
  }

  rollDice(socketId: string) {
    const {room, player, game} = this.battleMember(socketId);
    try { game.roll(player.id, player.nickname); } catch (e) { if (e instanceof BattleError) throw new RoomError(e.message); throw e; }
    this.touch(room);
    return room.code;
  }
  selectDice(socketId: string, faceIndex: unknown) {
    const {room, player, game} = this.battleMember(socketId);
    try { game.choose(player.id, faceIndex, player.nickname); } catch (e) { if (e instanceof BattleError) throw new RoomError(e.message); throw e; }
    this.touch(room);
    return room.code;
  }
  cancelDiceChoice(socketId: string) {
    const {room,player,game} = this.battleMember(socketId);
    try { game.cancelChoice(player.id); } catch (e) { if (e instanceof BattleError) throw new RoomError(e.message); throw e; }
    this.touch(room);
    return room.code;
  }
  selectTarget(socketId: string, targetId: unknown) {
    const {room, player, game} = this.battleMember(socketId);
    try { game.target(player.id, targetId, player.nickname); } catch (e) { if (e instanceof BattleError) throw new RoomError(e.message); throw e; }
    this.touch(room);
    return room.code;
  }
  passTurn(socketId: string) {
    const {room, player, game} = this.battleMember(socketId);
    try { game.pass(player.id, player.nickname); } catch (e) { if (e instanceof BattleError) throw new RoomError(e.message); throw e; }
    this.touch(room);
    return room.code;
  }

  nextFloor(socketId: string) {
    const {room, player, game} = this.battleMember(socketId);
    this.requireHost(room, player);
    try { game.continueFloor(); } catch (e) { if (e instanceof BattleError) throw new RoomError(e.message); throw e; }
    this.touch(room);
    return room.code;
  }

  debugAction(socketId: string, operation: string, payload: unknown) {
    if(!this.debugEnabled)throw new RoomError('Отладочная панель отключена на сервере.');
    const {room,player,game}=this.battleMember(socketId);
    this.requireHost(room,player);
    try {
      switch(operation){
        case 'debug:stat': game.debugSetStat(payload);break;
        case 'debug:face': game.debugSetFace(payload);break;
        case 'debug:status': game.debugApplyStatus(payload);break;
        case 'debug:roll': game.debugSetRoll(payload);break;
        case 'debug:foe': game.debugReplaceFoe(payload);break;
        case 'debug:time': game.debugExtendTurn(payload);break;
        default:throw new RoomError('Неизвестная отладочная команда.');
      }
    } catch(e){if(e instanceof BattleError)throw new RoomError(e.message);throw e;}
    this.touch(room);
    return room.code;
  }

  getConnection(socketId: string) { return this.sockets.get(socketId) ?? null; }

  leave(socketId: string) {
    const { room, player } = this.requireMember(socketId);
    this.sockets.delete(socketId);
    this.remove(room, player);
    return room.code;
  }

  disconnect(socketId: string) {
    const key = this.sockets.get(socketId);
    if (!key) return null;
    this.sockets.delete(socketId);
    const room = this.rooms.get(key.code);
    const player = room?.players.find(p => p.id === key.id);
    if (!room || !player || player.socketId !== socketId) return null;
    player.socketId = null;
    player.disconnectedAt = this.clock();
    room.game?.disconnected(player.id);
    this.touch(room);
    return room.code;
  }

  private remove(room: Room, player: Participant) {
    if (player.socketId) this.sockets.delete(player.socketId);
    room.players = room.players.filter(p => p.id !== player.id);
    room.game?.remove(player.id, player.nickname);
    if (room.players.length === 0) {
      this.rooms.delete(room.code);
      this.notify(room.code);
      return;
    }
    if (room.hostId === player.id) {
      room.hostId = (room.players.find(p => p.socketId) ?? room.players[0]).id;
    }
    this.touch(room);
  }

  cleanupDisconnected() {
    for (const room of [...this.rooms.values()]) {
      if (room.game) {
        const before = room.game.snapshot().activePlayerId + ':' + room.game.snapshot().events.at(-1)?.id;
        const kicks = room.game.tick(
          id => Boolean(room.players.find(p => p.id === id)?.socketId),
          id => room.players.find(p => p.id === id)?.nickname ?? 'Игрок'
        );
        for (const id of kicks) {
          const player = room.players.find(p => p.id === id);
          if (player) {
            if (player.socketId) this.onKick?.(player.socketId, 'Два хода подряд пропущены.');
            this.remove(room, player);
          }
        }
        if (room.game.snapshot().activePlayerId + ':' + room.game.snapshot().events.at(-1)?.id !== before) this.touch(room);
      }
      for (const player of [...room.players]) {
        if (player.socketId === null && player.disconnectedAt !== null && this.clock() - player.disconnectedAt >= RECONNECT_MS) {
          this.remove(room, player);
        }
      }
    }
  }
}
