// Route này xác minh email/password, nâng cấp password hash khi cần và cấp session mới.
import {
    hashPassword,
    passwordHashNeedsUpgrade,
    verifyPassword,
    verifyPasswordForMissingUser,
} from '@/lib/auth/password/hash';
import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import {
    errorResponse,
    invalidBodyResponse,
    invalidOriginResponse,
    jsonResponse,
} from '@/lib/auth/http/response';
import { replaceCurrentSession } from '@/lib/auth/session/service';
import { formatValidationErrors, loginSchema } from '@/lib/auth/validation/credentials';
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

    const parsed = loginSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(
            400,
            'VALIDATION_ERROR',
            'Login data is invalid',
            formatValidationErrors(parsed.error),
        );
    }

    const { email, password } = parsed.data;
    const user = await db.user.findUnique({
        where: { email },
        select: {
            id: true,
            email: true,
            passwordHash: true,
            firstName: true,
            lastName: true,
            institutionId: true,
        },
    });

    if (!user) {
        await verifyPasswordForMissingUser(password);
        return errorResponse(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }

    const passwordMatches = await verifyPassword(user.passwordHash, password);
    if (!passwordMatches) {
        return errorResponse(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }

    if (passwordHashNeedsUpgrade(user.passwordHash)) {
        const upgradedHash = await hashPassword(password);
        await db.user.updateMany({
            where: { id: user.id, passwordHash: user.passwordHash },
            data: { passwordHash: upgradedHash },
        });
    }

    const session = await replaceCurrentSession(user.id);

    return jsonResponse({
        user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            institutionId: user.institutionId,
        },
        session,
    });
}
