Fast Tap - Deployment Guide

This folder contains Dockerfiles, Kubernetes manifests, nginx config and compose files to deploy the Fast Tap app (frontend, backend, redis).

Targets
- frontend: Next.js app served by nginx
- backend: Node.js + Socket.IO server
- redis: redis:7.0

Deployment options
- Single-host Docker-compose (recommended for quick deploy on small VM)
- Kubernetes manifests (for clusters)

Resource guidance for a 2 CPU / 2 GB RAM Ubuntu VM
- We'll allocate small limits so all three services can run:
  - redis: 256Mi, 0.5 CPU
  - backend: 700Mi, 1 CPU
  - frontend: 500Mi, 0.5 CPU
  - nginx: 300Mi, 0.5 CPU (if used separately)

Files added
- Dockerfile.backend - build/run backend
- Dockerfile.frontend - build Next app and serve with nginx
- Dockerfile.redis - minimal redis image (you can use official image directly)
- docker-compose.yml - single-host orchestration
- nginx.frontend.conf - nginx proxy for frontend + socket.io
- k8s/* - Kubernetes manifests for backend, frontend, redis, nginx
- README.md - this guide

Quick Docker-compose deploy (Ubuntu)
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
- Create a simple LetsEncrypt/Certbot setup for HTTPS in the nginx manifest.
- Adjust resource limits further after a smoke test on your VM.
