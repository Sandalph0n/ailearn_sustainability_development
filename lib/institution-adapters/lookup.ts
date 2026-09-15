// File này gói phần dùng chung của hai route tra cứu môn: một cho quản trị hệ thống, một cho vai
// trò trong cơ sở. Cả hai chỉ khác nhau ở chốt chặn quyền.
import 'server-only';

import type { NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { SubjectSchema } from '@/lib/admin/subject-schema';
import { db } from '@/lib/db';
import { adapterForInstitution } from '@/lib/institution-adapters';

const SubjectCodeSchema = SubjectSchema.shape.subjectCode;

/**
 * Tra một mã môn trong danh mục công khai của cơ sở.
 *
 * `institutionId` đã được route kiểm quyền; ở đây chỉ còn kiểm dữ liệu và gọi adapter. Mã sai
 * định dạng bị chặn trước khi chạm mạng — không có lý do gì để hỏi Macquarie về "abc".
 */
export async function lookupCatalogSubject(
    institutionId: string,
    rawCode: string | null,
): Promise<NextResponse> {
    const parsedCode = SubjectCodeSchema.safeParse(rawCode ?? '');
    if (!parsedCode.success) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Enter a subject code to look up', {
            subjectCode: parsedCode.error.issues.map((issue) => issue.message),
        });
    }

    const institution = await db.institution.findUnique({
        where: { id: institutionId },
        select: { name: true, website: true },
    });
    if (!institution) return errorResponse(404, 'NOT_FOUND', 'Institution does not exist');

    const adapter = adapterForInstitution(institution);
    if (!adapter) {
        return errorResponse(
            404,
            'NOT_FOUND',
            `${institution.name} has no public catalog to look subjects up in`,
        );
    }

    const result = await adapter.findSubject(parsedCode.data);
    if (!result.ok) {
        return result.reason === 'not_found'
            ? errorResponse(
                  404,
                  'NOT_FOUND',
                  `${parsedCode.data} is not in the ${adapter.label}`,
              )
            : errorResponse(
                  502,
                  'UPSTREAM_UNAVAILABLE',
                  `The ${adapter.label} did not answer. Try again, or fill the details in by hand.`,
              );
    }

    return jsonResponse({ subject: result.subject, source: adapter.label });
}
