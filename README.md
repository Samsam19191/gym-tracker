# Gym tracker

Personal gym app for iPhone, built as a web app saved to the Home Screen. All data stays on the phone.

## Features (v1)

- **Train:** pick a workout type (Push, Pull, Shoulders) to start the total timer. One big button counts each set and starts the rest timer. The screen stays on during workouts.
- **History:** month calendar colored by workout type, with monthly stats (workout count, average duration, workouts per week).
- **Weights:** list of machines with best weight, progression chart and quick logging.
- **Backup:** export / import a backup file to Files or iCloud Drive.

## Status

- [x] Mockups v1: [`mockups/index.html`](mockups/index.html)
- [ ] Build v1

## Viewing the mockups

```bash
python3 -m http.server 8765 --directory mockups
```

Then open http://localhost:8765.
