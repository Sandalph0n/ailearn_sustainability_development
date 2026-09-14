import Image from 'next/image';

import { Reveal } from '@/components/reveal';

import sdg4Image from '@/public/about/sdg-4.jpg';
import sdg8Image from '@/public/about/sdg-8.jpg';

/**
 * Sứ mệnh và câu chuyện, kèm hai mục tiêu phát triển bền vững mà sản phẩm bám theo.
 *
 * ─── Vì sao ảnh nằm trong `public/` chứ không gọi thẳng CDN của base44 ───────
 *
 * Bản base44 trỏ `<img>` vào `media.base44.com`. Trang giới thiệu bên này đã bỏ tấm ảnh hero của
 * họ vì lý do đó; giữ nguyên lập trường: tải về `public/about/`, để `next/image` tự nén và đổi
 * kích thước. Đổi lại là không phải mở `images.remotePatterns` cho một tên miền ngoài, và trang
 * không hỏng khi dự án base44 kia bị xoá.
 *
 * ─── Vì sao `fill` chứ không để `next/image` tự suy kích thước ───────────────
 *
 * Ảnh nguồn là 1024×1024 nhưng khung hiển thị co theo cột. Nếu nhập tĩnh rồi đè `w-full` bằng CSS,
 * Next sẽ than rằng chỉ một trong hai chiều bị đổi. Bọc trong một khung `aspect-square` rồi cho
 * ảnh `fill` thì kích thước do bố cục quyết định, không còn mâu thuẫn.
 */

const SDGS = [
    {
        image: sdg4Image,
        alt: 'Abstract education tools representing quality education',
        code: 'SDG 4',
        label: 'Quality Education',
        ink: 'text-primary',
    },
    {
        image: sdg8Image,
        alt: 'Abstract forms representing decent work and economic growth',
        code: 'SDG 8',
        label: 'Decent Work and Economic Growth',
        ink: 'text-brand-amber',
    },
] as const;

export function MissionStory() {
    return (
        <section className="py-20 md:py-28">
            <div className="mx-auto grid max-w-295 items-center gap-12 px-5 md:px-8 lg:grid-cols-2">
                <Reveal variant="left">
                    <div className="space-y-10">
                        <div>
                            <p className="text-brand-teal mb-3 text-3xl font-semibold">
                                Our Mission
                            </p>
                            <h2 className="font-heading mb-4 text-[28px] font-bold tracking-tight">
                                Better Evidence for Better Learning.
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Our mission is to give students the freedom to add and combine the
                                tools that suit each subject, build practical skills and show the
                                real work behind every outcome. Educators gain a more complete and
                                equitable view of both progress and results.
                            </p>
                        </div>

                        <div>
                            <p className="text-brand-violet mb-3 text-3xl font-semibold">
                                Our Story
                            </p>
                            <h2 className="font-heading mb-4 text-[28px] font-bold tracking-tight">
                                Born from a Simple Question.
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                AI-Learn began with the belief that a final submission rarely tells
                                the whole story and that one fixed workspace cannot fit every
                                subject. We created a flexible platform where students can bring
                                together multiple tools while edits, decisions and problem-solving
                                remain part of the learning record.
                            </p>
                        </div>
                    </div>
                </Reveal>

                <Reveal variant="right">
                    {/*
                        Khoảng cách dọc phải rộng (`gap-20`) vì tấm thẻ SDG thò hẳn xuống dưới đáy
                        ảnh. Từ `sm` trở lên hai ảnh nằm cạnh nhau nên khoảng cách thu về `gap-5`,
                        và `pb-16` chừa chỗ cho thẻ của hàng cuối.
                    */}
                    <div className="mx-auto grid max-w-130 gap-20 pb-16 sm:grid-cols-2 sm:gap-5">
                        {SDGS.map((sdg) => (
                            <div key={sdg.code} className="relative">
                                <div className="border-border relative aspect-square overflow-hidden rounded-3xl border">
                                    <Image
                                        src={sdg.image}
                                        alt={sdg.alt}
                                        fill
                                        sizes="(min-width: 640px) 260px, 100vw"
                                        className="object-cover"
                                    />
                                </div>
                                <div className="border-border bg-card absolute right-0 -bottom-16 flex h-24 w-2/3 flex-col items-center justify-center rounded-xl border p-3 text-center shadow-xl sm:w-3/4">
                                    <p className={`text-xl font-bold ${sdg.ink}`}>{sdg.code}</p>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        {sdg.label}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
