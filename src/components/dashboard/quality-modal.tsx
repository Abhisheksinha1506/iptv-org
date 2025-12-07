"use client";

import { useEffect, useState } from "react";
import type { Channel, QualityMetrics, StreamTestResult } from "@/lib/types";

export interface QualityModalProps {
  channel: Channel | null;
  onClose: () => void;
}

export function QualityModal({ channel, onClose }: QualityModalProps) {
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [testResults, setTestResults] = useState<StreamTestResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(
    function fetchQualityData() {
      if (!channel) {
        return;
      }
      const channelId = channel.id; // Capture channel.id when we know it's not null
      setLoading(true);
      async function load() {
        try {
          const response = await fetch(`/api/channels/${channelId}/quality`);
          if (response.ok) {
            const data = await response.json();
            setQualityMetrics(data.qualityMetrics);
            setTestResults(data.testResults || []);
          }
        } catch (error) {
          console.error("Failed to fetch quality data:", error);
        } finally {
          setLoading(false);
        }
      }
      load();
    },
    [channel],
  );

  if (!channel) {
    return null;
  }

  // At this point, TypeScript knows channel is not null
  const channelUrl = channel.url;
  
  function handleOpenStream() {
    if (channelUrl) {
      window.open(channelUrl, "_blank", "noopener,noreferrer");
    }
  }

  function formatDate(dateString?: string): string {
    if (!dateString) {
      return "Never";
    }
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  }

  function formatBitrate(kbps: number): string {
    if (kbps >= 1000) {
      return `${(kbps / 1000).toFixed(1)} Mbps`;
    }
    return `${kbps} Kbps`;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
        onClick={function stopPropagation(event) {
          event.stopPropagation();
        }}
      >
        <div className="border-b border-zinc-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-zinc-900">{channel.name}</h2>
              {channel.tvgName && (
                <p className="mt-1 text-sm text-zinc-600">{channel.tvgName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-4 rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {loading ? (
            <div className="py-8 text-center text-zinc-500">Loading quality data...</div>
          ) : (
            <div className="space-y-6">
              {/* Overall Quality Score */}
              <div className="rounded-lg border border-zinc-200 bg-gradient-to-br from-indigo-50 to-indigo-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-900">Overall Quality Score</p>
                    <p className="mt-1 text-xs text-indigo-700">Composite quality rating</p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-bold text-indigo-900">{channel.qualityScore}%</p>
                    <p className="text-xs text-indigo-600">
                      {channel.status === "active"
                        ? "Active"
                        : channel.status === "inactive"
                          ? "Inactive"
                          : "Untested"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detailed Quality Metrics */}
              {qualityMetrics ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <p className="text-xs font-medium text-zinc-500">Uptime</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-900">
                      {qualityMetrics.uptimePercentage.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <p className="text-xs font-medium text-zinc-500">Stability</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-900">
                      {qualityMetrics.stabilityScore.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <p className="text-xs font-medium text-zinc-500">Video Quality</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-900">
                      {qualityMetrics.videoQualityScore.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <p className="text-xs font-medium text-zinc-500">Geo Availability</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-900">
                      {qualityMetrics.geoAvailabilityScore.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
                  No detailed quality metrics available yet. Metrics are calculated after multiple
                  tests.
                </div>
              )}

              {/* Recent Test Results */}
              {testResults.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-zinc-900">Recent Test Results</h3>
                  <div className="space-y-2">
                    {testResults.map(function renderTest(result, index) {
                      return (
                        <div
                          key={`${result.testedAt}-${index}`}
                          className="rounded-lg border border-zinc-200 bg-white p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                                    result.status === "success"
                                      ? "bg-green-50 text-green-700"
                                      : "bg-red-50 text-red-700"
                                  }`}
                                >
                                  {result.status}
                                </span>
                                <span className="text-xs text-zinc-500">
                                  {formatDate(result.testedAt)}
                                </span>
                              </div>
                              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="text-zinc-500">Bitrate: </span>
                                  <span className="font-medium text-zinc-900">
                                    {formatBitrate(result.bitrateKbps)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-500">Resolution: </span>
                                  <span className="font-medium text-zinc-900">
                                    {result.resolution}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-500">Response: </span>
                                  <span className="font-medium text-zinc-900">
                                    {result.responseTimeMs}ms
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Channel Info */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-zinc-900">Channel Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-zinc-500">Country: </span>
                    <span className="font-medium text-zinc-900">{channel.country}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Category: </span>
                    <span className="font-medium text-zinc-900 capitalize">{channel.category}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Source: </span>
                    <span className="font-medium text-zinc-900">{channel.source}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Last Tested: </span>
                    <span className="font-medium text-zinc-900">{formatDate(channel.lastTested)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 p-6">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleOpenStream}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Open Stream
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

