import { RegisteredTool } from '../toolRegistry.js';
import { createSupabaseClient, getTelepocketUserId, toJsonText } from '../telepocket.js';
import { canonicalizeUrl } from '../canonicalizeUrl.js';

interface ExposureStatsRow {
  canonical_url: string;
  exposure_count: number;
  last_exposed_at: string | null;
}

export const linksExposureStatsTool: RegisteredTool = {
  definition: {
    name: 'links.exposure.stats',
    description: 'Get exposure statistics for specific URLs within a time window. Returns exposure count and last exposure timestamp for each requested URL.',
    inputSchema: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          description: 'Array of URLs to get exposure stats for (will be canonicalized server-side).',
          items: {
            type: 'string',
            description: 'URL to query exposure stats for.'
          },
          minItems: 1
        },
        window_days: {
          type: 'integer',
          description: 'Time window in days to look back for exposures (positive integer, max 365).',
          minimum: 1,
          maximum: 365
        }
      },
      required: ['urls', 'window_days'],
      additionalProperties: false
    }
  },
  handler: async (args, context) => {
    const urls = args.urls as string[] | undefined;
    const windowDays = args.window_days as number | undefined;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      throw new Error('urls must be a non-empty array');
    }

    for (const url of urls) {
      if (!url || typeof url !== 'string') {
        throw new Error('Each url must be a non-empty string');
      }
    }

    if (typeof windowDays !== 'number' || !Number.isInteger(windowDays) || windowDays < 1 || windowDays > 365) {
      throw new Error('window_days must be a positive integer between 1 and 365');
    }

    const canonicalUrls: string[] = [];
    for (const url of urls) {
      try {
        canonicalUrls.push(canonicalizeUrl(url));
      } catch {
        throw new Error(`Invalid URL: ${url}`);
      }
    }

    const uniqueCanonicalUrls = [...new Set(canonicalUrls)];

    const client = createSupabaseClient(context.config);
    const userId = getTelepocketUserId(context.config);

    const { data, error } = await client.rpc('get_link_exposure_stats', {
      telegram_user_id_param: userId,
      keys: uniqueCanonicalUrls,
      window_days: windowDays
    });

    if (error) {
      throw new Error(`Failed to get link exposure stats: ${error.message}`);
    }

    const statsRows = data as ExposureStatsRow[];

    const statsMap = new Map<string, ExposureStatsRow>();
    for (const row of statsRows || []) {
      statsMap.set(row.canonical_url, row);
    }

    const result = canonicalUrls.map((canonicalUrl) => {
      const stats = statsMap.get(canonicalUrl);
      return {
        canonical_url: canonicalUrl,
        exposure_count: stats?.exposure_count ?? 0,
        last_exposed_at: stats?.last_exposed_at ?? null
      };
    });

    return toJsonText({
      window_days: windowDays,
      stats: result
    });
  }
};
