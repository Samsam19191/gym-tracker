import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { parseDayKey } from '../lib/dates';
import { fmtKg, MONTHS_SHORT } from '../lib/format';
import type { WeightEntry, WorkoutType } from '../lib/model';
import { KG_STEP, parseKg } from '../lib/weights';
import { Icon, type IconName } from './icons';
import { toast } from './toast';

let openSheets = 0;

/** Bottom sheet. Lifts itself above the iOS keyboard using the visual viewport. */
export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    openSheets++;
    document.body.classList.add('locked');
    const vv = window.visualViewport;
    const fit = () => {
      if (!vv || !ref.current) return;
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      ref.current.style.setProperty('--kb', `${kb}px`);
    };
    vv?.addEventListener('resize', fit);
    vv?.addEventListener('scroll', fit);
    fit();
    return () => {
      openSheets--;
      if (openSheets === 0) document.body.classList.remove('locked');
      vv?.removeEventListener('resize', fit);
      vv?.removeEventListener('scroll', fit);
    };
  }, []);
  return (
    <div class="sheet-wrap">
      <div class="scrim" onClick={onClose} />
      <div class="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={label}>
        <div class="grab" />
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({ title, onCancel, cancelLabel = 'Cancel' }: { title: string; onCancel: () => void; cancelLabel?: string }) {
  return (
    <div class="sheet-head">
      <button type="button" class="link muted" onClick={onCancel}>
        {cancelLabel}
      </button>
      <div class="sheet-title">{title}</div>
      <span class="sheet-head-spacer" />
    </div>
  );
}

export function IconButton({ icon, label, onClick, class: cls, disabled }: { icon: IconName; label: string; onClick: () => void; class?: string; disabled?: boolean }) {
  return (
    <button type="button" class={cls ? `iconbtn ${cls}` : 'iconbtn'} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <Icon name={icon} />
    </button>
  );
}

export function TypeChip({ type, small }: { type: WorkoutType; small?: boolean }) {
  return (
    <span class={small ? 'chip sm' : 'chip'} style={{ '--c': type.color }}>
      <span class="dot" />
      {type.name}
    </span>
  );
}

export function TypeChips({
  types,
  value,
  onChange,
  allowNone,
  label,
}: {
  types: WorkoutType[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowNone?: boolean;
  label: string;
}) {
  return (
    <div class="chips" role="radiogroup" aria-label={label}>
      {types.map((t) => {
        const sel = value === t.id;
        return (
          <button
            type="button"
            key={t.id}
            role="radio"
            aria-checked={sel}
            class={sel ? 'fchip sel' : 'fchip'}
            style={{ '--c': t.color }}
            onClick={() => onChange(sel && allowNone ? null : t.id)}
          >
            <span class="dot" />
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} class={on ? 'toggle on' : 'toggle'} onClick={() => onChange(!on)} />;
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div class="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.value} role="radio" aria-checked={o.value === value} class={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A button that must be held, so a stray tap can't trigger it. */
export function HoldButton({ label, onDone, ms = 800, hint }: { label: string; onDone: () => void; ms?: number; hint: string }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const done = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  const start = () => {
    done.current = false;
    clearTimeout(timer.current);
    setHolding(true);
    timer.current = setTimeout(() => {
      done.current = true;
      setHolding(false);
      onDone();
    }, ms);
  };
  const cancel = () => {
    clearTimeout(timer.current);
    setHolding(false);
  };
  return (
    <button
      type="button"
      class={holding ? 'hold holding' : 'hold'}
      style={{ '--hold': `${ms}ms` }}
      aria-label={label}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (done.current) {
          done.current = false;
          return;
        }
        toast(hint);
      }}
    >
      <span class="hold-fill" />
      <Icon name="stop" />
      <span>{holding ? 'Keep holding' : label}</span>
    </button>
  );
}

const roundKg = (v: number) => Math.round(v * 100) / 100;

export function KgStepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  const commit = () => {
    const v = parseKg(text);
    if (v !== null) onChange(v);
    else if (text.trim()) toast('Enter a weight between 0 and 1000 kg', { tone: 'error' });
    setEditing(false);
  };
  return (
    <div class="stepper" aria-label={label}>
      <button type="button" class="sb" aria-label="Decrease weight" disabled={value - KG_STEP <= 0} onClick={() => onChange(roundKg(value - KG_STEP))}>
        −
      </button>
      {editing ? (
        <input
          ref={inputRef}
          class="sv-input"
          type="text"
          inputMode="decimal"
          aria-label="Weight in kg"
          value={text}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <button
          type="button"
          class="sv"
          aria-label={`${fmtKg(value)} kg, tap to type a weight`}
          onClick={() => {
            setText(fmtKg(value));
            setEditing(true);
          }}
        >
          {fmtKg(value)}
          <small>kg</small>
        </button>
      )}
      <button type="button" class="sb" aria-label="Increase weight" onClick={() => onChange(roundKg(value + KG_STEP))}>
        +
      </button>
    </div>
  );
}

export function Spark({ values, color }: { values: number[]; color: string }) {
  const w = 52;
  const h = 22;
  if (values.length < 2) return <span class="spark-empty" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const r = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 6) + 3, h - 3 - ((v - min) / r) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg class="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} style={{ fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.85 }} />
      <circle cx={lx} cy={ly} r={2.3} style={{ fill: color }} />
    </svg>
  );
}

/** Progress chart of logged weights over time. */
export function WeightChart({ entries, color }: { entries: WeightEntry[]; color: string }) {
  if (entries.length === 0) return <div class="chart-empty">No weights in this period</div>;
  const W = 300;
  const H = 140;
  const x0 = 26;
  const x1 = 290;
  const y0 = 12;
  const y1 = 108;
  const times = entries.map((e) => parseDayKey(e.date).getTime());
  const tMin = times[0];
  const tMax = times[times.length - 1];
  const span = tMax - tMin || 1;
  const kgs = entries.map((e) => e.kg);
  let vMin = Math.min(...kgs);
  let vMax = Math.max(...kgs);
  if (vMax - vMin < 5) {
    const mid = (vMax + vMin) / 2;
    vMin = mid - 2.5;
    vMax = mid + 2.5;
  }
  const pad = (vMax - vMin) * 0.12;
  vMin -= pad;
  vMax += pad;
  const X = (t: number) => (entries.length === 1 ? (x0 + x1) / 2 : x0 + ((t - tMin) / span) * (x1 - x0));
  const Y = (v: number) => y1 - ((v - vMin) / (vMax - vMin)) * (y1 - y0);
  const pts = entries.map((e, i) => [X(times[i]), Y(e.kg)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${y1} L${pts[0][0].toFixed(1)} ${y1} Z`;
  const step = niceStep((vMax - vMin) / 3);
  const grid: number[] = [];
  for (let v = Math.ceil(vMin / step) * step; v <= vMax; v += step) grid.push(Math.round(v * 100) / 100);
  const labels = monthTicks(tMin, tMax);
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weight progress chart">
      <defs>
        <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: color, stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {grid.map((v) => (
        <g key={v}>
          <line x1={x0} x2={x1} y1={Y(v)} y2={Y(v)} class="chart-grid" />
          <text x={0} y={Y(v) + 3.5} class="chart-label">
            {fmtKg(v)}
          </text>
        </g>
      ))}
      {entries.length > 1 && <path d={area} fill="url(#chart-fill)" />}
      {entries.length > 1 && <path d={line} style={{ fill: 'none', stroke: color, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }} />}
      {pts.slice(0, -1).map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={2} style={{ fill: color, opacity: 0.6 }} />
      ))}
      <circle cx={lx} cy={ly} r={7} style={{ fill: color, opacity: 0.2 }} />
      <circle cx={lx} cy={ly} r={3.5} style={{ fill: color }} />
      {entries.length > 1 &&
        labels.map((l) => {
          const x = X(l.t);
          return (
            <text key={l.t} x={Math.min(Math.max(x, x0), x1)} y={H - 6} class="chart-label" text-anchor={x > x1 - 14 ? 'end' : x < x0 + 14 ? 'start' : 'middle'}>
              {l.label}
            </text>
          );
        })}
    </svg>
  );
}

function niceStep(raw: number): number {
  const candidates = [1, 2, 2.5, 5, 10, 20, 25, 50, 100];
  return candidates.find((c) => c >= raw) ?? 100;
}

function monthTicks(tMin: number, tMax: number): { t: number; label: string }[] {
  const out: { t: number; label: string }[] = [];
  const d = new Date(tMin);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() < tMin) d.setMonth(d.getMonth() + 1);
  while (d.getTime() <= tMax && out.length < 24) {
    out.push({ t: d.getTime(), label: MONTHS_SHORT[d.getMonth()] });
    d.setMonth(d.getMonth() + 1);
  }
  // Too many months to label: keep every other / every third one.
  const every = Math.ceil(out.length / 6);
  return out.filter((_, i) => i % every === 0);
}

export function Tiles({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div class="tiles">
      {items.map((it) => (
        <div class="tile" key={it.label}>
          <b class="num">{it.value}</b>
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export function SetPips({ sets, color }: { sets: number; color: string }) {
  const shown = Math.min(sets, 10);
  return (
    <span class="pips" style={{ '--c': color }} aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => (
        <i key={i} />
      ))}
      {sets > shown && <em>+</em>}
    </span>
  );
}
