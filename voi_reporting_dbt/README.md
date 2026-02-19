# VOI Reporting Platform dbt

This dbt project builds reporting models from `voi_warehouse` into curated datasets in BigQuery.
Model outputs are written to stable schemas: `voi_staging` and `voi_reporting`.

## First-time setup

1. Install dbt BigQuery adapter:
```bash
pip install dbt-bigquery
```

2. Create your dbt profile:
```bash
mkdir -p ~/.dbt
cp /Users/markgraham/Documents/New\ project/voi_reporting_dbt/profiles.example.yml ~/.dbt/profiles.yml
```

3. Edit `~/.dbt/profiles.yml`:
- `keyfile` path
- optional `dataset` for dev output

## Run commands

From `/Users/markgraham/Documents/New project/voi_reporting_dbt`:

```bash
dbt debug
dbt deps
dbt build
```

## GitHub Actions automation

Workflow file:
- `/Users/markgraham/Documents/New project/.github/workflows/dbt-build.yml`

Required repository secret:
- `BQ_SERVICE_ACCOUNT_JSON`: full JSON content of your BigQuery service account key.

How to set secret:
1. GitHub repo -> Settings -> Secrets and variables -> Actions.
2. New repository secret.
3. Name: `BQ_SERVICE_ACCOUNT_JSON`
4. Value: paste entire key JSON.

How to run:
1. GitHub repo -> Actions -> `VOI Reporting dbt Build` -> Run workflow.
2. It also runs every 2 hours on schedule.

## Current models

- `stg_ops__leads`
- `stg_voi__bookings`
- `stg_voi__clients`
- `stg_voi__deposits`
- `stg_voi__sale_items`
- `stg_voi__sales`
- `stg_voi__team_members`
- `dim_artists`
- `dim_artist_payout_rules`
- `mart_lead_lifecycle`
- `mart_client_lifecycle`
- `mart_google_ads_conversions`

## Notes

- Timezone handling is standardized to Melbourne local time for lead/book/sale lifecycle matching.
- Artist payout logic is owned by seed tables (`artist_master_seed`, `artist_payout_rules_seed`).
- Google Ads export model is `mart_google_ads_conversions`.
