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
};
export type Ack<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type CreateRoomData = { nickname: string; name: string; maxPlayers: number; token: string };
export type JoinRoomData = { nickname: string; code: string; token: string };
