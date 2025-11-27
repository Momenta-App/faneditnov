import { detectPlatform, Platform } from './url-utils';

type Metric = number;

export type NormalizedMetrics = {
  total_views: Metric;
  like_count: Metric;
  comment_count: Metric;
  share_count: Metric;
  save_count: Metric;
};

export type NormalizedRecordMetadata = {
  platform: Platform;
  normalized_metrics: NormalizedMetrics;
};

/**
 * Convert BrightData stats into our canonical metric names.
 * Always prefer the most accurate key available (e.g., Instagram's video_play_count).
 */
export function normalizeBrightDataRecord(
  record: Record<string, any>,
  options?: { platformHint?: Platform }
): NormalizedRecordMetadata {
  const platform = resolvePlatform(record, options?.platformHint);
  const normalized_metrics = extractMetrics(record, platform);

  return {
    platform,
    normalized_metrics,
  };
}

export function attachNormalizedMetrics(
  record: Record<string, any>,
  options?: { platformHint?: Platform }
): Record<string, any> {
  const normalization = normalizeBrightDataRecord(record, options);
  return {
    ...record,
    normalized_platform: normalization.platform,
    normalized_metrics: normalization.normalized_metrics,
  };
}

function resolvePlatform(record: Record<string, any>, hint?: Platform): Platform {
  if (hint && hint !== 'unknown') {
    return hint;
  }

  const directPlatform = (record.platform || record.source || record.site || record.dataset)?.toString().toLowerCase();
  if (directPlatform?.includes('tiktok')) return 'tiktok';
  if (directPlatform?.includes('instagram')) return 'instagram';
  if (directPlatform?.includes('youtube')) return 'youtube';

  const urlCandidate =
    record.url ||
    record.video_url ||
    record.post_url ||
    record.share_url ||
    record.link ||
    record?.input?.url ||
    record?.source_url;

  if (typeof urlCandidate === 'string') {
    return detectPlatform(urlCandidate);
  }

  return 'unknown';
}

function extractMetrics(record: Record<string, any>, platform: Platform): NormalizedMetrics {
  const metricsLookup = buildMetricsLookup(record);

  const total_views = getMetricValue(
    record,
    metricsLookup,
    platform === 'instagram'
      ? ['video_play_count', 'play_count', 'views', 'view_count', 'total_views']
      : platform === 'youtube'
      ? ['views', 'view_count', 'play_count', 'total_views']
      : ['play_count', 'views', 'view_count', 'video_play_count', 'total_views']
  );

  const like_count = getMetricValue(
    record,
    metricsLookup,
    platform === 'tiktok'
      ? ['digg_count', 'likes', 'like_count', 'likes_count', 'favorite_count']
      : ['likes', 'like_count', 'likes_count', 'digg_count', 'favorite_count']
  );

  const comment_count = getMetricValue(record, metricsLookup, [
    'num_comments',
    'comment_count',
    'comments_count',
    'comments',
  ]);

  const share_count = getMetricValue(record, metricsLookup, [
    'share_count',
    'shares_count',
    'shares',
    'reshare_count',
  ]);

  const save_count = getMetricValue(record, metricsLookup, [
    'save_count',
    'saves_count',
    'saves',
    'collect_count',
    'favorite_count',
    'favorites',
  ]);

  return {
    total_views,
    like_count,
    comment_count,
    share_count,
    save_count,
  };
}

function coalesceNumber(...values: Array<number | string | null | undefined>): number {
  for (const value of values) {
    const parsed = parseNumeric(value);
    if (parsed !== null) {
      return parsed;
    }
  }
  return 0;
}

function parseNumeric(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();

    // Find the first numeric substring with optional magnitude suffix (k, m, b)
    const match = trimmed.match(/([0-9][0-9.,]*)([kmb])?/);
    if (match) {
      const numericPortion = match[1].replace(/,/g, '');
      const base = Number(numericPortion);
      if (!Number.isNaN(base)) {
        const suffix = match[2];
        if (!suffix) {
          return base;
        }
        const multiplier =
          suffix === 'k' ? 1_000 :
          suffix === 'm' ? 1_000_000 :
          suffix === 'b' ? 1_000_000_000 : 1;
        return Math.round(base * multiplier);
      }
    }

    const numeric = Number(trimmed.replace(/,/g, ''));
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }
  return null;
}

