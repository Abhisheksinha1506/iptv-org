"use client";

import { formatDistanceToNow } from "date-fns";
import { useRealTimeUpdates } from "@/hooks/useRealTimeUpdates";

export function UpdatePanel() {
  const { updates, isConnected, clearUpdates } = useRealTimeUpdates();

  function renderStatusBadge() {
    const color =
      isConnected === true ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
    const label = isConnected === true ? "live" : "offline";
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${color}`}>
        {label}
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
            Repository Updates
          </p>
          <h2 className="text-lg font-semibold text-zinc-900">Live Source Activity</h2>
        </div>
        <div className="flex items-center gap-2">
          {renderStatusBadge()}
          <button
            type="button"
            onClick={clearUpdates}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-400"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {updates.length === 0 ? (
          <p className="text-sm text-zinc-500">No new updates yet.</p>
        ) : (
          updates.map(function renderUpdate(update, index) {
            const timestamp = formatDistanceToNow(new Date(update.timestamp), {
              addSuffix: true,
            });
            return (
              <div key={`${update.repository}-${index}`} className="rounded-lg bg-zinc-50 p-3">
                <div className="flex items-center justify-between text-sm text-zinc-600">
                  <span className="font-semibold text-zinc-900">{update.repository}</span>
                  <span>{timestamp}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-700">{update.message}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">
                    +{update.channelsAdded} added
                  </span>
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-800">
                    {update.channelsUpdated} updated
                  </span>
                  <span className="rounded-full bg-red-100 px-2 py-1 text-red-800">
                    -{update.channelsRemoved} removed
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

