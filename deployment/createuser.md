# Create an admin user

This document explains how to create an admin user for the app. The backend provides a small helper script that hashes the password with bcrypt and inserts a user into the `users` table.

Summary of steps
- Ensure Postgres is running and the DB schema (`deployment/db/init.sql`) has been applied.
- Configure backend environment so the backend can connect to Postgres.
- Install backend dependencies and run the helper script to create a user.
- Verify the user and log in via the admin UI.

Prereqs
- Node.js (v16+ recommended) and npm installed on your machine.
- Access to the Postgres server used by the app (local or container).
- The database schema file `deployment/db/init.sql` must have been applied so the `users` table exists.

1) Apply DB schema (if not already applied)

If you are using a managed deployment (Docker Compose) the schema may be applied automatically. To apply it manually from PowerShell using the `psql` CLI:

```powershell
# set password env for psql (PowerShell)
$env:PGPASSWORD = 'your_db_password'

# run the init script (adjust host, user, dbname as needed)
psql -h localhost -U postgres -d your_database -f .\deployment\db\init.sql
```

If your Postgres is running in a container, you can instead copy the SQL into the container or run `psql` from a client container. Replace `your_database`, `postgres` and host as appropriate.

2) Configure backend env so the create-user script can connect

The helper script uses the same Postgres config as the backend. You can set `POSTGRES_URL` (recommended) or the individual POSTGRES_* variables. Create a `.env` file in the `fast-tap-backend` folder or export env vars in your shell.

Example `.env` (put in `fast-tap-backend/.env`):

```
POSTGRES_URL=postgres://postgres:your_db_password@localhost:5432/your_database
SESSION_SECRET=change-this-to-a-secure-secret
NODE_ENV=development
PORT=5000
```

Or set in PowerShell for the current session:

```powershell
$env:POSTGRES_URL = 'postgres://postgres:your_db_password@localhost:5432/your_database'
$env:SESSION_SECRET = 'change-this'
```

3) Install backend dependencies

Open a PowerShell prompt and run:

```powershell
cd .\fast-tap-backend
npm install
```

4) Run the create-user helper

From the `fast-tap-backend` folder run the helper script. Example:

```powershell
# create an admin user
node .\src\bin\create_user.js --username admin --password hunter2 --email admin@example.com --name "Admin User" --role admin
```

Notes:
- `--username` and `--password` are required.
- `--role` defaults to `admin`.
- The script will print the created user row on success.

5) Verify the user exists

Using `psql` you can verify the inserted user:

```powershell
$env:PGPASSWORD = 'your_db_password'
psql -h localhost -U postgres -d your_database -c "SELECT id, username, email, name, role, created_at FROM users;"
```

6) Start the backend and log in

Start the backend server (in `fast-tap-backend`):

```powershell
npm start
# or for development with nodemon:
# npm run dev
```

Open the admin UI at `http://localhost:3000/admin/login` (or your frontend host). Sign in with the username/password you created.

Important environment notes
- Role checks: the server restricts `/api/admin/*` to users whose role is listed in the `ADMIN_ALLOWED_ROLES` environment variable (comma-separated). By default this is `admin`. To allow additional roles, set `ADMIN_ALLOWED_ROLES` in your backend environment, e.g.:

```powershell
$env:ADMIN_ALLOWED_ROLES = 'admin,superuser'
```

- Sessions: the backend uses `express-session` with the default MemoryStore. For production, configure a persistent session store (Redis or Postgres) and set a strong `SESSION_SECRET`.

If the helper fails
- Common causes:
	- Postgres not reachable / wrong `POSTGRES_URL`.
	- `users` table not created (run `deployment/db/init.sql`).
	- Node dependencies not installed (`npm install`).

Troubleshooting tips
- If you get `Postgres not configured` or connection errors, double-check `POSTGRES_URL` or the POSTGRES_* envs and that the DB is running and accepting connections from the host.
- To manually create a bcrypt hash for insertion (if you prefer to insert via SQL), you can generate a hash with Node and then INSERT via psql:

```powershell
# produce a bcrypt hash for `hunter2`
node -e "const bcrypt=require('bcrypt');bcrypt.hash('hunter2',10).then(h=>console.log(h))"

# then in psql insert (replace <HASH> with printed hash):
-- INSERT INTO users (username, email, password_hash, name, role) VALUES ('admin','admin@example.com','<HASH>','Admin','admin');
```

If you want me to run the create-user command from the repo now (install deps and create a demo user), tell me which username/password/role to use and I'll run the commands in your environment.

---
Generated on: October 12, 2025

