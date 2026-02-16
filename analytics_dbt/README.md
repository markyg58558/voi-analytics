# VOI Analytics dbt

This dbt project builds reporting models from `voi_warehouse` into curated datasets in BigQuery.

## First-time setup

1. Install dbt BigQuery adapter:
```bash
pip install dbt-bigquery
```

2. Create your dbt profile:
```bash
mkdir -p ~/.dbt
cp /Users/markgraham/Documents/New\ project/analytics_dbt/profiles.example.yml ~/.dbt/profiles.yml
```

3. Edit `~/.dbt/profiles.yml`:
- `keyfile` path
- optional `dataset` for dev output

## Run commands

From `/Users/markgraham/Documents/New project/analytics_dbt`:

```bash
dbt debug
dbt deps
dbt build
```

## Current models

- `stg_voi__commissions`
- `stg_voi__deposits`
- `stg_voi__team_members`
- `dim_artists`
- `mart_payroll_weekly_artist`

## Notes

- Business week is Melbourne time with Saturday week start.
- Payroll owed in mart currently uses Fresha `COMMISSION`.
