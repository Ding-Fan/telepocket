-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Add embedding column to z_notes table
-- We use 768 dimensions because that's what Google Gemini text-embedding-004 uses
alter table z_notes add column if not exists embedding vector(768);

-- Create an IVFFlat index for faster similarity search
-- lists = 100 is a good starting point for ~1000-10000 rows
-- We use vector_cosine_ops because we'll use cosine similarity
create index if not exists z_notes_embedding_idx
  on z_notes using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Function for semantic search using cosine similarity
create or replace function search_notes_semantic(
  query_embedding vector(768),
  user_id bigint,
  match_threshold float default 0.7,
  page_size int default 20
) returns table (
  id uuid,
  content text,
  similarity float,
  created_at timestamptz
) language plpgsql as $$
begin
  return query
  select
    z_notes.id,
    z_notes.content,
    1 - (z_notes.embedding <=> query_embedding) as similarity,
    z_notes.created_at
  from z_notes
  where z_notes.telegram_user_id = user_id
  and z_notes.status = 'active'
  and 1 - (z_notes.embedding <=> query_embedding) > match_threshold
  order by similarity desc, z_notes.created_at desc
  limit page_size;
end;
$$;

-- Function for hybrid search (semantic + fuzzy)
create or replace function search_notes_hybrid(
  query_embedding vector(768),
  query_text text,
  user_id bigint,
  match_threshold float default 0.5,
  page_size int default 20
) returns table (
  id uuid,
  content text,
  category text,
  relevance_score float,
  search_type text,
  links jsonb,
  created_at timestamptz,
  total_count bigint
) language plpgsql as $$
begin
  return query
  with semantic_results as (
    select
      n.id,
      n.content,
      n.category,
      (1 - (n.embedding <=> query_embedding)) * 0.7 as score,
      'semantic' as type,
      n.created_at
    from z_notes n
    where n.telegram_user_id = user_id
    and n.status = 'active'
    and (1 - (n.embedding <=> query_embedding)) > match_threshold
    order by score desc
    limit page_size * 2
  ),
  fuzzy_results as (
    select
      n.id,
      n.content,
      n.category,
      similarity(n.content, query_text) * 0.3 as score,
      'fuzzy' as type,
      n.created_at
    from z_notes n
    where n.telegram_user_id = user_id
    and n.status = 'active'
    and similarity(n.content, query_text) > 0.1
    order by score desc
    limit page_size * 2
  ),
  combined_results as (
    select
      coalesce(s.id, f.id) as id,
      coalesce(s.content, f.content) as content,
      coalesce(s.category, f.category) as category,
      coalesce(s.score, 0) + coalesce(f.score, 0) as total_score,
      case
        when s.id is not null and f.id is not null then 'semantic+fuzzy'
        when s.id is not null then 'semantic'
        else 'fuzzy'
      end as search_type,
      coalesce(s.created_at, f.created_at) as created_at
    from semantic_results s
    full outer join fuzzy_results f on s.id = f.id
  ),
  final_results as (
    select
      c.id,
      c.content,
      c.category,
      c.total_score as relevance_score,
      c.search_type,
      c.created_at,
      count(*) over() as total_count
    from combined_results c
    order by c.total_score desc, c.created_at desc
    limit page_size
  )
  select
    fr.id,
    fr.content,
    fr.category,
    fr.relevance_score,
    fr.search_type,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('id', l.id, 'url', l.url, 'title', l.title))
        from z_note_links l
        where l.note_id = fr.id
      ),
      '[]'::jsonb
    ) as links,
    fr.created_at,
    fr.total_count
  from final_results fr;
end;
$$;
