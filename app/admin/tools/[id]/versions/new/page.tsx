import { notFound } from 'next/navigation';

import { ToolPackageForm } from '@/components/admin/tools/tool-package-form';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function NewToolVersionPage({ params }: PageProps<'/admin/tools/[id]/versions/new'>) {
    const { id } = await params;
    const tool = await db.tool.findUnique({ where: { id }, select: { id: true, code: true, name: true } });
    if (!tool) notFound();
    return <ToolPackageForm tool={tool} />;
}
