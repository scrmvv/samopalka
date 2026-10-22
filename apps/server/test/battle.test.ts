import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleSession, turnDurations } from '../src/battle.js';
import { RoomManager } from '../src/rooms.js';
import { HERO_DICE } from '@samopalka/shared';

function make() {
  let now = 1_000;
  let roll = 0;
  const session = new BattleSession([
    { id: 'host', heroId: 'warrior' },
    { id: 'guest', heroId: 'healer' }
  ], () => now, () => [5, 3][roll++ % 2]!);
  return { session, advance(ms: number) { now += ms; }, setNow(value: number) { now = value; } };
}

test('два кубика и выбор одной грани синхронизируются', () => {
  const { session } = make();
  assert.equal(session.snapshot().activePlayerId, 'host');
  assert.throws(() => session.choose('host', 0, 'Host'), /Сначала бросьте/);
  session.roll('host', 'Host');
  assert.deepEqual(session.snapshot().rolls, [5, 3]);
  assert.throws(() => session.roll('host', 'Host'), /уже брошены/);
  assert.throws(() => session.choose('host', 3, 'Host'), /один из двух/);
  session.choose('host', 0, 'Host');
  assert.equal(session.snapshot().activePlayerId, 'guest');
  assert.equal(session.snapshot().rolls, null);
  assert.ok(session.snapshot().events.some(e => e.text.includes('Удар 2')));
});

test('нельзя бросать или выбирать за другого игрока', () => {
  const { session } = make();
  assert.throws(() => session.roll('guest', 'Guest'), /другого игрока/);
  session.roll('host', 'Host');
  assert.throws(() => session.choose('guest', 1, 'Guest'), /другого игрока/);
});

test('после пропуска 60 секунд, затем 60 секунд и исключение', () => {
  const { session, advance } = make();
  advance(60_000);
  assert.deepEqual(session.tick(() => true, id => id), []);
  assert.equal(session.snapshot().activePlayerId, 'guest');
  session.pass('guest', 'Guest');
  assert.equal(session.snapshot().activePlayerId, 'host');
  assert.equal(session.snapshot().deadlineAt, 121_000);
  advance(60_000);
  assert.deepEqual(session.tick(() => true, id => id), ['host']);
});

test('активный отключившийся игрок получает 60 секунд, пока сохраняется место', () => {
  const { session, advance } = make();
  session.disconnected('host');
  assert.equal(session.snapshot().deadlineAt, 61_000);
  advance(60_000);
  assert.deepEqual(session.tick(id => id !== 'host', id => id), []);
  assert.equal(session.snapshot().missedTurns.host ?? 0, 0);
  session.pass('guest', 'Guest');
  assert.equal(session.snapshot().deadlineAt, 121_000);
  session.reconnected('host');
  session.roll('host', 'Host');
});

test('удаление активного участника не ломает очередь', () => {
  const { session } = make();
  session.remove('host', 'Host');
  assert.equal(session.snapshot().activePlayerId, 'guest');
  session.roll('guest', 'Guest');
  session.remove('guest', 'Guest');
  assert.equal(session.snapshot().phase, 'paused');
});

test('все герои содержат по шесть граней', () => {
  for (const [hero, dice] of Object.entries(HERO_DICE)) {
    assert.equal(dice.length, 6, hero);
    assert.ok(dice.every(face => face.label.length > 0));
  }
});

test('комната синхронизирует ход и исключает за два пропуска', () => {
  let now = 20_000;
  const notices: string[] = [];
  const kicked: string[] = [];
  const mgr = new RoomManager(code => notices.push(code), () => now, (sid: string) => kicked.push(sid));
  const { code } = mgr.create({ nickname:'Host', name:'Путь проклятых', maxPlayers:2, token:'host123456789012345' }, 'host');
  mgr.join({ nickname:'Guest', code, token:'guest12345678901234' }, 'guest');
  mgr.chooseHero('host', 'warrior'); mgr.chooseHero('guest','healer');
  mgr.setReady('host',true); mgr.setReady('guest',true); mgr.start('host');
  assert.equal(mgr.snapshot(code)?.game?.activePlayerId, mgr.snapshot(code)?.players[0]?.id);
  mgr.rollDice('host');
  assert.equal(mgr.snapshot(code)?.game?.phase, 'choose');
  mgr.selectDice('host',0);
  assert.equal(mgr.snapshot(code)?.game?.activePlayerId, mgr.snapshot(code)?.players[1]?.id);
  now+=60_000; mgr.cleanupDisconnected();
  mgr.passTurn('host');
  assert.equal(mgr.snapshot(code)?.game?.activePlayerId, mgr.snapshot(code)?.players[1]?.id);
  now+=60_000; mgr.cleanupDisconnected();
  assert.deepEqual(kicked,['guest']);
  assert.equal(mgr.snapshot(code)?.players.length,1);
  assert.ok(notices.length>0);
});


test('настройки длительности хода для тестов и обычной партии', () => {
  assert.deepEqual(turnDurations({}), { normalMs: 60_000, shortMs: 60_000 });
  assert.deepEqual(turnDurations({ TURN_SECONDS:'90', SHORT_TURN_SECONDS:'20' }), { normalMs: 90_000, shortMs: 20_000 });
  assert.deepEqual(turnDurations({ TURN_SECONDS:'-1', SHORT_TURN_SECONDS:'not-a-number' }), { normalMs: 60_000, shortMs: 60_000 });
});
