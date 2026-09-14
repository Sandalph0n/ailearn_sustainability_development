import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/legal/legal-page';

/**
 * Điều khoản dịch vụ.
 *
 * Như trang chính sách riêng tư: chép nguyên văn bản base44, chỉ đổi tên sản phẩm.
 */
const SECTIONS: readonly LegalSection[] = [
    {
        title: 'Using AI-Learn',
        body: 'You may use AI-Learn only for lawful educational purposes and in accordance with the rules of your institution. You must provide accurate account information and keep your sign-in details secure.',
    },
    {
        title: 'Acceptable use',
        body: 'You must not disrupt the service, access another person’s account or work without permission, upload harmful content, attempt to bypass security, or use AI-Learn to violate applicable law or institutional policy.',
    },
    {
        title: 'Your content',
        body: 'You retain ownership of the work you create. You give AI-Learn the limited permission needed to store, process, display, and share that content with authorised users so we can provide the service.',
    },
    {
        title: 'Academic integrity',
        body: 'AI-Learn records parts of the working process to support learning and assessment. You remain responsible for following academic-integrity requirements and for ensuring submitted work is genuinely yours.',
    },
    {
        title: 'Service availability',
        body: 'We aim to keep AI-Learn reliable, but the service may occasionally be unavailable for maintenance, security, or circumstances outside our control. Features may change as the platform develops.',
    },
    {
        title: 'Suspension and termination',
        body: 'Access may be suspended or ended if these terms are breached, if required by an institution, or where necessary to protect users and the service. You may stop using AI-Learn at any time.',
    },
    {
        title: 'Disclaimers and liability',
        body: 'AI-Learn supports learning and assessment but does not guarantee academic outcomes. To the extent permitted by law, the service is provided without warranties beyond those that cannot legally be excluded, and liability is limited accordingly.',
    },
    {
        title: 'Changes and contact',
        body: 'We may update these terms as AI-Learn evolves. Continued use after an update means you accept the revised terms. For questions, contact the AI-Learn team through the Contact section on our home page.',
    },
];

export const metadata: Metadata = {
    title: 'Terms of Service — AI-Learn',
    description:
        'The rules for using AI-Learn and the responsibilities shared by learners, educators, and the platform.',
};

export default function TermsOfServicePage() {
    return (
        <LegalPage
            title="Terms of Service"
            intro="These terms set out the rules for using AI-Learn and the responsibilities shared by learners, educators, and the platform."
            sections={SECTIONS}
        />
    );
}
