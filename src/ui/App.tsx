import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { typeById } from '../lib/catalog';
import { fmtClock } from '../lib/format';
import { applyUpdate, useUpdateAvailable } from '../platform/pwa';
import { setKeepAwake } from '../platform/wakelock';
import { DialogHost } from './dialog';
import { Icon, type IconName } from './icons';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { MachineScreen } from './screens/MachineScreen';
import { Settings } from './screens/Settings';
import { Summary } from './screens/Summary';
import { Weights } from './screens/Weights';
import { RestBeeper, WorkoutScreen } from './screens/WorkoutScreen';
import { useData, useNow } from './store';
import { useToast } from './toast';

type Tab = 'train' | 'history' | 'weights';
type Route = { name: 'settings' } | { name: 'machine'; id: string } | null;

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'train', label: 'Train', icon: 'timer' },
  { id: 'history', label: 'History', icon: 'cal' },
  { id: 'weights', label: 'Weights', icon: 'dumbbell' },
];

function MiniBar({ onOpen }: { onOpen: () => void }) {
  const d = useData();
  const a = d.active!;
  const now = useNow(500);
  const t = typeById(d, a.typeId);
  const label = a.endedAt !== null ? 'Finished, tap to save' : a.rest ? `Resting ${fmtClock(now - a.rest.start)}` : fmtClock(now - a.start);
  return (
    <button type="button" class="minibar" style={{ '--c': t.color }} onClick={onOpen} aria-label={`Back to ${t.name} workout`}>
      <span class="dot" />
      <span class="mb-name">{t.name}</span>
      <span class="mb-time num">{label}</span>
      <span class="mb-cta">
        Back to workout <Icon name="chevR" />
      </span>
    </button>
  );
}

function ToastHost() {
  const t = useToast();
  if (!t) return null;
  return (
    <div class={`toast ${t.tone}`} role="status" key={t.id}>
      <span>{t.message}</span>
      {t.action && (
        <button type="button" onClick={t.action.run}>
          {t.action.label}
        </button>
      )}
    </div>
  );
}

/** Waits until no workout is in progress, so it never sits on top of the workout buttons. */
function UpdateBanner({ hidden }: { hidden: boolean }) {
  const available = useUpdateAvailable();
  if (!available || hidden) return null;
  return (
    <div class="update" role="status">
      <span>A new version is ready</span>
      <button type="button" onClick={applyUpdate}>
        Update
      </button>
    </div>
  );
}

export function App({ startupWarning }: { startupWarning: string | null }) {
  const d = useData();
  const [tab, setTab] = useState<Tab>('train');
  const [route, setRoute] = useState<Route>(null);
  const [warning, setWarning] = useState(startupWarning);
  const a = d.active;
  const running = !!a && a.endedAt === null;

  useEffect(() => {
    setKeepAwake(running && d.settings.keepScreenOn);
  }, [running, d.settings.keepScreenOn]);

  // Each screen starts at the top.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, route?.name, route && route.name === 'machine' ? route.id : null]);

  const goTab = (t: Tab) => {
    setRoute(null);
    setTab(t);
  };

  let content;
  if (route?.name === 'settings') content = <Settings onClose={() => setRoute(null)} />;
  else if (route?.name === 'machine') content = <MachineScreen id={route.id} onBack={() => setRoute(null)} />;
  else if (tab === 'train') content = a ? a.endedAt !== null ? <Summary /> : <WorkoutScreen onOpenWeights={() => goTab('weights')} /> : <Home onOpenSettings={() => setRoute({ name: 'settings' })} />;
  else if (tab === 'history') content = <History />;
  else content = <Weights onOpenMachine={(id) => setRoute({ name: 'machine', id })} />;

  const inWorkout = tab === 'train' && !!a && route === null;
  const showTabBar = !inWorkout && route?.name !== 'settings';
  const showMiniBar = !!a && !inWorkout;

  return (
    <div class={showMiniBar ? 'app has-minibar' : 'app'}>
      {warning && (
        <div class="banner error" role="alert">
          <Icon name="warn" />
          <div class="banner-text">
            <span>{warning}</span>
          </div>
          <button type="button" class="iconbtn sm plain" aria-label="Dismiss" onClick={() => setWarning(null)}>
            <Icon name="x" />
          </button>
        </div>
      )}
      {content}
      {showMiniBar && <MiniBar onOpen={() => goTab('train')} />}
      {showTabBar && (
        <nav class="tabbar" aria-label="Main">
          {TABS.map((t) => (
            <button type="button" key={t.id} class={tab === t.id ? 'tab on' : 'tab'} aria-current={tab === t.id ? 'page' : undefined} onClick={() => goTab(t.id)}>
              <Icon name={t.icon} />
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <UpdateBanner hidden={!!a} />
      <RestBeeper />
      <ToastHost />
      <DialogHost />
    </div>
  );
}
