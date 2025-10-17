# Save as dummy_seed.sql, then:
docker compose exec -T postgres psql -U ftuser -d fasttap -f /docker-entrypoint-initdb.d/dummy_seed.sql
# or pipe directly:
docker compose exec -T postgres psql -U ftuser -d fasttap <<'SQL'
-- paste the script here
SQL
