# Telegram Monitoring TMA

Централізований userbot/TMA застосунок за `DOCUMENTATION.md`: Bun + Hono API, Preact Mini App, Prisma/PostgreSQL, один mtcute userbot, admin-login через Bot API, persistent queue.

## Запуск локально

1. Скопіюйте `.env.example` у `.env` і заповніть `BOT_TOKEN`, `ADMIN_PHONE`, `ADMIN_TELEGRAM_ID`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`.
2. Підніміть PostgreSQL: `docker compose up postgres`.
   За замовчуванням контейнер публікує Postgres на `localhost:5433`, щоб не конфліктувати з локальною БД.
3. Встановіть залежності: `bun install`.
4. Підготуйте Prisma: `bunx prisma generate && bunx prisma db push`.
5. API: `bun run dev`.
6. Frontend dev server: `bun run dev:web`.

Для локального тесту без Telegram Mini App можна тимчасово поставити `ALLOW_DEV_AUTH=true` і `DEV_TELEGRAM_ID`.

## Авторизація центрального userbot-а

Після старту, якщо userbot не авторизований, основний бот напише адміну з `ADMIN_TELEGRAM_ID`. Адмін надсилає боту тільки команду:

```text
/login
```

Бот надішле одноразове посилання на admin login page. Код Telegram і 2FA пароль вводяться тільки на цій сторінці, не в Telegram чаті. Якщо код уже був надісланий у чат, Telegram може заблокувати цей login attempt; тоді потрібно запросити новий `/login`.

Сесія зберігається в `SystemState`, а TMA використовується тільки для конфігурації каналів, слів і цільового чату. Для продакшн-домену або тунелю вкажіть `PUBLIC_APP_URL`, щоб бот надсилав правильне HTTPS-посилання.

## Docker

```bash
docker compose up --build
```

Застосунок буде доступний на `http://localhost:3000`.

## Cloudflare Tunnel

1. У Cloudflare Zero Trust створіть tunnel і скопіюйте token для Docker connector.
2. У `.env` додайте:

```bash
CLOUDFLARE_TUNNEL_TOKEN="ваш-token"
```

3. У Public Hostname для tunnel вкажіть service URL:

```text
http://app:3000
```

4. Запустіть застосунок разом із тунелем:

```bash
docker compose --profile tunnel up -d --build
```

Перевірка логів тунелю:

```bash
docker compose logs -f cloudflared
```

## Перевірки

```bash
bun run typecheck
bun test
bun run build
```
