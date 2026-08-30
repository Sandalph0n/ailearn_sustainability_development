// File này định nghĩa thao tác cấp một RoleAssignment mới.
import { z } from 'zod';

import type { RoleAssignmentModel } from '@/app/generated/prisma/models';

export type RoleAssignmentSchemaValue = Pick<
    RoleAssignmentModel,
    'userId' | 'roleId' | 'offeringId'
>;

const optionalOfferingId = z
    .string()
    .transform((value) => (value === '' || value === 'institution' ? null : value))
    .refine((value) => value === null || z.uuid().safeParse(value).success, {
        message: 'Choose a valid scope',
    });

export const RoleAssignmentSchema = z.strictObject({
    userId: z.uuid({ message: 'Choose a user' }),
    roleId: z.uuid({ message: 'Choose a role' }),
    offeringId: optionalOfferingId,
}) satisfies z.ZodType<RoleAssignmentSchemaValue>;

export type RoleAssignmentFormValue = z.input<typeof RoleAssignmentSchema>;
export const EMPTY_ROLE_ASSIGNMENT_FORM: RoleAssignmentFormValue = {
    userId: '',
    roleId: '',
    offeringId: '',
};
