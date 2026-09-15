import type { IDisposable } from 'monaco-editor';

import type { ReplayController, ReplayFrame, ReplayOutlineItem } from './controller';
import {
    axisFraction,
    buildReplayAxis,
    interpolateReplayCursor,
    interpolateReplayFraction,
    nearestReplayPosition,
    type ReplayAxis,
    type ReplayAxisMode,
} from './axis';

type ReplayTransportCallbacks = {
    revealEditor(): void;
    showFrame(frame: ReplayFrame): void;
};

const ALL_SESSIONS = '__all__';
const MIN_WINDOW = 0.015;

export class ReplayTransport implements IDisposable {
    private readonly abort = new AbortController();
    private readonly resizeObserver: ResizeObserver;
    private model: ReplayController | null = null;
    private outline: ReplayOutlineItem[] = [];
    private axis: ReplayAxis = buildReplayAxis([], 'time');
    private scopeKey = '';
    private mode: ReplayAxisMode = 'time';
    private playing = false;
    private timeRate = 1;
    private cadenceMs = 500;
    private playbackCursor = 0;
    private eventAccumulator = 0;
    private lastFrame = 0;
    private animationFrame: number | undefined;
    private pinnedFile: string | null = null;
    private position = 0;
    private viewStart = 0;
    private viewEnd = 1;
    private trackWidth = 1;
    private syncingScroll = false;

    private readonly play: HTMLButtonElement;
    private readonly previous: HTMLButtonElement;
    private readonly next: HTMLButtonElement;
    private readonly scope: HTMLSelectElement;
    private readonly modeSelect: HTMLSelectElement;
    private readonly rate: HTMLSelectElement;
    private readonly cadence: HTMLSelectElement;
    private readonly clock: HTMLElement;
    private readonly file: HTMLSelectElement;
    private readonly jump: HTMLButtonElement;
    private readonly zoomOut: HTMLButtonElement;
    private readonly zoomIn: HTMLButtonElement;
    private readonly fit: HTMLButtonElement;
    private readonly scale: HTMLElement;
    private readonly scroll: HTMLElement;
    private readonly canvas: HTMLElement;
    private readonly ruler: HTMLElement;
    private readonly lane: HTMLElement;
    private readonly status: HTMLElement;
    private readonly overview: HTMLElement;
    private readonly overviewMarks: HTMLElement;
    private readonly overviewWindow: HTMLElement;
    private playheadElement: HTMLElement | null = null;

