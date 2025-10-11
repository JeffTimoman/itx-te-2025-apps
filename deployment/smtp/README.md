Send-only Postfix Docker deployment

This folder contains a minimal send-only Postfix image suitable for sending
no-reply email from your application. It's intentionally minimal and focuses
on delivery (not receiving). For production it's recommended to use a trusted
SMTP relay (SendGrid, Mailgun, SES, Postfix on your mail host) and authenticate
with credentials.

Files
- Dockerfile — builds a Debian-based image with Postfix
- start.sh — entrypoint that configures Postfix at container start
- docker-compose.yml — example compose file (binds port 25 -> 2525 on localhost)
- .env.example — sample environment values

Usage
1. Copy `.env.example` to `.env` and set RELAY_HOST/RELAY_USER/RELAY_PASS if
   you have an authenticated relay. If you don't set RELAY_HOST the container
   will attempt direct delivery which may be rejected by some MX servers.

2. Build & run (from this directory):

   docker compose up --build -d

3. Your app can send mail to localhost:2525 (mapped to container port 25). Use
   `no-reply@${POSTFIX_MYDOMAIN}` as the sender for automated messages.

Notes & security
- Do NOT commit real credentials. Use environment variables or secret stores.
- For production deliverability, set up SPF, DKIM, and DMARC records for
  `${POSTFIX_MYDOMAIN}` and prefer an authenticated relay.
- The container binds the SMTP port to 127.0.0.1:2525 by default for safety.
