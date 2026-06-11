# Deploy runbook — zvezdnik

Production runs on a Yandex Cloud VM (Ubuntu 24.04) via `docker-compose.prod.yml`.
Single domain serves the frontend, the API (`/api`), and the Telegram bot webhook
(`/bot`) behind nginx + Let's Encrypt TLS.

- **Domain:** `zvezdnikbot.ru`
- **VM public IP:** `51.250.103.115`
- **App dir on VM:** `~/zvezdnik`
- **Compose:** always pass `--env-file .env.prod -f docker-compose.prod.yml`

`.env.prod` lives only on the VM (gitignored). Template: `.env.prod.example`.

---

## 0. Prerequisites (one-time, already done)

- VM provisioned, Docker + compose installed, UFW allows `22, 80, 443`.
- GitHub deploy key added; repo cloned to `~/zvezdnik`.
- `.env.prod` filled in. Domain-related keys must be:
  ```
  PROD_DOMAIN=zvezdnikbot.ru
  TELEGRAM_MINI_APP_URL=https://zvezdnikbot.ru
  WEBHOOK_BASE_URL=https://zvezdnikbot.ru
  ```

---

## 1. Wait for DNS delegation

A-records at reg.ru point `@` and `www` to `51.250.103.115`.
A freshly registered `.ru` domain takes 15 min – 2 h to delegate.

```bash
# Run on the VM until it returns ns1.reg.ru / ns2.reg.ru:
dig zvezdnikbot.ru NS +short

# Then confirm the A-record resolves to the VM:
dig zvezdnikbot.ru +short   # -> 51.250.103.115
```

Do not proceed to TLS until the A-record resolves — certbot validates over HTTP
on port 80 and will fail otherwise.

---

## 2. Issue the TLS certificate (Let's Encrypt)

The prod nginx config won't start without a cert, so obtain one first in
standalone mode (port 80 must be free — stop any local test stack first).

```bash
cd ~/zvezdnik

# Stop the local HTTP-only dry-run stack if it's still up (port 8081):
docker compose --env-file .env.prod -f docker-compose.prod.yml -f docker-compose.local.yml down

# Obtain the certificate:
docker run --rm -p 80:80 \
  -v /etc/letsencrypt:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d zvezdnikbot.ru \
  --email kukiz200501@gmail.com --agree-tos --no-eff-email
```

Result: `/etc/letsencrypt/live/zvezdnikbot.ru/{fullchain,privkey}.pem`.

> If you later add `www` as a real host, append `-d www.zvezdnikbot.ru`.

---

## 3. Bring up the full prod stack

```bash
cd ~/zvezdnik
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

All four services (`postgres`, `redis`, `app`, `web`) should be `healthy`/`running`.
nginx now listens on 80 (redirect → HTTPS) and 443 (frontend + `/api` + `/bot`).

---

## 4. Verify HTTPS

```bash
curl -I https://zvezdnikbot.ru/health         # -> HTTP/2 200
curl -I http://zvezdnikbot.ru/                 # -> 301 to https
```

Open `https://zvezdnikbot.ru` in a browser — valid padlock, frontend loads.
(Onboarding will still 401 in a plain browser; that's expected — see step 6.)

---

## 5. Configure @BotFather

- `/setmenubutton` → `@zvezdnik_bot` → URL `https://zvezdnikbot.ru` → button text (e.g. «Открыть»)
- `/setdomain`     → `@zvezdnik_bot` → `zvezdnikbot.ru`
- `/setuserpic`, `/setname`, `/setdescription`, `/setabouttext` — branding (optional)

---

## 6. Verify the bot webhook

`app` auto-registers the webhook on startup because `WEBHOOK_BASE_URL` is set.

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
# url should be https://zvezdnikbot.ru/bot/webhook, pending_update_count low, no last_error
```

---

## 7. End-to-end test in Telegram

Open `@zvezdnik_bot` → tap the menu button → complete onboarding → press «Готово».
With real Telegram `initData`, auth succeeds (no more 401). Walk Today / Longreads /
Вселенная / Профиль.

---

## 8. Post-launch hardening

```bash
# Close the local-test port:
sudo ufw delete allow 8081

# Certificate auto-renewal (Let's Encrypt certs last 90 days).
# Add a root cron entry — renews then reloads nginx in the running container:
sudo crontab -e
# 0 3 * * * docker run --rm -p 80:80 -v /etc/letsencrypt:/etc/letsencrypt certbot/certbot renew --standalone --quiet && docker compose --env-file /home/kirill/zvezdnik/.env.prod -f /home/kirill/zvezdnik/docker-compose.prod.yml exec web nginx -s reload
```

> Note: standalone renew needs port 80 free for a moment. Alternative: switch to the
> webroot method using the `certbot-www` volume already wired into the compose file
> (`location /.well-known/acme-challenge/` is served from `/var/www/certbot`).

### Docker log rotation
Add to `/etc/docker/daemon.json`, then `sudo systemctl restart docker`:
```json
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" } }
```

### Postgres backup (daily pg_dump)
```bash
sudo crontab -e
# 0 4 * * * docker compose --env-file /home/kirill/zvezdnik/.env.prod -f /home/kirill/zvezdnik/docker-compose.prod.yml exec -T postgres pg_dump -U zvezdnik zvezdnik | gzip > /home/kirill/backups/zvezdnik-$(date +\%F).sql.gz
mkdir -p /home/kirill/backups
```

---

## Updating after a code change

```bash
cd ~/zvezdnik
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f app
```

## Payments (Robokassa)

Recurring PRO subscription via Robokassa's native "Подписки": the first payment
carries `Recurring=true`, then Robokassa auto-charges monthly. Each charge hits
ResultURL and extends PRO 30 days (`ActivatePro`), idempotent per InvId.

In `.env.prod` (creds from the cabinet: "Мои магазины" → shop → "Технические настройки"):
```
ROBOKASSA_MERCHANT_LOGIN=zvezdnik
ROBOKASSA_PASSWORD1=<боевой #1>
ROBOKASSA_PASSWORD2=<боевой #2>
ROBOKASSA_TEST_PASSWORD1=<тестовый #1>
ROBOKASSA_TEST_PASSWORD2=<тестовый #2>
ROBOKASSA_IS_TEST=true        # flip to false for live
ROBOKASSA_HASH_ALGO=md5       # must match the cabinet
ROBOKASSA_FISCAL=true         # attach НПД receipt (tax "none")
```

In the cabinet set (method GET, hash MD5 — also for the test-payment block):
- Result URL → `https://zvezdnikbot.ru/payments/webhook`
- Success URL → `https://zvezdnikbot.ru/payment/success`
- Fail URL → `https://zvezdnikbot.ru/payment/fail`

Create the 199 ₽/month subscription plan under "Подписки" and confirm recurring
is enabled. Then `up -d --build app web` to apply.

## Common issues

- **certbot fails with "connection refused" / timeout** — DNS not resolving yet, or
  port 80 not free / not allowed in UFW. Re-check step 1 and stop other stacks.
- **nginx restart loop** — cert files missing at `/etc/letsencrypt/live/zvezdnikbot.ru/`.
  Re-run step 2.
- **Onboarding 401 in browser** — expected. The prod build has no fake-initData
  fallback; test inside Telegram (step 7).
- **Bot webhook last_error "SSL"** — cert not trusted/incomplete; ensure `fullchain.pem`
  (not just `cert.pem`) is referenced (it is, in `nginx/nginx.conf`).
</content>
</invoke>
