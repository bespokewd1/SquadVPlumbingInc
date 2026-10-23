import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "htmlparser2";
import sharp from "sharp";
import ogCards from "../src/config/og-cards.js";
import client from "../src/_data/client.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const buildDir = path.join(root, "public");
const sourceDir = path.join(root, "src");
const images = JSON.parse(await fs.readFile(path.join(sourceDir, "_data/ogImages.json"), "utf8"));
assert.ok(images && !Array.isArray(images) && typeof images === "object", "Generated OG manifest must be an object.");
const keys = Object.keys(images);
assert.ok(keys.length > 0, "Generated OG manifest is empty. Run npm run og:export first.");
const bySource = new Map();
const found = new Map(keys.map(key => [key, []]));
const imageMetrics = new Map();
for (const key of keys) {
  assert.match(key, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid manifest key: ${key}`);
  const image = images[key];
  assert.match(image.src, /^\/assets\/images\/og\/[a-z0-9-]+\.[a-f0-9]{12}\.jpg$/, `${key}: expected a hashed JPEG path.`);
  assert.equal(path.posix.basename(image.src).split(".")[0], key, `${key}: filename must begin with the card key.`);
  assert.equal(image.width, 1200, `${key}: manifest width.`);
  assert.equal(image.height, 630, `${key}: manifest height.`);
  assert.equal(image.type, "image/jpeg", `${key}: manifest MIME type.`);
  assert.equal(bySource.has(image.src), false, `${key}: duplicate manifest image path.`);
  bySource.set(image.src, key);
  const sourceBytes = await fs.readFile(path.join(sourceDir, image.src.slice(1)));
  const publicBytes = await fs.readFile(path.join(buildDir, image.src.slice(1)));
  assert.ok(sourceBytes.equals(publicBytes), `${key}: public image bytes differ from the source. Rebuild the site.`);
  assert.ok(sourceBytes.length < 1024 * 1024, `${key}: image must be under 1 MiB.`);
  assert.equal(sourceBytes.subarray(0, 3).toString("hex"), "ffd8ff", `${key}: bytes are not JPEG.`);
  const hash = createHash("sha256").update(sourceBytes).digest("hex").slice(0, 12);
  assert.equal(path.posix.basename(image.src), `${key}.${hash}.jpg`, `${key}: filename hash does not match the image bytes.`);
  const metadata = await sharp(sourceBytes).metadata();
  assert.equal(metadata.format, "jpeg", `${key}: actual format.`);
  assert.equal(metadata.width, 1200, `${key}: actual width.`);
  assert.equal(metadata.height, 630, `${key}: actual height.`);
  assert.equal(metadata.chromaSubsampling, "4:4:4", `${key}: chroma subsampling.`);
  imageMetrics.set(key, { bytes: sourceBytes.length, hash, width: metadata.width, height: metadata.height, type: "image/jpeg" });
}

async function filesIn(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : path.join(directory, entry.name)));
  return files.flat();
}

function elementsIn(node, name) {
  const elements = [];
  for (const child of node.children ?? []) {
    if (child.name === name) elements.push(child);
    elements.push(...elementsIn(child, name));
  }
  return elements;
}

function textIn(node) {
  return node.type === "text" ? node.data : (node.children ?? []).map(textIn).join("");
}

function routeForFile(file) {
  const relative = path.relative(buildDir, file).split(path.sep).join("/");
  return relative === "index.html" ? "/" : `/${relative.replace(/index\.html$/, "")}`;
}

function absoluteUrl(value, label) {
  const url = new URL(value);
  assert.ok(["http:", "https:"].includes(url.protocol), `${label}: expected an absolute HTTP URL.`);
  assert.equal(url.hash + url.search, "", `${label}: unexpected URL fragment or query.`);
  return url;
}

const buildFiles = await filesIn(buildDir);
const pages = [];
const studioMarker = /og-image-studio|og-card-data|data-og-card|data-og-export/i;
for (const file of buildFiles) {
  const relative = path.relative(buildDir, file).split(path.sep).join("/");
  assert.equal(studioMarker.test(relative), false, `Studio-only file leaked into public: ${relative}`);
  if (!/\.(?:html|xml|css|js|json|map|txt|webmanifest)$/i.test(file)) continue;
  const html = await fs.readFile(file, "utf8");
  assert.equal(studioMarker.test(html), false, `Studio reference leaked into public/${relative}`);
  if (!/\.html$/i.test(file)) continue;
  const document = parseDocument(html, { decodeEntities: true });
  const heads = elementsIn(document, "head");
  const head = heads[0];
  if (!head) continue;
  const metas = elementsIn(head, "meta");
  const ogImages = metas.filter(meta => meta.attribs.property?.toLowerCase() === "og:image");
  const generated = ogImages.filter(meta => {
    try { return new URL(meta.attribs.content, client.domain).pathname.startsWith("/assets/images/og/"); }
    catch { return false; }
  });
  if (!generated.length) continue;
  const route = routeForFile(file);
  const label = `${route} metadata`;
  assert.equal(heads.length, 1, `${route}: expected one head.`);
  assert.equal(ogImages.length, 1, `${route}: expected one og:image.`);
  const socialImage = absoluteUrl(ogImages[0].attribs.content, `${route} og:image`);
  const key = bySource.get(socialImage.pathname);
  assert.ok(key, `${route}: generated image is not in the current manifest: ${socialImage.pathname}`);
  assert.equal(ogCards.keyForRoute(route), key, `${route}: generated image belongs to another route.`);
  found.get(key).push(route);
  function meta(name, required = true) {
    const matches = metas.filter(node => (node.attribs.property ?? node.attribs.name ?? "").toLowerCase() === name);
    assert.ok(matches.length <= 1, `${label}: duplicate ${name}.`);
    if (required) assert.equal(matches.length, 1, `${label}: missing ${name}.`);
    const value = matches[0]?.attribs.content;
    if (required) assert.ok(typeof value === "string" && value.trim(), `${label}: empty ${name}.`);
    return value;
  }
  const titles = elementsIn(head, "title");
  assert.equal(titles.length, 1, `${route}: expected one HTML title.`);
  const title = textIn(titles[0]).trim();
  assert.ok(title && title.length <= 60, `${route}: HTML title must contain 1-60 characters.`);
  const socialTitle = meta("og:title");
  assert.ok(socialTitle.length <= 60, `${route}: social title exceeds 60 characters.`);
  assert.equal(meta("twitter:title"), socialTitle, `${route}: X title differs from OG title.`);
  const description = meta("og:description");
  assert.ok(description.length >= 100 && description.length <= 125, `${route}: social description must contain 100-125 characters, got ${description.length}.`);
  assert.equal(meta("twitter:description"), description, `${route}: X description differs from OG description.`);
  meta("description");
  const links = elementsIn(head, "link");
  const canonicals = links.filter(node => (node.attribs.rel ?? "").toLowerCase().split(/\s+/).includes("canonical"));
  assert.equal(canonicals.length, 1, `${route}: expected one canonical link.`);
  const canonical = absoluteUrl(canonicals[0].attribs.href, `${route} canonical`);
  const expectedCanonical = new URL(route, client.domain);
  assert.equal(canonical.href, expectedCanonical.href, `${route}: canonical does not match the built route.`);
  assert.equal(meta("og:url"), canonical.href, `${route}: og:url differs from the canonical.`);
  const twitterUrl = meta("twitter:url", false);
  if (twitterUrl !== undefined) assert.equal(twitterUrl, canonical.href, `${route}: X URL differs from the canonical.`);
  assert.equal(socialImage.origin, canonical.origin, `${route}: social image must use the site origin.`);
  assert.equal(meta("twitter:image"), socialImage.href, `${route}: X image differs from OG image.`);
  assert.equal(meta("og:image:width"), String(images[key].width), `${route}: OG width.`);
  assert.equal(meta("og:image:height"), String(images[key].height), `${route}: OG height.`);
  assert.equal(meta("og:image:type"), images[key].type, `${route}: OG MIME type.`);
  const alt = meta("og:image:alt");
  assert.equal(meta("twitter:image:alt"), alt, `${route}: X image alt differs from OG image alt.`);
  assert.equal(meta("twitter:card"), "summary_large_image", `${route}: X card type.`);
  assert.ok(["website", "article"].includes(meta("og:type")), `${route}: unexpected OG type.`);
  assert.equal(meta("og:locale"), "en_CA", `${route}: OG locale.`);
  meta("og:site_name");
  const preloads = links.filter(node => (node.attribs.rel ?? "").toLowerCase().split(/\s+/).includes("preload"));
  assert.equal(preloads.some(node => new URL(node.attribs.href ?? "", client.domain).pathname.startsWith("/assets/images/og/")), false, `${route}: social images must not be page-image preloads.`);
  pages.push({ key, route, title, socialTitle, descriptionLength: description.length, alt, canonical: canonical.href, image: images[key].src, ...imageMetrics.get(key) });
}
for (const [key, routes] of found) assert.equal(routes.length, 1, `${key}: expected the generated image on exactly one built route, found ${routes.length}.`);
const sitemap = path.join(buildDir, "sitemap.xml");
const sitemapText = await fs.readFile(sitemap, "utf8");
assert.equal(studioMarker.test(sitemapText), false, "Studio must not appear in the sitemap.");
console.log(JSON.stringify({ count: pages.length, pages, studioExcludedFromBuild: true, studioExcludedFromSitemap: true }, null, 2));
