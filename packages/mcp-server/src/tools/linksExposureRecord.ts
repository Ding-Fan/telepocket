import { RegisteredTool } from '../toolRegistry.js';
import { createSupabaseClient, getTelepocketUserId, toJsonText } from '../telepocket.js';
import { canonicalizeUrl } from '../canonicalizeUrl.js';

interface ExposureItem {
  url: string;
  surface?: string;
  source?: string;
  note_id?: string;
  exposed_at?: string;
}

export const linksExposureRecordTool: RegisteredTool = {
  definition: {
    name: 'links.exposure.record',
    description: 'Record link exposure events for the Telepocket user. Tracks which links have been presented to the user for deduplication and analytics.',
    inputSchema: {
      type: 'object',
      properties: {
        feed_request_id: {
          type: 'string',
          description: 'Unique identifier for this feed/request batch. Used as part of the idempotency key.'
        },
        items: {
          type: 'array',
          description: 'Array of link exposure items to record.',
          items: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The exposed URL (will be canonicalized server-side).'
              },
              surface: {
                type: 'string',
                description: 'Surface/context where the link was exposed (default: reading_feed).'
              },
              source: {
                type: 'string',
                description: 'Source system that generated this exposure (default: openclaw).'
              },
              note_id: {
                type: 'string',
                description: 'Optional note ID this exposure is associated with.'
              },
              exposed_at: {
                type: 'string',
                description: 'ISO timestamp when the link was exposed (default: now).'
              }
            },
            required: ['url'],
            additionalProperties: false
          }
        }
      },
      required: ['feed_request_id', 'items'],
      additionalProperties: false
    }
  },
  handler: async (args, context) => {
    const feedRequestId = args.feed_request_id as string;
    const items = args.items as ExposureItem[] | undefined;

    if (!feedRequestId || typeof feedRequestId !== 'string') {
      throw new Error('feed_request_id must be a non-empty string');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('items must be a non-empty array');
    }

    const client = createSupabaseClient(context.config);
    const userId = getTelepocketUserId(context.config);
    const now = new Date().toISOString();

    const processedEvents = items.map((item) => {
      if (!item.url || typeof item.url !== 'string') {
        throw new Error('Each item must have a valid url');
      }

      let canonicalUrl: string;
      try {
        canonicalUrl = canonicalizeUrl(item.url);
      } catch {
        throw new Error(`Invalid URL: ${item.url}`);
      }

      const idempotencyKey = `${feedRequestId}:${canonicalUrl}`;
      const surface = item.surface || 'reading_feed';
      const source = item.source || 'openclaw';

      return {
        url: item.url,
        canonical_url: canonicalUrl,
        surface,
        source,
        note_id: item.note_id || null,
        idempotency_key: idempotencyKey,
        exposed_at: item.exposed_at || now
      };
    });

    const { data, error } = await client.rpc('record_link_exposures', {
      telegram_user_id_param: userId,
      events: processedEvents
    });

    if (error) {
      throw new Error(`Failed to record link exposures: ${error.message}`);
    }

    const result = data as Array<{ inserted_count: number; deduplicated_count: number }>;
    const counts = result?.[0] || { inserted_count: 0, deduplicated_count: 0 };

    return toJsonText({
      success: true,
      feed_request_id: feedRequestId,
      items_submitted: items.length,
      inserted_count: counts.inserted_count,
      deduplicated_count: counts.deduplicated_count,
      total_processed: counts.inserted_count + counts.deduplicated_count
    });
  }
};
