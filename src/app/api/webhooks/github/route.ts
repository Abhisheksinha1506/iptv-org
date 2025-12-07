import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { RepositoryTracker } from '@/lib/github';

async function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!signature) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('GITHUB_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const signature = request.headers.get('x-hub-signature-256');
  const body = await request.text();

  // Verify webhook signature
  if (!signature || !(await verifySignature(body, signature, webhookSecret))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = request.headers.get('x-github-event');
  const payload = JSON.parse(body);

  // Only handle push events
  if (event !== 'push') {
    return NextResponse.json({ message: 'Event ignored', event });
  }

  const repository = payload.repository;
  const owner = repository.owner.login || repository.owner.name;
  const repo = repository.name;
  const ref = payload.ref;

  // Check if this repository is tracked
  const tracker = new RepositoryTracker();
  const isTracked = await tracker.isRepositoryTracked(owner, repo);

  if (!isTracked) {
    return NextResponse.json({
      message: 'Repository not tracked',
      owner,
      repo,
    });
  }

  // Trigger background processing
  // We'll call the internal job endpoint asynchronously
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url.split('/api')[0];
  const jobUrl = `${baseUrl}/api/jobs/process-repository`;

  // Fire and forget - don't wait for the job to complete
  fetch(jobUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Internal API key for security (optional but recommended)
      'X-Internal-Key': process.env.INTERNAL_API_KEY || 'internal-key',
    },
    body: JSON.stringify({
      owner,
      repo,
      ref: ref.replace('refs/heads/', ''),
      commitSha: payload.after,
    }),
  }).catch(function handleError(error) {
    console.error('Failed to trigger background job:', error);
  });

  return NextResponse.json({
    message: 'Webhook received and processing started',
    owner,
    repo,
    ref,
    commitSha: payload.after,
  });
}

// Allow GET for webhook verification (GitHub sends GET to verify endpoint)
export async function GET() {
  return NextResponse.json({
    message: 'GitHub webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}

