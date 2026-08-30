/**
 * Nạp dữ liệu mẫu cho một tài khoản, đủ để bảng điều khiển có gì mà hiển thị.
 *
 * ─── Vì sao cần script này ───────────────────────────────────────────────────
 *
 * Bảng điều khiển đọc số liệu THẬT từ database. Không có dữ liệu thì mọi biểu đồ đều rỗng, và
 * không đánh giá được thiết kế. Cách thay thế — nhét số giả vào giao diện — thì đến lúc nối dữ
 * liệu thật phải gỡ hết, mà trong lúc đó không ai phân biệt được cái nào thật.
 *
 * Nên dữ liệu giả nằm ở ĐÂY, trong database, không nằm trong mã giao diện.
 *
 * ─── Cách chạy ───────────────────────────────────────────────────────────────
 *
 *     pnpm tsx scripts/seed-demo.ts <email>
 *
 * Chạy lại nhiều lần được: nó tìm-hoặc-tạo theo khoá tự nhiên, không nhân bản dữ liệu.
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../app/generated/prisma/client';

/**
 * Client riêng, KHÔNG dùng `lib/db.ts`.
 *
 * File đó mở đầu bằng `import 'server-only'` — một gói cố ý ném lỗi khi bị nạp ngoài môi trường
 * server của Next. Script chạy bằng `tsx` nên rơi đúng vào bẫy đó.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is missing from .env');
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const HOURS = 60 * 60 * 1000;
const DAYS = 24 * HOURS;

/** Trừ/cộng ngày so với bây giờ. Số âm là quá khứ. */
function daysFromNow(days: number, hour = 23, minute = 59): Date {
    const date = new Date(Date.now() + days * DAYS);
    date.setHours(hour, minute, 0, 0);
    return date;
}

