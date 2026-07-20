# REST API

## Authentication
- `POST /api/auth/register` (body: `{ username, email, password }`)
- `POST /api/auth/login` (body: `{ email, password }`)
- `GET /api/auth/me` (requires Bearer Authorization token)

## Lobbies & Rooms
- `POST /api/rooms` (body: `{ hostId }`) -> Creates room and returns layout/code
- `POST /api/rooms/join` (body: `{ code }`, parses authenticated user from base JWT)
- `GET /api/rooms/:id` -> Fetches room occupancy, user statuses, and configs

## Paragraphs
- `GET /api/paragraphs` (optional filters: `?category=code&limit=5`) -> Retrieves paragraph choices for practice/custom races
- `POST /api/paragraphs` (admin only, body: `{ text, category, source }`) -> Inserts custom typing content

## Matches & Practice
- `GET /api/matches?page=1&limit=15` (paginated list of user matches)
- `POST /api/matches/solo` (body: `{ paragraphId, wpm, accuracy, wpmHistory, keystrokeHistory }`, saves practice scores with anti-cheat checks)

## Metrics & Rankings
- `GET /api/leaderboard?page=1&limit=25&category=overall` (paginated leaderboard statistics)

