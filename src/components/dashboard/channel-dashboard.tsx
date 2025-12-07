"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { Channel } from "@/lib/types";
import { ChannelTable, type ChannelWithMetrics } from "@/components/dashboard/channel-table";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { UpdatePanel } from "@/components/dashboard/update-panel";

interface ChannelsResponse {
  channels: ChannelWithMetrics[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const PAGE_SIZE = 50;

export function ChannelDashboard() {
  const [channels, setChannels] = useState<ChannelWithMetrics[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allCountries, setAllCountries] = useState<string[]>([]);

  // Initialize on first run - reset channels if mock data detected
  useEffect(
    function initialize() {
      async function checkAndReset() {
        try {
          const response = await fetch("/api/cron/init");
          if (response.ok) {
            const data = await response.json();
            if (data.reset) {
              console.log(`[Init] ${data.message}`);
              // Refresh stats after reset
              const statsResponse = await fetch("/api/channels?limit=1");
              if (statsResponse.ok) {
                const statsData = (await statsResponse.json()) as ChannelsResponse;
                setTotalCount(statsData.pagination.total);
                setActiveCount(0);
              }
            } else {
              console.log(`[Init] ${data.message}`);
            }
          }
        } catch (error) {
          console.error("Failed to initialize:", error);
        }
      }
      checkAndReset();
    },
    [], // Run only once on mount
  );

  // Fetch summary stats (total and active counts)
  useEffect(
    function fetchStats() {
      async function load() {
        try {
          // Use ISR with revalidation - cache for 1 hour, then revalidate
          const response = await fetch("/api/channels?limit=1", {
            next: { revalidate: 3600 },
          });
          if (response.ok) {
            const data = (await response.json()) as ChannelsResponse;
            const total = data.pagination.total;
            setTotalCount(total);
            // Fetch active count
            const activeResponse = await fetch("/api/channels?status=active&limit=1", {
              next: { revalidate: 3600 },
            });
            if (activeResponse.ok) {
              const activeData = (await activeResponse.json()) as ChannelsResponse;
              setActiveCount(activeData.pagination.total);
            }
            // Fetch untested count for progress
            const untestedResponse = await fetch("/api/channels?status=untested&limit=1");
            if (untestedResponse.ok) {
              const untestedData = (await untestedResponse.json()) as ChannelsResponse;
              const untested = untestedData.pagination.total;
            }
          }
        } catch (error) {
          console.error("Failed to fetch stats:", error);
        }
      }
      load();
      // Refresh stats every 60 seconds (less frequent since we use ISR)
      const statsInterval = setInterval(load, 60000);
      return function cleanup() {
        clearInterval(statsInterval);
      };
    },
    [],
  );

  // Fetch unique values for filters
  useEffect(
    function fetchFilterOptions() {
      async function load() {
        try {
          // Fetch a sample to get unique values
          const response = await fetch("/api/channels?limit=1000");
          if (response.ok) {
            const data = (await response.json()) as ChannelsResponse;
            const categories = new Set<string>();
            const countries = new Set<string>();
            data.channels.forEach(function collect(channel) {
              if (channel.category) categories.add(channel.category);
              if (channel.country && channel.country !== "unknown") {
                countries.add(channel.country);
              }
            });
            setAllCategories(Array.from(categories).sort());
            setAllCountries(Array.from(countries).sort());
          }
        } catch (error) {
          console.error("Failed to fetch filter options:", error);
        }
      }
      load();
    },
    [],
  );

  // Fetch paginated channels
  useEffect(
    function fetchChannels() {
      setLoading(true);
      async function load() {
        try {
          const offset = (currentPage - 1) * PAGE_SIZE;
          const params = new URLSearchParams({
            limit: String(PAGE_SIZE),
            offset: String(offset),
          });
          if (categoryFilter !== "all") {
            params.set("category", categoryFilter);
          }
          if (countryFilter !== "all") {
            params.set("country", countryFilter);
          }
          // Use ISR with revalidation - cache for 1 hour, then revalidate
          const response = await fetch(`/api/channels?${params.toString()}`, {
            next: { revalidate: 3600 }, // Revalidate every hour
          });
          if (response.ok) {
            const data = (await response.json()) as ChannelsResponse;
            setChannels(data.channels);
            setTotalCount(data.pagination.total);
          }
        } catch (error) {
          console.error("Failed to fetch channels:", error);
        } finally {
          setLoading(false);
        }
      }
      load();
      // Refresh channels every 60 seconds (less frequent since we use ISR)
      const refreshInterval = setInterval(load, 60000);
      return function cleanup() {
        clearInterval(refreshInterval);
      };
    },
    [currentPage, categoryFilter, countryFilter],
  );

  const averageQuality = useMemo(
    function calculate() {
      if (channels.length === 0) {
        return 0;
      }
      const total = channels.reduce(function reducer(sum, channel) {
        return sum + channel.qualityScore;
      }, 0);
      return Math.round(total / channels.length);
    },
    [channels],
  );

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function handleCategoryChange(event: ChangeEvent<HTMLSelectElement>): void {
    setCategoryFilter(event.target.value);
    setCurrentPage(1); // Reset to first page on filter change
  }

  function handleCountryChange(event: ChangeEvent<HTMLSelectElement>): void {
    setCountryFilter(event.target.value);
    setCurrentPage(1); // Reset to first page on filter change
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
          IPTV Fusion Hub
        </p>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Stream Quality Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Monitor aggregated IPTV sources, reliability, and quality metrics. Stream testing runs
          automatically when repositories are updated via webhooks.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Total Channels" value={totalCount} helperText="In database" />
        <SummaryCard
          label="Active Streams"
          value={activeCount}
          helperText={`${activeCount} tested and working`}
        />
        <SummaryCard
          label="Average Quality"
          value={`${averageQuality}%`}
          helperText="Current page average"
        />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Filters</h2>
          <div className="flex flex-col gap-4 md:flex-row">
            <label className="text-sm text-zinc-600">
              Category
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none"
                value={categoryFilter}
                onChange={handleCategoryChange}
              >
                <option value="all">All</option>
                {allCategories.map(function renderCategory(option) {
                  return (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="text-sm text-zinc-600">
              Country
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none"
                value={countryFilter}
                onChange={handleCountryChange}
              >
                <option value="all">All</option>
                {allCountries.map(function renderCountry(option) {
                  return (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        </div>
      </section>

      <UpdatePanel />

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Channels</h2>
          <p className="text-sm text-zinc-500">
            Showing {channels.length} of {totalCount} entries
          </p>
        </div>
        {loading ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-500">
            Loading channels...
          </div>
        ) : (
          <>
            <ChannelTable channels={channels} />
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={function goPrev() {
                    setCurrentPage((prev) => Math.max(1, prev - 1));
                  }}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50"
                >
                  Previous
                </button>
                <span className="text-sm text-zinc-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={function goNext() {
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                  }}
                  disabled={currentPage >= totalPages}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