async function main() {
    const email = process.argv[2];
    if (!email) {
        throw new Error('Usage: pnpm tsx scripts/seed-demo.ts <email>');
    }

    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
        throw new Error(`No user with email ${email}. Register first, then run this.`);
    }

    // ─── Cơ sở, kỳ học, môn ──────────────────────────────────────────────────

    const institution =
        (await db.institution.findFirst({ where: { name: 'Macquarie University' } })) ??
        (await db.institution.create({
            data: { name: 'Macquarie University', website: 'https://mq.edu.au' },
        }));

    const term = await db.studyTerm.upsert({
        where: {
            institutionId_year_session: { institutionId: institution.id, year: 2026, session: 2 },
        },
        update: {},
        create: { institutionId: institution.id, year: 2026, session: 2 },
    });

    // Các giai đoạn trong kỳ — thứ mà lịch học sẽ đọc để biết tuần nào học, tuần nào nghỉ.
    const periods = [
        { name: 'Teaching block 1', type: 'TEACHING' as const, from: -42, to: -8 },
        { name: 'Mid-session break', type: 'BREAK' as const, from: -7, to: -1 },
        { name: 'Teaching block 2', type: 'TEACHING' as const, from: 0, to: 35 },
        { name: 'Examinations', type: 'EXAM' as const, from: 38, to: 52 },
    ];

    if ((await db.studyTermPeriod.count({ where: { studyTermId: term.id } })) === 0) {
        await db.studyTermPeriod.createMany({
            data: periods.map((period) => ({
                studyTermId: term.id,
                name: period.name,
                type: period.type,
                startAt: daysFromNow(period.from, 9, 0),
                endAt: daysFromNow(period.to, 17, 0),
            })),
        });
    }

    const subjects = [
        { subjectCode: 'COMP3000', subjectName: 'Programming Languages' },
        { subjectCode: 'COMP3250', subjectName: 'Computer Networks' },
        { subjectCode: 'COMP3300', subjectName: 'Data Privacy and Information Security' },
        { subjectCode: 'COMP3410', subjectName: 'Knowledge and Decision Making' },
    ];

    const offerings = [];
    for (const subject of subjects) {
        const row = await db.subject.upsert({
            where: {
                institutionId_subjectCode: {
                    institutionId: institution.id,
                    subjectCode: subject.subjectCode,
                },
            },
            update: {},
            create: { institutionId: institution.id, ...subject },
        });

        offerings.push(
            await db.offering.upsert({
                where: { subjectId_termId: { subjectId: row.id, termId: term.id } },
                update: {},
                create: { subjectId: row.id, termId: term.id },
            }),
        );
    }

    // ─── Vai trò, và gán người dùng vào từng lượt mở môn ─────────────────────

    const studentRole =
        (await db.role.findFirst({
            where: { institutionId: institution.id, roleName: 'Student' },
        })) ??
        (await db.role.create({
            data: { institutionId: institution.id, roleName: 'Student', scopeType: 'OFFERING' },
        }));

    for (const offering of offerings) {
        const existing = await db.roleAssignment.findFirst({
            where: { userId: user.id, roleId: studentRole.id, offeringId: offering.id },
        });

        if (!existing) {
            await db.roleAssignment.create({
                data: { userId: user.id, roleId: studentRole.id, offeringId: offering.id },
            });
        }
    }

    // ─── Bài tập, hạn nộp rải ra quanh hôm nay ───────────────────────────────

    const assessmentPlan = [
        { offering: 0, name: 'Interpreter — part 2', weight: 25, due: 2 },
        { offering: 1, name: 'Routing protocol report', weight: 20, due: 5 },
        { offering: 2, name: 'Threat model write-up', weight: 15, due: 9, hurdle: true },
        { offering: 3, name: 'Planning under uncertainty', weight: 30, due: 16, isGroup: true },
        { offering: 0, name: 'Interpreter — part 1', weight: 15, due: -11 },
        { offering: 1, name: 'Packet capture exercise', weight: 10, due: -20 },
        { offering: 2, name: 'Cipher implementation', weight: 20, due: -27 },
    ];

    const assessments = [];
    for (const plan of assessmentPlan) {
        const offering = offerings[plan.offering];
        const existing = await db.assessment.findFirst({
            where: { offeringId: offering.id, name: plan.name },
        });

        assessments.push(
            existing ??
                (await db.assessment.create({
                    data: {
                        offeringId: offering.id,
                        name: plan.name,
                        weight: plan.weight,
                        hurdle: plan.hurdle ?? false,
                        isGroup: plan.isGroup ?? false,
                        publishAt: daysFromNow(plan.due - 28, 9, 0),
                        dueAt: daysFromNow(plan.due),
                    },
                })),
        );
    }

    // ─── Công cụ ─────────────────────────────────────────────────────────────

    const tools = [];
    for (const tool of [
        { code: 'code', name: 'Code Workspace' },
        { code: 'diagram', name: 'Diagram Workspace' },
    ]) {
        tools.push(
            await db.tool.upsert({ where: { code: tool.code }, update: {}, create: tool }),
        );
    }

    // ─── Lượt làm bài + phiên làm việc ───────────────────────────────────────
    //
    // Đây là thứ nuôi biểu đồ hoạt động. Phiên rải trên 8 tuần gần nhất, mỗi phiên gắn một công
    // cụ, để biểu đồ có hai chuỗi thật sự khác nhau chứ không phải một chuỗi tô hai màu.

    let sessionsCreated = 0;
    for (const [index, assessment] of assessments.entries()) {
        // Một người được có nhiều lượt cho cùng bài. Seed chỉ tái dùng lượt đầu tiên của chính
        // nó để chạy lại script không nhân đôi dữ liệu demo.
        const attempt =
            (await db.assessmentAttempt.findFirst({
                where: { userId: user.id, assessmentId: assessment.id },
                orderBy: { startAt: 'asc' },
            })) ??
            (await db.assessmentAttempt.create({
                data: {
                    userId: user.id,
                    assessmentId: assessment.id,
                    startAt: daysFromNow(-30 + index * 4, 10, 0),
                    // Bài đã quá hạn thì coi như đã nộp.
                    submitAt: index >= 4 ? daysFromNow(-30 + index * 4 + 3, 22, 0) : null,
                },
            }));

        const workspace = await db.assignmentWorkspace.findUnique({
            where: { attemptId: attempt.id },
        });

        const assignmentWorkspace =
            workspace ??
            (await db.assignmentWorkspace.create({
                data: {
                    // Nối bằng `connect` chứ không gán thẳng hai cột khoá ngoại: khi trong cùng
                    // một `create` đã có quan hệ lồng (`workspace`), Prisma đòi mọi quan hệ khác
                    // cũng phải khai theo lối quan hệ, không trộn hai cách.
                    attempt: { connect: { id: attempt.id } },
                    workspace: {
                        create: {
                            name: assessment.name,
                            createdAt: daysFromNow(-30 + index * 4, 10, 0),
                            lastOpenedAt: daysFromNow(-30 + index * 4 + 2, 20, 0),
                        },
                    },
                },
            }));

        const existingSessions = await db.assignmentWorkSession.count({
            where: { assignmentWorkspaceId: assignmentWorkspace.workspaceId },
        });
        if (existingSessions > 0) continue;

        // Hai tới bốn phiên cho mỗi bài, thời lượng khác nhau.
        const sessionCount = 2 + (index % 3);
        for (let n = 0; n < sessionCount; n += 1) {
            const startAt = new Date(
                daysFromNow(-30 + index * 4 + n, 14 + (n % 4), 0).getTime(),
            );
            const minutes = 35 + ((index * 17 + n * 23) % 80);

            const session = await db.assignmentWorkSession.create({
                data: {
                    assignmentWorkspaceId: assignmentWorkspace.workspaceId,
                    toolId: tools[(index + n) % tools.length].id,
                    startAt,
                    endAt: new Date(startAt.getTime() + minutes * 60 * 1000),
                },
            });

            // Một lô sự kiện tượng trưng, để phần phát lại có gì mà đọc.
            const eventCount = 40 + ((index * 13 + n * 7) % 120);
            await db.eventBatch.create({
                data: {
                    assignmentWorkSessionId: session.id,
                    seqStart: 1,
                    seqEnd: eventCount,
                    clientAt: startAt,
                    events: [{ type: 'session.start', at: startAt.toISOString() }],
                },
            });

            sessionsCreated += 1;
        }
    }

    // ─── Ghi chú cá nhân ─────────────────────────────────────────────────────

    if ((await db.personalWorkspace.count({ where: { userId: user.id } })) === 0) {
        for (const name of ['Exam revision', 'Reading notes', 'Scratch']) {
            await db.personalWorkspace.create({
                data: {
                    // Cùng lý do như `assignmentWorkspace` ở trên: đã có quan hệ lồng thì mọi
                    // quan hệ khác cũng phải khai bằng `connect`.
                    user: { connect: { id: user.id } },
                    workspace: { create: { name, lastOpenedAt: daysFromNow(-3, 19, 0) } },
                },
            });
        }
    }

    console.log('Seeded for', email);
    console.log('  offerings   ', offerings.length);
    console.log('  assessments ', assessments.length);
    console.log('  sessions    ', sessionsCreated);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
