import type { QualityMetrics, StreamTestResult } from '@/lib/types';

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce(function reducer(sum, value) {
    return sum + value;
  }, 0);
  return total / values.length;
}

export function calculateQualityMetrics(results: StreamTestResult[]): QualityMetrics {
  const uptimeWeight = 0.4;
  const stabilityWeight = 0.25;
  const qualityWeight = 0.2;
  const geoWeight = 0.15;

  const successCount = results.filter(function filterSuccess(result) {
    return result.status === 'success';
  }).length;
  const uptimePercentage = results.length > 0 ? (successCount / results.length) * 100 : 0;

  const bitrateValues = results.map(function mapBitrate(result) {
    return result.bitrateKbps;
  });
  // Use actual average bitrate, scaled to 0-100 (10000 Kbps = 100%)
  const stabilityScore = bitrateValues.length > 0 
    ? Math.min(100, Math.round((average(bitrateValues) / 10000) * 100))
    : 0;

  const resolutions = new Set(
    results.map(function mapResolution(result) {
      return result.resolution;
    }),
  );
  // Use actual resolution - extract height and scale to 0-100 (1080p = 100%)
  let videoQualityScore = 0;
  if (resolutions.size > 0) {
    const resolutionArray = Array.from(resolutions);
    // Get the highest resolution
    let maxHeight = 0;
    for (const res of resolutionArray) {
      const heightMatch = res.match(/(\d+)x\d+/);
      if (heightMatch) {
        const height = parseInt(heightMatch[1], 10);
        if (height > maxHeight) maxHeight = height;
      }
    }
    // Scale: 1080 = 100%, 720 = 67%, 480 = 44%, etc.
    videoQualityScore = maxHeight > 0 ? Math.min(100, Math.round((maxHeight / 1080) * 100)) : 0;
  }

  const regions = new Set(
    results.map(function mapRegion(result) {
      return result.region;
    }),
  );
  // Use actual region count, scaled to 0-100 (3+ regions = 100%)
  const geoAvailabilityScore = regions.size > 0 
    ? Math.min(100, Math.round((regions.size / 3) * 100))
    : 0;

  const calculatedScore =
    uptimePercentage * uptimeWeight +
    stabilityScore * stabilityWeight +
    videoQualityScore * qualityWeight +
    geoAvailabilityScore * geoWeight;

  return {
    uptimePercentage,
    stabilityScore,
    videoQualityScore,
    geoAvailabilityScore,
    overallScore: Math.round(calculatedScore),
    calculatedAt: new Date().toISOString(),
  };
}

