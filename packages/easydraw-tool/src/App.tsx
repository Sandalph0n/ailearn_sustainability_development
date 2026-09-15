import { useEffect, useRef, useState } from 'react';
import { setDiagramBackend } from '@/lib/backend';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useLernumiApp } from './app-store';
import Blocked from './Blocked';
import Dashboard from './Dashboard';
import Editor from './Editor';
import ReplayScreen from './replay/ReplayScreen';
import { LernumiDiagrams } from './diagrams';
import { ToolApiClient } from './platform/client';
import { EventRecorder } from './platform/event-recorder';

/**
 * Boot sequence, per the Lernumi tool contract:
 *   1. read + erase the launch fragment,
 *   2. `GET /context` to learn who is working on what and whether it is read-only,
 *   3. land on the dashboard straight away — there is no easydraw login here.
 */
export default function App() {
  const screen = useLernumiApp((s) => s.screen);
  const client = useLernumiApp((s) => s.client);
  const [diagrams, setDiagrams] = useState<LernumiDiagrams | null>(null);
  const recorderRef = useRef<EventRecorder | null>(null);

  useEffect(() => {
    const app = useLernumiApp.getState();
    let api: ToolApiClient | null = null;
    let cancelled = false;
    (async () => {
      try {
        api = await ToolApiClient.fromLaunchLocation();
        const context = await api.context();
        if (cancelled) return;
        const recorder = new EventRecorder(
          api,
          context.session.mode === 'OWNER' && context.session.capabilities.includes('events:append'),
        );
        recorderRef.current = recorder;
        const diagramStore = new LernumiDiagrams(api, (event) => recorder.add(event));
        const { shouldCaptureBaseline } = await recorder.initialize(context);
        if (shouldCaptureBaseline) await diagramStore.captureBaseline();
        if (cancelled) return;
        setDiagrams(diagramStore);
        app.setSession(api, context);
        // The shared editor chrome reads the signed-in user from the easydraw
        // auth store; there is no account here, so feed it the Lernumi person.
        useAuthStore.setState({
          user: { id: context.user.id, email: '', name: context.user.displayName },
          ready: true,
          logout: async () => undefined,
        });
        void api.startTokenRefresh();
        app.setScreen(context.session.mode === 'REVIEWER' ? { kind: 'replay' } : { kind: 'dashboard' });
      } catch (error) {
        if (cancelled) return;
        app.setScreen({
          kind: 'blocked',
          title: 'EasyDraw could not start',
          detail:
            error instanceof Error ? error.message : 'Return to Lernumi and open the tool again.',
        });
      }
    })();

    const onExpired = () =>
      useLernumiApp.getState().setScreen({
        kind: 'blocked',
        title: 'Your session has expired',
        detail:
          'Reopen EasyDraw from the assessment page in Lernumi to continue. Saved diagrams are kept.',
      });
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') void recorderRef.current?.flush();
    };
    const onPageHide = () => {
      void recorderRef.current?.flush();
    };
    window.addEventListener('lernumi:token-expired', onExpired);
    document.addEventListener('visibilitychange', flushWhenHidden);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      cancelled = true;
      api?.stopTokenRefresh();
      window.removeEventListener('lernumi:token-expired', onExpired);
      document.removeEventListener('visibilitychange', flushWhenHidden);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  // Route the editor autosave into the workspace. A read-only session never
  // writes: the canvas is locked, and anything that slips through is dropped.
  useEffect(() => {
    if (!diagrams) return;
    setDiagramBackend({
      saveDiagram: async (diagramId, payload) => {
        if (useLernumiApp.getState().readOnly) return;
        await diagrams.save(diagramId, payload);
        await recorderRef.current?.flush();
      },
    });
  }, [diagrams]);

  switch (screen.kind) {
    case 'booting':
      return (
        <div className="flex min-h-screen items-center justify-center bg-panel text-ink-muted">
          Opening EasyDraw…
        </div>
      );
    case 'blocked':
      return <Blocked title={screen.title} detail={screen.detail} />;
    case 'dashboard':
      return diagrams ? (
        <Dashboard
          diagrams={diagrams}
          flushEvents={() => recorderRef.current?.flush() ?? Promise.resolve()}
          onOpenReplay={async () => {
            await recorderRef.current?.flush();
            useLernumiApp.getState().setScreen({ kind: 'replay' });
          }}
        />
      ) : null;
    case 'editor':
      return diagrams ? <Editor key={screen.diagramId} diagramId={screen.diagramId} diagrams={diagrams} /> : null;
    case 'replay':
      return client ? <ReplayScreen client={client} /> : null;
  }
}
