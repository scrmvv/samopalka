# Как загрузить исправления заказчика в GitHub

База: текущий `scrmvv/samopalka`, ветка `main`, стадия `3.4.3-test` от 19.11.2026. **Это исправления поверх 3.4.3; отдельные заклинания из 3.4.4 здесь отсутствуют.**

## Вариант А — архив изменённых файлов

1. Скачайте `samopalka_343_feedback_CUSTOMER_PATCH.zip` и распакуйте его содержимое поверх **корня клонированного репозитория** с заменой файлов.
2. Откройте PowerShell в корне репозитория. Убедитесь, что вы на `main` и локальные изменения, если они были, сохранены отдельно (`git status`).
3. Выполните:

```powershell
git status
npm.cmd install
npm.cmd run build
npm.cmd test
git add -A
git commit -m "fix: customer feedback on 3.4.3"
git push origin main
```

## Вариант Б — Git-патч

Поместите файл `samopalka_343_feedback_git.patch` **рядом с папкой проекта** и откройте PowerShell в корне клонированного репозитория:

```powershell
git status
git apply --check ..\samopalka_343_feedback_git.patch
git apply ..\samopalka_343_feedback_git.patch
npm.cmd install
npm.cmd run build
npm.cmd test
git add -A
git commit -m "fix: customer feedback on 3.4.3"
git push origin main
```

Если `git apply --check` сообщает об ошибках, **не используйте `--force` и не перезаписывайте другие коммиты**. Сначала проверьте `git status`, текущую ветку и отличаются ли файлы от 3.4.3.

После публикации исходников обновление сайта на VPS нужно выполнять отдельно (пока остаётся версия, которая уже установлена там). Запущенная игра и её комнаты не сохраняются при перезапуске сервера.

Тестовый чек-лист: `docs/STAGE_3_4_3_CUSTOMER_FEEDBACK.md`.
