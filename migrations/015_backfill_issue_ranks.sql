-- Backfill fractional-index ranks for existing issues so the Kanban board can
-- order cards by rank. Assign ranks per (project, status) following the current
-- visual order (created_at DESC) so nothing visibly reshuffles on first load.
-- Zero-padded sequential strings sort lexicographically and leave midpoint room
-- for the rank.Between helper. Only touches rows with an empty rank, so it is
-- idempotent and safe against rows created after this migration.
WITH ordered AS (
    SELECT id,
           printf('%06d', ROW_NUMBER() OVER (
               PARTITION BY project_id, status
               ORDER BY created_at DESC, id DESC
           )) AS new_rank
    FROM issues
)
UPDATE issues
SET rank = (SELECT new_rank FROM ordered WHERE ordered.id = issues.id)
WHERE rank = '' OR rank IS NULL;
