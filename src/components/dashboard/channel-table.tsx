"use client";

import { useMemo, useState } from "react";
import type { Channel } from "@/lib/types";
import { QualityModal } from "@/components/dashboard/quality-modal";
import { QualityInfoModal } from "@/components/dashboard/quality-info-modal";

export interface ChannelWithMetrics extends Channel {
  latestBitrate?: number;
  latestResolution?: string;
  latestResponseTime?: number;
  uptimePercentage?: number;
}

export interface ChannelTableProps {
  channels: ChannelWithMetrics[];
}

function formatBitrate(kbps: number | undefined): string {
  if (!kbps || kbps === 0) {
    return "—";
  }
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${kbps} Kbps`;
}

function formatResolution(resolution: string | undefined): string {
  if (!resolution || resolution === "unknown") {
    return "—";
  }
  // Convert "1920x1080" to "1080p" format if possible
  const match = resolution.match(/(\d+)x(\d+)/);
  if (match) {
    const height = parseInt(match[2], 10);
    if (height === 1080) return "1080p";
    if (height === 720) return "720p";
    if (height === 480) return "480p";
    if (height === 360) return "360p";
    if (height === 240) return "240p";
  }
  return resolution;
}

function formatResponseTime(ms: number | undefined): string {
  if (!ms) {
    return "—";
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatUptime(percentage: number | undefined): string {
  if (percentage === undefined || percentage === null) {
    return "—";
  }
  return `${percentage.toFixed(0)}%`;
}

export function ChannelTable({ channels }: ChannelTableProps) {
  const [selectedChannel, setSelectedChannel] = useState<ChannelWithMetrics | null>(null);
  const [showQualityInfo, setShowQualityInfo] = useState<boolean>(false);

  const sortedChannels = useMemo(function buildSortedList() {
    return [...channels].sort(function compare(a, b) {
      return b.qualityScore - a.qualityScore;
    });
  }, [channels]);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-100 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Bitrate</th>
              <th className="px-4 py-3 text-right">Resolution</th>
              <th className="px-4 py-3 text-right">Response</th>
              <th className="px-4 py-3 text-right">Uptime</th>
              <th className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <span>Quality</span>
                  <button
                    type="button"
                    onClick={function handleInfoClick(event) {
                      event.stopPropagation();
                      setShowQualityInfo(true);
                    }}
                    className="rounded-full p-1 text-zinc-400 hover:bg-zinc-200 hover:text-indigo-600"
                    aria-label="Quality score information"
                    title="Learn about quality scores"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                </div>
              </th>
              <th className="px-4 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {sortedChannels.map(function renderRow(channel) {
              function handleClick() {
                setSelectedChannel(channel);
              }

              return (
              <tr
                key={channel.id}
                onClick={handleClick}
                className="cursor-pointer transition-colors hover:bg-indigo-50 active:bg-indigo-100"
                role="button"
                tabIndex={0}
                onKeyDown={function handleKeyDown(event) {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleClick();
                  }
                }}
                aria-label={`View quality details for ${channel.name}`}
              >
                <td className="px-4 py-2 font-medium text-zinc-900">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="text-indigo-600 hover:text-indigo-800">
                        {channel.name}
                      </span>
                      <svg
                        className="h-3 w-3 text-indigo-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {channel.tvgName || channel.tvgId || `${channel.category} • ${channel.country}`}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2 text-zinc-700">{channel.country}</td>
                <td className="px-4 py-2 text-zinc-700 capitalize">{channel.category}</td>
                <td className="px-4 py-2 text-right text-zinc-700">
                  {formatBitrate(channel.latestBitrate)}
                </td>
                <td className="px-4 py-2 text-right text-zinc-700">
                  {formatResolution(channel.latestResolution)}
                </td>
                <td className="px-4 py-2 text-right text-zinc-700">
                  {formatResponseTime(channel.latestResponseTime)}
                </td>
                <td className="px-4 py-2 text-right text-zinc-700">
                  {formatUptime(channel.uptimePercentage)}
                </td>
                <td className="px-4 py-2 text-right font-semibold text-zinc-900">
                  {channel.qualityScore}%
                </td>
                <td className="px-4 py-2 text-right">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                      channel.status === "active"
                        ? "bg-green-50 text-green-700"
                        : channel.status === "inactive"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {channel.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <QualityModal
      channel={selectedChannel}
      onClose={function closeModal() {
        setSelectedChannel(null);
      }}
    />
    <QualityInfoModal
      isOpen={showQualityInfo}
      onClose={function closeInfoModal() {
        setShowQualityInfo(false);
      }}
    />
    </>
  );
}

