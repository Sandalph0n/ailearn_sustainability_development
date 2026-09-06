import 'server-only';

import type { NextRequest } from 'next/server';
import type { z } from 'zod';

import {
    guardOfferingAction,
    guardOfferingWrite,
} from '@/lib/auth/offering-route-guard';
import type { PermissionCode } from '@/lib/auth/permissions';

export function guardAssessmentAction(
    request: NextRequest,
    institutionId: string,
    offeringId: string,
    permission: PermissionCode,
) {
    return guardOfferingAction(request, institutionId, offeringId, permission);
}

export function guardAssessmentWrite<TOutput>(
    request: NextRequest,
    institutionId: string,
    offeringId: string,
    permission: PermissionCode,
    schema: z.ZodType<TOutput>,
) {
    return guardOfferingWrite(
        request,
        institutionId,
        offeringId,
        permission,
        schema,
        'Assessment',
    );
}
