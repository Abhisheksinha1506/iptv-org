"use client";

export interface QualityInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QualityInfoModal({ isOpen, onClose }: QualityInfoModalProps) {
  if (!isOpen) {
    return null;
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
              <h2 className="text-2xl font-bold text-zinc-900">Quality Score Explanation</h2>
              <p className="mt-1 text-sm text-zinc-600">
                How quality scores are calculated for IPTV streams
              </p>
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
          <div className="space-y-6">
            {/* Overview */}
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <h3 className="text-lg font-semibold text-indigo-900">Overview</h3>
              <p className="mt-2 text-sm text-indigo-800">
                Quality scores range from 0% to 100%, representing the overall reliability and
                performance of an IPTV stream. Higher scores indicate more reliable, higher-quality
                streams.
              </p>
            </div>

            {/* Initial Quality Score */}
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">Initial Quality Score</h3>
              <p className="mt-2 text-sm text-zinc-600">
                The quality score shown in the table is calculated when a stream is first tested:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-indigo-600">•</span>
                  <span>
                    <strong>Based on Bitrate:</strong> 0% = 0 Kbps, 100% = 10,000+ Kbps (10 Mbps)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-indigo-600">•</span>
                  <span>
                    <strong>Failed Streams:</strong> Automatically receive 0% quality score
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-indigo-600">•</span>
                  <span>
                    <strong>Unknown Bitrate:</strong> Streams without detectable bitrate receive 0%
                  </span>
                </li>
              </ul>
            </div>

            {/* Overall Quality Score */}
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">Overall Quality Score</h3>
              <p className="mt-2 text-sm text-zinc-600">
                After multiple tests, a comprehensive quality score is calculated using four
                weighted components:
              </p>
            </div>

            {/* Components */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-zinc-900">Uptime</h4>
                  <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
                    40%
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  Percentage of successful stream tests. 100% means all tests passed, 0% means all
                  tests failed.
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-zinc-900">Stability</h4>
                  <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
                    25%
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  Based on average bitrate consistency. Higher bitrate streams (up to 10 Mbps) score
                  higher, indicating more stable connections.
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-zinc-900">Video Quality</h4>
                  <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
                    20%
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  Based on resolution. 1080p = 100%, 720p = 67%, 480p = 44%, with lower resolutions
                  scoring proportionally less.
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-zinc-900">Geo Availability</h4>
                  <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
                    15%
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  Based on multi-region availability. Streams available in 3+ regions score 100%,
                  with fewer regions scoring proportionally less.
                </p>
              </div>
            </div>

            {/* Calculation Formula */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <h4 className="font-semibold text-zinc-900">Calculation Formula</h4>
              <p className="mt-2 text-sm text-zinc-600">
                Overall Quality Score = (Uptime × 40%) + (Stability × 25%) + (Video Quality × 20%)
                + (Geo Availability × 15%)
              </p>
            </div>

            {/* Examples */}
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">Score Examples</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <div className="font-semibold text-green-900">90-100%: Excellent</div>
                  <div className="mt-1 text-green-700">
                    High uptime, stable bitrate, HD resolution, multi-region availability
                  </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="font-semibold text-blue-900">70-89%: Good</div>
                  <div className="mt-1 text-blue-700">
                    Reliable uptime, decent bitrate, good resolution, limited regions
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="font-semibold text-amber-900">50-69%: Fair</div>
                  <div className="mt-1 text-amber-700">
                    Moderate uptime, lower bitrate, standard resolution, single region
                  </div>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="font-semibold text-red-900">0-49%: Poor</div>
                  <div className="mt-1 text-red-700">
                    Low uptime, unstable bitrate, low resolution, or stream failures
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-200 p-6">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

