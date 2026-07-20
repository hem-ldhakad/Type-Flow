# Development Roadmap

## Phase 1: Project Setup & Normalization
- Initialize React and Express servers with modern ES Modules.
- Set up Prisma with PostgreSQL schemas (User, Room, Match, Result, Paragraph tables).
- Implement database indexing strategies.

## Phase 2: Authentication
- User sign-up & sign-in API routers with Bcrypt encryption.
- Client context manager with secure `HttpOnly` token delivery.
- User profile dashboards reflecting levels and XP trackers.

## Phase 3: Typing Engine & Solo Mode
- Build local layout calculation scripts (WPM/Accuracy metrics logic).
- Establish Solo Practice page allowing local offline trials.
- Integrate Chart.js/Recharts to paint performance progression lines.

## Phase 4: WebSockets & Multiplayer Lobbies
- Socket.IO connection configurations with validation handshakes.
- Room configuration handlers (host timer selections, custom modes).
- Event triggers: Join, ready flags, and interactive countdown loops.
- Host migration fallback protocols.

## Phase 5: Race Tracking & Anti-Cheat
- Streamlined typing progress updates with throttled Socket payloads.
- Live competitor positioning animations.
- Backend validator for keystroke sequence dynamics (Anti-Cheat).
- Reconnection / Session recovery timers for disconnected clients.

## Phase 6: Stats & Persistence
- Concurrency-ready Result dispatcher queued with BullMQ/Redis.
- PostgreSQL tables entry of results (storing WPM histories).
- Level recalculations and XP rewards processing.

## Phase 7: Leaderboards
- Paginated endpoint rankings by WPM, category, and date.
- Display leaderboards in React client interface.

## Phase 8: Deployment & Hardening
- Performance audits under simulated load thresholds.
- Production environment configurations and server build distributions.

