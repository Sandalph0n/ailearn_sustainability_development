'use client';

import { useMemo, useState } from 'react';
import { ArrowRight01Icon, SearchIcon, UserIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { LaunchReplayButton } from '@/components/navigation/learning/replay-actions';
import { Badge } from '@/components/ui/badge';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

export type ReviewAttempt = {
    id: string;
    number: number;
    startedAt: string;
    submitted: boolean;
    sessionCount: number;
    eventCount: number;
    toolNames: string[];
    replay: { workSessionId: string; toolName: string } | null;
};

export type ReviewStudent = {
    id: string;
    displayName: string;
    email: string;
    attempts: ReviewAttempt[];
};

function countLabel(count: number, singular: string): string {
    return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

/** Master-detail browser: choose one student first, then inspect only that student's attempts. */
export function AssessmentAttemptBrowser({
    students,
    canReplay,
    roleAssignmentId,
}: {
    students: ReviewStudent[];
    canReplay: boolean;
    roleAssignmentId: string;
}) {
    const [query, setQuery] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    const filteredStudents = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase();
        if (!needle) return students;
        return students.filter((student) =>
            `${student.displayName} ${student.email}`.toLocaleLowerCase().includes(needle),
        );
    }, [query, students]);
    const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? null;

    if (students.length === 0) {
        return (
            <div className="rounded-lg border bg-card px-5 py-14 text-center">
                <p className="text-sm font-medium">No attempts have been started.</p>
                <p className="text-muted-foreground mt-1 text-sm">
                    Students will appear here after starting this assessment.
                </p>
            </div>
        );
    }

    return (
        <div className="grid min-h-[34rem] overflow-hidden rounded-lg border bg-card lg:grid-cols-[20rem_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col border-b lg:border-r lg:border-b-0">
                <div className="border-b px-4 py-4">
                    <div className="flex items-baseline justify-between gap-3">
                        <div>
                            <h2 className="font-heading font-semibold">Students</h2>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                                Search, then choose one student.
                            </p>
                        </div>
                        <span className="text-muted-foreground text-xs tabular-nums">
                            {students.length}
                        </span>
                    </div>
                    <InputGroup className="mt-3">
                        <InputGroupAddon>
                            <HugeiconsIcon icon={SearchIcon} strokeWidth={2} className="size-4" />
                        </InputGroupAddon>
                        <InputGroupInput
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search name or email"
                            aria-label="Search students"
                        />
                    </InputGroup>
                </div>

                <div className="max-h-[calc(100vh-22rem)] min-h-64 overflow-y-auto p-2">
                    {filteredStudents.length === 0 ? (
                        <p className="text-muted-foreground px-3 py-10 text-center text-sm">
                            No students match “{query.trim()}”.
                        </p>
                    ) : (
                        <div className="grid gap-1">
                            {filteredStudents.map((student) => {
                                const selected = student.id === selectedStudentId;
                                const initials = student.displayName
                                    .split(/\s+/)
                                    .slice(0, 2)
                                    .map((part) => part.at(0))
                                    .join('')
                                    .toUpperCase();

                                return (
                                    <button
                                        key={student.id}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => setSelectedStudentId(student.id)}
                                        className={cn(
                                            'group flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-left outline-none transition-colors',
                                            'hover:bg-muted/65 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
                                            selected && 'border-brand-teal/35 bg-brand-teal/8',
                                        )}
                                    >
                                        <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold">
                                            {initials || <HugeiconsIcon icon={UserIcon} strokeWidth={2} />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">
                                                {student.displayName}
                                            </span>
                                            <span className="text-muted-foreground block truncate text-xs">
                                                {student.email}
                                            </span>
                                            <span className="text-muted-foreground mt-0.5 block text-xs">
                                                {countLabel(student.attempts.length, 'attempt')}
                                            </span>
                                        </span>
                                        <HugeiconsIcon
                                            icon={ArrowRight01Icon}
                                            strokeWidth={2}
                                            className={cn(
                                                'text-muted-foreground size-4 shrink-0',
                                                selected && 'text-brand-teal',
                                            )}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </aside>

            <section className="min-w-0">
                {!selectedStudent ? (
                    <div className="flex min-h-[34rem] items-center justify-center px-6 py-16">
                        <div className="max-w-sm text-center">
                            <span className="bg-muted text-muted-foreground mx-auto flex size-10 items-center justify-center rounded-md">
                                <HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-5" />
                            </span>
                            <h2 className="font-heading mt-4 font-semibold">Choose a student</h2>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Select a student from the first column to see their assessment
                                attempts.
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-end justify-between gap-3 border-b px-5 py-4">
                            <div className="min-w-0">
                                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                                    Attempts
                                </p>
                                <h2 className="font-heading mt-0.5 truncate text-lg font-semibold">
                                    {selectedStudent.displayName}
                                </h2>
                                <p className="text-muted-foreground truncate text-sm">
                                    {selectedStudent.email}
                                </p>
                            </div>
                            <span className="text-muted-foreground text-sm tabular-nums">
                                {countLabel(selectedStudent.attempts.length, 'attempt')}
                            </span>
                        </div>

                        <div className="max-h-[calc(100vh-22rem)] min-h-64 overflow-auto">
                            <div className="grid min-w-[46rem] grid-cols-[7rem_10rem_7rem_minmax(14rem,1fr)_9rem] gap-4 border-b bg-muted/35 px-5 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                <span>Attempt</span>
                                <span>Started</span>
                                <span>Status</span>
                                <span>Activity</span>
                                <span className="text-right">Replay</span>
                            </div>
                            {selectedStudent.attempts.map((attempt) => (
                                <article
                                    key={attempt.id}
                                    className="grid min-w-[46rem] grid-cols-[7rem_10rem_7rem_minmax(14rem,1fr)_9rem] items-center gap-4 border-b px-5 py-4 last:border-b-0"
                                >
                                    <div>
                                        <p className="text-sm font-medium">Attempt {attempt.number}</p>
                                        <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                                            {attempt.id.slice(0, 8)}
                                        </p>
                                    </div>
                                    <time className="text-sm tabular-nums">{attempt.startedAt}</time>
                                    <div>
                                        <Badge variant={attempt.submitted ? 'secondary' : 'outline'}>
                                            {attempt.submitted ? 'Submitted' : 'Active'}
                                        </Badge>
                                    </div>
                                    <div className="min-w-0">
                                        {attempt.sessionCount === 0 ? (
                                            <p className="text-muted-foreground text-sm">
                                                No tool activity recorded
                                            </p>
                                        ) : (
                                            <>
                                                <p className="truncate text-sm font-medium">
                                                    {attempt.toolNames.join(', ')}
                                                </p>
                                                <p className="text-muted-foreground mt-0.5 text-xs">
                                                    {countLabel(attempt.sessionCount, 'session')} ·{' '}
                                                    {countLabel(attempt.eventCount, 'event')}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex justify-end">
                                        {canReplay && attempt.replay ? (
                                            <LaunchReplayButton
                                                workSessionId={attempt.replay.workSessionId}
                                                roleAssignmentId={roleAssignmentId}
                                                toolName={attempt.replay.toolName}
                                            />
                                        ) : (
                                            <span className="text-muted-foreground text-right text-xs">
                                                {attempt.sessionCount === 0
                                                    ? 'No recording'
                                                    : 'Unavailable for this role'}
                                            </span>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
