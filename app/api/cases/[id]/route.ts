import { NextResponse } from 'next/server';
import { getCaseById } from '@/data/cases';
import { briefingOnly, planIncludes, viewerId } from '@/lib/plans/access';

// The whole case only for someone whose plan includes it (anyone, for the free /try case), since it holds the
// diagnosis, the answers and the patient's script; for everyone else, the briefing only (lib/plans/access.ts).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const caseData = await getCaseById(id);

    if (!caseData) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    let whole = false;
    try {
      whole = await planIncludes(await viewerId(), id, caseData);
    } catch (error) {
      console.error('Could not check plan for case fetch:', error);
    }

    return NextResponse.json(whole ? caseData : briefingOnly(caseData as Record<string, any>));
  } catch (error) {
    console.error(`Error fetching case:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch case' },
      { status: 500 }
    );
  }
}
