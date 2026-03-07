import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Config } from './config.js';
import { metadataFetcher } from '../../shared/dist/metadataFetcher.js';

export interface SaveNoteInput {
  content: string;
  urls?: string[];
  images?: SaveImageInput[];
  source?: string;
  sourceItemId?: string;
  idempotencyKey: string;
  createdAt?: string;
}

export interface SaveImageInput {
  imageSourceId?: string;
  url?: string;
  cloudflareUrl?: string;
  telegramFileId?: string;
  telegramFileUniqueId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
}

export interface SearchNotesInput {
  query?: string;
  limit?: number;
  since?: string;
  until?: string;
  hasLinks?: boolean;
  source?: string;
}

export interface NoteSummaryInput {
  noteIds?: string[];
  query?: string;
  limit?: number;
  style?: 'bullets' | 'paragraph' | 'brief';
  length?: 'short' | 'medium' | 'long';
  includeCitations?: boolean;
}

export interface LinkRecord {
  id?: string;
  url: string;
  title?: string | null;
  description?: string | null;
  og_image?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ImageRecord {
  id?: string;
  telegram_file_id?: string;
  telegram_file_unique_id?: string;
  cloudflare_url?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  width?: number;
  height?: number;
  created_at?: string;
  updated_at?: string;
}

export interface NoteRecord {
  note_id: string;
  telegram_user_id: number;
  telegram_message_id: number;
  content: string;
  created_at: string;
  status?: string | null;
  is_marked?: boolean | null;
  source?: string | null;
  source_item_id?: string | null;
  idempotency_key?: string | null;
  links: LinkRecord[];
  images: ImageRecord[];
}

interface SaveRpcResult {
  note_id: string | null;
  links_saved: number;
  images_saved: number;
  success: boolean;
  deduplicated: boolean;
}

interface SearchRpcRow {
  note_id: string;
  note_content: string;
  telegram_message_id: number;
  created_at: string;
  links: LinkRecord[] | null;
  relevance_score?: number;
  total_count?: number;
}

export function createSupabaseClient(config: Config): SupabaseClient {
  return createClient(config.supabase.url, config.supabase.serviceRoleKey);
}

export function getTelepocketUserId(config: Config): number {
  return config.telepocket.userId;
}

export function toJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function parseOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean`);
  }

  return value;
}

export function parseOptionalInteger(
  value: unknown,
  fieldName: string,
  defaultValue: number,
  min: number,
  max: number
): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer`);
  }

  if (value < min || value > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}`);
  }

  return value;
}

export function parseOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of strings`);
  }

  const items = value.map((item) => {
    if (typeof item !== 'string') {
      throw new Error(`${fieldName} must contain only strings`);
    }
    return item.trim();
  }).filter(Boolean);

  return items.length > 0 ? items : undefined;
}

export function parseOptionalObjectArray(value: unknown, fieldName: string): Record<string, unknown>[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of objects`);
  }

  const items = value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${fieldName} must contain only objects`);
    }
    return item as Record<string, unknown>;
  });

  return items.length > 0 ? items : undefined;
}

export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)]+/g) || [];
  const deduped = new Set<string>();

  for (const match of matches) {
    try {
      const parsed = new URL(match);
      deduped.add(parsed.toString());
    } catch {
    }
  }

  return Array.from(deduped);
}

export function buildSyntheticMessageId(seed: string): number {
  const hash = crypto.createHash('sha256').update(seed).digest();
  const value = hash.readUInt32BE(0);
  return Math.max(1, value);
}

export function buildSyntheticExternalId(seed: string, prefix: string): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return `${prefix}_${hash.slice(0, 32)}`;
}

export async function fetchLinksWithMetadata(urls: string[]): Promise<Array<Required<Pick<LinkRecord, 'url'>> & LinkRecord>> {
  if (urls.length === 0) {
    return [];
  }

  const results = await metadataFetcher.fetchMetadataForUrls(urls);
  return results.map(({ url, metadata }) => ({
    url,
    title: metadata.title,
    description: metadata.description,
    og_image: metadata.og_image
  }));
}

export async function fetchNoteById(
  client: SupabaseClient,
  userId: number,
  noteId: string
): Promise<NoteRecord | null> {
  const { data, error } = await client
    .from('z_notes')
    .select(`
      id,
      telegram_user_id,
      telegram_message_id,
      content,
      created_at,
      status,
      is_marked,
      source,
      source_item_id,
      idempotency_key,
      z_note_links(id, url, title, description, og_image, created_at, updated_at),
      z_note_images(id, telegram_file_id, telegram_file_unique_id, cloudflare_url, file_name, file_size, mime_type, width, height, created_at, updated_at)
    `)
    .eq('id', noteId)
    .eq('telegram_user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    note_id: data.id,
    telegram_user_id: data.telegram_user_id,
    telegram_message_id: data.telegram_message_id,
    content: data.content,
    created_at: data.created_at,
    status: data.status,
    is_marked: data.is_marked,
    source: data.source,
    source_item_id: data.source_item_id,
    idempotency_key: data.idempotency_key,
    links: (data.z_note_links || []) as LinkRecord[],
    images: (data.z_note_images || []) as ImageRecord[]
  };
}

