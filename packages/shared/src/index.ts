export const HEROES = [
  { id: 'warrior', name: 'Воин', title: 'Стальной страж', hp: 11, symbol: '⚔', color: '#e9b77a', description: 'Сбалансированные атаки и защита.' },
  { id: 'berserker', name: 'Берсерк', title: 'Ярость битвы', hp: 8, symbol: '✦', color: '#e88a7d', description: 'Сильные удары ценой уязвимости.' },
  { id: 'knight', name: 'Рыцарь', title: 'Несокрушимый', hp: 12, symbol: '♜', color: '#9dbdd2', description: 'Щиты и стойкость в бою.' },
  { id: 'healer', name: 'Лекарь', title: 'Хранитель жизни', hp: 11, symbol: '✚', color: '#b6cea4', description: 'Лечение и поддержка команды.' },
  { id: 'adept', name: 'Адепт', title: 'Повелитель маны', hp: 9, symbol: '✧', color: '#c7a6e6', description: 'Управление маной и заклинаниями.' },
  { id: 'archer', name: 'Лучник', title: 'Меткий стрелок', hp: 9, symbol: '➶', color: '#94c5a7', description: 'Атаки на расстоянии.' }
] as const;

export type HeroId = typeof HEROES[number]['id'];
export type RoomStatus = 'lobby' | 'started';
export type PlayerPublic = {
  id: string;
  nickname: string;
  heroId: HeroId | null;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
};
export type RoomSnapshot = {
  code: string;
  name: string;
  maxPlayers: number;
  status: RoomStatus;
  campaign: string;
  players: PlayerPublic[];
  updatedAt: number;
  game?: BattleSnapshot;
};
export type Ack<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type CreateRoomData = { nickname: string; name: string; maxPlayers: number; token: string };
export type JoinRoomData = { nickname: string; code: string; token: string };

// Dice faces transcribed from the printed hero cards. They are display-only in stage 2.
export type DiceFace = { kind: 'strike' | 'shield' | 'heal' | 'mana' | 'empty' | 'special'; value: number; label: string; note?: string };
const face = (kind: DiceFace['kind'], value: number, label: string, note?: string): DiceFace => ({ kind, value, label, ...(note ? { note } : {}) });
export const HERO_DICE: Record<HeroId, readonly DiceFace[]> = {
  warrior: [face('empty',0,'Пусто'),face('empty',0,'Пусто'),face('heal',2,'Лечение 2'),face('shield',2,'Щит 2'),face('strike',2,'Удар 2'),face('strike',2,'Удар 2')],
  berserker: [face('empty',0,'Пусто'),face('empty',0,'Пусто'),face('special',1,'Самооборот 1'),face('strike',1,'Удар 1'),face('strike',2,'Удар 2'),face('strike',4,'Удар 4')],
  knight: [face('empty',0,'Пусто'),face('special',1,'Самощит 1 + Насмешка'),face('special',2,'Самощит 2 + Насмешка'),face('shield',2,'Щит 2'),face('shield',3,'Щит 3'),face('strike',2,'Удар 2')],
  healer: [face('empty',0,'Пусто'),face('mana',1,'Мана 1'),face('mana',2,'Мана 2'),face('heal',3,'Лечение 3'),face('heal',3,'Лечение 3'),face('strike',2,'Удар 2')],
  adept: [face('empty',0,'Пусто'),face('empty',0,'Пусто'),face('mana',1,'Мана 1'),face('mana',2,'Мана 2'),face('mana',2,'Мана 2'),face('mana',3,'Мана 3')],
  archer: [face('empty',0,'Пусто'),face('empty',0,'Пусто'),face('heal',2,'Лечение 2'),face('strike',2,'Удар 2 + Дальность'),face('strike',2,'Удар 2 + Дальность'),face('strike',3,'Удар 3 + Дальность')]
};

export type BattleEvent = { id: number; kind: 'system' | 'turn' | 'dice' | 'action' | 'timeout'; text: string };
export type BattleSnapshot = {
  floor: number;
  round: number;
  activePlayerId: string | null;
  phase: 'roll' | 'choose' | 'paused';
  deadlineAt: number | null;
  serverTime: number;
  rolls: [number, number] | null;
  events: BattleEvent[];
  missedTurns: Record<string,number>;
};
