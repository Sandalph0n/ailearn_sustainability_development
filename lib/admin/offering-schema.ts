// File này định nghĩa dữ liệu nối một Subject với một StudyTerm.
import { z } from 'zod';

import type { OfferingModel } from '@/app/generated/prisma/models';

export type OfferingSchemaValue = Pick<OfferingModel, 'subjectId' | 'termId'>;

export const OfferingSchema = z.strictObject({
    subjectId: z.uuid({ message: 'Choose a subject' }),
    termId: z.uuid({ message: 'Choose a term' }),
}) satisfies z.ZodType<OfferingSchemaValue>;

export type OfferingFormValue = z.input<typeof OfferingSchema>;
export const EMPTY_OFFERING_FORM: OfferingFormValue = { subjectId: '', termId: '' };
