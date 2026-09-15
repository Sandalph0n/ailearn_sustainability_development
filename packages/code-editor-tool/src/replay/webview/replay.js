// @ts-check
const vscode = acquireVsCodeApi();
const label = document.getElementById('label');
const code = document.getElementById('code');

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
        code.innerHTML = '<div class="empty">This file does not exist yet at this point.</div>';
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
    code.innerHTML = html
        .replace(new RegExp(MARK_OPEN, 'g'), '<span class="fresh">')
        .replace(new RegExp(MARK_SEL_OPEN, 'g'), '<span class="sel">')
        .replace(new RegExp(`${MARK_CLOSE}|${MARK_SEL_CLOSE}`, 'g'), '</span>');
    const focus = code.querySelector('.fresh') || code.querySelector('.sel');
    if (focus) focus.scrollIntoView({ block: 'center' });
}

window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'frame') {
        const frame = message.frame;
        label.textContent = frame.label;
        label.classList.toggle('notable', frame.notable);
        render(frame.content, frame.change, frame.selection);
        return;
    }
    if (message.type === 'error') {
        code.innerHTML = `<div class="error">${escape(message.message)}</div>`;
    }
});

vscode.postMessage({ type: 'ready' });
