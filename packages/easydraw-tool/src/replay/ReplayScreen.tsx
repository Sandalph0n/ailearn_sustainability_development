import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  History,
  Pause,
  Play,
} from 'lucide-react';

import Logo from '@/lib/components/Logo';
import { useLernumiApp } from '../app-store';
import type { ToolApiClient } from '../platform/client';
import ReplayCanvas from './ReplayCanvas';
import {
  ALL_SESSIONS,
  describeReplayEvent,
  eventDelay,
  loadReplayData,
  replayFrame,
  replayScope,
  type ReplayData,
} from './model';

const TIME = new Intl.DateTimeFormat('en-AU', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});
const SESSION_TIME = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export default function ReplayScreen({ client }: { client: ToolApiClient }) {
  const context = useLernumiApp((state) => state.context);
  const navigate = useLernumiApp((state) => state.navigate);
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState('');
  const [scope, setScope] = useState(ALL_SESSIONS);
  const [position, setPosition] = useState(0);
  const [pinnedDocumentId, setPinnedDocumentId] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<'time' | 'event'>('event');
  const [rate, setRate] = useState(2);
  const [cadence, setCadence] = useState(500);

  useEffect(() => {
    let cancelled = false;
    void loadReplayData(client)
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Replay history could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const model = useMemo(() => data ? replayScope(data, scope) : null, [data, scope]);
  const frame = useMemo(
    () => model ? replayFrame(model, position, pinnedDocumentId) : null,
    [model, position, pinnedDocumentId],
  );
  const selectedPage = frame?.diagram?.pages.find((page) => page.id === pageId)
    ?? frame?.diagram?.pages.find((page) => page.id === frame.diagram?.activePageId)
    ?? frame?.diagram?.pages[0]
    ?? null;

  useEffect(() => {
    setPosition(0);
    setPinnedDocumentId(null);
    setPlaying(false);
  }, [scope]);

  useEffect(() => {
    if (!frame?.diagram) {
      setPageId(null);
      return;
    }
    if (!frame.diagram.pages.some((page) => page.id === pageId)) {
      setPageId(frame.diagram.activePageId ?? frame.diagram.pages[0]?.id ?? null);
    }
  }, [frame?.diagram, pageId]);

  useEffect(() => {
    if (!playing || !model || position >= model.timeline.events.length) {
      if (playing && model && position >= model.timeline.events.length) setPlaying(false);
      return;
    }
    const delay = position === 0 ? 120 : eventDelay(model, position, mode, rate, cadence);
    const timer = window.setTimeout(() => setPosition((value) => value + 1), delay);
    return () => window.clearTimeout(timer);
  }, [playing, model, position, mode, rate, cadence]);

  const seek = (next: number) => {
    if (!model) return;
    setPlaying(false);
    setPosition(Math.max(0, Math.min(next, model.timeline.events.length)));
  };

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-panel px-6">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto text-danger" size={30} />
          <h1 className="mt-4 text-xl font-semibold text-ink">Replay could not be opened</h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{error}</p>
        </div>
      </main>
    );
  }

  if (!data || !model || !frame) {
    return <div className="grid min-h-screen place-items-center bg-panel text-sm text-ink-muted">Loading replay history…</div>;
  }

  const currentSession = frame.sessionId
    ? data.sessions.find((session) => session.id === frame.sessionId)
    : null;
  const integrityGood = frame.integrity === 'VERIFIED';
  const ownerMode = context?.session.mode === 'OWNER';

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-panel text-ink">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-white px-4">
        {ownerMode ? (
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="grid size-9 place-items-center rounded-md text-ink-muted hover:bg-surface-hover hover:text-ink"
            aria-label="Back to diagrams"
          >
            <ArrowLeft size={19} />
          </button>
        ) : null}
        <Logo size="sm" />
        <div className="h-6 w-px bg-line" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Replay · {context?.assessment.name ?? 'Assessment'}</p>
          <p className="truncate text-xs text-ink-muted">
            {context?.offering.subject.code} · {context?.attempt.owner.displayName}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            title={integrityGood ? 'The server hash chain and document checkpoints are valid.' : 'Some replay data could not be fully verified.'}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
              integrityGood
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-orange-200 bg-orange-50 text-orange-700'
            }`}
          >
            {integrityGood ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {frame.integrity.toLowerCase()}
          </span>
          {!ownerMode ? <span className="text-xs text-ink-muted">Review mode · read-only</span> : null}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-line bg-white">
          <div className="border-b border-line px-4 py-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <History size={16} /> History explorer
            </div>
            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Session scope
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-line bg-white px-2.5 text-sm font-normal normal-case tracking-normal outline-none focus:border-primary"
              >
                <option value={ALL_SESSIONS}>Entire attempt · {data.sessions.length} sessions</option>
                {data.sessions.map((session, index) => (
                  <option key={session.id} value={session.id}>
                    Session {index + 1} · {SESSION_TIME.format(new Date(session.startedAt))}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            {model.timeline.events.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm leading-6 text-ink-muted">No drawing activity was recorded in this scope.</p>
            ) : model.timeline.events.map((item, index) => {
              const active = position === index + 1;
              return (
                <button
                  type="button"
                  key={`${model.timeline.eventSessionIds[index]}-${item.sequence}`}
                  onClick={() => seek(index + 1)}
                  className={`group flex w-full items-start gap-2.5 border-l-2 px-3 py-2.5 text-left ${
                    active
                      ? 'border-primary bg-primary-tint'
                      : 'border-transparent hover:bg-surface-hover'
                  }`}
                >
                  <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${active ? 'bg-primary' : 'bg-line'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{describeReplayEvent(item)}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted">
                      <Clock3 size={11} /> {TIME.format(new Date(item.event.at))}
                    </span>
                  </span>
                  <span className="text-[11px] tabular-nums text-ink-muted">{index + 1}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_7.75rem] bg-[#f7f9f8]">
          <div className="flex min-h-12 items-center gap-3 border-b border-line bg-white px-4">
            <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-ink-muted">
              <FileText size={15} />
              <select
                value={frame.diagram?.documentId ?? ''}
                disabled={frame.diagrams.length === 0}
                onChange={(event) => setPinnedDocumentId(event.target.value || null)}
                className="h-8 max-w-64 rounded-md border border-line bg-white px-2 text-sm font-medium text-ink outline-none focus:border-primary"
                aria-label="Diagram shown"
              >
                {frame.diagrams.length === 0 ? <option value="">No diagrams at this point</option> : null}
                {frame.diagrams.map((diagram) => <option key={diagram.documentId} value={diagram.documentId}>{diagram.title}</option>)}
              </select>
            </label>
            {frame.diagram && frame.diagram.pages.length > 1 ? (
              <label className="flex items-center gap-2 text-xs font-medium text-ink-muted">
                Page
                <select
                  value={selectedPage?.id ?? ''}
                  onChange={(event) => setPageId(event.target.value)}
                  className="h-8 max-w-52 rounded-md border border-line bg-white px-2 text-sm text-ink outline-none focus:border-primary"
                >
                  {frame.diagram.pages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
                </select>
              </label>
            ) : null}
            <span className="ml-auto truncate text-xs text-ink-muted">
              {currentSession ? `Session started ${SESSION_TIME.format(new Date(currentSession.startedAt))}` : 'Initial workspace state'}
            </span>
          </div>

          <section className="relative min-h-0 overflow-hidden">
            {selectedPage ? (
              <ReplayCanvas page={selectedPage} />
            ) : (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <FileText className="mx-auto text-ink-muted" size={30} />
                  <p className="mt-3 text-sm font-medium">No diagram at this event</p>
                  <p className="mt-1 text-xs text-ink-muted">Move the playhead forward or choose another event.</p>
                </div>
              </div>
            )}
          </section>

          <section className="border-t border-line bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => seek(position - 1)} disabled={position === 0} className="replay-transport-button" aria-label="Previous event">
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (position >= frame.total) setPosition(0);
                  setPlaying((value) => !value);
                }}
                disabled={frame.total === 0}
                className="flex h-9 min-w-24 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
                {playing ? 'Pause' : 'Play'}
              </button>
              <button type="button" onClick={() => seek(position + 1)} disabled={position >= frame.total} className="replay-transport-button" aria-label="Next event">
                <ChevronRight size={18} />
              </button>
              <span className="ml-1 min-w-0 flex-1 truncate text-sm font-medium">{frame.label}</span>
              <span className="text-xs tabular-nums text-ink-muted">{position} / {frame.total}</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as 'time' | 'event')} className="replay-select" aria-label="Playback mode">
                <option value="event">Event steps</option>
                <option value="time">Real time</option>
              </select>
              {mode === 'event' ? (
                <select value={cadence} onChange={(event) => setCadence(Number(event.target.value))} className="replay-select" aria-label="Event cadence">
                  <option value={250}>0.25s / event</option>
                  <option value={500}>0.5s / event</option>
                  <option value={1000}>1s / event</option>
                  <option value={2000}>2s / event</option>
                </select>
              ) : (
                <select value={rate} onChange={(event) => setRate(Number(event.target.value))} className="replay-select" aria-label="Playback speed">
                  <option value={0.5}>0.5×</option>
                  <option value={1}>1×</option>
                  <option value={2}>2×</option>
                  <option value={4}>4×</option>
                  <option value={10}>10×</option>
                </select>
              )}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="w-14 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Timeline</span>
              <input
                type="range"
                min={0}
                max={Math.max(frame.total, 1)}
                value={position}
                disabled={frame.total === 0}
                onChange={(event) => seek(Number(event.target.value))}
                className="replay-range min-w-0 flex-1"
                aria-label="Replay timeline"
              />
              <time className="w-24 text-right text-xs tabular-nums text-ink-muted">
                {frame.at ? TIME.format(new Date(frame.at)) : 'Start'}
              </time>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
