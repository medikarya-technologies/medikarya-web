import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCaseById } from '@/data/cases';
import { GUEST_CASE_IDS, explain } from '@/lib/plans/limits';
import { admitCaseStart, caseKind } from '@/lib/plans/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the case definition from the database
    const caseData = await getCaseById(id);

    if (!caseData) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Plan limits (lib/plans/limits.ts). The free /try case is open to everyone and never counted: anyone can
    // play it signed out, so counting it for a signed-in student would only penalise signing in. Signed out,
    // nothing else opens, except on the dev preview pages (/sim-preview, never in production).
    let userId: string | null = null;
    try {
      userId = (await auth()).userId;
    } catch {
      // no session
    }

    if (GUEST_CASE_IDS.includes(id)) {
      // free for everyone
    } else if (!userId) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Sign in to open this case.', reason: 'sign_in' }, { status: 401 });
      }
    } else {
      let decision;
      try {
        decision = await admitCaseStart(userId, id, caseKind(caseData));
      } catch (error) {
        console.error('Could not check plan limits:', error);
        return NextResponse.json({ error: 'We could not check your plan just now. Please try again.' }, { status: 503 });
      }
      if (!decision.ok) {
        return NextResponse.json(
          { error: explain(decision), reason: decision.reason, needs: decision.needs ?? null },
          { status: decision.reason === 'locked' ? 403 : 429 }
        );
      }
    }

    // We append the timestamp for the frontend state,
    // but we DO NOT save this to the global immutable database.
    const sessionData = {
      ...caseData,
      startedAt: new Date().toISOString()
    };

    return NextResponse.json(sessionData);
  } catch (error) {
    console.error('Error starting case:', error);
    return NextResponse.json(
      { error: 'Failed to start case' },
      { status: 500 }
    );
  }
}
