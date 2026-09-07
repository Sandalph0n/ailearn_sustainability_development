import { notFound } from 'next/navigation';

import { ToolMetadataForm } from '@/components/admin/tools/tool-metadata-form';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function EditToolPage({ params }: PageProps<'/admin/tools/[id]/edit'>) {
    const { id } = await params;
    const tool = await db.tool.findUnique({
        where: { id },
        select: { id: true, code: true, name: true, description: true, codeBaseLocation: true },
    });
    if (!tool) notFound();
    return <ToolMetadataForm tool={tool} />;
}
