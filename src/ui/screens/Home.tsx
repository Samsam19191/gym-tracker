import { useState } from 'preact/hooks';
import { activityTypes, gymTypes, typeById } from '../../lib/catalog';
import { shouldRemindBackup, snoozeBackup } from '../../lib/backup';
import { fmtDayLong, fmtDurationCompact, fmtRelativeDay, plural, WEEKDAYS } from '../../lib/format';
import { lastWorkoutOfType, upNextTypeId, weekStrip, weekSummary } from '../../lib/stats';
import { startWorkout } from '../../lib/workout';
import { setKeepAwake } from '../../platform/wakelock';
import { unlockAudio } from '../../platform/sound';
import { IconButton } from '../components';
import { Icon } from '../icons';
import { LogWorkoutSheet } from '../sheets/LogWorkoutSheet';
import { exportBackup } from '../backupActions';
import { dispatch, useData, useNow } from '../store';

export function Home({ onOpenSettings }: { onOpenSettings: () => void }) {
  const d = useData();
  const now = useNow(60_000);
  const [logType, setLogType] = useState<string | null>(null);
  const gym = gymTypes(d);
  const acts = activityTypes(d);
  const next = upNextTypeId(d);
  const week = weekStrip(d, now);
  const sum = weekSummary(d, now);
  const remind = shouldRemindBackup(d, now);

  const start = (typeId: string) => {
    unlockAudio();
    const next = dispatch((x) => startWorkout(x, typeId, Date.now()));
    // Ask for the wake lock during the tap itself: some browsers only grant it then.
    if (next.active && next.settings.keepScreenOn) setKeepAwake(true);
  };

  return (
    <main class="screen">
      <header class="spread">
        <span class="small muted">{fmtDayLong(now)}</span>
        <IconButton icon="sliders" label="Settings" onClick={onOpenSettings} />
      </header>
      <h1 class="title">Ready to train?</h1>

      {remind && (
        <div class="banner" role="status">
          <Icon name="warn" />
          <div class="banner-text">
            <b>Back up your data</b>
            <span>
              {d.settings.lastBackupAt ? `Last backup ${fmtRelativeDay(d.settings.lastBackupAt, now).toLowerCase()}` : 'No backup yet'}. It only lives on this phone.
            </span>
          </div>
          <button type="button" class="btn small primary" onClick={() => void exportBackup()}>
            Export
          </button>
          <IconButton icon="x" label="Remind me later" class="sm plain" onClick={() => dispatch((x) => snoozeBackup(x, Date.now()))} />
        </div>
      )}

      <section class="card week-card" aria-label="This week">
        <div class="spread">
          <span class="eyebrow">This week</span>
          <span class="small muted num">{sum.count ? `${plural(sum.count, 'workout')} · ${fmtDurationCompact(sum.totalMs)}` : 'No workouts yet'}</span>
        </div>
        <div class="week">
          {week.map((day) => {
            const first = day.workouts[0];
            const t = first ? typeById(d, first.typeId) : null;
            const name = WEEKDAYS[new Date(day.start).getDay()];
            return (
              <div class={day.isToday ? 'wd today' : 'wd'} key={day.key} aria-label={`${name}: ${day.workouts.length ? day.workouts.map((w) => typeById(d, w.typeId).name).join(', ') : 'rest day'}`}>
                <span>{name[0]}</span>
                <b class={t ? 'f' : ''} style={t ? { '--c': t.color } : undefined}>
                  {day.workouts.length > 1 && <em>{day.workouts.length}</em>}
                </b>
              </div>
            );
          })}
        </div>
      </section>

      <div class="eyebrow section-label">Start a workout</div>
      {gym.length === 0 && <div class="empty">No gym workout types. Add one in Settings.</div>}
      {gym.map((t) => {
        const last = lastWorkoutOfType(d, t.id);
        const isNext = t.id === next && d.workouts.length > 0;
        return (
          <button type="button" key={t.id} class={isNext ? 'wtype next' : 'wtype'} style={{ '--c': t.color }} onClick={() => start(t.id)} aria-label={`Start ${t.name}`}>
            <span class="ic">
              <i />
            </span>
            <span class="wtext">
              <span class="wname">{t.name}</span>
              <span class="wsub">{last ? fmtRelativeDay(last.start, now) : 'Not done yet'}</span>
            </span>
            {isNext && <span class="badge">Up next</span>}
            <Icon name="chevR" class="go" />
          </button>
        );
      })}

      {acts.length > 0 && (
        <>
          <div class="eyebrow section-label">Log an activity</div>
          {acts.map((t) => {
            const last = lastWorkoutOfType(d, t.id);
            return (
              <button type="button" key={t.id} class="arow" style={{ '--c': t.color }} onClick={() => setLogType(t.id)} aria-label={`Log ${t.name}`}>
                <span class="dot" />
                <span class="wtext">
                  <span class="aname">{t.name}</span>
                  <span class="wsub">{last ? fmtRelativeDay(last.start, now) : 'Not logged yet'}</span>
                </span>
                <span class="arow-cta">
                  <Icon name="plus" /> Log
                </span>
              </button>
            );
          })}
        </>
      )}

      {logType && <LogWorkoutSheet typeId={logType} onClose={() => setLogType(null)} />}
    </main>
  );
}
