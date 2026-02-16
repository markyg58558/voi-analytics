# VOI Reporting Platform

Reporting data platform for Victims of Ink.

## Current Architecture

- Ingestion: Fresha data synced via Snowflake + n8n into BigQuery `voi_warehouse`
- Modeling: dbt project in `/Users/markgraham/Documents/New project/voi_reporting_dbt`
- Reporting outputs: BigQuery dataset `voi_reporting_prod`
- Automation: GitHub Actions workflow `/Users/markgraham/Documents/New project/.github/workflows/dbt-build.yml`

## Primary Goal

Build reliable tattoo studio reporting first, then use this foundation to support future custom booking + CRM product development.

## Quick Start

1. Local dbt run:
```bash
cd "/Users/markgraham/Documents/New project/voi_reporting_dbt"
dbt deps
dbt build
```

2. Automated run:
- GitHub Actions -> `VOI Reporting dbt Build`
- Runs daily and can be triggered manually.
