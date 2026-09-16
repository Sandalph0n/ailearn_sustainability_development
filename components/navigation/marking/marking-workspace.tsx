'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    BookOpen01Icon,
    Calendar03Icon,
    SearchIcon,
    UserIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Badge } from '@/components/ui/badge';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

export type MarkingAttemptSummary = {
    id: string;
    assessmentName: string;
    startedAt: string;
    submitted: boolean;
    markCount: number;
    hasDraft: boolean;
    officialScore: string | null;
};

export type MarkingStudentSummary = {
    id: string;
    displayName: string;
    email: string;
    attempts: MarkingAttemptSummary[];
};

export type MarkingSubjectSummary = {
    id: string;
    code: string;
    name: string;
    assessmentCount: number;
    students: MarkingStudentSummary[];
};

export type MarkingTermSummary = {
    id: string;
    label: string;
    current: boolean;
    periodLabel: string | null;
    subjects: MarkingSubjectSummary[];
};

type Selection = {
    termId?: string;
    subjectId?: string;
    studentId?: string;
};

type WorkspaceScreen = 'scope' | 'attempts';

function countLabel(count: number, singular: string): string {
    return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function setSelectionInUrl(selection: Selection): void {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(selection)) {
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
    }
    window.history.replaceState(null, '', url);
}