    constructor(
        private readonly container: HTMLElement,
        private readonly callbacks: ReplayTransportCallbacks,
    ) {
        container.innerHTML = `<div class="replay-studio">
            <div class="replay-commandbar">
                <div class="replay-playback-cluster" role="group" aria-label="Replay transport">
                    <button class="replay-icon-button" data-role="previous" type="button" title="Previous event"><span class="codicon codicon-debug-step-back"></span></button>
                    <button class="replay-primary" data-role="play" type="button"><span class="codicon codicon-play"></span><span>Play</span></button>
                    <button class="replay-icon-button" data-role="next" type="button" title="Next event"><span class="codicon codicon-debug-step-over"></span></button>
                    <output class="replay-clock" data-role="clock">Event 0 / 0</output>
                </div>
                <div class="replay-options">
                    <label class="replay-field"><span>Scope</span><select data-role="scope" aria-label="Replay scope"><option value="${ALL_SESSIONS}">All sessions</option></select></label>
                    <label class="replay-field"><span>Playback</span><select data-role="mode" aria-label="Playback mode"><option value="time">Real time</option><option value="event">Event steps</option></select></label>
                    <label class="replay-field" data-role="rate-field"><span>Speed</span><select data-role="rate" aria-label="Real-time playback speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option><option value="10">10×</option></select></label>
                    <label class="replay-field" data-role="cadence-field" hidden><span>Cadence</span><select data-role="cadence" aria-label="Event playback cadence"><option value="100">0.1s / event</option><option value="250">0.25s / event</option><option value="500" selected>0.5s / event</option><option value="1000">1s / event</option><option value="2000">2s / event</option></select></label>
                    <label class="replay-field replay-file-field"><span>File</span><select data-role="file" aria-label="File shown"><option value="">Follow the edit</option></select></label>
                    <button class="replay-quiet-button" data-role="jump" type="button" title="Jump to the next notable event"><span class="codicon codicon-flag"></span><span>Next flag</span></button>
                </div>
            </div>
            <div class="replay-timeline-header">
                <span class="replay-scale" data-role="scale">Entire attempt</span>
                <div class="replay-zoom-controls" role="group" aria-label="Timeline zoom">
                    <button class="replay-icon-button" data-role="zoom-out" type="button" title="Zoom out"><span class="codicon codicon-zoom-out"></span></button>
                    <button class="replay-icon-button" data-role="zoom-in" type="button" title="Zoom in"><span class="codicon codicon-zoom-in"></span></button>
                    <button class="replay-quiet-button" data-role="fit" type="button" title="Fit the complete replay"><span class="codicon codicon-screen-full"></span><span>Fit</span></button>
                </div>
            </div>
            <div class="replay-timeline-scroll" data-role="scroll" tabindex="0" aria-label="Replay timeline. Use left and right arrow keys to move between events.">
                <div class="replay-timeline-canvas" data-role="canvas">
                    <div class="replay-ruler" data-role="ruler"></div>
                    <div class="replay-event-lane" data-role="lane"></div>
                </div>
            </div>
            <div class="replay-status" data-role="status">No recorded events are available.</div>
            <div class="replay-overview-row">
                <span class="replay-overview-label">Overview</span>
                <div class="replay-overview" data-role="overview" title="Drag the window or either handle to change the visible range">
                    <div class="replay-overview-marks" data-role="overview-marks"></div>
                    <div class="replay-overview-window" data-role="overview-window">
                        <span class="replay-overview-handle start" data-handle="start" role="separator" aria-label="Visible range start"></span>
                        <span class="replay-overview-grip"></span>
                        <span class="replay-overview-handle end" data-handle="end" role="separator" aria-label="Visible range end"></span>
                    </div>
                </div>
            </div>
        </div>`;

        const required = <T extends Element>(selector: string): T => {
            const element = container.querySelector<T>(selector);
            if (!element) throw new Error(`Replay control is missing: ${selector}`);
            return element;
        };
        this.play = required('[data-role="play"]');
        this.previous = required('[data-role="previous"]');
        this.next = required('[data-role="next"]');
        this.scope = required('[data-role="scope"]');
        this.modeSelect = required('[data-role="mode"]');
        this.rate = required('[data-role="rate"]');
        this.cadence = required('[data-role="cadence"]');
        this.clock = required('[data-role="clock"]');
        this.file = required('[data-role="file"]');
        this.jump = required('[data-role="jump"]');
        this.zoomOut = required('[data-role="zoom-out"]');
        this.zoomIn = required('[data-role="zoom-in"]');
        this.fit = required('[data-role="fit"]');
        this.scale = required('[data-role="scale"]');
        this.scroll = required('[data-role="scroll"]');
        this.canvas = required('[data-role="canvas"]');
        this.ruler = required('[data-role="ruler"]');
        this.lane = required('[data-role="lane"]');
        this.status = required('[data-role="status"]');
        this.overview = required('[data-role="overview"]');
        this.overviewMarks = required('[data-role="overview-marks"]');
        this.overviewWindow = required('[data-role="overview-window"]');
        this.bind();
        this.resizeObserver = new ResizeObserver(() => this.layoutTimeline(true));
        this.resizeObserver.observe(this.scroll);
        this.setEnabled(false);
    }

    connect(model: ReplayController): void {
        this.model = model;
        this.syncFromModel();
    }

