# Squad V Plumbing analytics

## Google resources

- Agency Analytics account: Bespoke Web Design, `416967912`.
- Dedicated GA4 property: Squad V Plumbing, `565165841`.
- Web stream: Squad V Plumbing - Website, `16376413696`.
- Measurement ID: `G-H5H4WMWS2G`.
- Stream URL: `https://www.squadvplumbing.ca`.
- Property setup used Edmonton reporting time and CAD.
- GSC URL-prefix property: `https://www.squadvplumbing.ca/`. The user supplied an Ownership verified screenshot using the HTML file method.
- Verification source: `verification/googleea56b7852f7e4217.html`. `.eleventy.js` copies it unchanged to the output root. Keep it published through hosting changes.

Squad V uses its own property and measurement destination. Iron Fist's property and settings were not changed. No connected site tags were listed on Squad V's stream during setup. Do not add other clients' destinations, a second Google tag, or GTM alongside this installation.

## Installation and events

`src/_includes/layouts/base.html` loads `src/assets/js/analytics.js` with `defer`. The script loads direct gtag.js only on `squadvplumbing.ca` and `www.squadvplumbing.ca`. Preview hosts, localhost, admin, and the OG image studio are excluded.

| Event | Trigger | Additional parameters | Key event |
| --- | --- | --- | --- |
| `page_view` | Initial full document load and a back/forward cache restoration | `page_title` | No |
| `phone_click` | A `tel:` link click | None | No |
| `email_click` | A `mailto:` link click | None | No |
| `generate_lead` | Web3Forms returns an HTTP success response and JSON `success: true` for the service request form | `form_id: request-service`, `lead_source: contact_form` | Yes |

This Eleventy site uses full document navigation. Each new document initializes once; hash-only navigation does not count another pageview. Restored documents count a pageview through `pageshow`. On a cache restoration, the referrer remains the original document referrer.

`contact.js` emits a payload-free acceptance notification only in its existing success branch. The existing pending/accepted guards prevent duplicate provider requests. Analytics also deduplicates acceptance notifications within the document. Direct thank-you visits and reloads never produce a lead. Validation, honeypot, missing-key checks, errors, retries, and the success redirect retain their existing behavior. Contact clicks express interest, not completed calls or sent emails.

Every event explicitly targets Squad V's measurement ID and includes a sanitized page URL and referrer. Public routes are static. Query strings, fragments, form fields, and contact destinations are omitted. Configuration also uses sanitized URLs so automatic session events do not receive the original query string through the config. No lead revenue or booking events are sent. Existing consent controls were not changed; the repository audit found no consent manager in the shared layout or scripts.

## GA4 settings

Verified on November 20, 2026:

- Enhanced measurement is off for the Squad V Web stream. Code disables `send_page_view` globally before tag initialization and in the stream config, then sends manual pageviews.
- `generate_lead` was created using Create with code and appears in the property's Key events table.
- Counting is once per event, with no default monetary value.
- No URL/pageview-derived lead rule was created. Phone and email clicks were not marked as key events.

## Validation and release status

- `npm run build` passed.
- `node scripts/check-analytics.cjs` passed against built output. All network requests are intercepted; Google is mocked and Web3Forms responses are simulated. No real inquiry or telemetry is sent.
- Checks cover the dedicated destination, a single script/config/pageview per initialization, page titles/referrers, normal navigation and back navigation, hash exclusion, contact clicks, invalid forms, rejected/HTTP/JSON/network errors, retry and successful submission, duplicate requests/events, thank-you reloads, omitted private data, blocked analytics, both production hosts, excluded preview hosts, and admin.
- The user deployed the initial tracking commit. Production Home and Services pageviews were confirmed in Squad V's GA4 Realtime report on November 20, 2026. Controlled phone/email handler checks sent events to `G-H5H4WMWS2G` and Google's collection endpoint returned HTTP 204. A subsequent controlled check in the user's regular Chrome tab prevented default phone/email actions; both `phone_click` and `email_click` then appeared in Squad V's Realtime event table. No phone/email application was launched and no real form submission was made. No separate Tag Assistant or DebugView audit was performed.
- A follow-up diagnostic using the real Google tag with collection requests intercepted reproduced an extra automatic pageview on each document, despite the stream config's `send_page_view: false`. Disabling it globally before initialization removed that extra event. The diagnostic compared the original code, the global-disable fix, and omission of manual pageviews. The fix still needs deployment and a production recheck. These blocked diagnostic requests did not reach GA4.
- Coordinate a real accepted service request test with the user/client before sending one. Live lead/key-event ingestion remains pending.
- Query stripping removes campaign parameters from reported URLs. UTM/advertising attribution has not been validated; assess it before using advertising reports.
- No reporting dashboard, GA4-to-GSC association, or reporting connector was configured by this implementation.

## References

- https://developers.google.com/analytics/devguides/collection/ga4/views
- https://support.google.com/analytics/answer/12844695
- https://support.google.com/analytics/answer/13366706
