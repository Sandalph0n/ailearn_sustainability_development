import { z } from 'zod';

export type ScopeCodeSchemaValue = {
    offeringId: string;
};

export const ScopeCodeSchema = z.strictObject({
    offeringId: z.uuid({ message: 'Choose an offering' }),
}) satisfies z.ZodType<ScopeCodeSchemaValue>;

export type ScopeCodeFormValue = z.input<typeof ScopeCodeSchema>;

export const EMPTY_SCOPE_CODE_FORM: ScopeCodeFormValue = {
    offeringId: '',
};
