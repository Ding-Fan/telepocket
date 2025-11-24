-- Add category filtering to search_notes_hybrid function
-- This allows filtering search results by category (e.g., "todo", "youtube", "blog")

-- ROLLBACK INSTRUCTIONS:
-- To rollback, recreate function without category_filter parameter using the previous migration's SQL

create or replace function search_notes_hybrid(
  query_embedding vector(768),
  query_text text,
  user_id bigint,
  match_threshold float default 0.5,
  page_size int default 20,
  category_filter text default null
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
    -- Category filter: only apply if category_filter is provided
    and (
      category_filter is null
      or exists (
        select 1
        from z_note_categories c
        where c.note_id = n.id
        and c.category = category_filter
      )
    )
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
      -- If exact substring match, ensure a minimum score boost
      case
        when n.content ilike '%' || query_text || '%' then greatest(similarity(n.content, query_text), 0.2) * 0.3
        else similarity(n.content, query_text) * 0.3
      end as score,
      'fuzzy' as type,
      n.created_at
    from z_notes n
    where n.telegram_user_id = user_id
    and n.status = 'active'
    and (
      similarity(n.content, query_text) > 0.1
      OR n.content ilike '%' || query_text || '%'
    )
    -- Category filter: only apply if category_filter is provided
    and (
      category_filter is null
      or exists (
        select 1
        from z_note_categories c
        where c.note_id = n.id
        and c.category = category_filter
      )
    )
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
