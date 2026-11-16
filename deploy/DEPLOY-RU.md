# Самопалка 3.4 — развёртывание на VPS с Amnezia

Проверено по исходникам: `DEBUG_TOOLS=1` включает тестовую панель, но сервер допускает изменения только для `hostId` соответствующей комнаты.
Важное ограничение: эта сборка — **3.4-test**, 97 поддерживаемых карт, а не полный набор артефактов.

## Шаг A — на Windows

Установи Node.js 22 или новее. Распакуй этот архив в отдельную папку.
В PowerShell из папки проекта:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\build-release.ps1
```

Скрипт выполнит `npm install`, `npm run build` и создаст `samopalka-release.zip` без исходников/.git и без node_modules.
Проверки проекта отдельно: `npm.cmd test` (желательно выполнить перед загрузкой).

## Шаг B — перенос сборки на VPS

Через WinSCP или SCP загрузи `samopalka-release.zip` в `/tmp/samopalka-release.zip`.

```powershell
scp .\samopalka-release.zip root@IP_НИДЕРЛАНДСКОГО_VPS:/tmp/samopalka-release.zip
```

## Шаг C — установка на Debian 12

Подключись по SSH и выполни:

```bash
sudo apt-get update && sudo apt-get install -y unzip
unzip -p /tmp/samopalka-release.zip deploy/install-vps.sh > /tmp/install-samopalka.sh
sudo bash /tmp/install-samopalka.sh /tmp/samopalka-release.zip
```

Скрипт установит Node.js 22 и Nginx, создаст пользователя `samopalka`,
установит продакшен-зависимости, настроит systemd и проксирование HTTP/WebSocket.
Он не перезапускает Docker и не меняет правила iptables или настройки Amnezia.
Скрипт откажется перезаписывать существующий `/opt/samopalka`.

## Проверка

```bash
systemctl is-active samopalka nginx docker
curl -sS http://127.0.0.1:3000/api/health
curl -sSI http://127.0.0.1/
sudo journalctl -u samopalka -n 50 --no-pager
sudo docker ps --filter name=amnezia-awg2
free -h
```

После запуска игра доступна по `http://ПУБЛИЧНЫЙ_IP/`.
Сразу после установки убедись, что Amnezia по-прежнему подключается с телефона.

## Важно

- Для закрытого тестирования включён `DEBUG_TOOLS=1`, права подтверждаются на стороне сервера.
- Публичный HTTP не шифрует игровой трафик и токены комнат; для постоянного внешнего доступа подключи домен и TLS/HTTPS.
- После перезапуска Node комнаты/партии пропадают: всё хранится в ОЗУ.
- Процесс ограничен до 160 МБ heap Node.js. Если наблюдаются OOM или swap thrashing, проверь нагрузку; возможно понадобится VPS с 1+ ГБ ОЗУ.
- Не публикуй долгоживущие коды комнат и ссылки приглашения, если тестирование должно быть закрытым.
