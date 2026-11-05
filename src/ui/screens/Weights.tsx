import { useState } from 'preact/hooks';
import { liveTypes, typeById } from '../../lib/catalog';
import { parseDayKey } from '../../lib/dates';
import { fmtDayMonth, fmtKg } from '../../lib/format';
import { machineRows } from '../../lib/weights';
import { IconButton, Spark } from '../components';
import { Icon } from '../icons';
import { MachineSheet } from '../sheets/MachineSheet';
import { useData } from '../store';

const NEUTRAL = '#8C8C96';

export function Weights({ onOpenMachine }: { onOpenMachine: (id: string) => void }) {
  const d = useData();
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const types = liveTypes(d).filter((t) => d.machines.some((m) => m.typeId === t.id));
  const activeFilter = filter && types.some((t) => t.id === filter) ? filter : null;
  const rows = machineRows(d, activeFilter, query);
  const now = Date.now();

  return (
    <main class="screen">
      <header class="spread">
        <h1 class="title">Weights</h1>
        <IconButton icon="plus" label="Add machine" onClick={() => setAdding(true)} />
      </header>

      {d.machines.length > 0 && (
        <>
          <label class="search">
            <Icon name="search" />
            <input type="search" placeholder="Search machines" aria-label="Search machines" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
          </label>
          {types.length > 0 && (
            <div class="chips filter-chips" role="radiogroup" aria-label="Filter by workout type">
              <button type="button" role="radio" aria-checked={activeFilter === null} class={activeFilter === null ? 'fchip on' : 'fchip'} onClick={() => setFilter(null)}>
                All
              </button>
              {types.map((t) => (
                <button type="button" key={t.id} role="radio" aria-checked={activeFilter === t.id} class={activeFilter === t.id ? 'fchip on' : 'fchip'} style={{ '--c': t.color }} onClick={() => setFilter(t.id)}>
                  <span class="dot" />
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {d.machines.length === 0 ? (
        <div class="empty-big">
          <Icon name="dumbbell" />
          <b>No machines yet</b>
          <span>Add the machines you use to keep track of your weights and see your progress.</span>
          <button type="button" class="btn primary" onClick={() => setAdding(true)}>
            Add your first machine
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div class="empty">No machines match.</div>
      ) : (
        <div class="list">
          {rows.map((r) => {
            const t = r.machine.typeId ? typeById(d, r.machine.typeId) : null;
            const color = t?.color ?? NEUTRAL;
            return (
              <button type="button" class="wrow" key={r.machine.id} onClick={() => onOpenMachine(r.machine.id)}>
                <span class="wl">
                  <span class="wn">{r.machine.name}</span>
                  <span class="ws">
                    {t && <span style={{ color: t.color }}>{t.name}</span>}
                    {t && ' · '}
                    {r.last ? fmtDayMonth(parseDayKey(r.last).getTime(), now) : 'No weight yet'}
                  </span>
                </span>
                <Spark values={r.series} color={color} />
                <span class="wv num">{r.best === null ? '–' : fmtKg(r.best)}{r.best !== null && <small>kg</small>}</span>
              </button>
            );
          })}
        </div>
      )}

      {adding && <MachineSheet onClose={() => setAdding(false)} defaultTypeId={activeFilter} />}
    </main>
  );
}
