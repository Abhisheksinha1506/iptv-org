import { NextResponse } from 'next/server';
import { RepositoryTracker } from '@/lib/github';

export async function GET() {
  const tracker = new RepositoryTracker();
  const updates = await tracker.checkForUpdates();
  return NextResponse.json({
    repositories: updates,
    checkedAt: new Date().toISOString(),
  });
}

