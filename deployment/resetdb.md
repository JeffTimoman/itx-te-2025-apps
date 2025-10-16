# 1) Stop and remove the Postgres container (keeps other services up)
docker compose stop postgres
docker compose rm -f postgres

# 2) Find the exact volume name (usually <project>_postgres-data) and remove it
VOL=$(docker volume ls -q | grep 'postgres-data$')   # picks the volume ending with postgres-data
docker volume rm "$VOL"

# 3) Recreate Postgres (it will run docker-entrypoint-initdb.d/init.sql on first boot)
docker compose up -d postgres