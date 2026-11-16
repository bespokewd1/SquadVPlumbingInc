# Cloudflare migration

Updated: 2026-11-17

## Objective and agreed order

Keep the existing website design and functionality while migrating away from Netlify. Prefer free tiers and low maintenance.

1. Replace Netlify Forms with Web3Forms.
2. Configure Decap CMS authentication and repository access through DecapBridge.
3. Add Cloudflare Workers Static Assets deployment alongside Netlify.
4. Configure a Cloudflare-compatible IndexNow submission step if needed, then complete the domain cutover.
5. Implement the agency analytics/dashboard project after active websites have migrated, as its task requests.

This document records decisions and implementation progress. Web3Forms code integration is now implemented locally. Authentication setup, Cloudflare hosting configuration, and DNS cutover have not been performed.

## Current project evidence

- Eleventy builds with `npm run build` into `public/`.
- `netlify.toml` configures that build, image/build caching, and a production IndexNow plugin.
- The service request form is in `src/content/pages/contact.html`, named `request-service`, with Netlify attributes and a `/thank-you/` action.
- Existing fields: name, phone, email, service, optional referral, message, subject, and honeypot.
- `src/admin/index.html` loads Decap CMS. `src/admin/config.yml` has a placeholder Git Gateway backend and explicitly requests replacement with DecapBridge configuration for production.
- `src/_data/client.js` defines the canonical domain as `https://www.squadvplumbing.ca`, primary email `office@squadvplumbing.ca`, and secondary email `SQUADV726@gmail.com`.
- `plugins/netlify-plugin-indexnow/index.js` currently submits published sitemap URLs after successful Netlify production deployment.
- The repository is configured for Netlify. Live hosting/account settings have not been independently inspected.

## 1. Web3Forms

### Decision

Use Web3Forms for submission processing and client notification emails. No Resend account or custom Cloudflare form Worker is required for this approach. Keep existing fields, layout, styles, and thank-you experience.

### Setup currently reached

The user created `SquadV Plumbing - Service Requests` under the agency account and provided the public access key as text. It is stored in `src/_data/web3forms.json`. The client supplied a different recipient address directly to the user; its value has not been supplied in chat and must not be guessed from `client.js`. Recipient verification and selection remain pending. The earlier office address was shown as unverified in the dashboard.

### Local implementation on 2026-11-17

- Existing HTML form now posts to Web3Forms, with public access key and sender label. Netlify attributes and its form-name field were removed.
- Existing `contact.js` retains service preselection and adds JSON submission, an in-flight/accepted guard, native validation, a 20-second timeout, accessible loading/error messages, and same-origin `/thank-you/` navigation only after an accepted response.
- Submitted values are retained on errors. A timeout does not automatically retry because the server may already have received the request.
- Hidden `botcheck` checkbox replaces the Netlify honeypot. This is basic protection; current Web3Forms documentation describes the honeypot as deprecated/less effective. No CAPTCHA was added because it can change the interface. Revisit hCaptcha before launch if stronger protection is needed.
- No GA4 event or new tracking installation was added. Keep later analytics implementation aligned with the existing GTM installation in `base.html` and avoid duplicate tags.
- `.scratch/cloudflare-migration/check-form.cjs` checks success, duplicate prevention, rejection, malformed responses, network/timeout errors, missing key, honeypot, validation, and service preselection using mocked requests. No live notification emails were sent.
- Production build passed. Actual inbox delivery, recipient selection, and visual browser QA remain pending. No deploy or push performed.
- With JavaScript disabled, the native form action still submits to Web3Forms; its default hosted success page is used. The same-site thank-you redirect is implemented in JavaScript.

### Next actions

- Create a clearly named form, for example `SquadV Plumbing - Service Requests`.
- Set the website URL to `https://www.squadvplumbing.ca/contact/`.
- Link/verify the intended client notification email and select it for this form. Confirm the recipient; do not assume the agency login email should receive client inquiries.
- Obtain the public form access key from the integration settings.
- Update the existing HTML form to use Web3Forms; remove Netlify form detection fields/attributes and adapt the honeypot to Web3Forms' documented field.
- Configure the existing subject and same-site thank-you destination.
- Decide on spam protection. Free hCaptcha is available but can introduce a visible widget. Do not silently change the agreed design or promise an invisible challenge.
- Prefer a JavaScript success handler when implementing lead tracking, so events fire only after API acceptance. Do not combine Web3Forms' HTML redirect input with its AJAX method; redirect in the success handler instead.
- Verify required fields, error handling, prevention of accidental double submission, success navigation, and actual notification receipt before switching production traffic.
- An accepted API response is not proof that the email arrived in the recipient's inbox.

