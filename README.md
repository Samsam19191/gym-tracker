# Gym tracker

A personal gym app for iPhone: workout timer with rest tracking, training calendar, and machine weights.
It's a web app you add to your Home Screen. **All data stays on the phone.**

**App:** https://samsam19191.github.io/gym-tracker/

## Install on the iPhone

1. Open the link above in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open the app from the new **Gym** icon (not from Safari). It opens full screen and works offline.

## Features

- **Train:** pick Push, Pull or Shoulders and the total timer starts. One big button counts each set and starts the rest timer; tap again to end the rest. `−1` undoes a set, "Next exercise" resets the counter. Hold the end button for a second to finish, review the summary, then save or discard.
- **Up next:** Home highlights the next workout in your rotation (the order of your types in Settings).
- **Rest target:** the rest ring fills up and a short sound plays at the target (default 1:30). Tap the target under the rest timer to change it mid-workout.
- **Screen stays on** during a workout (Settings can turn this off).
- **Football and other activities:** logged by hand with a start and end time from Home.
- **History:** month calendar (weeks start on Monday) colored by workout type, monthly stats, and every workout. Tap a day to see, edit or delete what you did there; tap an empty day to log a forgotten workout.
- **Weights:** every machine with your best weight and a trend line. Log a weight in two taps (one entry per day, the highest is kept), see your progress chart, delete entries, rename or delete machines.
- **Settings:** add, rename, recolor, reorder and delete workout types; rest target; export and import a backup file.

## Good to know on iPhone

- **Timers never drift:** they are based on start times, so locking the phone or closing the app doesn't affect them.
- **Screen on:** uses the Screen Wake Lock API (Home Screen apps need iOS 18.4 or later). The workout screen shows "Screen on", or "Screen may sleep" if iOS refuses.
- **Rest sound:** plays only while the app is open, and follows the silent switch. The ring and the "Rest done" label always show.
- **Mistakes:** `−1` undoes the last set, or an accidental "Next exercise". Workouts, weights, machines and types can all be edited or deleted.

## Updates

Every push to `main` runs all the tests and, if they pass, publishes the new version.
The next time the app is opened with internet, it shows **"A new version is ready"**: tap **Update**. No reinstalling, no cable, data is kept.

The app address must never change: data is tied to it. Don't rename this repository. If it ever has to move, use Export / Import backup.

## Backups

Data lives only in the app on the phone. Use **Settings → Export backup** and save the file to Files or iCloud Drive.
The app reminds you if your last backup is more than 30 days old.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run e2e        # end-to-end tests (Playwright: iPhone WebKit on 3 screen sizes + offline/update in Chromium)
npm run build      # production build in dist/
```

- Stack: Preact + TypeScript + Vite, no backend. Data is stored in `localStorage` under `gym-tracker:data`.
- `src/lib/`: data model and all the rules (pure functions, unit tested).
- `src/ui/`: screens and components. `src/platform/`: wake lock, sound, service worker, files.
- `sw/sw.template.js`: offline service worker, filled in at build time by `vite.config.ts`.
- `mockups/index.html`: the original design mockups.
