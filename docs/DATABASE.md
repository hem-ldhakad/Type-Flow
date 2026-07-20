# Database

## User
- id
- username
- email
- password
- xp (default: 0)
- level (default: 1)
- createdAt

## Paragraph
- id
- text (text snippet to type)
- source (quote author, or random corpus name)
- category (e.g. "code", "english", "quote")
- wordCount

## Room
- id
- code (unique short code)
- hostId
- status ("LOBBY", "RACING", "FINISHED")
- configDuration (e.g. 15, 30, 60 seconds)
- configMode ("WORDS", "TIME")

## Match
- id
- roomId
- paragraphId (foreign key to Paragraph)
- startedAt
- endedAt

## Result
- id
- matchId
- userId
- wpm
- accuracy
- position
- wpmHistory (Array of floats describing WPM progression at 1-second ticks)
- keystrokeHistory (JSON telemetry tracking key timestamps for anti-cheat verification)