### Access key and free-tier constraints

- The form access key is intentionally public, unlike a secret management API key or a Resend API key. It can appear in HTML/browser requests.
- A build environment variable rendered into browser code does not conceal it.
- A copied public form key can be abused for unsolicited submissions; enable supported spam protection.
- Current pricing lists unlimited forms/domains, 250 monthly submissions, one recipient per form, and two linked email addresses in addition to the account's primary email.
- Do not assume 250 submissions per website. Confirm quota scope in the account before rolling out across clients.
- Domain restrictions and native Web3Forms Turnstile integration are paid features. hCaptcha and honeypot protection are available on the free plan.
- One agency account can manage multiple websites, but recipient allowances and shared usage must be checked before onboarding all six clients.

## 2. Decap CMS / DecapBridge

### Local configuration on 2026-11-17

- User created DecapBridge site `1637ae09-68c5-4e57-9651-8f8d6a59498f` and provided its generated public configuration.
- Applied the generated PKCE backend, claim mappings, commit messages, branding, and temporary Cloudflare site URL to `src/admin/config.yml`, preserving the media folders, blog collection/fields, and local backend support.
- Pinned the browser-loaded Decap CMS script to `3.8.3`, the minimum version stated by DecapBridge for PKCE, replacing `3.0.0`.
- Validation passed: YAML parsing, unchanged collection schema/media paths, production build, copied admin configuration, preserved commit-message templates, and versioned CMS script in built HTML. Interactive login/publishing are not yet verified. User authorized committing this configuration and waiting for client verification before pushing both integrations.
- The GitHub token remains in DecapBridge, not in repository configuration. Token expiration shown during setup: 2027-02-15. Renew before expiration and update DecapBridge.
- Pending after deployment: confirm editor has site collaborator access, test PKCE login at the Cloudflare `/admin/` URL, load existing posts/media, and verify publishing with a deliberate content change.
- Publishing to `main` triggers both hosting pipelines. Existing production OG-card checks require exported card assets for new routes; successful CMS authentication does not remove this existing publishing requirement.
- Before the code push, verify the Web3Forms recipient is verified and selected, since pushing the current branch also publishes that integration.

- Keep the existing static CMS interface at `/admin/` in the same deployment as the website.
- Register the site and repository with DecapBridge and use its generated backend configuration rather than inventing endpoints.
- Configure publishing to the intended Git branch, normally `main`, and invite the client editor.
- Validate login/callback behavior for the addresses used during migration and after cutover according to DecapBridge's generated configuration.
- Publishing saves content to Git; repository pushes trigger hosting builds.
- CMS authentication and Git operations are handled by DecapBridge/Git provider rather than custom Cloudflare Worker code.
- Current DecapBridge free allowance: three sites and ten collaborators per site. Six client websites exceed one free account's site allowance; resolve agency-wide CMS hosting/authentication separately before promising a free rollout for every site.

## 3. Parallel Cloudflare deployment

### Deployment status on 2026-11-17

- User reports successful deployment at `https://squadvplumbinginc.bespokemusicapp.workers.dev/`.
- Project name: `squadvplumbinginc`. Build command: `npm run build`. Build variable: `NODE_VERSION=22`.
- Deploy command: `npx wrangler deploy --assets ./public --name squadvplumbinginc --compatibility-date 2026-11-16`.
- Initial deployment built successfully but failed because the earlier command omitted the required compatibility date. The corrected command succeeded according to the user.
- Compatibility date stays fixed across ordinary pushes; update intentionally when adopting newer runtime behavior, not for every deploy.
- Preview builds disabled during initial setup. Verify production branch is `main` in branch control.
- Public domain remains on Netlify. Web3Forms live rollout and DecapBridge are still pending.
- Temporary Cloudflare URL could not be independently fetched using the web tool; do not describe browser QA as complete.

### Agreed behavior

Keep Netlify connected to `main`. Connect Cloudflare to the same repository and branch. Each push should trigger both providers independently. Keep the public custom domain on Netlify until the Cloudflare deployment is verified.

### Configuration

- Use one Cloudflare Workers Static Assets deployment per website.
- Build command remains `npm run build`; static directory remains `public/`.
- Prefer a small versioned `wrangler.jsonc` defining the deployment name and static directory, plus a pinned Wrangler development dependency. Netlify continues to use `netlify.toml`.
- With that config the Cloudflare deploy command is `npx wrangler deploy`.
- An alternative without a repository config is a dashboard deploy command using `--assets ./public --name <worker-name>`; verify current CLI requirements when implementing.
- No custom Worker request handler is needed for Web3Forms or static Decap files.
- Set a compatible Node version for the project's dependencies in the build environment.
- Check assets, routes, redirects, headers, canonical URLs, sitemap, CMS, and form behavior on the Cloudflare address before cutover.
- Keep temporary hosting URLs out of public indexing and later analytics reports without changing production canonical URLs.