function getMetricValue(
  record: Record<string, any>,
  lookup: Record<string, any> | null,
  keys: string[]
): number {
  const sources = [
    record,
    record.stats,
    record.statistics,
    record.metrics,
    record.metrics?.stats,
    record.metrics_stats,
    record.author_stats,
    record.author?.stats,
    record.profile?.stats,
    record.details,
    record.engagement,
    record.engagements,
    record.performance,
  ].filter(Boolean);

  for (const key of keys) {
    for (const source of sources) {
      const value = getValueFromObject(source, key);
      const parsed = parseNumeric(value);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  const metricsArraySources = [
    record.metrics,
    record.metrics_data,
    record.metrics_list,
    record.statistics?.metrics,
    record.details?.metrics,
  ];

  for (const collection of metricsArraySources) {
    const value = getValueFromMetricsCollection(collection, keys);
    if (value !== null) {
      return value;
    }
  }

  if (lookup) {
    for (const key of keys) {
      const normalized = normalizeKey(key);
      const direct = lookup[normalized];
      if (direct !== undefined) {
        const parsed = parseNumeric(direct);
        if (parsed !== null) {
          return parsed;
        }
      }
      const simplified = normalized.replace(/^num_/, '').replace(/_count$/, '');
      const simplifiedValue = lookup[simplified];
      if (simplifiedValue !== undefined) {
        const parsed = parseNumeric(simplifiedValue);
        if (parsed !== null) {
          return parsed;
        }
      }
    }
  }

  return 0;
}

function getValueFromObject(source: any, key: string): any {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
  if (key in source) return source[key];

  const lowerKey = key.toLowerCase();
  for (const [k, v] of Object.entries(source)) {
    if (k.toLowerCase() === lowerKey) {
      return v;
    }
  }
  return undefined;
}

function getValueFromMetricsCollection(collection: any, keys: string[]): number | null {
  if (!collection) return null;
  if (Array.isArray(collection)) {
    for (const entry of collection) {
      if (!entry || typeof entry !== 'object') continue;
      const value = getValueFromObject(entry, keys[0]);
      if (value !== undefined) {
        const parsed = coalesceNumber(value);
        if (parsed !== null) return parsed;
      }

      const label =
        entry.label ||
        entry.name ||
        entry.metric ||
        entry.key ||
        entry.title ||
        entry.type ||
        entry.caption;
      const metricValue =
        entry.value ??
        entry.count ??
        entry.total ??
        entry.number ??
        entry.text ??
        entry.display ??
        entry.data;

      if (label) {
        const normalizedLabel = normalizeKey(label);
        for (const key of keys) {
          const normalizedKey = normalizeKey(key);
          if (
            normalizedLabel === normalizedKey ||
            normalizedLabel === normalizedKey.replace(/^num_/, '').replace(/_count$/, '') ||
            normalizedLabel.includes(normalizedKey.replace(/_/g, ''))
          ) {
            const parsed = parseNumeric(metricValue);
            if (parsed !== null) return parsed;
          }
        }
      }
    }
  } else if (typeof collection === 'object') {
    for (const key of keys) {
      const value = getValueFromObject(collection, key);
      const parsed = coalesceNumber(value);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function buildMetricsLookup(record: Record<string, any>): Record<string, any> | null {
  const lookup: Record<string, any> = {};
  const addEntry = (key: string | undefined, value: any) => {
    if (!key) return;
    const normalized = normalizeKey(key);
    if (normalized && lookup[normalized] === undefined) {
      lookup[normalized] = value;
    }
  };

  const processObject = (obj: any) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    for (const [key, value] of Object.entries(obj)) {
      addEntry(key, value);
    }
  };

  processObject(record.metrics);
  processObject(record.metrics?.stats);
  processObject(record.statistics?.metrics);
  processObject(record.details?.metrics);

  const collections = [
    record.metrics,
    record.metrics_data,
    record.metrics_list,
    record.statistics?.metrics,
    record.details?.metrics,
  ];

  for (const collection of collections) {
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) {
      if (!entry || typeof entry !== 'object') continue;
      const label =
        entry.label ||
        entry.name ||
        entry.metric ||
        entry.key ||
        entry.title ||
        entry.type ||
        entry.caption;
      const metricValue =
        entry.value ??
        entry.count ??
        entry.total ??
        entry.number ??
        entry.text ??
        entry.display ??
        entry.data;
      addEntry(label, metricValue);
      processObject(entry);
    }
  }

  return Object.keys(lookup).length ? lookup : null;
}

function normalizeKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

