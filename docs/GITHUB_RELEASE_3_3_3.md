# Подготовка публикации 3.3.3 + Simulator v1.1 на GitHub

Этот архив содержит **исходники игры 3.3.3 и симулятор v1.1**. Это не `git`-репозиторий с историей; копируйте файлы в существующую рабочую копию репозитория. Не копируйте `node_modules`, `dist`, отчёты и приватные файлы.

## Публикация

```powershell
git status
# Сохраните свои локальные изменения, если они есть.
# Замените файлы содержимым этого архива в корне репозитория.
npm.cmd install
npm.cmd run build
npm.cmd test
npm.cmd run simulate -- --games 100 --players 4 --seed 42 --strategy mixed --out reports/smoke.json
git add .
git commit -m "release: stage 3.3.3 closed beta and simulator v1.1"
git push
```

Проверяйте `git diff --cached` перед `git commit`, чтобы не опубликовать локальные отчёты, секреты или `node_modules`. Папка `reports/` исключается через `.gitignore`.

## Безопасность тестовой панели

**В этой закрытой бете `DEBUG_TOOLS` включён по умолчанию и в GitHub-версии тоже.** Она предназначена для игры с доверенными друзьями. Для публичного сервера **обязательно** установить `DEBUG_TOOLS=0`. Доступ к панели и API debug ограничен хостом комнаты; тем не менее в публичных комнатах хостов нельзя считать доверенными.

## Simulator

Запуск `npm.cmd run simulate -- --games 1000 --players 4 --seed 42 --strategy aggressive --out reports/aggressive.json`. Отчёты не следует коммитить. Режим `campaign-smoke` намеренно меняет условия и не отражает баланс.
