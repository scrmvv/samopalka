import express from 'express';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, type Socket } from 'socket.io';
import { RoomError, RoomManager } from './rooms.js';
import type { Ack } from '@samopalka/shared';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const app = express();
app.disable('x-powered-by');
const httpServer = createServer(app);
const io = new Server(httpServer, { transports: ['polling', 'websocket'], maxHttpBufferSize: 16_384 });
const manager = new RoomManager(code => {
  const room = manager.snapshot(code);
  if (room) io.to(code).emit('room:state', room);
  else io.to(code).emit('room:closed');
}, Date.now, (socketId, reason) => {
  const socket = io.sockets.sockets.get(socketId);
  if (socket) { socket.emit('room:kicked', reason); setTimeout(() => socket.disconnect(true), 150).unref(); }
});

app.get('/api/health', (_, res) => res.json({ ok: true, name: 'Самопалка', stage: '3.2' }));
app.get('/api/network', (_, res) => {
  const interfaces = Object.values(networkInterfaces()).flatMap(items => items ?? []);
  const addresses = [...new Set(interfaces.filter(ip => ip.family === 'IPv4' && !ip.internal).map(ip => ip.address))];
  res.json({ port: PORT, radmin: addresses.filter(ip => ip.startsWith('26.')), addresses });
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (existsSync(path.join(root, 'index.html'))) {
  app.use(express.static(root, { maxAge: '1h' }));
  app.get('/{*path}', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return res.status(404).end();
    res.sendFile(path.join(root, 'index.html'));
  });
} else {
  app.get('/', (_, res) => res.status(503).send('Клиент не собран. Запустите npm run build в корне проекта.'));
}

type Done = (response: Ack<any>) => void;
function handle<T>(callback: Done | undefined, action: () => T) {
  try {
    const data = action();
    if (typeof callback === 'function') callback({ ok: true, data });
  } catch (err) {
    const error = err instanceof RoomError ? err.message : 'Внутренняя ошибка сервера.';
    if (!(err instanceof RoomError)) console.error(err);
    if (typeof callback === 'function') callback({ ok: false, error });
  }
}

io.on('connection', (socket: Socket) => {
  socket.on('room:create', (input, ack: Done) => handle(ack, () => {
    if (manager.getConnection(socket.id)) throw new RoomError('Сначала покиньте текущую комнату.');
    const result = manager.create(input ?? {}, socket.id);
    socket.join(result.code);
    io.to(result.code).emit('room:state', manager.snapshot(result.code));
    return { playerId: result.playerId, room: manager.snapshot(result.code) };
  }));

  socket.on('room:join', (input, ack: Done) => handle(ack, () => {
    if (manager.getConnection(socket.id)) throw new RoomError('Сначала покиньте текущую комнату.');
    const result = manager.join(input ?? {}, socket.id);
    socket.join(result.code);
    if (result.oldSocketId && result.oldSocketId !== socket.id) {
      const old = io.sockets.sockets.get(result.oldSocketId);
      old?.emit('session:replaced');
      old?.disconnect(true);
    }
    io.to(result.code).emit('room:state', manager.snapshot(result.code));
    return { playerId: result.playerId, room: manager.snapshot(result.code) };
  }));

  socket.on('room:hero', (heroId, ack: Done) => handle(ack, () => {
    manager.chooseHero(socket.id, heroId);
    return true;
  }));
  socket.on('room:ready', (ready, ack: Done) => handle(ack, () => {
    manager.setReady(socket.id, ready);
    return true;
  }));
  socket.on('room:settings', (input, ack: Done) => handle(ack, () => {
    manager.settings(socket.id, input ?? {});
    return true;
  }));
  socket.on('room:start', (_input, ack: Done) => handle(ack, () => {
    manager.start(socket.id);
    return true;
  }));
  socket.on('game:roll', (_input, ack: Done) => handle(ack, () => manager.rollDice(socket.id)));
  socket.on('game:choose', (index, ack: Done) => handle(ack, () => manager.selectDice(socket.id, index)));
  socket.on('game:cancel-choice', (_input, ack: Done) => handle(ack, () => manager.cancelDiceChoice(socket.id)));
  socket.on('game:target', (targetId, ack: Done) => handle(ack, () => manager.selectTarget(socket.id, targetId)));
  socket.on('game:pass', (_input, ack: Done) => handle(ack, () => manager.passTurn(socket.id)));
  socket.on('game:next-floor', (_input, ack: Done) => handle(ack, () => manager.nextFloor(socket.id)));
  socket.on('room:leave', (_input, ack: Done) => handle(ack, () => {
    const connection = manager.getConnection(socket.id);
    if (!connection) throw new RoomError('Вы уже вышли из комнаты.');
    const roomCode = connection.code;
    manager.leave(socket.id);
    socket.leave(roomCode);
    return true;
  }));
  socket.on('disconnect', () => manager.disconnect(socket.id));
});

setInterval(() => manager.cleanupDisconnected(), 250).unref();
httpServer.listen(PORT, HOST, () => {
  console.log(`\n  САМОПАЛКА • игровой сервер\n  Сервер: http://localhost:${PORT}`);
  console.log(`  Слушает: ${HOST}:${PORT} (доступ по Radmin VPN при разрешённом брандмауэре)`);
  const ips = Object.values(networkInterfaces()).flatMap(items => items ?? []).filter(ip => ip.family === 'IPv4' && !ip.internal);
  ips.forEach(ip => console.log(`  Сеть: http://${ip.address}:${PORT}`));
  console.log('  Для остановки нажмите Ctrl+C.\n');
});
