import type { Metadata } from 'next';

import { AboutCta } from '@/components/about/about-cta';
import { AboutHeader } from '@/components/about/about-header';
import { AboutHero } from '@/components/about/about-hero';
import { AboutTeam } from '@/components/about/about-team';
import { AboutValues } from '@/components/about/about-values';
import { MissionStory } from '@/components/about/mission-story';
import { SiteFooter } from '@/components/home/site-footer';

/**
 * Trang About — sản phẩm này là gì, và ai làm ra nó.
 *
 * ─── Vì sao không có `ctaTo` như bản base44 ──────────────────────────────────
 *
 * Bên đó, About hỏi `base44.auth.isAuthenticated()` rồi đổi đích của nút giữa `/dashboard` và
 * `/register`. Ở đây mọi nút trỏ thẳng `/auth`, đúng như trang giới thiệu: `proxy.ts` đã đá người
 * đang có phiên từ `/auth` vào bảng điều khiển, nên một liên kết phục vụ được cả hai phía.
 *
 * Nhờ vậy cả trang là server component tĩnh — không `'use client'`, không đọc cookie, không chờ
 * một lượt gọi mạng rồi mới biết nút trỏ đi đâu.
 */
export const metadata: Metadata = {
    title: 'About — AI-Learn',
    description:
        'Why AI-Learn exists: making student thinking visible, and giving educators fairer evidence of how learning happens.',
};

export default function AboutPage() {
    return (
        <div className="bg-background text-foreground min-h-svh overflow-x-hidden">
            <AboutHeader />
            <main>
                <AboutHero />
                <MissionStory />
                <AboutValues />
                <AboutTeam />
                <AboutCta />
            </main>
            <SiteFooter />
        </div>
    );
}