    syncFromModel(startAt?: number): void {
        const model = this.model;
        if (!model) return;
        const state = model.snapshot();
        this.renderScopeOptions(state.sessions, state.scope, state.selectedSessionId);
        if (state.loading && state.events.length === 0) {
            this.status.textContent = 'Loading recorded activity…';
            this.setEnabled(false);
            return;
        }
        if (state.message) {
            this.status.textContent = state.message;
            this.setEnabled(false);
            return;
        }

        const nextScope = state.scope === 'all' ? ALL_SESSIONS : (state.selectedSessionId ?? '');
        const scopeChanged = nextScope !== this.scopeKey;
        this.scopeKey = nextScope;
        this.outline = model.outline();
        this.axis = buildReplayAxis(this.outline, this.mode);
        this.setEnabled(this.outline.length > 0);
        if (scopeChanged) {
            this.setPlaying(false);
            this.viewStart = 0;
            this.viewEnd = 1;
        }
        if (this.outline.length === 0) {
            this.position = 0;
            this.status.textContent = 'No recorded events are available in this scope.';
            this.drawClock();
            this.renderAll();
            return;
        }
        const position = startAt === undefined
            ? Math.min(model.history().position, this.outline.length)
            : Math.min(Math.max(startAt + 1, 0), this.outline.length);
        this.seek(position, false);
        this.renderAll();
    }

    syncPlayhead(): void {
        if (!this.model || this.playing) return;
        const position = Math.min(this.model.history().position, this.outline.length);
        if (position !== this.position) this.seek(position, false);
    }

    dispose(): void {
        this.setPlaying(false);
        this.resizeObserver.disconnect();
        this.abort.abort();
    }

    private bind(): void {
        const signal = this.abort.signal;
        this.play.addEventListener('click', () => {
            this.callbacks.revealEditor();
            this.setPlaying(!this.playing);
        }, { signal });
        this.previous.addEventListener('click', () => {
            this.callbacks.revealEditor();
            this.setPlaying(false);
            this.seek(this.position - 1);
        }, { signal });
        this.next.addEventListener('click', () => {
            this.callbacks.revealEditor();
            this.setPlaying(false);
            this.seek(this.position + 1);
        }, { signal });
        this.scope.addEventListener('change', () => {
            this.setPlaying(false);
            if (!this.model) return;
            void (this.scope.value === ALL_SESSIONS
                ? this.model.selectAll()
                : this.model.select(this.scope.value));
        }, { signal });
        this.modeSelect.addEventListener('change', () => {
            this.setPlaying(false);
            this.mode = this.modeSelect.value === 'event' ? 'event' : 'time';
            this.container.querySelector<HTMLElement>('[data-role="rate-field"]')!.hidden = this.mode !== 'time';
            this.container.querySelector<HTMLElement>('[data-role="cadence-field"]')!.hidden = this.mode !== 'event';
            this.axis = buildReplayAxis(this.outline, this.mode);
            this.snapPlaybackCursor();
            this.eventAccumulator = 0;
            this.viewStart = 0;
            this.viewEnd = 1;
            this.renderAll();
        }, { signal });
        this.rate.addEventListener('change', () => {
            this.timeRate = Number(this.rate.value) || 1;
        }, { signal });
        this.cadence.addEventListener('change', () => {
            this.cadenceMs = Number(this.cadence.value) || 500;
        }, { signal });
        this.file.addEventListener('change', () => {
            this.callbacks.revealEditor();
            this.pinnedFile = this.file.value || null;
            this.seek(this.position);
        }, { signal });
        this.jump.addEventListener('click', () => {
            this.callbacks.revealEditor();
            const next = this.outline.findIndex((item, index) => index >= this.position && item.notable);
            if (next < 0) return;
            this.setPlaying(false);
            this.seek(next + 1);
        }, { signal });
        this.zoomOut.addEventListener('click', () => this.zoom(0.6), { signal });
        this.zoomIn.addEventListener('click', () => this.zoom(1.7), { signal });
        this.fit.addEventListener('click', () => {
            this.viewStart = 0;
            this.viewEnd = 1;
            this.layoutTimeline(true);
        }, { signal });
        this.scroll.addEventListener('scroll', () => this.onTimelineScroll(), { signal });
        this.scroll.addEventListener('keydown', (event) => this.onTimelineKeydown(event), { signal });
        this.lane.addEventListener('pointerdown', (event) => {
            if (event.button !== 0 || this.outline.length === 0) return;
            this.callbacks.revealEditor();
            this.setPlaying(false);
            const bounds = this.canvas.getBoundingClientRect();
            const fraction = (event.clientX - bounds.left) / bounds.width;
            if (this.mode === 'event') {
                this.seek(nearestReplayPosition(this.axis, fraction));
            } else {
                const cursor = interpolateReplayFraction(this.axis, fraction);
                this.seek(cursor.position, true, false, cursor.playbackAt);
            }
        }, { signal });
        this.overview.addEventListener('pointerdown', (event) => this.startOverviewDrag(event), { signal });
    }