### Important consequences

- A Web3Forms or DecapBridge change merged into `main` reaches BOTH hosted copies. They will not retain separate form/authentication behavior unless we deliberately implement environment-specific builds.
- Static files served directly by Workers Static Assets do not consume dynamic Worker request allowance.
- The free 100,000 daily dynamic requests are shared across Workers in a Cloudflare account, resetting at midnight UTC. Separate client-owned accounts have separate allowances.
- With direct-to-Web3Forms submissions, those submissions do not execute our Cloudflare Worker code either.
- Build allowances are separate from request allowances. Current Workers Builds docs list 3,000 free build minutes/month; recheck when deploying.

## 4. IndexNow and cutover

Yes, IndexNow can also be set up with Cloudflare; it is not specific to Netlify.

- Preserve the existing IndexNow key file and sitemap generation.
- Cloudflare will not run the Netlify plugin automatically.
- Adapt the existing plugin's sitemap filtering and request construction into a portable script, invoked only AFTER a successful production deployment to the canonical domain.
- During parallel testing, let Netlify remain the submission owner. Avoid redundant submissions from both pipelines and avoid notifying IndexNow about changes not yet live on the canonical site.
- Transfer submission ownership to the Cloudflare deployment pipeline at domain cutover. A chained post-deploy script or CI job is sufficient; no always-running Worker endpoint is needed.
- Retain the rule excluding future-dated sitemap entries.
- Configure apex/www routing and HTTPS, check live key-file accessibility and sitemap, then verify an IndexNow request.
- Export existing Netlify form submissions before retiring Netlify, if the client needs that history.
- Retire the old pipeline only after successful hosting, form notification, CMS publishing, and domain checks.

## Later analytics/dashboard work

Source: `F:/projects/part-time/bespoke-dashboard/emails/nov-16/tasks.md`.

- Start after active sites have moved to the new hosting.
- Agency-owned GA4, Search Console, and Looker Studio setup.
- Master agency dashboard and individually shareable client dashboards.
- Last 30 days versus the preceding period: visitors, traffic sources, search performance, and lead interactions.
- Sites: Squad V Plumbing, Iron Fist Transport LTD., Rod's Electrical, Stone Massage, Glow And Relax, Bespoke Music App.
- Track accepted form submissions as `generate_lead`; phone and email clicks as separate interaction events. Clicks are not confirmed calls or emails.
- Avoid duplicate analytics installations and duplicate conversion triggers. Do not count submit-button clicks or direct visits/reloads of the thank-you page as new accepted leads.
- Use consistent event naming across sites, with each client's data separated for reporting.
- Do not send names, email addresses, phone numbers, or message content to GA4.
- Browser analytics is not an authoritative inquiry ledger due to consent, blockers, and delivery limitations.
- Web3Forms supports this analytics scope. Reconsider a custom Worker with durable storage if future requirements include inquiry records, delivery status, retries, assignment, or an operational lead dashboard.

## Reference documentation

- Web3Forms setup: https://docs.web3forms.com/getting-started/installation
- Web3Forms JavaScript integration: https://docs.web3forms.com/how-to-guides/html-and-javascript
- Public access keys: https://docs.web3forms.com/getting-started/faq
- Web3Forms plan details: https://web3forms.com/pricing
- DecapBridge: https://decapbridge.com/
- Cloudflare build settings: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Static Assets: https://developers.cloudflare.com/workers/static-assets/get-started/
- Static asset billing: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- Google Analytics privacy: https://support.google.com/analytics/answer/6366371?hl=en

## Progress

- [x] Record migration scope, decisions, current evidence, and implementation order.
- [x] Create Web3Forms form and obtain public key.
- [x] Implement local Web3Forms integration and mocked behavior checks without redesigning the form.
- [ ] Configure verified client recipient and confirm actual inbox delivery.
- [ ] Finish browser QA and decide whether to add hCaptcha before rollout.
- [ ] Configure and verify DecapBridge publishing.
- [x] Create Cloudflare deployment alongside Netlify; user reports successful deployment.
- [ ] Verify Cloudflare routes/assets and confirm branch control; live form/CMS checks remain pending.
- [ ] Configure IndexNow ownership and domain cutover.
- [ ] Implement shared analytics conventions and agency reporting after site migrations.
