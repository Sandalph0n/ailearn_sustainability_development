import Image from 'next/image';

import { Reveal } from '@/components/reveal';

import davidImage from '@/public/about/david-nguyen.jpg';
import khoiImage from '@/public/about/khoi-nguyen-vu.jpg';

/**
 * Hai người làm ra sản phẩm.
 *
 * `focal` là vị trí cần giữ lại khi ảnh bị cắt thành hình tròn. Bản base44 truyền
 * `focalPointX/focalPointY` cho component `Image` riêng của họ; ở đây không có component đó, nên
 * dịch thẳng sang `object-position` — cùng một ý, bằng CSS thuần.
 *
 * Ảnh chân dung không vuông (474×711 và 960×960), nên `object-cover` là bắt buộc: thiếu nó thì
 * khung tròn sẽ bóp méo mặt người.
 */
const PEOPLE = [
    {
        name: 'Khoi Nguyen Vu',
        role: 'Co-Founder · Software Engineer',
        image: khoiImage,
        focal: '50% 50%',
        bio: 'Builds reliable product experiences and turns complex learning workflows into clear, intuitive software.',
    },
    {
        name: 'David Nguyen',
        role: 'Co-Founder · Software Engineer',
        image: davidImage,
        focal: '50% 32%',
        bio: 'Focuses on thoughtful engineering and practical tools that help students make their learning process visible.',
    },
] as const;

export function AboutTeam() {
    return (
        <section id="team" className="scroll-mt-20 py-20 md:py-28">
            <div className="mx-auto max-w-225 px-5 md:px-8">
                <Reveal variant="blur">
                    <div className="mb-12 text-center">
                        <p className="text-brand-teal mb-3 text-3xl font-semibold">Meet Our Team</p>
                        <h2 className="font-heading mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                            The People Behind AI-Learn
                        </h2>
                        <p className="text-muted-foreground">
                            A small team building a clearer future for learning and assessment.
                        </p>
                    </div>
                </Reveal>

                <div className="grid gap-6 sm:grid-cols-2">
                    {PEOPLE.map((person, index) => (
                        <Reveal
                            key={person.name}
                            variant="up"
                            delay={index * 0.1}
                            className="h-full"
                        >
                            <article className="bg-card border-border flex h-full flex-col items-center rounded-2xl border p-7 text-center">
                                <div className="relative mb-5 size-40 overflow-hidden rounded-full">
                                    <Image
                                        src={person.image}
                                        alt={person.name}
                                        fill
                                        sizes="160px"
                                        style={{ objectPosition: person.focal }}
                                        className="object-cover"
                                    />
                                </div>
                                <h3 className="font-heading text-xl font-semibold">{person.name}</h3>
                                <p className="text-brand-teal mt-1 text-sm font-medium">
                                    {person.role}
                                </p>
                                <p className="text-muted-foreground mt-4 max-w-[34ch] text-sm leading-relaxed">
                                    {person.bio}
                                </p>
                            </article>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
