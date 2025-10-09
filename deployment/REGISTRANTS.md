# Registrants feature — step-by-step Postgres implementation

This project includes a PostgreSQL-backed `registrants` table and a small admin API.
Below are clear, step-by-step instructions to configure, start, initialize, and verify Postgres for this app.

Files to know:
- `deployment/db/init.sql` — table DDL for `registrants` (creates the table only).
- `fast-tap-backend/.env.example` — recommended env variables (copy to `.env` and edit).
- `deployment/docker-compose.yml` — includes `postgres` and `backend` services; the backend reads `../fast-tap-backend/.env` by default.

API Endpoints (backend):
- GET  /admin/registrants         - list recent registrants (returns up to 1000 rows)
- POST /admin/registrants         - create new registrant (body: { name, email?, bureau? })
- PATCH /admin/registrants/:id    - update allowed fields (name, email, is_win, is_verified, is_send_email, bureau)

Security note
- The `/admin` endpoints are not protected by authentication in the current code. Run this behind a trusted network or add an API key/auth middleware before exposing publicly.

Step-by-step: local Docker Compose (recommended)
1. Prepare the backend env file
	- Copy the example file and edit values as needed:
	  ```bash
	  cp fast-tap-backend/.env.example fast-tap-backend/.env
	  # Edit fast-tap-backend/.env to change POSTGRES_* values if desired
	  ```

2. Start the stack
	```bash
	cd deployment
	docker compose up -d --build
	```

3. Watch logs to ensure Postgres initialized and backend connected
	```bash
	docker compose logs -f postgres backend
	```
	- On first start (when the `postgres-data` volume is empty), Docker's Postgres image will run any files in `/docker-entrypoint-initdb.d/` — we mount `deployment/db/init.sql` there so the `registrants` table is created automatically.
	- Look for messages like `Postgres pool connected` (backend) and normal Postgres startup messages.

4. Verify the backend sees the DB (HTTP checks)
	```bash
	# quick config check
	curl http://127.0.0.1:5000/api/config

	# list registrants (should be empty initially)
	curl http://127.0.0.1:5000/admin/registrants
	```

5. If Postgres already had an existing data volume
- If you already had a `postgres-data` volume from a previous run the `init.sql` will not be executed (Postgres runs init scripts only on first initialization). You have two options:
  - Run the DDL manually using psql (safe):
	 ```bash
	 # run inside the running postgres container
	 docker compose exec -T postgres psql -U ftuser -d fasttap -f /docker-entrypoint-initdb.d/init.sql
	 ```
  - Or, recreate the Postgres volume to let Docker run the init script automatically (this deletes existing DB data):
	 ```bash
	 docker compose down
	 docker volume rm itx-te-2025-apps_postgres-data
	 docker compose up -d
	 ```
	 Replace the volume name with the actual VOLUME name reported by `docker volume ls` if different.

6. Querying Postgres directly (optional)
	```bash
	# open a psql shell inside postgres container
	docker compose exec postgres psql -U ftuser -d fasttap

	# inside psql prompt
	\dt
	select * from registrants limit 10;
	```

7. Creating a registrant via HTTP
	```bash
	curl -X POST http://127.0.0.1:5000/admin/registrants \
	  -H "Content-Type: application/json" \
	  -d '{"name":"Alice","email":"alice@example.com","bureau":"Marketing"}'
	```

8. Updating a registrant
	```bash
	curl -X PATCH http://127.0.0.1:5000/admin/registrants/1 \
	  -H "Content-Type: application/json" \
	  -d '{"is_verified":"Y"}'
	```

Troubleshooting
- If backend logs show `Postgres connect failed` or `Postgres pool test failed`:
  - Confirm `fast-tap-backend/.env` has correct POSTGRES_* or POSTGRES_URL values.
  - Ensure `postgres` service is healthy: `docker compose ps` and `docker compose logs postgres`.
  - If the DB container crashed due to permissions or mount issues, inspect logs for errors and ensure the `postgres-data` volume is writable by the container.

Production notes
- Use a stronger password than the example `ftpassword` and keep credentials out of source control. Put them in environment variables or a secrets manager.
- Protect `/admin` routes behind an API key or admin authentication. I can add a simple middleware that checks a shared secret header if you want.
- If you need migrations beyond the simple `init.sql`, consider using a migration tool (Flyway, sqitch, or a Node-based tool like node-pg-migrate).

Need help?
- I can add a migration script, an API-key middleware for `/admin` routes, or a small admin UI for bulk import/export (CSV). Tell me which you prefer and I'll implement it.
