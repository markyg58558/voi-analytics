-- Nightly Xero receipts payload (BigQuery)
-- Purpose:
-- 1) Build invoice header + lines from Fresha sales/sale_items.
-- 2) Build payment payloads from Fresha payments.
-- 3) Route payment amounts to clearing buckets for Xero bank account mapping.
--
-- Usage:
-- - Set p_run_day to the local business day to sync.
-- - Run at 23:00 Australia/Melbourne for same-day receipts.
--
-- Notes:
-- - This script is idempotency-ready; wire an audit table filter where marked.
-- - Amounts are rounded to 2 dp for Xero payload stability.

DECLARE p_tz STRING DEFAULT 'Australia/Melbourne';
DECLARE p_run_day DATE DEFAULT CURRENT_DATE(p_tz);

-- Eligible sales for the business day.
WITH eligible_sales AS (
  SELECT
    s.SALE_ID AS sale_id,
    s.SALE_NUMBER AS sale_number,
    s.CLIENT AS client_name,
    s.LOCATION AS location_name,
    s.CURRENCY_CODE AS currency_code,
    DATE(s.SALE_DATE, p_tz) AS sale_day_local,
    s.SALE_DATE AS sale_ts_utc,
    LOWER(IFNULL(s.STATUS, '')) AS sale_status_lc,
    LOWER(IFNULL(s.PAYMENT_STATUS, '')) AS payment_status_lc,
    ROUND(CAST(s.TOTAL_SALES AS NUMERIC), 2) AS total_sales
  FROM `victims-of-ink-data-platform.voi_warehouse.sales` s
  WHERE DATE(s.SALE_DATE, p_tz) = p_run_day
    AND LOWER(IFNULL(s.STATUS, '')) NOT IN ('cancelled', 'void')
    AND CAST(IFNULL(s.TOTAL_SALES, 0) AS NUMERIC) > 0
),

-- Invoice line payload from sale items.
invoice_lines AS (
  SELECT
    si.SALE_ID AS sale_id,
    si.SALE_ITEM_ID AS sale_item_id,
    IFNULL(si.ITEM, 'Sale Item') AS line_description,
    CAST(IFNULL(si.QUANTITY, 1) AS INT64) AS quantity,
    ROUND(CAST(IFNULL(si.NET_SALES, 0) AS NUMERIC), 2) AS net_amount,
    ROUND(CAST(IFNULL(si.TAXES_ON_NET_SALES, 0) AS NUMERIC), 2) AS tax_amount,
    ROUND(CAST(IFNULL(si.TOTAL_SALES, 0) AS NUMERIC), 2) AS gross_amount,
    IFNULL(si.CATEGORY, 'Uncategorised') AS item_category,
    IFNULL(si.SALE_TYPE, 'General') AS sale_type
  FROM `victims-of-ink-data-platform.voi_warehouse.sale_items` si
  INNER JOIN eligible_sales es
    ON es.sale_id = si.SALE_ID
  WHERE CAST(IFNULL(si.TOTAL_SALES, 0) AS NUMERIC) <> 0
),

-- Payment allocation per sale + clearing bucket.
payment_allocations AS (
  SELECT
    p.SALE_ID AS sale_id,
    p.PAYMENT_NO AS payment_no,
    p.PAYMENT_METHOD AS payment_method,
    p.IS_DEPOSIT_REDEMPTION AS is_deposit_redemption,
    p.IS_GIFT_CARD_REDEMPTION AS is_gift_card_redemption,
    DATE(p.PAYMENT_DATE, p_tz) AS payment_day_local,
    ROUND(CAST(IFNULL(p.PAYMENT_AMOUNT, 0) AS NUMERIC), 2) AS payment_amount,
    CASE
      WHEN IFNULL(p.IS_GIFT_CARD_REDEMPTION, FALSE) THEN 'gift_voucher_clearing'
      WHEN IFNULL(p.IS_DEPOSIT_REDEMPTION, FALSE) THEN 'deposits_clearing'
      WHEN LOWER(IFNULL(p.PAYMENT_METHOD, '')) LIKE '%eftpos%' THEN 'fresha_eftpos_clearing'
      WHEN LOWER(IFNULL(p.PAYMENT_METHOD, '')) LIKE '%card%' THEN 'fresha_eftpos_clearing'
      ELSE 'fresha_eftpos_clearing'
    END AS clearing_bucket
  FROM `victims-of-ink-data-platform.voi_warehouse.payments` p
  INNER JOIN eligible_sales es
    ON es.sale_id = p.SALE_ID
  WHERE DATE(p.PAYMENT_DATE, p_tz) = p_run_day
    AND ROUND(CAST(IFNULL(p.PAYMENT_AMOUNT, 0) AS NUMERIC), 2) > 0
),

-- Sale-level payment totals to control "mark as paid" eligibility.
payment_totals AS (
  SELECT
    sale_id,
    ROUND(SUM(payment_amount), 2) AS paid_total
  FROM payment_allocations
  GROUP BY sale_id
),

receipt_ready_sales AS (
  SELECT
    es.*,
    ROUND(IFNULL(pt.paid_total, 0), 2) AS paid_total
  FROM eligible_sales es
  LEFT JOIN payment_totals pt
    ON pt.sale_id = es.sale_id
  WHERE ROUND(IFNULL(pt.paid_total, 0), 2) >= es.total_sales
)

-- Output A: invoice headers (one invoice per sale).
SELECT
  'invoice_header' AS record_type,
  r.sale_id,
  r.sale_number,
  r.sale_day_local AS invoice_date_local,
  r.client_name,
  r.location_name,
  r.currency_code,
  r.total_sales AS invoice_total,
  r.paid_total,
  CONCAT('Fresha receipt ', r.sale_number) AS reference
FROM receipt_ready_sales r

UNION ALL

-- Output B: invoice lines.
SELECT
  'invoice_line' AS record_type,
  l.sale_id,
  CAST(l.sale_item_id AS STRING) AS sale_number,
  NULL AS invoice_date_local,
  l.line_description AS client_name,
  l.item_category AS location_name,
  NULL AS currency_code,
  l.gross_amount AS invoice_total,
  NULL AS paid_total,
  l.sale_type AS reference
FROM invoice_lines l
INNER JOIN receipt_ready_sales r
  ON r.sale_id = l.sale_id

UNION ALL

-- Output C: invoice payments (mark as paid in Xero).
SELECT
  'invoice_payment' AS record_type,
  p.sale_id,
  CAST(p.payment_no AS STRING) AS sale_number,
  p.payment_day_local AS invoice_date_local,
  p.payment_method AS client_name,
  p.clearing_bucket AS location_name,
  NULL AS currency_code,
  p.payment_amount AS invoice_total,
  NULL AS paid_total,
  CONCAT('Payment allocation for sale ', CAST(p.sale_id AS STRING)) AS reference
FROM payment_allocations p
INNER JOIN receipt_ready_sales r
  ON r.sale_id = p.sale_id
ORDER BY sale_id, record_type;
