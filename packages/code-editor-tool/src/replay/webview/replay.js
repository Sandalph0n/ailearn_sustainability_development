// @ts-check
const vscode = acquireVsCodeApi();
const el = {
    play: document.getElementById('play'),
    range: document.getElementById('range'),
    marks: document.getElementById('marks'),
    speedButton: document.getElementById('speedButton'),
    speedPopup: document.getElementById('speedPopup'),
    speedSlider: document.getElementById('speedSlider'),
    speedPresets: document.getElementById('speedPresets'),
    speedCustom: document.getElementById('speedCustom'),
    file: document.getElementById('file'),
    clock: document.getElementById('clock'),
    label: document.getElementById('label'),
    code: document.getElementById('code'),
    jump: document.getElementById('jump'),
};

let playing = false;
let pinnedFile = null;
let outline = [];
const KEYWORDS = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'new', 'class', 'extends', 'implements', 'interface', 'this', 'super', 'try', 'catch', 'finally', 'throw', 'public', 'private', 'protected', 'static', 'final', 'abstract', 'import', 'from', 'export', 'async', 'await', 'function', 'const', 'let', 'var', 'def', 'in', 'is', 'not', 'and', 'or', 'with', 'lambda', 'yield', 'null', 'true', 'false', 'None', 'True', 'False']);
const TYPES = new Set(['int', 'float', 'double', 'boolean', 'char', 'byte', 'short', 'long', 'void', 'string', 'String', 'number', 'object', 'unknown', 'never', 'Array', 'Map', 'Set', 'Promise']);
const BUILTINS = new Set(['console', 'print', 'println', 'Math', 'JSON', 'Date', 'Object', 'Number', 'String', 'Boolean', 'fetch', 'setTimeout', 'setInterval']);
const CONSTANTS = new Set(['PI', 'Infinity', 'NaN', 'undefined']);
const MARK_OPEN = '\uE000';
const MARK_CLOSE = '\uE001';
const MARK_SEL_OPEN = '\uE002';
const MARK_SEL_CLOSE = '\uE003';
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(#[0-9a-fA-F]{6,8}|\b\d[\w.]*)|([A-Za-z_]\w*)/g;

const escape = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function classOf(word) {
    if (KEYWORDS.has(word)) return 't-key';
    if (TYPES.has(word)) return 't-type';
    if (BUILTINS.has(word)) return 't-builtin';
    if (CONSTANTS.has(word)) return 't-const';
    return '';
}

function highlight(text) {
    let out = '';
    let last = 0;
    let match;
    TOKEN.lastIndex = 0;
    while ((match = TOKEN.exec(text)) !== null) {
        out += escape(text.slice(last, match.index));
        const [all, comment, string, number, word] = match;
        if (comment) out += `<span class="t-com">${escape(all)}</span>`;
        else if (string) out += `<span class="t-str">${escape(all)}</span>`;
        else if (number) out += `<span class="t-num">${escape(all)}</span>`;
        else {
            const cls = classOf(word);
            out += cls ? `<span class="${cls}">${escape(all)}</span>` : escape(all);
        }
        last = match.index + all.length;
    }
    return out + escape(text.slice(last));
}

function splitAtLines(content, start, end) {
    const parts = [];
    let from = Math.max(0, Math.min(start, content.length));
    const until = Math.max(from, Math.min(end, content.length));
    while (from < until) {
        const newline = content.indexOf('\n', from);
        const to = newline === -1 || newline > until ? until : newline;
        if (to > from) parts.push([from, to]);
        from = to + 1;
    }
    return parts;
}

function render(content, change, selection) {
    if (!content) {
        el.code.innerHTML = '<div class="empty">This file does not exist yet at this point.</div>';
        return;
    }
    const marks = [];
    if (change && change.length > 0) {
        for (const [from, to] of splitAtLines(content, change.offset, change.offset + change.length)) {
            marks.push({ at: from, text: MARK_OPEN }, { at: to, text: MARK_CLOSE });
        }
    }
    for (const [anchor, active] of selection || []) {
        for (const [from, to] of splitAtLines(content, Math.min(anchor, active), Math.max(anchor, active))) {
            marks.push({ at: from, text: MARK_SEL_OPEN }, { at: to, text: MARK_SEL_CLOSE });
        }
    }
    marks.sort((left, right) => right.at - left.at);
    let marked = content;
    for (const mark of marks) marked = marked.slice(0, mark.at) + mark.text + marked.slice(mark.at);
    const html = marked.split('\n').map((line, index) =>
        `<div class="line"><span class="gutter">${index + 1}</span><span class="text">${highlight(line) || '&nbsp;'}</span></div>`,
    ).join('');
    el.code.innerHTML = html
        .replace(new RegExp(MARK_OPEN, 'g'), '<span class="fresh">')
        .replace(new RegExp(MARK_SEL_OPEN, 'g'), '<span class="sel">')
        .replace(new RegExp(`${MARK_CLOSE}|${MARK_SEL_CLOSE}`, 'g'), '</span>');
    const focus = el.code.querySelector('.fresh') || el.code.querySelector('.sel');
    if (focus) focus.scrollIntoView({ block: 'center' });
}

function seek(index) {
    vscode.postMessage({ type: 'seek', index, file: pinnedFile });
}

const PRESETS = [0.25, 0.5, 1, 1.5, 2, 4, 6, 10];
let speed = 1;
let clockMs = 0;
let lastFrame = 0;
let rafId;

const sliderToSpeed = (value) => Math.round(Math.pow(10, (value / 100) * 2 - 1) * 100) / 100;
const speedToSlider = (value) => Math.round(((Math.log10(value) + 1) / 2) * 100);

function setSpeed(value) {
    speed = Math.min(20, Math.max(0.05, value));
    el.speedButton.textContent = `${Number(speed.toFixed(2))}×`;
    el.speedSlider.value = String(speedToSlider(Math.min(10, Math.max(0.1, speed))));
    el.speedCustom.value = String(Number(speed.toFixed(2)));
    for (const button of el.speedPresets.children) {
        button.classList.toggle('active', Number(button.getAttribute('data-speed')) === speed);
    }
}

for (const preset of PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.speed = String(preset);
    button.textContent = `${preset}×`;
    button.addEventListener('click', () => setSpeed(preset));
    el.speedPresets.append(button);
}
el.speedSlider.addEventListener('input', () => setSpeed(sliderToSpeed(Number(el.speedSlider.value))));
el.speedCustom.addEventListener('change', () => setSpeed(Number(el.speedCustom.value) || 1));
el.speedButton.addEventListener('click', (event) => {
    event.stopPropagation();
    el.speedPopup.hidden = !el.speedPopup.hidden;
});
document.addEventListener('click', (event) => {
    if (!el.speedPopup.hidden && !el.speedPopup.contains(event.target)) el.speedPopup.hidden = true;
});

function syncClockTo(index) {
    if (outline.length === 0) clockMs = 0;
    else clockMs = index > 0 ? outline[Math.min(index, outline.length) - 1].at : outline[0].at;
}

function drawClock(index) {
    const stamp = clockMs > 0 ? new Date(clockMs).toLocaleTimeString() : '—';
    el.clock.textContent = `${index} / ${outline.length}   ·   ${stamp}`;
}

function animate(now) {
    if (!playing) return;
    clockMs += (now - lastFrame) * speed;
    lastFrame = now;
    let applied = Number(el.range.value);
    while (applied < outline.length && outline[applied].at <= clockMs) applied += 1;
    if (applied !== Number(el.range.value)) {
        el.range.value = String(applied);
        seek(applied);
    }
    drawClock(applied);
    if (applied >= outline.length) {
        setPlaying(false);
        return;
    }
    rafId = requestAnimationFrame(animate);
}

function setPlaying(on) {
    playing = on;
    el.play.textContent = on ? '❚❚  Pause' : '▶  Play';
    if (rafId !== undefined) cancelAnimationFrame(rafId);
    rafId = undefined;
    if (on) {
        if (Number(el.range.value) >= outline.length) {
            el.range.value = '0';
            seek(0);
        }
        syncClockTo(Number(el.range.value));
        lastFrame = performance.now();
        rafId = requestAnimationFrame(animate);
    }
}

el.play.addEventListener('click', () => setPlaying(!playing));
el.range.addEventListener('input', () => {
    setPlaying(false);
    const index = Number(el.range.value);
    syncClockTo(index);
    drawClock(index);
    seek(index);
});
el.file.addEventListener('change', () => {
    pinnedFile = el.file.value === '' ? null : el.file.value;
    seek(Number(el.range.value));
});
el.jump.addEventListener('click', () => {
    const from = Number(el.range.value);
    const next = outline.findIndex((item, index) => index >= from && item.notable);
    if (next === -1) return;
    setPlaying(false);
    el.range.value = String(next + 1);
    syncClockTo(next + 1);
    drawClock(next + 1);
    seek(next + 1);
});

window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'init') {
        outline = message.outline;
        el.range.max = String(outline.length);
        el.marks.replaceChildren();
        outline.forEach((item, index) => {
            if (!item.notable) return;
            const mark = document.createElement('div');
            mark.className = 'mark';
            mark.style.left = `${outline.length ? (index / outline.length) * 100 : 0}%`;
            el.marks.append(mark);
        });
        const start = typeof message.startAt === 'number' ? message.startAt + 1 : 0;
        el.range.value = String(start);
        setSpeed(1);
        syncClockTo(start);
        drawClock(start);
        seek(start);
        return;
    }
    if (message.type === 'jumpTo') {
        setPlaying(false);
        const index = Math.max(0, Math.min(Number(message.index), outline.length));
        el.range.value = String(index);
        syncClockTo(index);
        drawClock(index);
        seek(index);
        return;
    }
    if (message.type === 'frame') {
        const frame = message.frame;
        el.range.value = String(frame.index);
        if (!playing) {
            clockMs = frame.at || clockMs;
            drawClock(frame.index);
        }
        el.label.textContent = frame.label;
        el.label.classList.toggle('notable', frame.notable);
        const values = ['', ...frame.files];
        const currentValues = [...el.file.options].map((option) => option.value);
        if (JSON.stringify(values) !== JSON.stringify(currentValues)) {
            el.file.replaceChildren();
            el.file.append(new Option('(follow the edit)', ''));
            for (const path of frame.files) el.file.append(new Option(path.replace(/^\//, ''), path));
        }
        el.file.value = pinnedFile ?? '';
        render(frame.content, frame.change, frame.selection);
        return;
    }
    if (message.type === 'error') {
        setPlaying(false);
        el.code.innerHTML = `<div class="error">${escape(message.message)}</div>`;
    }
});

vscode.postMessage({ type: 'ready' });
