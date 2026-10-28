import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomError, RoomManager } from '../src/rooms.js';

const host = { nickname: 'Host', name: 'Путь проклятых', maxPlayers: 3, token: 'a1234567890123456' };
const guest = { nickname: 'Guest', token: 'b1234567890123456' };

function make() {
  let now = 10_000;
  const notifications: string[] = [];
  const manager = new RoomManager(code => notifications.push(code), () => now);
  return { manager, notifications, advance: (ms: number) => { now += ms; manager.cleanupDisconnected(); } };
}

test('комната: создание, 2 игрока, выбор героев, готовность, запуск', () => {
  const { manager } = make();
  const { code, playerId } = manager.create(host, 'socket-host');
  assert.equal(code.length, 6);
  assert.equal(manager.snapshot(code)?.players.length, 1);
  const joined = manager.join({ ...guest, code }, 'socket-guest');
  assert.equal(manager.snapshot(code)?.players.length, 2);
  assert.throws(() => manager.start('socket-host'), RoomError);
  manager.chooseHero('socket-host', 'warrior');
  manager.chooseHero('socket-guest', 'warrior');
  assert.equal(manager.snapshot(code)?.players[1]?.heroId, 'warrior');
  manager.chooseHero('socket-guest', 'knight');
  manager.setReady('socket-host', true);
  manager.setReady('socket-guest', true);
  assert.equal(manager.snapshot(code)?.players.find(p => p.id === playerId)?.ready, true);
  manager.start('socket-host');
  assert.equal(manager.snapshot(code)?.status, 'started');
  assert.throws(() => manager.join({ code, nickname: 'Third', token: 'c1234567890123456' }, 'socket-three'), /запущена/);
  assert.equal(joined.code, code);
});

test('смена героя сбрасывает готовность, редактирование только хостом', () => {
  const { manager } = make();
  const { code } = manager.create(host, 'h');
  manager.join({ ...guest, code }, 'g');
  manager.chooseHero('h', 'warrior');
  manager.setReady('h', true);
  manager.chooseHero('h', 'healer');
  assert.equal(manager.snapshot(code)?.players[0]?.ready, false);
  assert.throws(() => manager.settings('g', { maxPlayers: 2 }), /хосту/);
  manager.settings('h', { maxPlayers: 2, name: 'Новое подземелье' });
  assert.equal(manager.snapshot(code)?.name, 'Новое подземелье');
  assert.equal(manager.snapshot(code)?.maxPlayers, 2);
  assert.throws(() => manager.join({ code, nickname: 'Third', token: 'c1234567890123456' }, 'third'), /свободных мест/);
});

test('переподключение до 60 секунд и игнор старого сокета', () => {
  const { manager, advance } = make();
  const { code, playerId } = manager.create(host, 'old');
  manager.chooseHero('old', 'archer');
  manager.disconnect('old');
  advance(59_000);
  const res = manager.join({ code, token: host.token, nickname: 'Other' }, 'new');
  assert.equal(res.playerId, playerId);
  assert.equal(manager.snapshot(code)?.players.length, 1);
  assert.equal(manager.snapshot(code)?.players[0]?.heroId, 'archer');
  assert.equal(manager.snapshot(code)?.players[0]?.nickname, 'Host');
  manager.disconnect('old');
  advance(60_000);
  assert.equal(manager.snapshot(code)?.players[0]?.connected, true);
});

test('через 60 секунд отключившийся игрок удаляется, хост меняется', () => {
  const { manager, advance } = make();
  const { code } = manager.create(host, 'host');
  manager.join({ ...guest, code }, 'guest');
  manager.disconnect('host');
  advance(59_999);
  assert.equal(manager.snapshot(code)?.players.length, 2);
  advance(1);
  assert.equal(manager.snapshot(code)?.players.length, 1);
  assert.equal(manager.snapshot(code)?.players[0]?.isHost, true);
  manager.leave('guest');
  assert.equal(manager.snapshot(code), null);
});

test('валидация и запрет дублирования имени', () => {
  const { manager } = make();
  assert.throws(() => manager.create({ ...host, nickname: 'a' }, 'bad'), /Никнейм/);
  const { code } = manager.create(host, 'host');
  assert.throws(() => manager.join({ code, nickname: 'host', token: 'd1234567890123456' }, 'dupe'), /занят/);
  assert.throws(() => manager.chooseHero('host', 'fake'), /не найден/);
  assert.throws(() => manager.setReady('host', true), /выберите героя/);
});

test('можно выбирать одинаковый класс персонажа и начать партию',()=>{
  const {manager}=make();
  const {code}=manager.create(host,'h');
  manager.join({...guest,code},'g');
  manager.chooseHero('h','warrior');manager.chooseHero('g','warrior');
  manager.setReady('h',true);manager.setReady('g',true);
  manager.start('h');
  assert.equal(manager.snapshot(code)?.game?.combatants.filter(c=>c.kind==='hero').length,2);
});

test('можно покинуть комнату даже после истечения таймера',()=>{
  const {manager,advance}=make();
  const {code}=manager.create(host,'h');
  manager.join({...guest,code},'g');
  manager.chooseHero('h','warrior');manager.chooseHero('g','healer');
  manager.setReady('h',true);manager.setReady('g',true);
  manager.start('h');
  advance(60_100);
  manager.leave('h');
  assert.equal(manager.snapshot(code)?.players.length,1);
});
