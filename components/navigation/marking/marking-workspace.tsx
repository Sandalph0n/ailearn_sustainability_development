'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
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
    const firstTerm =
        terms.find((term) => term.id === initialSelection.termId) ??
        terms.find((term) => term.current) ??
        terms[0] ??
        null;
    const [selectedTermId, setSelectedTermId] = useState(firstTerm?.id ?? null);
    const selectedTerm = terms.find((term) => term.id === selectedTermId) ?? null;
    const firstSubject =
        selectedTerm?.subjects.find((subject) => subject.id === initialSelection.subjectId) ??
        selectedTerm?.subjects[0] ??
        null;
    const [selectedSubjectId, setSelectedSubjectId] = useState(firstSubject?.id ?? null);
    const selectedSubject =
        selectedTerm?.subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
    const [studentQuery, setStudentQuery] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
        selectedSubject?.students.some((student) => student.id === initialSelection.studentId)
            ? initialSelection.studentId ?? null
            : null,
    );

    const filteredStudents = useMemo(() => {
        const needle = studentQuery.trim().toLocaleLowerCase();
        if (!needle) return selectedSubject?.students ?? [];
        return (selectedSubject?.students ?? []).filter((student) =>
            `${student.displayName} ${student.email}`.toLocaleLowerCase().includes(needle),
        );
    }, [selectedSubject, studentQuery]);
    const selectedStudent =
        selectedSubject?.students.find((student) => student.id === selectedStudentId) ?? null;

    function chooseTerm(termId: string): void {
        const term = terms.find((item) => item.id === termId) ?? null;
        const subjectId = term?.subjects[0]?.id ?? null;
        setSelectedTermId(termId);
        setSelectedSubjectId(subjectId);
        setSelectedStudentId(null);
        setStudentQuery('');
        setSelectionInUrl({ termId, subjectId: subjectId ?? undefined, studentId: undefined });
    }

    function chooseSubject(subjectId: string): void {
        setSelectedSubjectId(subjectId);
        setSelectedStudentId(null);
        setStudentQuery('');
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
            <div className="border-b bg-muted/20">
                <div className="flex items-center gap-3 border-b px-4 py-3">
                    <span className="bg-foreground text-background flex size-6 items-center justify-center rounded-sm text-xs font-semibold">1</span>
                    <div>
                        <h2 className="text-sm font-semibold">Study term</h2>
                        <p className="text-muted-foreground text-xs">Choose the teaching period to review.</p>
                    </div>
                </div>
                <div className="flex gap-2 overflow-x-auto px-4 py-3">
                    {terms.map((term) => {
                        const selected = term.id === selectedTermId;
                        return (
                            <button
                                key={term.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => chooseTerm(term.id)}
                                className={cn(
                                    'flex min-w-48 shrink-0 items-start gap-3 border px-3 py-2.5 text-left outline-none transition-colors',
                                    'hover:bg-background focus-visible:ring-2 focus-visible:ring-ring/40',
                                    selected ? 'border-brand-teal bg-brand-teal/8' : 'bg-card',
                                )}
                            >
                                <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="mt-0.5 size-4 shrink-0" />
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2 text-sm font-medium">
                                        {term.label}
                                        {term.current && <Badge variant="secondary">Current</Badge>}
                                    </span>
                                    <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                                        {term.periodLabel ?? countLabel(term.subjects.length, 'subject')}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="border-b">
                <div className="flex items-center gap-3 border-b px-4 py-3">
                    <span className="bg-foreground text-background flex size-6 items-center justify-center rounded-sm text-xs font-semibold">2</span>
                    <div>
                        <h2 className="text-sm font-semibold">Subject</h2>
                        <p className="text-muted-foreground text-xs">Subjects are limited to this role&apos;s offering scope.</p>
                    </div>
                </div>
                <div className="flex gap-2 overflow-x-auto px-4 py-3">
                    {(selectedTerm?.subjects ?? []).map((subject) => {
                        const selected = subject.id === selectedSubjectId;
                        const attemptCount = subject.students.reduce(
                            (total, student) => total + student.attempts.length,
                            0,
                        );
                        return (
                            <button
                                key={subject.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => chooseSubject(subject.id)}
                                className={cn(
                                    'flex min-w-64 shrink-0 items-start gap-3 border px-3 py-2.5 text-left outline-none transition-colors',
                                    'hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring/40',
                                    selected ? 'border-brand-teal bg-brand-teal/8' : 'bg-background',
                                )}
                            >
                                <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} className="mt-0.5 size-4 shrink-0" />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold">{subject.code}</span>
                                    <span className="text-muted-foreground block truncate text-xs">{subject.name}</span>
                                    <span className="text-muted-foreground mt-1 block text-xs">
                                        {countLabel(subject.assessmentCount, 'assessment')}
                                        {canBrowseAttempts ? ` · ${countLabel(attemptCount, 'attempt')}` : ''}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                    {selectedTerm?.subjects.length === 0 && (
                        <p className="text-muted-foreground py-3 text-sm">No subjects in this study term.</p>
                    )}
                </div>
            </div>

            {!canBrowseAttempts ? (
                <div className="px-6 py-14 text-center">
                    <h2 className="font-heading font-semibold">Assessment overview only</h2>
                    <p className="text-muted-foreground mx-auto mt-1 max-w-lg text-sm leading-6">
                        This role can inspect assessment configuration, but it cannot view student attempts,
                        replay recordings, or create marks.
                    </p>
                </div>
            ) : !selectedSubject ? (
                <div className="px-6 py-14 text-center text-sm text-muted-foreground">Choose a subject to continue.</div>
            ) : (
                <div className="grid min-h-[32rem] lg:grid-cols-[21rem_minmax(0,1fr)]">
                    <aside className="flex min-h-0 flex-col border-b lg:border-r lg:border-b-0">
                        <div className="border-b px-4 py-4">
                            <div className="flex items-center gap-3">
                                <span className="bg-foreground text-background flex size-6 items-center justify-center rounded-sm text-xs font-semibold">3</span>
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-sm font-semibold">Student</h2>
                                    <p className="text-muted-foreground text-xs">Search within {selectedSubject.code}.</p>
                                </div>
                                <span className="text-muted-foreground text-xs tabular-nums">{selectedSubject.students.length}</span>
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
                        <div className="max-h-[calc(100vh-25rem)] min-h-64 overflow-y-auto p-2">
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
                                    {studentQuery ? `No students match “${studentQuery.trim()}”.` : 'No students have attempts in this subject.'}
                                </p>
                            )}
                        </div>
                    </aside>

                    <div className="min-w-0">
                        {!selectedStudent ? (
                            <div className="flex min-h-[32rem] items-center justify-center px-6 text-center">
                                <div className="max-w-sm">
                                    <h2 className="font-heading font-semibold">Choose a student</h2>
                                    <p className="text-muted-foreground mt-1 text-sm">Their attempts will appear here, across every assessment in {selectedSubject.code}.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="border-b px-5 py-4">
                                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Attempts</p>
                                    <h2 className="font-heading mt-0.5 text-lg font-semibold">{selectedStudent.displayName}</h2>
                                    <p className="text-muted-foreground text-sm">{selectedStudent.email}</p>
                                </div>
                                <div className="max-h-[calc(100vh-25rem)] min-h-64 overflow-auto">
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
                            </>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