export function MarkingWorkspace({
    terms,
    initialSelection,
    contextQuery,
    canBrowseAttempts,
}: {
    terms: MarkingTermSummary[];
    initialSelection: Selection;
    contextQuery: string;
    canBrowseAttempts: boolean;
}) {
    const initialTerm =
        terms.find((term) => term.id === initialSelection.termId) ??
        terms.find((term) => term.current) ??
        terms[0] ??
        null;
    const initialSubject =
        initialTerm?.subjects.find((subject) => subject.id === initialSelection.subjectId) ?? null;
    const initialStudent =
        initialSubject?.students.find((student) => student.id === initialSelection.studentId) ?? null;

    const [screen, setScreen] = useState<WorkspaceScreen>(
        initialSubject ? 'attempts' : 'scope',
    );
    const [selectedTermId, setSelectedTermId] = useState(initialTerm?.id ?? null);
    const [selectedSubjectId, setSelectedSubjectId] = useState(initialSubject?.id ?? null);
    const [selectedStudentId, setSelectedStudentId] = useState(initialStudent?.id ?? null);
    const [subjectQuery, setSubjectQuery] = useState('');
    const [studentQuery, setStudentQuery] = useState('');

    const selectedTerm = terms.find((term) => term.id === selectedTermId) ?? null;
    const selectedSubject =
        selectedTerm?.subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
    const selectedStudent =
        selectedSubject?.students.find((student) => student.id === selectedStudentId) ?? null;

    const subjectQueryNeedle = subjectQuery.trim().toLocaleLowerCase();
    const filteredSubjects = subjectQueryNeedle
        ? (selectedTerm?.subjects ?? []).filter((subject) =>
              `${subject.code} ${subject.name}`
                  .toLocaleLowerCase()
                  .includes(subjectQueryNeedle),
          )
        : (selectedTerm?.subjects ?? []);

    const studentQueryNeedle = studentQuery.trim().toLocaleLowerCase();
    const filteredStudents = studentQueryNeedle
        ? (selectedSubject?.students ?? []).filter((student) =>
              `${student.displayName} ${student.email}`
                  .toLocaleLowerCase()
                  .includes(studentQueryNeedle),
          )
        : (selectedSubject?.students ?? []);

    function chooseTerm(termId: string): void {
        setSelectedTermId(termId);
        setSelectedSubjectId(null);
        setSelectedStudentId(null);
        setSubjectQuery('');
        setStudentQuery('');
        setSelectionInUrl({ termId, subjectId: undefined, studentId: undefined });
    }

    function openSubject(subjectId: string): void {
        setSelectedSubjectId(subjectId);
        setSelectedStudentId(null);
        setStudentQuery('');
        setScreen('attempts');
        setSelectionInUrl({
            termId: selectedTermId ?? undefined,
            subjectId,
            studentId: undefined,
        });
    }

    function chooseStudent(studentId: string): void {
        setSelectedStudentId(studentId);
        setSelectionInUrl({
            termId: selectedTermId ?? undefined,
            subjectId: selectedSubjectId ?? undefined,
            studentId,
        });
    }

    function returnToScope(): void {
        setScreen('scope');
        setSelectedSubjectId(null);
        setSelectedStudentId(null);
        setSubjectQuery('');
        setStudentQuery('');
        setSelectionInUrl({
            termId: selectedTermId ?? undefined,
            subjectId: undefined,
            studentId: undefined,
        });
    }

    if (terms.length === 0) {
        return (
            <div className="border px-5 py-16 text-center">
                <p className="font-medium">No study terms are available in this role&apos;s scope.</p>
                <p className="text-muted-foreground mt-1 text-sm">
                    Offering-scoped roles appear here after at least one subject offering is assigned.
                </p>
            </div>
        );
    }

    return (
        <section className="overflow-hidden border bg-card">
            <div className="flex items-center border-b bg-muted/25 px-4 py-2.5 text-xs font-medium">
                <button
                    type="button"
                    onClick={returnToScope}
                    disabled={screen === 'scope'}
                    className={cn(
                        'flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                        screen === 'scope' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    <span className="bg-foreground text-background flex size-5 items-center justify-center rounded-sm text-[11px]">1</span>
                    Term &amp; subject
                </button>
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground mx-3 size-3.5" />
                <span className={cn('flex items-center gap-2', screen === 'attempts' ? 'text-foreground' : 'text-muted-foreground')}>
                    <span className={cn('flex size-5 items-center justify-center rounded-sm text-[11px]', screen === 'attempts' ? 'bg-foreground text-background' : 'border bg-card')}>2</span>
                    Student &amp; attempt
                </span>
            </div>

            {screen === 'scope' ? (
                <div className="grid min-h-[38rem] lg:grid-cols-2">
                    <section className="flex min-h-0 flex-col border-b lg:border-r lg:border-b-0">
                        <div className="border-b px-5 py-4">
                            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Step 1</p>
                            <h2 className="font-heading mt-1 text-lg font-semibold">Study term</h2>
                            <p className="text-muted-foreground mt-1 text-sm">Choose the teaching period first.</p>
                        </div>
                        <div className="max-h-[calc(100vh-20rem)] min-h-80 overflow-y-auto p-3">
                            {terms.map((term) => {
                                const selected = term.id === selectedTermId;
                                return (
                                    <button
                                        key={term.id}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => chooseTerm(term.id)}
                                        className={cn(
                                            'flex w-full items-start gap-3 border border-transparent px-3 py-3 text-left outline-none transition-colors',
                                            'hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring/40',
                                            selected && 'border-brand-teal/45 bg-brand-teal/8',
                                        )}
                                    >
                                        <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-sm">
                                            <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                                                {term.label}
                                                {term.current && <Badge variant="secondary">Current</Badge>}
                                            </span>
                                            <span className="text-muted-foreground mt-1 block text-xs">
                                                {term.periodLabel ?? countLabel(term.subjects.length, 'subject')}
                                            </span>
                                        </span>
                                        <span className="text-muted-foreground pt-1 text-xs tabular-nums">
                                            {term.subjects.length}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="flex min-h-0 flex-col">
                        <div className="border-b px-5 py-4">
                            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Step 2</p>
                            <h2 className="font-heading mt-1 text-lg font-semibold">Subject</h2>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {selectedTerm
                                    ? `Choose a subject in ${selectedTerm.label} to continue.`
                                    : 'Choose a study term to see its subjects.'}
                            </p>
                            <InputGroup className="mt-3">
                                <InputGroupAddon>
                                    <HugeiconsIcon icon={SearchIcon} strokeWidth={2} className="size-4" />
                                </InputGroupAddon>
                                <InputGroupInput
                                    value={subjectQuery}
                                    onChange={(event) => setSubjectQuery(event.target.value)}
                                    placeholder="Search by subject code or name"
                                    aria-label="Search subjects"
                                    disabled={!selectedTerm}
                                />
                            </InputGroup>
                        </div>
                        <div className="max-h-[calc(100vh-20rem)] min-h-80 overflow-y-auto p-3">
                            {filteredSubjects.map((subject) => {
                                const attemptCount = subject.students.reduce(
                                    (total, student) => total + student.attempts.length,
                                    0,
                                );
                                return (
                                    <button
                                        key={subject.id}
                                        type="button"
                                        onClick={() => openSubject(subject.id)}
                                        className="group flex w-full items-center gap-3 border border-transparent px-3 py-3 text-left outline-none transition-colors hover:border-border hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring/40"
                                    >
                                        <span className="bg-brand-teal/10 text-brand-teal flex size-9 shrink-0 items-center justify-center rounded-sm">
                                            <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} className="size-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold">{subject.code}</span>
                                            <span className="text-muted-foreground block truncate text-xs">{subject.name}</span>
                                            <span className="text-muted-foreground mt-1 block text-xs">
                                                {countLabel(subject.assessmentCount, 'assessment')}
                                                {canBrowseAttempts ? ` · ${countLabel(attemptCount, 'attempt')}` : ''}
                                            </span>
                                        </span>
                                        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                                    </button>
                                );
                            })}
                            {selectedTerm?.subjects.length === 0 && (
                                <p className="text-muted-foreground px-4 py-12 text-center text-sm">
                                    No subjects are available in this study term.
                                </p>
                            )}
                            {selectedTerm && selectedTerm.subjects.length > 0 && filteredSubjects.length === 0 && (
                                <p className="text-muted-foreground px-4 py-12 text-center text-sm">
                                    No subjects match “{subjectQuery.trim()}”.
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            ) : !selectedSubject || !selectedTerm ? (
                <div className="px-6 py-16 text-center">
                    <p className="font-medium">The selected subject is no longer available.</p>
                    <button type="button" onClick={returnToScope} className="text-brand-teal mt-2 text-sm font-medium hover:underline">
                        Choose another term and subject
                    </button>
                </div>
            ) : !canBrowseAttempts ? (
                <div className="px-6 py-14 text-center">
                    <h2 className="font-heading font-semibold">Assessment overview only</h2>
                    <p className="text-muted-foreground mx-auto mt-1 max-w-lg text-sm leading-6">
                        This role can inspect assessment configuration, but it cannot view student attempts,
                        replay recordings, or create marks.
                    </p>
                </div>
            ) : (
                <div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                        <button
                            type="button"
                            onClick={returnToScope}
                            className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />
                            Change term or subject
                        </button>
                        <div className="text-right">
                            <p className="text-sm font-semibold">{selectedSubject.code} · {selectedSubject.name}</p>
                            <p className="text-muted-foreground text-xs">{selectedTerm.label}</p>
                        </div>
                    </div>

                    <div className="grid min-h-[36rem] lg:grid-cols-[22rem_minmax(0,1fr)]">
                        <aside className="flex min-h-0 flex-col border-b lg:border-r lg:border-b-0">
                            <div className="border-b px-4 py-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Step 1</p>
                                        <h2 className="font-heading mt-1 text-lg font-semibold">Student</h2>
                                        <p className="text-muted-foreground mt-1 text-xs">Search within {selectedSubject.code}.</p>
                                    </div>
                                    <span className="text-muted-foreground pt-5 text-xs tabular-nums">{selectedSubject.students.length}</span>
                                </div>
                                <InputGroup className="mt-3">
                                    <InputGroupAddon>
                                        <HugeiconsIcon icon={SearchIcon} strokeWidth={2} className="size-4" />
                                    </InputGroupAddon>
                                    <InputGroupInput
                                        value={studentQuery}
                                        onChange={(event) => setStudentQuery(event.target.value)}
                                        placeholder="Search name or email"
                                        aria-label="Search students"
                                    />
                                </InputGroup>
                            </div>
                            <div className="max-h-[calc(100vh-22rem)] min-h-72 overflow-y-auto p-2">
                                {filteredStudents.map((student) => {
                                    const selected = student.id === selectedStudentId;
                                    return (
                                        <button
                                            key={student.id}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => chooseStudent(student.id)}
                                            className={cn(
                                                'flex w-full items-center gap-3 border border-transparent px-3 py-2.5 text-left outline-none transition-colors',
                                                'hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40',
                                                selected && 'border-brand-teal/40 bg-brand-teal/8',
                                            )}
                                        >
                                            <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-sm">
                                                <HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-4" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">{student.displayName}</span>
                                                <span className="text-muted-foreground block truncate text-xs">{student.email}</span>
                                                <span className="text-muted-foreground mt-0.5 block text-xs">{countLabel(student.attempts.length, 'attempt')}</span>
                                            </span>
                                            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground size-4" />
                                        </button>
                                    );
                                })}
                                {filteredStudents.length === 0 && (
                                    <p className="text-muted-foreground px-3 py-10 text-center text-sm">
                                        {studentQuery
                                            ? `No students match “${studentQuery.trim()}”.`
                                            : 'No students have attempts in this subject.'}
                                    </p>
                                )}
                            </div>
                        </aside>

                        <section className="min-w-0">
                            <div className="border-b px-5 py-4">
                                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Step 2</p>
                                <h2 className="font-heading mt-1 text-lg font-semibold">Attempt</h2>
                                <p className="text-muted-foreground mt-1 text-xs">
                                    {selectedStudent
                                        ? `Choose an attempt by ${selectedStudent.displayName}.`
                                        : 'Choose a student to see their attempts.'}
                                </p>
                            </div>

                            {!selectedStudent ? (
                                <div className="flex min-h-[29rem] items-center justify-center px-6 text-center">
                                    <div className="max-w-sm">
                                        <h3 className="font-heading font-semibold">Choose a student</h3>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            Their attempts across every assessment in {selectedSubject.code} will appear here.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="max-h-[calc(100vh-22rem)] min-h-72 overflow-auto">
                                    <div className="grid min-w-[48rem] grid-cols-[minmax(14rem,1fr)_10rem_7rem_9rem_2rem] gap-4 border-b bg-muted/35 px-5 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        <span>Assessment</span><span>Started</span><span>Status</span><span>Marking</span><span />
                                    </div>
                                    {selectedStudent.attempts.map((attempt) => {
                                        const href = `/navigation/marking/attempts/${attempt.id}?${contextQuery}&termId=${selectedTermId}&subjectId=${selectedSubjectId}&studentId=${selectedStudent.id}`;
                                        return (
                                            <Link
                                                key={attempt.id}
                                                href={href}
                                                className="grid min-w-[48rem] grid-cols-[minmax(14rem,1fr)_10rem_7rem_9rem_2rem] items-center gap-4 border-b px-5 py-4 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium">{attempt.assessmentName}</p>
                                                    <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">{attempt.id.slice(0, 8)}</p>
                                                </div>
                                                <time className="text-sm tabular-nums">{attempt.startedAt}</time>
                                                <Badge variant={attempt.submitted ? 'secondary' : 'outline'}>{attempt.submitted ? 'Submitted' : 'Active'}</Badge>
                                                <div className="text-sm">
                                                    {attempt.officialScore ? (
                                                        <span className="font-medium tabular-nums">{attempt.officialScore}</span>
                                                    ) : attempt.hasDraft ? (
                                                        <span>Draft in progress</span>
                                                    ) : (
                                                        <span className="text-muted-foreground">{countLabel(attempt.markCount, 'mark')}</span>
                                                    )}
                                                </div>
                                                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground size-4" />
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            )}
        </section>
    );
}
