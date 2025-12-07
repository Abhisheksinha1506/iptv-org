import { NextRequest } from 'next/server';
import {
  getUnprocessedRepositoryUpdates,
  markRepositoryUpdatesAsProcessed,
} from '@/lib/supabase-adapter';
import { supabase } from '@/lib/supabase';
import type { RepositoryUpdate } from '@/lib/types';

async function readUpdates(): Promise<RepositoryUpdate[]> {
  return getUnprocessedRepositoryUpdates();
}

async function clearUpdates(): Promise<void> {
  // Fetch unprocessed update IDs and mark them as processed
  const { data } = await supabase
    .from('repository_updates')
    .select('id')
    .eq('processed', false);
  if (data && data.length > 0) {
    await markRepositoryUpdatesAsProcessed(
      data.map(function mapRow(row) {
        return row.id;
      }),
    );
  }
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      function sendEvent(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      sendEvent({ type: 'connected', timestamp: new Date().toISOString() });

      const intervalId = setInterval(async function pollQueue() {
        const updates = await readUpdates();
        if (updates.length > 0) {
          sendEvent({ type: 'updates', payload: updates });
          await clearUpdates();
        }
      }, 5000);

      const abortHandler = function handleAbort() {
        clearInterval(intervalId);
        controller.close();
      };

      request.signal.addEventListener('abort', abortHandler);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