export async function saveNoteFromSource(config: Config, input: SaveNoteInput): Promise<{
  noteId: string;
  created: boolean;
  deduplicated: boolean;
  links: Array<Required<Pick<LinkRecord, 'url'>> & LinkRecord>;
  images: ImageRecord[];
}> {
  const client = createSupabaseClient(config);
  const urls = Array.from(new Set([...(input.urls || []), ...extractUrls(input.content)]));
  const links = await fetchLinksWithMetadata(urls);
  const seed = input.idempotencyKey || input.sourceItemId || input.content;
  const syntheticMessageId = buildSyntheticMessageId(seed);
  const images = normalizeImages(input.images || [], input.idempotencyKey, input.source || 'openclaw');

  const { data, error } = await client.rpc('save_note_payload_from_source', {
    telegram_user_id_param: getTelepocketUserId(config),
    telegram_message_id_param: syntheticMessageId,
    content_param: input.content,
    links_param: links,
    images_param: images,
    source_param: input.source || 'openclaw',
    source_item_id_param: input.sourceItemId || null,
    idempotency_key_param: input.idempotencyKey,
    created_at_param: input.createdAt || new Date().toISOString()
  });

  if (error) {
    throw new Error(`Failed to save note: ${error.message}`);
  }

  const row = ((data as SaveRpcResult[] | null) || [])[0];
  if (!row?.success || !row.note_id) {
    throw new Error('Failed to save note');
  }

  return {
    noteId: row.note_id,
    created: !row.deduplicated,
    deduplicated: row.deduplicated,
    links,
    images
  };
}

export function parseImageInputs(value: unknown, fieldName: string): SaveImageInput[] | undefined {
  const objects = parseOptionalObjectArray(value, fieldName);
  if (!objects) {
    return undefined;
  }

  return objects.map((image, index) => parseImageInput(image, `${fieldName}[${index}]`));
}

function parseImageInput(value: Record<string, unknown>, fieldName: string): SaveImageInput {
  const url = parseOptionalString(value.url, `${fieldName}.url`);
  const cloudflareUrl = parseOptionalString(value.cloudflare_url, `${fieldName}.cloudflare_url`) || parseOptionalString(value.cloudflareUrl, `${fieldName}.cloudflareUrl`);
  const telegramFileId = parseOptionalString(value.telegram_file_id, `${fieldName}.telegram_file_id`) || parseOptionalString(value.telegramFileId, `${fieldName}.telegramFileId`);
  const telegramFileUniqueId = parseOptionalString(value.telegram_file_unique_id, `${fieldName}.telegram_file_unique_id`) || parseOptionalString(value.telegramFileUniqueId, `${fieldName}.telegramFileUniqueId`);
  const imageSourceId = parseOptionalString(value.image_source_id, `${fieldName}.image_source_id`) || parseOptionalString(value.imageSourceId, `${fieldName}.imageSourceId`);
  const fileName = parseOptionalString(value.file_name, `${fieldName}.file_name`) || parseOptionalString(value.fileName, `${fieldName}.fileName`);
  const mimeType = parseOptionalString(value.mime_type, `${fieldName}.mime_type`) || parseOptionalString(value.mimeType, `${fieldName}.mimeType`);
  const fileSize = parseOptionalNumber(value.file_size, `${fieldName}.file_size`) ?? parseOptionalNumber(value.fileSize, `${fieldName}.fileSize`);
  const width = parseOptionalNumber(value.width, `${fieldName}.width`);
  const height = parseOptionalNumber(value.height, `${fieldName}.height`);

  if (!url && !cloudflareUrl && !telegramFileId) {
    throw new Error(`${fieldName} must include at least one of: url, cloudflare_url, telegram_file_id`);
  }

  return {
    url,
    cloudflareUrl,
    imageSourceId,
    telegramFileId,
    telegramFileUniqueId,
    fileName,
    fileSize,
    mimeType,
    width,
    height,
  };
}

function parseOptionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${fieldName} must be a number`);
  }

  if (value < 0) {
    throw new Error(`${fieldName} must be non-negative`);
  }

  return value;
}

function normalizeImages(images: SaveImageInput[], idempotencyKey: string, source: string): ImageRecord[] {
  return images.map((image, index) => normalizeImage(image, idempotencyKey, source, index));
}

function normalizeImage(image: SaveImageInput, idempotencyKey: string, source: string, index: number): ImageRecord {
  const url = image.cloudflareUrl || image.url;
  const sourceId = image.imageSourceId || [url || '', image.telegramFileId || '', image.fileName || '', index].join(':');
  const safeSource = source.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const seed = [idempotencyKey, safeSource, sourceId].join(':');
  const telegramFileUniqueId = image.telegramFileUniqueId || `src:${safeSource}:${buildSyntheticExternalId(seed, 'img')}`;
  const telegramFileId = image.telegramFileId || `src:${safeSource}:${buildSyntheticExternalId(seed, 'file')}`;
  const mimeType = image.mimeType || inferMimeType(url, image.fileName);
  const fileName = image.fileName || inferFileName(url, index, mimeType);

  return {
    telegram_file_id: telegramFileId,
    telegram_file_unique_id: telegramFileUniqueId,
    cloudflare_url: url || `telepocket://image/${telegramFileId}`,
    file_name: fileName,
    file_size: image.fileSize || 0,
    mime_type: mimeType,
    width: image.width,
    height: image.height,
  };
}

function inferMimeType(url: string | undefined, fileName: string | undefined): string {
  const candidate = (fileName || url || '').toLowerCase();
  if (candidate.endsWith('.png')) {
    return 'image/png';
  }
  if (candidate.endsWith('.webp')) {
    return 'image/webp';
  }
  if (candidate.endsWith('.gif')) {
    return 'image/gif';
  }
  return 'image/jpeg';
}

function inferFileName(url: string | undefined, index: number, mimeType: string): string {
  if (url) {
    try {
      const pathname = new URL(url).pathname;
      const lastSegment = pathname.split('/').filter(Boolean).pop();
      if (lastSegment) {
        return lastSegment;
      }
    } catch {
    }
  }

  const extension = mimeType.split('/')[1] || 'jpg';
  return `image-${index + 1}.${extension}`;
}

