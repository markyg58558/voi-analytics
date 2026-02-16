-- Reusable upsert from a loaded CSV stage table.
-- 1) Load your CSV into:
--    victims-of-ink-data-platform.voi_reporting.artist_payout_config_stage
--    Columns expected: Artist, ABN, Rate, GST Registered, Active, First Name, Helper
-- 2) Run this script.

CREATE TABLE IF NOT EXISTS `victims-of-ink-data-platform.voi_reporting.artist_payout_config_stage` (
  Artist STRING,
  ABN STRING,
  Rate STRING,
  `GST Registered` STRING,
  Active STRING,
  `First Name` STRING,
  Helper STRING
);

MERGE `victims-of-ink-data-platform.voi_reporting.artist_payout_config` tgt
USING (
  SELECT
    TRIM(Artist) AS artist_name,
    LOWER(TRIM(Artist)) AS artist_name_normalized,
    CAST(NULL AS INT64) AS team_member_id,
    SAFE_CAST(REPLACE(TRIM(Rate), '%', '') AS NUMERIC) AS commission_rate,
    LOWER(TRIM(`GST Registered`)) = 'yes' AS gst_registered,
    LOWER(TRIM(Active)) = 'yes' AS active,
    NULLIF(TRIM(ABN), '') AS abn
  FROM `victims-of-ink-data-platform.voi_reporting.artist_payout_config_stage`
  WHERE NULLIF(TRIM(Artist), '') IS NOT NULL
) src
ON tgt.artist_name_normalized = src.artist_name_normalized
WHEN MATCHED THEN
  UPDATE SET
    tgt.artist_name = src.artist_name,
    tgt.commission_rate = src.commission_rate,
    tgt.gst_registered = src.gst_registered,
    tgt.active = src.active,
    tgt.abn = src.abn,
    tgt.updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
  INSERT (
    artist_name,
    artist_name_normalized,
    team_member_id,
    commission_rate,
    gst_registered,
    active,
    abn,
    updated_at
  )
  VALUES (
    src.artist_name,
    src.artist_name_normalized,
    src.team_member_id,
    src.commission_rate,
    src.gst_registered,
    src.active,
    src.abn,
    CURRENT_TIMESTAMP()
  );
