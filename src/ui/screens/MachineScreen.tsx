import { useEffect, useState } from 'preact/hooks';
import { typeById } from '../../lib/catalog';
import { dayKey, parseDayKey } from '../../lib/dates';
import { fmtDayMonth, fmtKg, MONTHS } from '../../lib/format';
import { newId } from '../../lib/ids';
import type { WeightEntry } from '../../lib/model';
import { bestKg, DEFAULT_START_KG, deleteWeight, entriesFor, lastKg, logWeight, progressSince, rangeEntries, type Range } from '../../lib/weights';
import { KgStepper, Segmented, TypeChip, WeightChart } from '../components';
import { confirmDialog } from '../dialog';
import { Icon } from '../icons';
import { MachineSheet } from '../sheets/MachineSheet';
import { dispatch, getData, useData } from '../store';
import { toast } from '../toast';

const NEUTRAL = '#8C8C96';

export function MachineScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const d = useData();
  const machine = d.machines.find((m) => m.id === id);
  const entries = entriesFor(d, id);
  const [kg, setKg] = useState(() => lastKg(entries) ?? DEFAULT_START_KG);
  const [range, setRange] = useState<Range>('6M');
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!machine) onBack();
  }, [machine]);
  if (!machine) return null;

  const t = machine.typeId ? typeById(d, machine.typeId) : null;
  const color = t?.color ?? NEUTRAL;
  const best = bestKg(entries);
  const progress = progressSince(entries);
  const now = Date.now();
  const shown = rangeEntries(entries, range, now);
  const history = [...entries].reverse();
  const visible = showAll ? history : history.slice(0, 8);

  const log = () => {
    const today = dayKey(Date.now());
    const current = getData();
    const prevBest = bestKg(entriesFor(current, id));
    const { data, result } = logWeight(current, id, today, kg, newId());
    dispatch(() => data);
    if (result === 'kept') {
      const todays = entriesFor(current, id).find((e) => e.date === today);
      toast(`Kept today's ${fmtKg(todays?.kg ?? kg)} kg (only the highest weight of the day is saved)`);
    } else if (prevBest === null || kg > prevBest) {
      toast(prevBest === null ? `Logged ${fmtKg(kg)} kg` : `New best: ${fmtKg(kg)} kg`, { tone: 'success' });
    } else {
      toast(`Logged ${fmtKg(kg)} kg`, { tone: 'success' });
    }
  };

  const remove = async (e: WeightEntry) => {
    const ok = await confirmDialog({ title: `Delete ${fmtKg(e.kg)} kg?`, message: `Logged on ${fmtDayMonth(parseDayKey(e.date).getTime(), now)}.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    dispatch((x) => deleteWeight(x, e.id));
    toast('Weight deleted');
  };

  const sinceLabel = (k: string) => {
    const dt = parseDayKey(k);
    return dt.getFullYear() === new Date(now).getFullYear() ? MONTHS[dt.getMonth()] : `${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
  };

  return (
    <main class="screen machine" style={{ '--c': color }}>
      <header class="spread">
        <button type="button" class="back" onClick={onBack}>
          <Icon name="chevL" />
          Weights
        </button>
        <button type="button" class="link" onClick={() => setEditing(true)}>
          Edit
        </button>
      </header>
      <div class="spread title-row">
        <h1 class="title">{machine.name}</h1>
        {t && <TypeChip type={t} small />}
      </div>

      <div class="best">
        <div class="eyebrow">Best</div>
        <div class="bv num" data-testid="best-kg">
          {best === null ? '–' : fmtKg(best)}
          {best !== null && <small>kg</small>}
        </div>
        <div class="up">
          {progress
            ? progress.delta > 0
              ? `↑ +${fmtKg(progress.delta)} kg since ${sinceLabel(progress.since)}`
              : `Same as in ${sinceLabel(progress.since)}`
            : entries.length === 1
              ? `First logged ${fmtDayMonth(parseDayKey(entries[0].date).getTime(), now)}`
              : 'Log your first weight below'}
        </div>
      </div>

      {entries.length > 0 && (
        <div class="card chartcard">
          <WeightChart entries={shown} color={color} />
          <Segmented
            label="Chart range"
            value={range}
            onChange={setRange}
            options={[
              { value: '3M', label: '3M' },
              { value: '6M', label: '6M' },
              { value: 'ALL', label: 'All' },
            ]}
          />
        </div>
      )}

      <div class="card logc">
        <KgStepper value={kg} onChange={setKg} label="Weight to log" />
        <button type="button" class="savebtn" onClick={log}>
          Log
        </button>
      </div>
      <div class="form-note">Saved for today. Only your highest weight of the day is kept.</div>

      {history.length > 0 && (
        <>
          <div class="eyebrow section-label">History</div>
          <div class="list">
            {visible.map((e) => (
              <div class="hrow" key={e.id}>
                <span class="d num">{fmtDayMonth(parseDayKey(e.date).getTime(), now)}</span>
                <b class="num">{fmtKg(e.kg)} kg</b>
                {e.kg === best && <span class="bestb">Best</span>}
                <button type="button" class="iconbtn sm plain del" aria-label={`Delete ${fmtKg(e.kg)} kg on ${fmtDayMonth(parseDayKey(e.date).getTime(), now)}`} onClick={() => void remove(e)}>
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
          {history.length > visible.length && (
            <button type="button" class="btn ghost block" onClick={() => setShowAll(true)}>
              Show all {history.length}
            </button>
          )}
        </>
      )}

      {editing && <MachineSheet editing={machine} onClose={() => setEditing(false)} onDeleted={onBack} />}
    </main>
  );
}