export async function searchNotes(config: Config, input: SearchNotesInput): Promise<{
  results: Array<{
    note_id: string;
    snippet: string;
    created_at: string;
    source?: string | null;
    link_count: number;
    links: Array<Pick<LinkRecord, 'id' | 'url' | 'title'>>;
    relevance_score?: number;
  }>;
  totalCount: number;
}> {
  const client = createSupabaseClient(config);
  const userId = getTelepocketUserId(config);
  const limit = input.limit || 10;
  const query = input.query?.trim();

  if (query) {
    const fetchSize = Math.min(Math.max(limit * 3, limit), 50);
    const { data, error } = await client.rpc('search_notes_fuzzy_optimized', {
      telegram_user_id_param: userId,
      search_keyword: query,
      page_number: 1,
      page_size: fetchSize
    });

    if (error) {
      throw new Error(`Failed to search notes: ${error.message}`);
    }

    const rows = ((data as SearchRpcRow[] | null) || []).map((row) => ({
      note_id: row.note_id,
      snippet: summarizeSnippet(row.note_content, query),
      created_at: row.created_at,
      links: (row.links || []).map((link) => ({ id: link.id, url: link.url, title: link.title || undefined })),
      link_count: (row.links || []).length,
      relevance_score: row.relevance_score
    }));

    const sourceMap = await fetchNoteSources(client, rows.map((row) => row.note_id));
    const filtered = rows.filter((row) => {
      if (!matchesDateFilters(row.created_at, input.since, input.until)) {
        return false;
      }
      if (input.hasLinks !== undefined && (row.link_count > 0) !== input.hasLinks) {
        return false;
      }
      if (input.source && sourceMap.get(row.note_id) !== input.source) {
        return false;
      }
      return true;
    }).slice(0, limit).map((row) => ({
      ...row,
      source: sourceMap.get(row.note_id)
    }));

    return {
      results: filtered,
      totalCount: filtered.length
    };
  }

  const fetchSize = Math.min(Math.max(limit * 3, limit), 50);
  let request = client
    .from('z_notes')
    .select(`
      id,
      content,
      created_at,
      source,
      z_note_links(id, url, title)
    `, { count: 'exact' })
    .eq('telegram_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(fetchSize);

  if (input.source) {
    request = request.eq('source', input.source);
  }
  if (input.since) {
    request = request.gte('created_at', input.since);
  }
  if (input.until) {
    request = request.lte('created_at', input.until);
  }

  const { data, error, count } = await request;
  if (error) {
    throw new Error(`Failed to list notes: ${error.message}`);
  }

  const results = ((data || []) as Array<{
    id: string;
    content: string;
    created_at: string;
    source?: string | null;
    z_note_links?: Array<{ id?: string; url: string; title?: string | null }>;
  }>).filter((note) => {
    if (input.hasLinks !== undefined) {
      return ((note.z_note_links || []).length > 0) === input.hasLinks;
    }
    return true;
  }).slice(0, limit).map((note) => ({
    note_id: note.id,
    snippet: summarizeSnippet(note.content),
    created_at: note.created_at,
    source: note.source,
    link_count: (note.z_note_links || []).length,
    links: (note.z_note_links || []).map((link) => ({ id: link.id, url: link.url, title: link.title || undefined }))
  }));

  return {
    results,
    totalCount: count || results.length
  };
}

export async function summarizeNotes(config: Config, input: NoteSummaryInput): Promise<{
  summary: string;
  citations: Array<{ note_id: string; snippet: string }>;
  notes_considered: number;
}> {
  const client = createSupabaseClient(config);
  const userId = getTelepocketUserId(config);
  const limit = input.limit || 5;

  let notes: NoteRecord[] = [];

  if (input.noteIds && input.noteIds.length > 0) {
    const loaded = await Promise.all(input.noteIds.slice(0, limit).map((noteId) => fetchNoteById(client, userId, noteId)));
    notes = loaded.filter((note): note is NoteRecord => note !== null);
  } else {
    const searchResult = await searchNotes(config, {
      query: input.query,
      limit
    });
    const loaded = await Promise.all(searchResult.results.map((result) => fetchNoteById(client, userId, result.note_id)));
    notes = loaded.filter((note): note is NoteRecord => note !== null);
  }

  if (notes.length === 0) {
    throw new Error('No notes found to summarize');
  }

  const prompt = buildSummaryPrompt(notes, input.style || 'bullets', input.length || 'medium', input.includeCitations !== false);
  const genAI = new GoogleGenerativeAI(config.googleAI.apiKey);
  const model = genAI.getGenerativeModel({ model: config.googleAI.model });
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  if (!text) {
    throw new Error('Summary generation returned empty output');
  }

  return {
    summary: text,
    citations: notes.map((note) => ({
      note_id: note.note_id,
      snippet: summarizeSnippet(note.content)
    })),
    notes_considered: notes.length
  };
}

function summarizeSnippet(content: string, query?: string): string {
  const trimmed = content.trim();
  if (!query) {
    return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
  }

  const lowerContent = trimmed.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);

  if (index === -1) {
    return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
  }

  const start = Math.max(0, index - 60);
  const end = Math.min(trimmed.length, index + query.length + 80);
  const snippet = trimmed.slice(start, end).trim();
  return `${start > 0 ? '...' : ''}${snippet}${end < trimmed.length ? '...' : ''}`;
}

async function fetchNoteSources(client: SupabaseClient, noteIds: string[]): Promise<Map<string, string | null>> {
  if (noteIds.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from('z_notes')
    .select('id, source')
    .in('id', noteIds);

  if (error) {
    throw new Error(`Failed to fetch note sources: ${error.message}`);
  }

  const map = new Map<string, string | null>();
  for (const row of data || []) {
    map.set(row.id, row.source || null);
  }
  return map;
}

function matchesDateFilters(createdAt: string, since?: string, until?: string): boolean {
  const timestamp = new Date(createdAt).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }
  if (since) {
    const sinceTimestamp = new Date(since).getTime();
    if (!Number.isNaN(sinceTimestamp) && timestamp < sinceTimestamp) {
      return false;
    }
  }
  if (until) {
    const untilTimestamp = new Date(until).getTime();
    if (!Number.isNaN(untilTimestamp) && timestamp > untilTimestamp) {
      return false;
    }
  }
  return true;
}

function buildSummaryPrompt(
  notes: NoteRecord[],
  style: 'bullets' | 'paragraph' | 'brief',
  length: 'short' | 'medium' | 'long',
  includeCitations: boolean
): string {
  const serializedNotes = notes.map((note) => ({
    note_id: note.note_id,
    created_at: note.created_at,
    source: note.source || 'telegram',
    content: note.content,
    links: note.links.map((link) => ({ url: link.url, title: link.title || '' }))
  }));

  return [
    'You summarize stored Telepocket notes for the user.',
    `Style: ${style}.`,
    `Length: ${length}.`,
    includeCitations
      ? 'Include note IDs inline where useful, like [note:uuid]. Do not invent citations.'
      : 'Do not include citations.',
    'Focus on the user-visible meaning, key links, and actionable insights.',
    'Notes:',
    JSON.stringify(serializedNotes, null, 2)
  ].join('\n\n');
}
