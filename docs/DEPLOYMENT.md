# TypeFLOW — Production Deployment Guide

Complete guide to deploy TypeFLOW to a Linux VPS (Ubuntu 22.04) with Nginx + PM2.

---

## Architecture Overview

```
Browser ──HTTPS──> Nginx (reverse proxy)
                     ├── /api/*      ──> Node/Express (port 5000)
                     ├── /socket.io  ──> Node/Express (port 5000, WebSocket)
                     └── /*          ──> React static dist (Vite build)
```

---

## 1 · Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 LTS | `nvm install 20` |
| npm | ≥ 10 | bundled with Node |
| PostgreSQL | ≥ 15 | `apt install postgresql-15` |
| PM2 | latest | `npm install -g pm2` |
| Nginx | latest | `apt install nginx` |

---

## 2 · Environment Variables

### Server (`server/.env`)
```bash
# Copy and fill in all fields
cp server/.env.example server/.env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | ✓ | Port the Express server listens on (default `5000`) |
| `NODE_ENV` | ✓ | Set to `production` |
| `DATABASE_URL` | ✓ | Full PostgreSQL connection string |
| `JWT_SECRET` | ✓ | Min 64-char random string — `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `CORS_ORIGIN` | ✓ prod | Frontend domain, e.g. `https://typeflow.app` |
| `RATE_LIMIT_MAX` | optional | Requests per 15-min window per IP (default `100`) |

### Client (`client/.env.local`)
```bash
cp client/.env.example client/.env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✓ | Backend REST API base URL, e.g. `https://api.typeflow.app` |
| `VITE_SOCKET_URL` | ✓ | Socket.IO server URL (same as API URL) |

---

## 3 · Database Setup

```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE typeflow;"
sudo -u postgres psql -c "CREATE USER typeflow_user WITH ENCRYPTED PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE typeflow TO typeflow_user;"

# Run migrations
cd server
npx prisma migrate deploy
npx prisma generate
```

---

## 4 · Backend Deployment (PM2)

```bash
cd server
npm install --omit=dev

# Start with PM2 (auto-restart on crash, memory overflow)
pm2 start src/server.js --name typeflow-api \
  --max-memory-restart 512M \
  --node-args="--env-file=.env"

# Save process list and configure startup
pm2 save
pm2 startup
```

### PM2 Ecosystem File (optional — `server/ecosystem.config.cjs`)
```js
module.exports = {
  apps: [{
    name: 'typeflow-api',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
    },
    max_memory_restart: '512M',
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
  }]
};
```

---

## 5 · Frontend Build & Deployment

```bash
cd client
npm install --omit=dev
npm run build
# Output: client/dist/
```

Copy `dist/` to Nginx web root or configure Nginx to serve it directly (see Section 6).

---

## 6 · Nginx Configuration

Create `/etc/nginx/sites-available/typeflow`:

```nginx
server {
    listen 80;
    server_name typeflow.app www.typeflow.app;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name typeflow.app www.typeflow.app;

    # SSL (use Certbot / Let's Encrypt)
    ssl_certificate     /etc/letsencrypt/live/typeflow.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/typeflow.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend static files
    root /var/www/typeflow/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO proxy (WebSocket upgrade required)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|svg|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable and reload
ln -s /etc/nginx/sites-available/typeflow /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL via Certbot
certbot --nginx -d typeflow.app -d www.typeflow.app
```

---

## 7 · CI/CD (GitHub Actions — optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy TypeFLOW

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install & build client
        working-directory: client
        run: |
          npm ci
          npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_SOCKET_URL: ${{ secrets.VITE_SOCKET_URL }}

      - name: Deploy to server via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/typeflow
            git pull origin main
            cd server && npm ci --omit=dev
            npx prisma migrate deploy
            pm2 restart typeflow-api
```

---

## 8 · Health Check

After deployment, verify:

```bash
curl https://typeflow.app/health
# → { "status": "UP", "environment": "production", ... }
```

---

## 9 · Monitoring

```bash
# Live PM2 logs
pm2 logs typeflow-api --lines 50

# Process metrics
pm2 monit

# Nginx access log
tail -f /var/log/nginx/access.log
```
