# Social images

Each included page has `ogCard: true` in its page or post YAML frontmatter. That frontmatter is the editorial source for the image and its share metadata. Eleventy converts the included pages to `collections.ogCards` with `src/config/og-cards.js`. The studio embeds this same collection as JSON. Neither script keeps a separate route list.

## Edit a card

Use these fields on the page or post:

| Field | Use |
| --- | --- |
| `metaTitle` | Optional HTML title, up to 60 characters. It does not change the visible page heading. |
| `ogTitle` | Share title, up to 60 characters. |
| `ogDescription` | Share description, 100-125 characters. |
| `ogHeadline` | Short headline printed in the image. |
| `ogDetail` | Optional short supporting line printed below the headline. |
| `ogAction` | Short call to action printed in the image. Do not use a phone number. |
| `ogPhoto` | Existing photo path under `/assets/`. Blog posts may fall back to `image`. |
| `ogPhotoAlt` | Description of the source photo. Blog posts may fall back to `alt` or the CMS `imageAlt` field. |
| `ogImagePosition` | Optional CSS `object-position`, default `center center`. |
| `ogImageAlt` | Meaningful description of the complete composed image, including its photo and message. |
| `ogKind` | Optional `service`, `page`, or `utility`. Posts with `ogType: article` use the article style. |

New CMS posts enable branded cards by default. Complete the required social fields, then export the card before the production build. Saving through the CMS does not render a new image.

Keep the raster headline shorter than the share title when it helps the layout. Check the 600 x 315 review image after changing copy or the photo crop. The cards use the existing logo, local Roboto fonts, and site photos. They do not use generated imagery.

## Export images

Install dependencies with `npm ci`. Install the export browser once:

```sh
npx playwright install chromium
```

Start the local Eleventy development server in one terminal:

```sh
npm run watch:eleventy
```

Open `http://127.0.0.1:8080/og-image-studio/` to review all cards. The studio scales the fixed card layout to the available screen width. Export mode at `/og-image-studio/?export=1` removes the review controls and transforms.

In another terminal, run:

```sh
npm run og:export
```

To use a different local port:

```sh
npm run og:export -- --url http://127.0.0.1:8081
```

The exporter accepts only loopback hosts. A static server serving a completed development build also works. Stop watch mode before serving that snapshot if you want to avoid rebuilding while the exporter writes its results.

The exporter checks the studio JSON against the rendered cards. It waits for loaded Roboto 700 and 900 font faces and decodes every image. It rejects browser errors, missing images, duplicate keys or routes, incorrect card dimensions, clipped or overlapping text regions, text crossing into the photo, and horizontal overflow in the desktop, tablet, or mobile studio previews.

Each capture is 1200 x 630 CSS pixels at device scale factor 1. Sharp encodes JPEGs with quality 85, MozJPEG, and 4:4:4 chroma subsampling. Every image must be under 1 MiB. Filenames include the first 12 hex characters of the SHA-256 hash of the final JPEG bytes.

Only after all cards and studio previews pass does the exporter write:

- `src/assets/images/og/KEY.HASH.jpg`
- `src/_data/ogImages.json`

The manifest records each image's public path, dimensions, and MIME type. Existing images stay in place. A failed capture does not replace the source manifest or publish newly captured images.

Review files are local and are not deployed:

- `.cache/og-cards/KEY.png`, full-size browser capture
- `.cache/og-cards/KEY-600x315.png`, share-size review image
- `.cache/og-cards/studio-desktop.png`
- `.cache/og-cards/studio-tablet.png`
- `.cache/og-cards/studio-mobile.png`
- `.cache/og-cards/export-report.json`, editorial descriptors, font and browser details, image sizes, text geometry, and preview measurements

Review the longest headlines, utility cards, and photo crops before accepting an export. Automated geometry checks cannot judge whether a photo is useful or copy reads well.

## Build and check

Stop the development server before the production build so it cannot write into `public` at the same time. Then run:

```sh
npm run build
npm run og:check
```

A normal build uses the checked-in manifest and JPEGs. It does not launch Chromium or regenerate images. The studio is development-only and must not appear in production output or the sitemap.

The checker reads `public` with htmlparser2 and uses the generated manifest as its image inventory. Each manifest image must appear in the head of exactly one matching built route. It checks the canonical URL, short titles, 100-125 character share description, OG and X metadata parity, image alt text, JPEG MIME type, dimensions, file size, filename hash, and exact source/public image byte equality. It also rejects studio files or references in production output. It leaves metadata on excluded legacy pages alone.

Commit the relevant frontmatter changes, studio or script changes, generated JPEGs, and `src/_data/ogImages.json` together after review. Do not edit the generated manifest by hand. If card copy, photos, fonts, or layout change, export again before the production build. Changed bytes receive a new image URL so share caches can fetch the new version.
