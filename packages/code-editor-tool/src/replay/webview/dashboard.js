// @ts-check
const vscode = acquireVsCodeApi();
const root = document.getElementById('root');
const escape = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const time = (milliseconds) => new Date(milliseconds).toLocaleString();

function verdictOf(integrity) {
    if (!integrity) return { cls: 'warn', text: 'No integrity result yet', note: 'Choose a recorded work session to verify its event chain.' };
    if (integrity.status === 'VERIFIED') return { cls: 'ok', text: 'Chain intact from the very beginning', note: integrity.message };
    if (integrity.status === 'LEGACY') return { cls: 'warn', text: 'Legacy recording — partial verification only', note: integrity.message };
    if (integrity.status === 'GAP') return { cls: 'bad', text: 'A sequence gap was detected', note: integrity.message };
    return { cls: 'bad', text: 'Integrity verification failed', note: integrity.message };
}

const LABEL = {
    'editor.paste': 'Paste from outside',
};

function render(state) {
    if (state.loading && !state.found) {
        root.innerHTML = '<h1>Loading activity log…</h1><p class="path">Reading recorded work sessions from Lernumi.</p>';
        return;
    }
    if (!state.found) {
        root.innerHTML = `<h1>No activity log</h1><p class="path">No recorded work session is available for this attempt.</p>${state.message ? `<p class="error">${escape(state.message)}</p>` : ''}`;
        return;
    }

    const verdict = verdictOf(state.integrity);
    const head = state.integrity?.head ?? '—';
    root.innerHTML = `
        <h1>Log Inspector</h1>
        <p class="path">${state.loading ? 'Refreshing recording…' : 'Recorded activity for this assessment attempt'}</p>

        <div class="grid">
            <div class="card wide">
                <h2>Integrity</h2>
                <div class="verdict ${verdict.cls}"><span class="dot"></span><span>${escape(verdict.text)}</span></div>
                <p class="note">${escape(verdict.note)}</p>
                <code>${escape(head)}</code>
            </div>
            <div class="card">
                <h2>Log</h2>
                <dl>
                    <dt>Event batches</dt><dd>${state.batches}</dd>
                    <dt>Work sessions</dt><dd>${state.sessions.length}</dd>
                    <dt>Events</dt><dd>${state.events}</dd>
                </dl>
            </div>
            <div class="card">
                <h2>Activity</h2>
                <dl>
                    <dt>Replay checkpoints</dt><dd>${state.checkpoints}</dd>
                    <dt>Pastes from outside</dt><dd class="${state.externalPastes ? 'flag' : ''}">${state.externalPastes}</dd>
                </dl>
            </div>
        </div>

        <div class="card wide" style="margin-bottom:22px">
            <h2>Sessions</h2>
            <table>
                <tr><th>Started</th><th>Status</th><th>Tool version</th><th class="num">Events</th></tr>
                ${state.sessions.map((session) => `<tr class="clickable ${session.id === state.selectedSessionId ? 'active' : ''}" data-session="${escape(session.id)}">
                    <td>${escape(time(Date.parse(session.startedAt)))}</td>
                    <td>${session.endedAt ? 'Closed' : 'Open'}</td>
                    <td>${escape(session.toolVersion?.version ?? 'Unknown')}</td>
                    <td class="num">${session.checkpoint + 1}</td>
                </tr>`).join('')}
            </table>
            <p class="note" style="margin-left:0">Click a row to inspect that work session.</p>
        </div>

        <div class="card wide">
            <h2>Worth a look — ${state.flags.length}</h2>
            ${state.flags.length === 0
                ? '<p class="note" style="margin-left:0">Nothing flagged. No outside paste was recorded.</p>'
                : `<table>
                    <tr><th>When</th><th>What</th><th>File</th><th class="num">Size</th></tr>
                    ${state.flags.map((flag) => `<tr class="clickable" data-index="${flag.index}">
                        <td>${escape(time(flag.at))}</td>
                        <td class="warn">${escape(LABEL[flag.type] ?? flag.type)}</td>
                        <td>${escape(flag.file?.replace(/^\//, '') ?? '—')}</td>
                        <td class="num">${flag.size === null ? '—' : `${flag.size} chars${flag.lines ? `, ${flag.lines} lines` : ''}`}</td>
                    </tr>`).join('')}
                </table><p class="note" style="margin-left:0">Click a row to open Replay at that moment.</p>`}
        </div>
        ${state.message ? `<p class="error">${escape(state.message)}</p>` : ''}`;

    for (const row of root.querySelectorAll('[data-session]')) {
        row.addEventListener('click', () => vscode.postMessage({ type: 'selectSession', sessionId: row.getAttribute('data-session') }));
    }
    for (const row of root.querySelectorAll('[data-index]')) {
        row.addEventListener('click', () => vscode.postMessage({ type: 'replayAt', index: Number(row.getAttribute('data-index')) }));
    }
}

window.addEventListener('message', (event) => {
    if (event.data.type === 'state') render(event.data.state);
});
vscode.postMessage({ type: 'ready' });
