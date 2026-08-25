// Route này tạo tài khoản, tạo database session và đặt cookie đăng nhập cho user mới.
import { Prisma } from '@/app/generated/prisma/client';
import { hashPassword } from '@/lib/auth/password/hash';
import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import {
    errorResponse,
    invalidBodyResponse,
    invalidOriginResponse,
    jsonResponse,
} from '@/lib/auth/http/response';
import { prepareSession, setSessionCookie } from '@/lib/auth/session/service';
import { formatValidationErrors, registerSchema } from '@/lib/auth/validation/credentials';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse();
    }

    const body = await readAuthJson(request);
    if (!body.ok) {
        return invalidBodyResponse(body.reason);
    }

    const parsed = registerSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(
            400,
            'VALIDATION_ERROR',
            'Registration data is invalid',
            formatValidationErrors(parsed.error),
        );
    }

    const { email, password, firstName, lastName, institutionId } = parsed.data;
    const [existingUser, institution] = await Promise.all([
        db.user.findUnique({ where: { email }, select: { id: true } }),
        db.institution.findUnique({ where: { id: institutionId }, select: { id: true } }),
    ]);

    if (existingUser) {
        return errorResponse(409, 'EMAIL_ALREADY_EXISTS', 'Email is already in use');
    }

    if (!institution) {
        return errorResponse(400, 'INVALID_INSTITUTION', 'Institution does not exist');
    }

    const passwordHash = await hashPassword(password);

    try {
        const result = await db.$transaction(async (transaction) => {
            const user = await transaction.user.create({
                data: { email, passwordHash, firstName, lastName, institutionId },
                select: { id: true, email: true, firstName: true, lastName: true, institutionId: true },
            });
            const session = prepareSession(user.id);

            await transaction.session.create({ data: session.record });
            return { user, session };
        });

        await setSessionCookie(result.session.token, result.session.expiresAt);

        return jsonResponse(
            {
                user: result.user,
                session: { expiresAt: result.session.expiresAt },
            },
            { status: 201 },
        );
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return errorResponse(409, 'EMAIL_ALREADY_EXISTS', 'Email is already in use');
        }

        console.error('Failed to create account', error);
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to create account');
    }
}
