"use client";

import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useRealTimeUpdates } from "@/hooks/useRealTimeUpdates";

export function UpdatePanel() {
  const { updates, isConnected, clearUpdates } = useRealTimeUpdates();
  const [isPopulating, setIsPopulating] = useState(false);
  const [populateResult, setPopulateResult] = useState<{
    success: boolean;
    message: string;
    totalChannels?: number;
    totalTested?: number;
    totalActive?: number;
  } | null>(null);

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

  async function handlePopulateDatabase() {
    setIsPopulating(true);
    setPopulateResult(null);
    
    try {
      const response = await fetch("/api/populate", {
        method: "POST",
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setPopulateResult({
          success: true,
          message: data.message || "Database populated successfully",
          totalChannels: data.totalChannelsProcessed,
          totalTested: data.totalChannelsTested,
          totalActive: data.totalActiveChannels,
        });
        
        // Refresh the page after a short delay to show updated data
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setPopulateResult({
          success: false,
          message: data.message || data.error || "Failed to populate database",
        });
      }
    } catch (error) {
      console.error("Error populating database:", error);
      setPopulateResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to populate database",
      });
    } finally {
      setIsPopulating(false);
    }
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
            onClick={handlePopulateDatabase}
            disabled={isPopulating}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPopulating ? "Populating..." : "Populate Database"}
          </button>
          <button
            type="button"
            onClick={clearUpdates}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-400"
          >
            Clear
          </button>
        </div>
      </div>
      {populateResult && (
        <div
          className={`mt-4 rounded-lg border p-4 ${
            populateResult.success
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                className={`text-sm font-semibold ${
                  populateResult.success ? "text-green-800" : "text-red-800"
                }`}
              >
                {populateResult.success ? "✓ Success" : "✗ Error"}
              </p>
              <p
                className={`mt-1 text-sm ${
                  populateResult.success ? "text-green-700" : "text-red-700"
                }`}
              >
                {populateResult.message}
              </p>
              {populateResult.success && populateResult.totalChannels !== undefined && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">
                    {populateResult.totalChannels} channels processed
                  </span>
                  {populateResult.totalTested !== undefined && (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-800">
                      {populateResult.totalTested} tested
                    </span>
                  )}
                  {populateResult.totalActive !== undefined && (
                    <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-800">
                      {populateResult.totalActive} active
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPopulateResult(null)}
              className="text-zinc-400 hover:text-zinc-600"
            >
              ×
            </button>
          </div>
        </div>
      )}
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

