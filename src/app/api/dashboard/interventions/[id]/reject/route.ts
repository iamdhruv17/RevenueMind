import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const intervention = await prisma.intervention.update({
      where: { id },
      data: { status: 'rejected' }
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'Intervention',
        entityId: id,
        action: 'rejected_by_human',
        actor: 'Human'
      }
    });

    return NextResponse.json({ success: true, intervention });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to reject' }, { status: 500 });
  }
}
