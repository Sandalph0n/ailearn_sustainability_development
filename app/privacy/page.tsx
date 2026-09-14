import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/legal/legal-page';

/**
 * Chính sách quyền riêng tư.
 *
 * Nội dung bê nguyên từ bản base44, chỉ đổi tên sản phẩm Lernumi → AI-Learn. Đây là văn bản pháp
 * lý: không diễn đạt lại cho gọn, vì mỗi chữ đều có thể mang nghĩa ràng buộc.
 */
const SECTIONS: readonly LegalSection[] = [
    {
        title: 'Information we collect',
        body: 'We collect account information such as your name, email address, institution, and role. When you use AI-Learn, we also store coursework, submissions, tool activity, deadlines, and technical information needed to operate the service.',
    },
    {
        title: 'How we use information',
        body: 'We use your information to provide and improve AI-Learn, authenticate accounts, save learning activity, support assessment and feedback, communicate service updates, and protect the platform from misuse.',
    },
    {
        title: 'How information is shared',
        body: 'Your learning information may be visible to authorised educators and institution members where required for teaching or assessment. We do not sell personal information. We may use trusted service providers to host and operate AI-Learn, subject to appropriate safeguards.',
    },
    {
        title: 'Data retention and security',
        body: 'We retain information while your account or institutional relationship remains active and as needed for legitimate educational, legal, or operational purposes. We use reasonable technical and organisational measures to protect stored information.',
    },
    {
        title: 'Your choices and rights',
        body: 'Depending on where you live, you may ask to access, correct, export, or delete personal information. Some educational records may need to be retained by your institution. Contact the AI-Learn team to make a request.',
    },
    {
        title: 'Children’s privacy',
        body: 'AI-Learn is intended for learners who are permitted to use the service by their institution and applicable law. Where consent from a parent or guardian is required, the institution is responsible for obtaining it.',
    },
    {
        title: 'Changes and contact',
        body: 'We may update this policy as AI-Learn evolves. Material changes will be communicated through the service. For privacy questions, contact the AI-Learn team through the Contact section on our home page.',
    },
];

export const metadata: Metadata = {
    title: 'Privacy Policy — AI-Learn',
    description:
        'What information AI-Learn handles, why we use it, and the choices available to you.',
};

export default function PrivacyPolicyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            intro="This policy explains what information AI-Learn handles, why we use it, and the choices available to you."
            sections={SECTIONS}
        />
    );
}
