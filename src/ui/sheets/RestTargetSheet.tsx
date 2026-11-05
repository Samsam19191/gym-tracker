import { REST_TARGET_OPTIONS } from '../../lib/defaults';
import { fmtClock } from '../../lib/format';
import { Sheet, SheetHeader } from '../components';
import { Icon } from '../icons';
import { dispatch, useData } from '../store';

export const restLabel = (s: number | null) => (s === null ? 'Off' : fmtClock(s * 1000));

export function RestTargetSheet({ onClose }: { onClose: () => void }) {
  const d = useData();
  const current = d.settings.restTargetSec;
  return (
    <Sheet label="Rest target" onClose={onClose}>
      <SheetHeader title="Rest target" onCancel={onClose} cancelLabel="Close" />
      <div class="form-note">During a rest, the ring fills up and a sound plays when you reach this time.</div>
      <div class="group" role="radiogroup" aria-label="Rest target">
        {REST_TARGET_OPTIONS.map((opt) => (
          <button
            type="button"
            role="radio"
            aria-checked={current === opt}
            class="grow"
            key={String(opt)}
            onClick={() => {
              dispatch((x) => ({ ...x, settings: { ...x.settings, restTargetSec: opt } }));
              onClose();
            }}
          >
            {restLabel(opt)}
            <span class="r">{current === opt && <Icon name="check" />}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
