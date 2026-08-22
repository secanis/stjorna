import { render } from 'solid-js/web';
import { Router, Route, Navigate } from '@solidjs/router';
import Settings from '~/pages/Settings';
import Catalog from '~/pages/Catalog';
import ApiLog from '~/components/ApiLog';
import { hasSavedUrl } from '~/lib/pb';
import './index.css';

function Gate(props: { children: any }) {
  return hasSavedUrl()() ? props.children : <Navigate href="/settings" />;
}

render(
  () => (
    <div class="min-h-full flex flex-col">
      <Router>
        <Route path="/settings" component={Settings} />
        <Route path="/" component={() => <Gate><Catalog /></Gate>} />
        <Route path="*" component={() => <Navigate href="/" />} />
      </Router>
      <ApiLog />
    </div>
  ),
  document.getElementById('root')!
);
