-- Match artist payout config rows to warehouse team_member_id values.
-- Region: australia-southeast2
-- Timezone context: Australia/Melbourne

-- 1) Preview potential matches before updating
WITH tm_ranked AS (
  SELECT
    TEAM_MEMBER_ID,
    LOWER(TRIM(FULL_NAME)) AS norm_full_name,
    FULL_NAME,
    EMPLOYMENT_END_DATE,
    DELETED_AT,
    _loaded_at,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(FULL_NAME))
      ORDER BY
        IF(EMPLOYMENT_END_DATE IS NULL AND DELETED_AT IS NULL, 1, 0) DESC,
        EMPLOYMENT_END_DATE DESC,
        _loaded_at DESC,
        TEAM_MEMBER_ID DESC
    ) AS rn
  FROM `victims-of-ink-data-platform.voi_warehouse.team_members`
  WHERE FULL_NAME IS NOT NULL
    AND TRIM(FULL_NAME) != ''
),
tm_best AS (
  SELECT TEAM_MEMBER_ID, norm_full_name, FULL_NAME
  FROM tm_ranked
  WHERE rn = 1
)
SELECT
  apc.artist_name,
  apc.artist_name_normalized,
  tm.TEAM_MEMBER_ID AS matched_team_member_id,
  tm.FULL_NAME AS matched_full_name
FROM `victims-of-ink-data-platform.voi_reporting.artist_payout_config` apc
LEFT JOIN tm_best tm
  ON apc.artist_name_normalized = tm.norm_full_name
ORDER BY apc.artist_name;

-- 2) Update team_member_id on config rows using normalized full-name match
MERGE `victims-of-ink-data-platform.voi_reporting.artist_payout_config` tgt
USING (
  WITH tm_ranked AS (
    SELECT
      TEAM_MEMBER_ID,
      LOWER(TRIM(FULL_NAME)) AS norm_full_name,
      EMPLOYMENT_END_DATE,
      DELETED_AT,
      _loaded_at,
      ROW_NUMBER() OVER (
        PARTITION BY LOWER(TRIM(FULL_NAME))
        ORDER BY
          IF(EMPLOYMENT_END_DATE IS NULL AND DELETED_AT IS NULL, 1, 0) DESC,
          EMPLOYMENT_END_DATE DESC,
          _loaded_at DESC,
          TEAM_MEMBER_ID DESC
      ) AS rn
    FROM `victims-of-ink-data-platform.voi_warehouse.team_members`
    WHERE FULL_NAME IS NOT NULL
      AND TRIM(FULL_NAME) != ''
  )
  SELECT
    norm_full_name AS artist_name_normalized,
    TEAM_MEMBER_ID
  FROM tm_ranked
  WHERE rn = 1
) src
ON tgt.artist_name_normalized = src.artist_name_normalized
WHEN MATCHED THEN
  UPDATE SET
    tgt.team_member_id = src.TEAM_MEMBER_ID,
    tgt.updated_at = CURRENT_TIMESTAMP();

-- 3) Show artists still unmatched (manual review list)
SELECT
  artist_name,
  artist_name_normalized,
  commission_rate,
  gst_registered,
  active
FROM `victims-of-ink-data-platform.voi_reporting.artist_payout_config`
WHERE active = TRUE
  AND team_member_id IS NULL
ORDER BY artist_name;
