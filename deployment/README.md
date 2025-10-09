Fast Tap - Deployment Guide

This folder contains Dockerfiles, Kubernetes manifests, nginx config and compose files to deploy the Fast Tap app (frontend, backend, redis).

Targets
- frontend: Next.js app served by nginx
- backend: Node.js + Socket.IO server
- redis: redis:7.0

Deployment options
- Single-host Docker-compose (recommended for quick deploy on small VM)
- Kubernetes manifests (for clusters)

Resource guidance for a 2 vCPU / 8 GB RAM Ubuntu VM
We tuned the manifests and compose file for a 2 vCPU / 8 GB host. Suggested resource reservations:
- redis: 512Mi, 0.3 CPU
- backend: 4Gi, 1.5 CPU
- frontend: 1.5Gi, 0.8 CPU
- nginx: 512Mi, 0.5 CPU

Files added
- Dockerfile.backend - build/run backend
- Dockerfile.frontend - build Next app and serve with nginx
- Dockerfile.redis - minimal redis image (you can use official image directly)
- docker-compose.yml - single-host orchestration
- nginx.frontend.conf - nginx proxy for frontend + socket.io
- k8s/* - Kubernetes manifests for backend, frontend, redis, nginx
- README.md - this guide

Quick Docker-compose deploy (Ubuntu) — suited for a single VM
1. Install Docker & Docker Compose
   sudo apt update; sudo apt install -y docker.io docker-compose
   sudo systemctl enable --now docker

2. Build & run
   cd /path/to/itx-te-2025-apps/deployment
   # Build images and start services
   docker-compose up --build -d

3. Verify
   docker-compose ps
   # Frontend should be on port 80, backend on 5000, redis on 6379

4. Logs
   docker-compose logs -f backend

Notes about Socket.IO (Nginx)
- We configure nginx to proxy websocket upgrades for /socket.io/.
- If you run nginx outside docker, update backend hostname in nginx config.

DNS & TLS
- This repository expects your public DNS to point to the VM. We use te-itx-2025.site in configs.
- For production HTTPS on Kubernetes, create a TLS secret named `te-itx-2025-tls` containing `tls.crt` and `tls.key` and apply it before deploying nginx. Example:

   kubectl create secret tls te-itx-2025-tls --key /path/to/privkey.pem --cert /path/to/fullchain.pem

For the docker-compose setup you can provision certificates with certbot on the host and mount them into the nginx container or run nginx on the host.

Kubernetes deploy (outline)
1. Build and push images to your registry (replace your-registry/... in manifests)
   docker build -f deployment/Dockerfile.backend -t your-registry/fast-tap-backend:latest ..
   docker build -f deployment/Dockerfile.frontend -t your-registry/fast-tap-frontend:latest ..
   docker push your-registry/fast-tap-backend:latest
   docker push your-registry/fast-tap-frontend:latest

2. Apply manifests
   kubectl apply -f deployment/k8s/

3. Check pods
   kubectl get pods

Sizing notes
- On a small 2 CPU/2GB VM use docker-compose.
- If memory pressure occurs, reduce backend memory to 512Mi and frontend to 300Mi.

Security & env
- Set sensible env vars for production (CORS_ORIGIN, REDIS_URL, NODE_ENV=production).
- Consider using a process manager (PM2) for better Node resiliency.

If you want I can:
- Add a small systemd unit to run docker-compose on boot.
- Add a certbot + nginx example to automatically provision LetsEncrypt certificates.
- Run a smoke test on your VM (you can grant me access or paste logs) and further tune memory.
