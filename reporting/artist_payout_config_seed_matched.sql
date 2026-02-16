-- Seed/upsert artist payout config from your payout sheet + provided team member list.
-- Region: australia-southeast2
-- Safe to rerun (MERGE).

CREATE TABLE IF NOT EXISTS `victims-of-ink-data-platform.voi_reporting.artist_payout_config` (
  artist_name STRING,
  artist_name_normalized STRING,
  team_member_id INT64,
  commission_rate NUMERIC,
  gst_registered BOOL,
  active BOOL,
  abn STRING,
  updated_at TIMESTAMP
);

MERGE `victims-of-ink-data-platform.voi_reporting.artist_payout_config` tgt
USING (
  SELECT * FROM UNNEST([
    STRUCT('Enrico Bigi' AS artist_name, 'enrico bigi' AS artist_name_normalized, 5098118 AS team_member_id, 75 AS commission_rate, FALSE AS gst_registered, TRUE AS active, CAST(NULL AS STRING) AS abn),
    STRUCT('Digby Stewart', 'digby stewart', 5098144, 70, FALSE, TRUE, NULL),
    STRUCT('Serhat Aslan', 'serhat aslan', CAST(NULL AS INT64), 70, TRUE, FALSE, NULL),
    STRUCT('Chanelle Pititto', 'chanelle pititto', 5097976, 60, FALSE, TRUE, NULL),
    STRUCT('Milli Bug', 'milli bug', 5097948, 70, TRUE, TRUE, NULL),
    STRUCT('Niki Peppers', 'niki peppers', 5098020, 60, FALSE, TRUE, NULL),
    STRUCT('Zoe Clues', 'zoe clues', CAST(NULL AS INT64), 60, FALSE, TRUE, NULL),
    STRUCT('Tom Rattle', 'tom rattle', 5098138, 75, FALSE, TRUE, NULL),
    STRUCT('Yesid Correa', 'yesid correa', 5098143, 70, FALSE, TRUE, NULL),
    STRUCT('Yuli Prajapati', 'yuli prajapati', 5098132, 75, TRUE, TRUE, NULL),
    STRUCT('Oli John', 'oli john', 5097938, 60, FALSE, TRUE, NULL),
    STRUCT('Syd Richmond', 'syd richmond', 5097980, 70, FALSE, TRUE, NULL),
    STRUCT('Tanya Putthapipat', 'tanya putthapipat', 5097978, 50, FALSE, TRUE, NULL),
    STRUCT('Will Halstead-Smith', 'will halstead-smith', 5098147, 75, FALSE, TRUE, NULL),
    STRUCT('Pau Costa', 'pau costa', 5097950, 70, FALSE, TRUE, NULL),
    STRUCT('Hayley Bayley', 'hayley bayley', 5098016, 70, FALSE, TRUE, NULL),
    STRUCT('Dappy Tattoo', 'dappy tattoo', CAST(NULL AS INT64), 70, FALSE, FALSE, NULL),
    STRUCT('Nari Janphanich', 'nari janphanich', CAST(NULL AS INT64), 60, FALSE, TRUE, NULL),
    STRUCT('Tobias Meredith', 'tobias meredith', 5098140, 75, FALSE, TRUE, NULL),
    STRUCT('David Carry', 'david carry', 5097942, 60, FALSE, TRUE, NULL),
    STRUCT('Joy j.vell Guest', 'joy j.vell guest', CAST(NULL AS INT64), 70, FALSE, FALSE, NULL),
    STRUCT('Brandon Harry', 'brandon harry', CAST(NULL AS INT64), 60, FALSE, FALSE, NULL),
    STRUCT('Cassy Martin', 'cassy martin', CAST(NULL AS INT64), 60, FALSE, FALSE, NULL),
    STRUCT('Bradley Thompson', 'bradley thompson', CAST(NULL AS INT64), 70, FALSE, TRUE, NULL),
    STRUCT('Lucas Marques', 'lucas marques', 5097953, 60, FALSE, TRUE, NULL),
    STRUCT('Rafael Couto', 'rafael couto', 5097986, 60, FALSE, TRUE, NULL),
    STRUCT('Saitama', 'saitama', CAST(NULL AS INT64), 60, FALSE, TRUE, NULL),
    STRUCT('Woody', 'woody', 5097963, 60, FALSE, TRUE, NULL),
    STRUCT('Juff', 'juff', 5097959, 60, FALSE, TRUE, NULL),
    STRUCT('Eunji', 'eunji', CAST(NULL AS INT64), 60, FALSE, TRUE, NULL),
    STRUCT('Brian Ledda', 'brian ledda', 5097967, 75, FALSE, TRUE, NULL)
  ])
) src
ON tgt.artist_name_normalized = src.artist_name_normalized
WHEN MATCHED THEN
  UPDATE SET
    tgt.artist_name = src.artist_name,
    tgt.team_member_id = src.team_member_id,
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

-- Quick QA: show active artists without team_member_id match
SELECT
  artist_name,
  commission_rate,
  gst_registered
FROM `victims-of-ink-data-platform.voi_reporting.artist_payout_config`
WHERE active = TRUE
  AND team_member_id IS NULL
ORDER BY artist_name;
