# Socket.IO Events

## Client to Server Events
- `create-room`: Initiates room creation. Payload: `{ hostId }`
- `join-room`: Asks to join lobby. Payload: `{ code, userId }`
- `update-room-config`: Updates lobby preferences (host only). Payload: `{ roomId, configDuration, configMode }`
- `ready`: Toggles player ready state. Payload: `{ userId, isReady }`
- `typing`: Sends progress metrics periodically. Payload: `{ inputLength, currentWpm, keystrokeLogs: [{ char, delayMs }, ...] }`
- `finish`: Declares text completion. Payload: `{ wpm, accuracy, finalTelemetry: {...} }`
- `reconnect-session`: Attempts recovery of an active race segment. Payload: `{ userId, originalSocketId, roomId }`

## Server to Client Events
- `room-created`: Confirms room generation. Payload: `{ roomId, code }`
- `player-joined`: Informs lobby of player entry. Payload: `{ userId, username }`
- `room-config-updated`: Broadcasts lobby settings change. Payload: `{ configDuration, configMode }`
- `player-ready-status`: Broadcasts user ready checks. Payload: `{ userId, isReady }`
- `countdown`: Triggers pre-game countdown tick. Payload: `{ timeRemaining }`
- `game-start`: Signals typing test can begin. Payload: `{ matchId, paragraphId, paragraphText }`
- `progress-update`: Dispatches sync points. Payload: `{ userId, progressPercentage, currentWpm }`
- `player-finished`: Informs of competitor finish. Payload: `{ userId, rank, wpm }`
- `player-disconnected`: Notifies lobby of connection drop (begins session grace timer). Payload: `{ userId }`
- `host-migrated`: Alerts lobby that a new host was chosen. Payload: `{ newHostId }`
- `session-restored`: Re-synchronizes state upon fast reconnect. Payload: `{ matchId, paragraphText, timePassed }`
- `game-end`: Sends finalized leaderboard results summary. Payload: `{ results: [{ userId, username, wpm, accuracy, position, xpGained }] }`
