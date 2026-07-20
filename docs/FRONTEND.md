# React Structure (JavaScript)

```text
src/
 ├── components/       # Reusable components (e.g. Timer, AccuracyGauge, ChartWrapper, SettingsModal)
 ├── pages/            # Page-level components
 ├── hooks/            # useAuth, useSocket, useTypingEngine hooks
 ├── context/          # AuthContext, SocketContext providers
 ├── services/         # Axios config, Auth service, Socket listener service
 └── utils/            # WPM calculations, stats parser, validation rules
```

## Pages
- **Login / Register**: Authentication onboarding pages.
- **Dashboard**: User analytics overview, lobby finder/creator, and practice history.
- **Solo (Practice) [NEW]**: Fully client-side workspace for typing tests without socket traffic. Supports custom words count, coding snippets, and registers results locally.
- **Room**: Lobbies page with host privilege controls (room settings panel: change countdown timer, paragraph mode).
- **Race**: Dynamic visual race arena displaying live character cursors and speedometers for other competitors.
- **Results**: End-of-race breakdown (WPM, Accuracy) displaying a visual Line Chart (via Recharts or Chart.js) depicting speed progression.
- **Profile**: Performance logs showing Level/XP progression and historically compiled test stats.