    private renderScopeOptions(
        sessions: ReturnType<ReplayController['snapshot']>['sessions'],
        scope: 'all' | 'session',
        selectedSessionId: string | null,
    ): void {
        const expected = [ALL_SESSIONS, ...sessions.map((session) => session.id)];
        const current = [...this.scope.options].map((option) => option.value);
        if (JSON.stringify(expected) !== JSON.stringify(current)) {
            this.scope.replaceChildren(new Option(`All sessions (${sessions.length})`, ALL_SESSIONS));
            [...sessions]
                .sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt))
                .forEach((session, index) => this.scope.append(new Option(
                    `Session ${index + 1} · ${formatSessionTime(session.startedAt)}`,
                    session.id,
                )));
        }
        this.scope.value = scope === 'all' ? ALL_SESSIONS : (selectedSessionId ?? ALL_SESSIONS);
    }

    private setEnabled(enabled: boolean): void {
        for (const element of [
            this.play,
            this.previous,
            this.next,
            this.modeSelect,
            this.rate,
            this.cadence,
            this.file,
            this.jump,
            this.zoomOut,
            this.zoomIn,
            this.fit,
        ]) element.disabled = !enabled;
        this.scope.disabled = !this.model || this.model.snapshot().sessions.length === 0;
    }

    private seek(
        position: number,
        reveal = true,
        preservePlaybackCursor = false,
        playbackAt?: number,
    ): void {
        if (!this.model || this.outline.length === 0) return;
        this.position = Math.min(Math.max(position, 0), this.outline.length);
        this.model.seek(this.position);
        const frame = this.model.frame(this.position, this.pinnedFile);
        this.updateFrame(frame);
        if (!preservePlaybackCursor) {
            if (playbackAt === undefined) this.snapPlaybackCursor();
            else this.playbackCursor = Math.min(Math.max(playbackAt, 0), this.axis.playbackDuration);
            this.eventAccumulator = 0;
        }
        this.drawClock();
        this.renderTimeline();
        this.renderOverview();
        if (this.playing) this.keepPlayheadVisible();
        if (reveal) this.callbacks.showFrame(frame);
    }

    private updateFrame(frame: ReplayFrame): void {
        this.status.textContent = frame.label;
        this.status.classList.toggle('notable', frame.notable);
        const values = ['', ...frame.files];
        const currentValues = [...this.file.options].map((option) => option.value);
        if (JSON.stringify(values) !== JSON.stringify(currentValues)) {
            this.file.replaceChildren(new Option('Follow the edit', ''));
            for (const path of frame.files) this.file.append(new Option(path.replace(/^\//, ''), path));
        }
        if (this.pinnedFile && !frame.files.includes(this.pinnedFile)) this.pinnedFile = null;
        this.file.value = this.pinnedFile ?? '';
    }

    private setPlaying(playing: boolean): void {
        this.playing = playing;
        this.play.replaceChildren();
        const icon = document.createElement('span');
        icon.className = `codicon codicon-${playing ? 'debug-pause' : 'play'}`;
        const text = document.createElement('span');
        text.textContent = playing ? 'Pause' : 'Play';
        this.play.append(icon, text);
        if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame);
        this.animationFrame = undefined;
        if (!playing || this.outline.length === 0) return;
        if (this.position >= this.outline.length) this.seek(0);
        this.lastFrame = performance.now();
        this.animationFrame = requestAnimationFrame((now) => this.animate(now));
    }

    private animate(now: number): void {
        if (!this.playing) return;
        const elapsed = Math.max(0, now - this.lastFrame);
        this.lastFrame = now;
        let nextPosition = this.position;

        if (this.mode === 'event') {
            this.eventAccumulator += elapsed;
            while (this.eventAccumulator >= this.cadenceMs && nextPosition < this.outline.length) {
                this.eventAccumulator -= this.cadenceMs;
                nextPosition += 1;
            }
        } else {
            this.playbackCursor += elapsed * this.timeRate;
            while (
                nextPosition < this.axis.points.length
                && this.axis.points[nextPosition]!.playbackAt <= this.playbackCursor
            ) nextPosition += 1;
        }

        if (nextPosition !== this.position) this.seek(nextPosition, true, true);
        else {
            this.drawClock();
            this.drawPlayhead();
            this.keepPlayheadVisible();
        }
        if (nextPosition >= this.outline.length) {
            this.setPlaying(false);
            return;
        }
        this.animationFrame = requestAnimationFrame((next) => this.animate(next));
    }

    private drawClock(): void {
        if (this.mode === 'event') {
            this.clock.textContent = `Event ${this.position} / ${this.outline.length}`;
            return;
        }
        const cursor = interpolateReplayCursor(this.axis, this.playbackCursor);
        this.clock.textContent = this.outline.length > 0
            ? `${formatTimelineTime(cursor.timestamp, this.scopeKey === ALL_SESSIONS)} · ${this.position}/${this.outline.length}`
            : '—';
        const gap = this.axis.gaps.find((item) => item.beforeIndex === this.position);
        if (this.playing && gap) this.status.textContent = `Skipping ${formatDuration(gap.durationMs)} idle time`;
    }

    private renderAll(): void {
        this.layoutTimeline(true);
        this.renderOverviewMarks();
        this.renderOverview();
        this.drawClock();
    }

    private layoutTimeline(syncScroll: boolean): void {
        const viewport = this.scroll.clientWidth;
        if (viewport <= 0) return;
        const fraction = Math.max(MIN_WINDOW, this.viewEnd - this.viewStart);
        this.trackWidth = Math.max(viewport, Math.round(viewport / fraction));
        this.canvas.style.width = `${this.trackWidth}px`;
        if (syncScroll) {
            this.syncingScroll = true;
            this.scroll.scrollLeft = this.viewStart * this.trackWidth;
            this.syncingScroll = false;
        }
        this.renderTimeline();
        this.renderOverview();
        this.renderScale();
    }

    private renderTimeline(): void {
        this.ruler.replaceChildren();
        this.lane.replaceChildren();
        this.playheadElement = null;
        if (this.axis.points.length === 0) return;

        const visibleStart = this.scroll.scrollLeft / this.trackWidth;
        const visibleEnd = Math.min(1, (this.scroll.scrollLeft + this.scroll.clientWidth) / this.trackWidth);
        this.renderRuler(visibleStart, visibleEnd);

        for (const gap of this.axis.gaps) {
            const start = gap.coordinateStart / this.axis.total;
            const end = gap.coordinateEnd / this.axis.total;
            if (end < visibleStart || start > visibleEnd) continue;
            const element = document.createElement('span');
            element.className = 'replay-idle-gap';
            element.style.left = `${start * 100}%`;
            element.style.width = `${Math.max((end - start) * 100, 0.04)}%`;
            element.title = `Idle ${formatDuration(gap.durationMs)} · ${formatTimelineTime(gap.from, true)} – ${formatTimelineTime(gap.to, true)}`;
            const width = (end - start) * this.trackWidth;
            if (width >= 58) element.textContent = `Idle ${formatDuration(gap.durationMs)}`;
            this.lane.append(element);
        }

        const startIndex = lowerBound(this.axis.points, visibleStart * this.axis.total);
        const endIndex = Math.min(
            this.axis.points.length,
            lowerBound(this.axis.points, visibleEnd * this.axis.total) + 1,
        );
        const visibleCount = Math.max(0, endIndex - startIndex);
        const step = Math.max(1, Math.ceil(visibleCount / 450));
        for (let index = startIndex; index < endIndex; index += 1) {
            const point = this.axis.points[index]!;
            const sessionBoundary = index === 0 || point.sessionId !== this.axis.points[index - 1]!.sessionId;
            if (index % step !== 0 && !point.notable && !sessionBoundary) continue;
            const marker = document.createElement('span');
            marker.className = `replay-event-marker${point.notable ? ' notable' : ''}${sessionBoundary ? ' session-start' : ''}`;
            marker.style.left = `${(point.coordinate / this.axis.total) * 100}%`;
            marker.title = `${index + 1}. ${point.type} · ${formatTimelineTime(point.at, true)}`;
            this.lane.append(marker);
            if (sessionBoundary) {
                const label = document.createElement('span');
                label.className = 'replay-session-label';
                label.style.left = `${(point.coordinate / this.axis.total) * 100}%`;
                label.textContent = `Session ${this.sessionNumber(point.sessionId)}`;
                this.lane.append(label);
            }
        }

        const playhead = document.createElement('span');
        playhead.className = 'replay-playhead';
        playhead.innerHTML = '<span></span>';
        this.lane.append(playhead);
        this.playheadElement = playhead;
        this.drawPlayhead();
    }

    private renderRuler(start: number, end: number): void {
        const divisions = Math.max(3, Math.min(10, Math.floor(this.scroll.clientWidth / 130)));
        for (let index = 0; index <= divisions; index += 1) {
            const fraction = start + (end - start) * (index / divisions);
            const position = nearestReplayPosition(this.axis, fraction);
            const point = this.axis.points[Math.max(0, position - 1)]!;
            const tick = document.createElement('span');
            tick.className = 'replay-ruler-tick';
            tick.style.left = `${fraction * 100}%`;
            tick.textContent = this.mode === 'event'
                ? `#${position}`
                : formatRulerTime(point.at, this.scopeKey === ALL_SESSIONS);
            this.ruler.append(tick);
        }
    }

    private renderOverviewMarks(): void {
        this.overviewMarks.replaceChildren();
        for (const gap of this.axis.gaps) {
            const element = document.createElement('span');
            element.className = 'replay-overview-gap';
            element.style.left = `${(gap.coordinateStart / this.axis.total) * 100}%`;
            element.style.width = `${Math.max(((gap.coordinateEnd - gap.coordinateStart) / this.axis.total) * 100, 0.15)}%`;
            element.title = `Idle ${formatDuration(gap.durationMs)}`;
            this.overviewMarks.append(element);
        }
        this.axis.points.forEach((point, index) => {
            if (index > 0 && point.sessionId === this.axis.points[index - 1]!.sessionId && !point.notable) return;
            const mark = document.createElement('span');
            mark.className = point.notable ? 'replay-overview-flag' : 'replay-overview-session';
            mark.style.left = `${(point.coordinate / this.axis.total) * 100}%`;
            this.overviewMarks.append(mark);
        });
    }

    private renderOverview(): void {
        this.overviewWindow.style.left = `${this.viewStart * 100}%`;
        this.overviewWindow.style.width = `${Math.max(MIN_WINDOW, this.viewEnd - this.viewStart) * 100}%`;
        this.overviewWindow.setAttribute('aria-valuetext', `${Math.round(this.viewStart * 100)}% to ${Math.round(this.viewEnd * 100)}%`);
    }

    private renderScale(): void {
        const fraction = Math.max(MIN_WINDOW, this.viewEnd - this.viewStart);
        if (fraction >= 0.995) {
            this.scale.textContent = `${this.mode === 'time' ? 'Time' : 'Events'} · entire ${this.scopeKey === ALL_SESSIONS ? 'attempt' : 'session'}`;
            return;
        }
        if (this.mode === 'event') {
            const count = Math.max(1, Math.round(this.outline.length * fraction));
            this.scale.textContent = `Events · about ${count} visible`;
        } else {
            const start = nearestReplayPosition(this.axis, this.viewStart);
            const end = nearestReplayPosition(this.axis, this.viewEnd);
            const from = this.outline[Math.max(0, start - 1)]?.at;
            const to = this.outline[Math.max(0, end - 1)]?.at;
            this.scale.textContent = from !== undefined && to !== undefined
                ? `Time · ${formatDuration(Math.max(0, to - from))} visible`
                : 'Time';
        }
    }

    private onTimelineScroll(): void {
        if (this.syncingScroll || this.trackWidth <= 0) return;
        const width = this.scroll.clientWidth / this.trackWidth;
        this.viewStart = Math.min(1 - width, Math.max(0, this.scroll.scrollLeft / this.trackWidth));
        this.viewEnd = Math.min(1, this.viewStart + width);
        this.renderTimeline();
        this.renderOverview();
        this.renderScale();
    }

    private onTimelineKeydown(event: KeyboardEvent): void {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        this.callbacks.revealEditor();
        this.setPlaying(false);
        if (event.key === 'Home') this.seek(0);
        else if (event.key === 'End') this.seek(this.outline.length);
        else this.seek(this.position + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 10 : 1));
    }

    private startOverviewDrag(event: PointerEvent): void {
        if (event.button !== 0 || this.outline.length === 0) return;
        event.preventDefault();
        const bounds = this.overview.getBoundingClientRect();
        const target = event.target as HTMLElement;
        const handle = target.closest<HTMLElement>('[data-handle]')?.dataset.handle;
        const insideWindow = Boolean(target.closest('.replay-overview-window'));
        const mode = handle === 'start' || handle === 'end' ? handle : insideWindow ? 'move' : 'center';
        const initialX = event.clientX;
        const initialStart = this.viewStart;
        const initialEnd = this.viewEnd;
        if (mode === 'center') {
            const width = initialEnd - initialStart;
            const center = (event.clientX - bounds.left) / bounds.width;
            this.viewStart = clamp(center - width / 2, 0, 1 - width);
            this.viewEnd = this.viewStart + width;
            this.layoutTimeline(true);
            return;
        }

        const dragAbort = new AbortController();
        const move = (moveEvent: PointerEvent) => {
            const delta = (moveEvent.clientX - initialX) / bounds.width;
            if (mode === 'start') this.viewStart = clamp(initialStart + delta, 0, initialEnd - MIN_WINDOW);
            else if (mode === 'end') this.viewEnd = clamp(initialEnd + delta, initialStart + MIN_WINDOW, 1);
            else {
                const width = initialEnd - initialStart;
                this.viewStart = clamp(initialStart + delta, 0, 1 - width);
                this.viewEnd = this.viewStart + width;
            }
            this.layoutTimeline(true);
        };
        document.addEventListener('pointermove', move, { signal: dragAbort.signal });
        document.addEventListener('pointerup', () => dragAbort.abort(), { signal: dragAbort.signal, once: true });
    }

    private zoom(factor: number): void {
        if (this.outline.length === 0) return;
        const oldWidth = this.viewEnd - this.viewStart;
        const newWidth = clamp(oldWidth / factor, MIN_WINDOW, 1);
        const center = axisFraction(this.axis, this.position);
        this.viewStart = clamp(center - newWidth / 2, 0, 1 - newWidth);
        this.viewEnd = this.viewStart + newWidth;
        this.layoutTimeline(true);
    }

    private keepPlayheadVisible(): void {
        const fraction = this.currentPlayheadFraction();
        if (fraction >= this.viewStart && fraction <= this.viewEnd) return;
        const width = this.viewEnd - this.viewStart;
        this.viewStart = clamp(fraction - width * 0.15, 0, 1 - width);
        this.viewEnd = this.viewStart + width;
        this.layoutTimeline(true);
    }

    private snapPlaybackCursor(): void {
        this.playbackCursor = this.position > 0
            ? this.axis.points[this.position - 1]?.playbackAt ?? 0
            : 0;
    }

    private currentPlayheadFraction(): number {
        return this.mode === 'time'
            ? interpolateReplayCursor(this.axis, this.playbackCursor).fraction
            : axisFraction(this.axis, this.position);
    }

    private drawPlayhead(): void {
        if (!this.playheadElement) return;
        this.playheadElement.style.left = `${this.currentPlayheadFraction() * 100}%`;
    }

    private sessionNumber(sessionId: string): number {
        const sessions = [...(this.model?.snapshot().sessions ?? [])]
            .sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt));
        return Math.max(1, sessions.findIndex((session) => session.id === sessionId) + 1);
    }
}

function lowerBound(points: ReplayAxis['points'], coordinate: number): number {
    let low = 0;
    let high = points.length;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (points[middle]!.coordinate < coordinate) low = middle + 1;
        else high = middle;
    }
    return low;
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

function formatDuration(durationMs: number): string {
    const seconds = Math.max(0, Math.round(durationMs / 1_000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
}

function formatSessionTime(value: string): string {
    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatTimelineTime(value: number, includeDate: boolean): string {
    return new Date(value).toLocaleString(undefined, includeDate
        ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }
        : { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function formatRulerTime(value: number, includeDate: boolean): string {
    return new Date(value).toLocaleString(undefined, includeDate
        ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
        : { hour: 'numeric', minute: '2-digit' });
}
