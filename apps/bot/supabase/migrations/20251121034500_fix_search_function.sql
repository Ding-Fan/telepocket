-- Fix search_notes_hybrid function to correctly fetch category from z_note_categories
-- Previous version tried to select n.category from z_notes which doesn't exist

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
      (
        select c.category 
        from z_note_categories c 
        where c.note_id = n.id 
        order by c.user_confirmed desc, c.confidence desc 
        limit 1
      ) as category,
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
      (
        select c.category 
        from z_note_categories c 
        where c.note_id = n.id 
        order by c.user_confirmed desc, c.confidence desc 
        limit 1
      ) as category,
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

-- Fix search_notes_fuzzy_optimized to cast relevance_score to numeric
-- This fixes "Returned type double precision does not match expected type numeric" error

CREATE OR REPLACE FUNCTION search_notes_fuzzy_optimized(
  telegram_user_id_param BIGINT,
  search_keyword TEXT,
  page_number INT DEFAULT 1,
  page_size INT DEFAULT 5
)
RETURNS TABLE (
  note_id UUID,
  category TEXT,
  note_content TEXT,
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ,
  links JSONB,
  relevance_score NUMERIC,
  total_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set similarity threshold for this query only
  SET LOCAL pg_trgm.similarity_threshold = 0.4;

  RETURN QUERY
  WITH matched_notes AS (
    SELECT
      n.id AS note_id,
      nc.category,
      n.content AS note_content,
      n.telegram_message_id,
      n.created_at,
      -- Aggregate all links for this note as JSON array
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', nl.id,
            'url', nl.url,
            'title', nl.title,
            'description', nl.description,
            'og_image', nl.og_image,
            'created_at', nl.created_at,
            'updated_at', nl.updated_at
          )
          ORDER BY nl.created_at DESC
        ) FILTER (WHERE nl.id IS NOT NULL),
        '[]'::jsonb
      ) AS links,
      -- Calculate weighted relevance score and cast to numeric
      (
        (
          similarity(LOWER(COALESCE(n.content, '')), LOWER(search_keyword)) * 10 +
          COALESCE(MAX(similarity(LOWER(COALESCE(nl.title, '')), LOWER(search_keyword)) * 4), 0) +
          COALESCE(MAX(similarity(LOWER(COALESCE(nl.url, '')), LOWER(search_keyword)) * 3), 0) +
          COALESCE(MAX(similarity(LOWER(COALESCE(nl.description, '')), LOWER(search_keyword)) * 2), 0)
        ) / 10.0
      )::numeric AS relevance_score
    FROM z_notes n
    INNER JOIN z_note_categories nc ON n.id = nc.note_id
    LEFT JOIN z_note_links nl ON n.id = nl.note_id
    WHERE
      n.telegram_user_id = telegram_user_id_param
      AND n.status = 'active'
      AND nc.user_confirmed = true
      AND (
        -- Match in note content
        LOWER(COALESCE(n.content, '')) % LOWER(search_keyword)
        OR
        -- Match in any link field
        LOWER(COALESCE(nl.url, '')) % LOWER(search_keyword)
        OR LOWER(COALESCE(nl.title, '')) % LOWER(search_keyword)
        OR LOWER(COALESCE(nl.description, '')) % LOWER(search_keyword)
      )
    GROUP BY n.id, nc.category, n.content, n.telegram_message_id, n.created_at
  )
  SELECT
    mn.*,
    COUNT(*) OVER() AS total_count
  FROM matched_notes mn
  ORDER BY relevance_score DESC, created_at DESC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;
