import { useEffect, useRef, useState } from 'preact/hooks';
import { typeById } from '../../lib/catalog';
import { dayKey, monthGrid, shiftMonth } from '../../lib/dates';
import { fmtClock, fmtDayLong, fmtDayShort, fmtDuration, fmtDurationCompact, fmtMonthYear, fmtTime, plural } from '../../lib/format';
import type { Workout } from '../../lib/model';
import { monthStats, typeCounts, workoutsInMonth, workoutsOnDay } from '../../lib/stats';
import { avgRest, deleteWorkout, totalSets, workoutDuration } from '../../lib/workout';
import { IconButton, SetPips, Sheet, Tiles, TypeChip } from '../components';
import { confirmDialog } from '../dialog';
import { Icon } from '../icons';
import { LogWorkoutSheet } from '../sheets/LogWorkoutSheet';
import { dispatch, useData, useNow } from '../store';
import { toast } from '../toast';

type LogState = { day?: string; editing?: Workout } | null;

export function History() {
  const d = useData();
  const now = useNow(60_000);
  const today = new Date(now);
  const [ym, setYm] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [log, setLog] = useState<LogState>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const isCurrentMonth = ym.year === today.getFullYear() && ym.month === today.getMonth();
  const isFutureMonth = ym.year * 12 + ym.month > today.getFullYear() * 12 + today.getMonth();
  const month = workoutsInMonth(d, ym.year, ym.month);
  const stats = monthStats(month, ym.year, ym.month, now);
  const counts = typeCounts(month);
  const todayKey = dayKey(now);
  const go = (delta: number) => setYm((v) => shiftMonth(v.year, v.month, delta));

  const tapDay = (key: string) => {
    if (workoutsOnDay(d, key).length) setOpenDay(key);
    else if (key <= todayKey) setLog({ day: key });
  };

  return (
    <main
      class="screen"
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const s = touch.current;
        touch.current = null;
        if (!s) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
      }}
    >
      <header class="spread">
        <h1 class="title">History</h1>
        <IconButton icon="plus" label="Log a workout" onClick={() => setLog({})} />
      </header>

      <div class="spread monthnav">
        <IconButton icon="chevL" label="Previous month" class="sm" onClick={() => go(-1)} />
        <button type="button" class="mlabel" onClick={() => setYm({ year: today.getFullYear(), month: today.getMonth() })} aria-label={`${fmtMonthYear(ym.year, ym.month)}${isCurrentMonth ? '' : ', tap to go to this month'}`}>
          {fmtMonthYear(ym.year, ym.month)}
        </button>
        <IconButton icon="chevR" label="Next month" class="sm" onClick={() => go(1)} />
      </div>

      <Tiles
        items={[
          { value: String(stats.count), label: stats.count === 1 ? 'Workout' : 'Workouts' },
          { value: stats.avgDurationMs === null ? '–' : fmtDurationCompact(stats.avgDurationMs), label: 'Avg duration' },
          { value: stats.perWeek === null ? '–' : stats.perWeek.toFixed(1), label: 'Per week' },
        ]}
      />

      <div class="cal" role="grid" aria-label={`Calendar ${fmtMonthYear(ym.year, ym.month)}`}>
        <div class="cal-h" aria-hidden="true">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => (
            <span key={i}>{x}</span>
          ))}
        </div>
        <div class="cal-g">
          {monthGrid(ym.year, ym.month).map((day, i) => {
            if (day === null) return <span key={`p${i}`} />;
            const key = dayKey(new Date(ym.year, ym.month, day));
            const ws = workoutsOnDay(d, key);
            const t = ws.length ? typeById(d, ws[0].typeId) : null;
            const cls = ['cd', t ? 'w' : '', key === todayKey ? 'today' : '', key > todayKey ? 'future' : ''].filter(Boolean).join(' ');
            return (
              <button
                type="button"
                key={key}
                class={cls}
                style={t ? { '--c': t.color } : undefined}
                disabled={key > todayKey && !ws.length}
                onClick={() => tapDay(key)}
                aria-label={`${fmtDayLong(new Date(ym.year, ym.month, day).getTime())}${ws.length ? `: ${ws.map((w) => typeById(d, w.typeId).name).join(', ')}` : ''}`}
              >
                {day}
                {ws.length > 1 && <i class="multi" style={{ '--c2': typeById(d, ws[1].typeId).color }} />}
              </button>
            );
          })}
        </div>
      </div>

      {counts.size > 0 && (
        <div class="legend">
          {[...counts.entries()]
            .map(([id, n]) => ({ t: typeById(d, id), n }))
            .sort((x, y) => x.t.order - y.t.order)
            .map(({ t, n }) => (
              <span key={t.id} style={{ '--c': t.color }}>
                <span class="dot" />
                {t.name} {n}
              </span>
            ))}
        </div>
      )}

      <div class="eyebrow section-label">{isCurrentMonth ? 'This month' : fmtMonthYear(ym.year, ym.month)}</div>
      {month.length === 0 ? (
        <div class="empty">{isFutureMonth ? 'Nothing here yet.' : isCurrentMonth ? 'No workouts yet this month.' : 'No workouts this month.'}</div>
      ) : (
        <div class="list">
          {month.map((w) => {
            const t = typeById(d, w.typeId);
            return (
              <button type="button" class="lrow" key={w.id} style={{ '--c': t.color }} onClick={() => setOpenDay(dayKey(w.start))}>
                <span class="dot" />
                <span class="lt">{t.name}</span>
                <span class="small muted">{fmtDayShort(w.start)}</span>
                <span class="lr num">
                  {fmtDuration(workoutDuration(w))}
                  {!w.manual && ` · ${plural(totalSets(w.exercises), 'set')}`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {openDay && (
        <DaySheet
          day={openDay}
          onClose={() => setOpenDay(null)}
          onEdit={(w) => {
            setOpenDay(null);
            setLog({ editing: w });
          }}
        />
      )}
      {log && <LogWorkoutSheet day={log.day} editing={log.editing} onClose={() => setLog(null)} />}
    </main>
  );
}

function DaySheet({ day, onClose, onEdit }: { day: string; onClose: () => void; onEdit: (w: Workout) => void }) {
  const d = useData();
  const ws = workoutsOnDay(d, day);
  const [menu, setMenu] = useState<string | null>(null);
  // The last workout of the day was deleted: nothing left to show.
  useEffect(() => {
    if (ws.length === 0) onClose();
  }, [ws.length]);
  if (ws.length === 0) return null;
  const remove = async (w: Workout) => {
    const t = typeById(d, w.typeId);
    const ok = await confirmDialog({ title: `Delete this ${t.name} workout?`, message: `${fmtDayShort(w.start)}, ${fmtTime(w.start)} → ${fmtTime(w.end)}. This can't be undone.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    dispatch((x) => deleteWorkout(x, w.id));
    toast('Workout deleted');
  };
  return (
    <Sheet label={fmtDayLong(ws[0].start)} onClose={onClose}>
      <div class="h2">{fmtDayLong(ws[0].start)}</div>
      {ws.map((w) => {
        const t = typeById(d, w.typeId);
        const rest = avgRest(w.exercises);
        return (
          <section class="day-workout" key={w.id} aria-label={`${t.name} workout`}>
            <div class="spread">
              <TypeChip type={t} />
              <IconButton icon="more" label={`Options for ${t.name} workout`} onClick={() => setMenu(menu === w.id ? null : w.id)} />
            </div>
            {menu === w.id && (
              <div class="menu" role="menu">
                <button type="button" role="menuitem" onClick={() => onEdit(w)}>
                  <Icon name="edit" /> Edit type, date or times
                </button>
                <button type="button" role="menuitem" class="danger-text" onClick={() => void remove(w)}>
                  <Icon name="trash" /> Delete workout
                </button>
              </div>
            )}
            <div class="small muted num day-times">
              {fmtTime(w.start)} → {fmtTime(w.end)}
              {w.manual ? ' · logged by hand' : ''}
            </div>
            <Tiles
              items={[
                { value: fmtClock(workoutDuration(w)), label: 'Duration' },
                { value: w.manual ? '–' : String(totalSets(w.exercises)), label: 'Sets' },
                { value: rest === null ? '–' : fmtClock(rest), label: 'Avg rest' },
              ]}
            />
            {w.exercises.length > 0 && (
              <div class="card exlist">
                {w.exercises.map((e, i) => (
                  <div class="exrow" key={i}>
                    <span>Exercise {i + 1}</span>
                    <SetPips sets={e.sets} color={t.color} />
                    <span class="n num">{plural(e.sets, 'set')}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </Sheet>
  );
}
