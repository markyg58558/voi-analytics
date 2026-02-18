# GTM Hidden Fields for Leads Form

Use `/Users/markgraham/Documents/New project/reporting/gtm_lead_hidden_fields.js` as a GTM **Custom HTML** tag.

## Purpose
- Persist attribution params (`gclid/fbclid/msclkid/utm_*`) in browser storage.
- Generate a `lead_id` if missing.
- Inject hidden fields into Elementor form before webhook submit.

## Elementor Hidden Fields (name attributes)
- `lead_id`
- `gclid`, `fbclid`, `msclkid`
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- `landing_page_url`, `referrer_url`

## GTM Setup
1. Create tag type: `Custom HTML`.
2. Paste script content from `gtm_lead_hidden_fields.js`.
3. Trigger: `All Pages`.
4. Publish container.

## Notes
- This tracks attribution per browser/device (not cross-device identity).
- Keep Conversion Linker enabled separately for Google Ads tracking.
- In n8n, keep fallback: generate `lead_id` if payload is missing it.
