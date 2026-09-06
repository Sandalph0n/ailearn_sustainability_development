export type LearningAssessmentSummary = {
    id: string;
    name: string;
    description: string | null;
    weight: number;
    hurdle: boolean;
    isGroup: boolean;
    publishAt: string;
    dueAt: string | null;
    expectedDue: string | null;
    ownAttemptCount: number | null;
};

export type LearningOfferingSummary = {
    id: string;
    institution: { id: string; name: string };
    subject: {
        code: string;
        name: string;
        description: string | null;
    };
    term: {
        id: string;
        year: number;
        session: number;
        periods: Array<{ startAt: string; endAt: string }>;
    };
    publishedAssessmentCount: number | null;
};

export type LearningOfferingDetail = LearningOfferingSummary & {
    assessments: LearningAssessmentSummary[] | null;
};

export type LearningAssessmentDetail = Omit<
    LearningAssessmentSummary,
    'ownAttemptCount'
> & {
    offering: Omit<LearningOfferingSummary, 'publishedAssessmentCount'>;
};

export type LearningAttemptSummary = {
    id: string;
    startAt: string;
    submitAt: string | null;
    workspace: { id: string; name: string; lastOpenedAt: string | null };
};
