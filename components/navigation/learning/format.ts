const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const DATE_FORMAT = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' });

export function formatDateTime(value: string | Date): string {
    return DATE_TIME_FORMAT.format(new Date(value));
}

export function formatDate(value: string | Date): string {
    return DATE_FORMAT.format(new Date(value));
}

export function dueLabel(dueAt: string | null, expectedDue: string | null): string {
    if (dueAt) return formatDateTime(dueAt);
    return expectedDue || 'No due date specified';
}

export function termLabel(term: { year: number; session: number }): string {
    return `Session ${term.session}, ${term.year}`;
}
