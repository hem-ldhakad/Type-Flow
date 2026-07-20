# TypeFLOW — Production Checklists

Use these checklists before every production deployment.

---

## ✅ Deployment Checklist

### Environment & Config
- [ ] `NODE_ENV=production` is set on the server
- [ ] `JWT_SECRET` is a cryptographically random string ≥ 64 characters (not a placeholder)
- [ ] `DATABASE_URL` points to the production database, not localhost
- [ ] `CORS_ORIGIN` is set to the exact production frontend URL
- [ ] Client `.env.local` has `VITE_API_URL` and `VITE_SOCKET_URL` pointing to production backend
- [ ] `.env` files are **NOT** committed to version control (verify with `git status`)

### Database
- [ ] `npx prisma migrate deploy` has been run on the production database
- [ ] `npx prisma generate` has been run after any schema changes
- [ ] Database connection pool is configured (`connection_limit` in `DATABASE_URL`)
- [ ] Database has a regular backup schedule configured

### Build
- [ ] Frontend built with `npm run build` (no warnings or errors)
- [ ] `VITE_API_URL` is baked into the production bundle (check `dist/assets/*.js`)
- [ ] PM2 process is running: `pm2 list` shows `online` status

### Nginx & SSL
- [ ] Nginx config passes syntax check: `nginx -t`
- [ ] HTTPS (port 443) is active and HTTP redirects to HTTPS
- [ ] SSL certificate is valid and not near expiry (`certbot renew --dry-run`)
- [ ] WebSocket upgrade headers are set in the `/socket.io/` location block
- [ ] Static assets have `Cache-Control: immutable` headers

### Health Check
- [ ] `GET /health` returns `{ "status": "UP", "environment": "production" }`
- [ ] Login / Register flow works end-to-end
- [ ] Socket.IO connects successfully (no errors in browser console)
- [ ] Leaderboard data loads from `/api/users/leaderboard`

---

## 🔒 Security Checklist

### Authentication
- [ ] JWT secret is strong (≥ 64 chars, generated with `crypto.randomBytes`)
- [ ] JWT tokens expire (verify `expiresIn` in `authService.js`)
- [ ] Passwords are hashed with bcrypt (cost factor ≥ 12)
- [ ] `/api/auth/register` and `/api/auth/login` are rate-limited (20 req / 15 min)

### API & Transport
- [ ] All API routes return `Content-Type: application/json`
- [ ] Helmet is enabled — check `X-Frame-Options`, `X-Content-Type-Options` headers
- [ ] CORS origin allowlist is non-wildcard in production
- [ ] Request body size is limited (`express.json({ limit: '10kb' })`)
- [ ] Global rate limit is active on `/api/*` (100 req / 15 min per IP)
- [ ] HTTPS enforced — no HTTP responses to API or socket endpoints

### Socket.IO
- [ ] JWT middleware validates every socket connection before allowing events
- [ ] Unauthenticated sockets are immediately disconnected
- [ ] Room actions validate that the user is actually a member of the room

### Database
- [ ] Database user has only the minimum required permissions (no `SUPERUSER`)
- [ ] `DATABASE_URL` is not exposed in logs
- [ ] All Prisma queries use parameterized inputs (no raw SQL string interpolation)

### Infrastructure
- [ ] SSH root login is disabled on the VPS
- [ ] UFW / firewall allows only ports 22, 80, 443
- [ ] PostgreSQL port 5432 is NOT exposed to the public internet
- [ ] Node process does NOT run as root (use a `typeflow` system user)
- [ ] Secrets are stored as CI/CD environment secrets, not in the repository

---

## ⚡ Performance Optimizations Applied

| Layer | Optimization | Status |
|-------|-------------|--------|
| Backend | `compression` gzip middleware on all responses | ✅ Implemented |
| Backend | Global API rate limiter (100 req / 15 min / IP) | ✅ Implemented |
| Backend | Stricter auth rate limiter (20 req / 15 min / IP) | ✅ Implemented |
| Backend | Request body size cap (10 KB) | ✅ Implemented |
| Backend | Leaderboard aggregation in-memory (single DB query) | ✅ Implemented |
| Backend | Parallel `Promise.all` queries in stats/history endpoints | ✅ Implemented |
| Frontend | Vite manual chunk splitting (react / router / socket) | ✅ Implemented |
| Frontend | CSS Modules (zero runtime CSS-in-JS overhead) | ✅ Implemented |
| Frontend | Typing engine uses 100ms ticker (not per-keystroke socket emit) | ✅ Implemented |
| Nginx | `Cache-Control: immutable` for versioned static assets | ✅ In DEPLOYMENT.md |
| Nginx | HTTP/2 enabled | ✅ In DEPLOYMENT.md |
| Database | Prisma connection pool via `connection_limit` URL param | ✅ In .env.example |

---

## 📊 Recommended Monitoring

- **PM2**: `pm2 monit` — real-time CPU / memory per process
- **Nginx**: `tail -f /var/log/nginx/access.log`
- **DB**: Enable `pg_stat_statements` for slow query analysis
- **Uptime**: Use [UptimeRobot](https://uptimerobot.com) to ping `/health` every 5 minutes
