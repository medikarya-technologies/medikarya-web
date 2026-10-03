import { NextResponse } from 'next/server';
import { getCaseById } from '@/data/cases';
import { asAdminSees, briefingOnly, isAdmin, isDraft, planIncludes, viewerId } from '@/lib/plans/access';
import { caseForBrowser } from '@/lib/cases/for-browser';

// Three views of a case (lib/cases/views.ts, lib/plans/access.ts): the briefing only for someone whose plan does not
// include it; the play view (no diagnosis, scoring or walkthrough) while they play it; the whole case for someone
// who has completed it before, and for admins. The answers reach a first-time player with their result.
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

    const userId = await viewerId();
    // Drafts exist only for admins to play-test.
    if (isDraft(caseData) && !(await isAdmin(userId))) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    let whole = false;
    try {
      whole = await planIncludes(userId, id, caseData);
    } catch (error) {
      console.error('Could not check plan for case fetch:', error);
    }

    if (!whole) return NextResponse.json(briefingOnly(caseData as Record<string, any>));
    // An admin gets a proposed live plan running, to play-test it; everyone else gets the case as it is live.
    return NextResponse.json(await caseForBrowser((await asAdminSees(caseData, userId)) as Record<string, any>, userId));
  } catch (error) {
    console.error(`Error fetching case:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch case' },
      { status: 500 }
    );
  }
}
