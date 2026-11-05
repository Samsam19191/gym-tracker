import { render } from 'preact';
import { registerServiceWorker } from './platform/pwa';
import { App } from './ui/App';
import { initStore } from './ui/store';
import './styles.css';

const warning = initStore();
render(<App startupWarning={warning} />, document.getElementById('app')!);
registerServiceWorker();
