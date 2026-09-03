import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { Prisma } from '@/app/generated/prisma/client';
import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import {
    errorResponse,
    invalidBodyResponse,
    invalidOriginResponse,
    jsonResponse,
} from '@/lib/auth/http/response';
import { listRequestableRoleOptions } from '@/lib/auth/role-request-service';
import { getCurrentSession } from '@/lib/auth/session/service';
import { formatValidationErrors } from '@/lib/auth/validation/credentials';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const institutionIdSchema = z.uuid({ message: 'Choose a valid institution' });
const createRoleRequestSchema = z.strictObject({
    institutionId: institutionIdSchema,
    roleId: z.uuid({ message: 'Choose a valid role' }),
});

class RoleNotRequestableError extends Error {}
class RoleRequestAlreadyPendingError extends Error {}

export async function GET(request: NextRequest): Promise<NextResponse> {
    const session = await getCurrentSession();
    if (!session) {
        return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }

    const parsedInstitutionId = institutionIdSchema.safeParse(
        request.nextUrl.searchParams.get('institutionId'),
    );
    if (!parsedInstitutionId.success) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Choose a valid institution', {
            institutionId: ['Choose a valid institution'],
        });
    }

    const institution = await db.institution.findUnique({
        where: { id: parsedInstitutionId.data },
        select: { id: true },
    });
    if (!institution) return errorResponse(404, 'NOT_FOUND', 'Institution does not exist');

    const roles = await listRequestableRoleOptions(
        db,
        session.user.id,
        parsedInstitutionId.data,
    );
    return jsonResponse({ roles });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();

    const session = await getCurrentSession();
    if (!session) {
        return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }

    const body = await readAuthJson(request);
    if (!body.ok) return invalidBodyResponse(body.reason);

    const parsed = createRoleRequestSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(
            400,
            'VALIDATION_ERROR',
            'Role request data is invalid',
            formatValidationErrors(parsed.error),
        );
    }

    const { institutionId, roleId } = parsed.data;

    try {
        const roleRequest = await db.$transaction(async (transaction) => {
            // Hai tab gửi cùng lúc vẫn chỉ tạo được một request đang chờ.
            await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`role-request:${session.user.id}:${roleId}`}, 0))`;

            const options = await listRequestableRoleOptions(
                transaction,
                session.user.id,
                institutionId,
            );
            const selectedRole = options.find((role) => role.id === roleId);
            if (!selectedRole) throw new RoleNotRequestableError();
            if (selectedRole.pending) throw new RoleRequestAlreadyPendingError();

            return transaction.roleRequest.create({
                data: {
                    userId: session.user.id,
                    institutionId,
                    roleId,
                },
                select: { id: true, requestedAt: true, status: true },
            });
        });

        return jsonResponse({ roleRequest }, { status: 201 });
    } catch (error) {
        if (error instanceof RoleNotRequestableError) {
            // Cùng một câu trả lời cho role không tồn tại, khác institution hoặc đang bị ẩn.
            return errorResponse(404, 'NOT_FOUND', 'That role is not available to request');
        }
        if (
            error instanceof RoleRequestAlreadyPendingError ||
            (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        ) {
            return errorResponse(
                409,
                'ROLE_REQUEST_ALREADY_PENDING',
                'You already have a pending request for that role',
            );
        }

        console.error('Failed to create role request', error);
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to create role request');
    }
}
