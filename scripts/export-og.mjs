import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import sharp from "sharp";
import ogCards from "../src/config/og-cards.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const { values } = parseArgs({ options: { url: { type: "string", default: "http://127.0.0.1:8080" } } });
const base = new URL(values.url);
assert.ok(["http:", "https:"].includes(base.protocol), "Use an HTTP development server.");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Capture must use a loopback development server.");
assert.equal(base.username + base.password, "", "The development URL must not contain credentials.");
const studio = new URL("/og-image-studio/", base);
const exportUrl = new URL(studio);
exportUrl.searchParams.set("export", "1");
const workDir = path.join(root, ".cache/og-cards");
const outputDir = path.join(root, "src/assets/images/og");
const manifestPath = path.join(root, "src/_data/ogImages.json");
const width = 1200;
const height = 630;
const maxBytes = 1024 * 1024;
const jpegOptions = { quality: 85, mozjpeg: true, chromaSubsampling: "4:4:4" };
const viewport = { width: 1440, height: 900 };
await fs.mkdir(workDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = {
  createdAt: new Date().toISOString(), studio: studio.href, viewport, deviceScaleFactor: 1,
  width, height, maxBytes, jpeg: jpegOptions, browser: { name: "Chromium", version: browser.version() },
  descriptors: [], fonts: [], cards: [], previews: [],
};

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", error => errors.push(`Page: ${error.message}`));
  page.on("console", message => { if (message.type() === "error") errors.push(`Console: ${message.text()}`); });
  page.on("requestfailed", request => errors.push(`Request: ${request.url()} (${request.failure()?.errorText})`));
  page.on("response", response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  return errors;
}

async function ready(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const requiredFonts = [];
    for (const weight of ["700", "900"]) {
      const faces = await document.fonts.load(`${weight} 32px "Roboto"`, "Squad V Plumbing");
      const matchingWeight = faces.some(face => face.family.replace(/["']/g, "") === "Roboto" && face.weight === weight && face.status === "loaded");
      if (!matchingWeight || faces.some(face => face.status !== "loaded") || !document.fonts.check(`${weight} 32px "Roboto"`)) {
        throw new Error(`Roboto ${weight} did not load.`);
      }
      requiredFonts.push({ weight, faces: faces.map(face => ({ family: face.family, weight: face.weight, status: face.status })) });
    }
    await Promise.all([...document.images].map(async image => {
      image.loading = "eager";
      await image.decode();
      if (!image.complete || !image.naturalWidth || !image.naturalHeight) throw new Error(`Missing image: ${image.currentSrc || image.src}`);
    }));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { required: requiredFonts, available: [...document.fonts].map(face => ({ family: face.family, weight: face.weight, status: face.status })) };
  });
}

function validateDescriptors(descriptors) {
  assert.ok(Array.isArray(descriptors) && descriptors.length > 0, "Studio JSON must contain a nonempty card array.");
  const keys = new Set();
  const routes = new Set();
  for (const card of descriptors) {
    assert.ok(card && typeof card === "object", "Invalid card descriptor.");
    assert.match(card.key, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Unsafe card key: ${card.key}`);
    assert.ok(typeof card.route === "string" && card.route.startsWith("/") && card.route.endsWith("/"), `${card.key}: route must have leading and trailing slashes.`);
    assert.equal(card.key, ogCards.keyForRoute(card.route), `${card.key}: route/key mismatch.`);
    assert.ok(!keys.has(card.key), `Duplicate key: ${card.key}`);
    assert.ok(!routes.has(card.route), `Duplicate route: ${card.route}`);
    keys.add(card.key);
    routes.add(card.route);
    for (const field of ["title", "description", "headline", "action", "photo", "photoAlt", "alt"]) {
      assert.ok(typeof card[field] === "string" && card[field].trim(), `${card.key}: missing ${field}.`);
    }
    assert.ok(card.title.length <= 60, `${card.key}: social title exceeds 60 characters.`);
    assert.ok(card.description.length >= 100 && card.description.length <= 125, `${card.key}: social description must be 100-125 characters.`);
    assert.ok(card.photo.startsWith("/assets/") && !card.photo.includes(".."), `${card.key}: photo must use an existing local /assets/ path.`);
    assert.equal(/(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/.test([card.headline, card.detail, card.action].join(" ")), false, `${card.key}: card copy must not include a phone number.`);
  }
}

function validateMetrics(key, metrics) {
  assert.equal(metrics.width, width, `${key}: card width.`);
  assert.equal(metrics.height, height, `${key}: card height.`);
  assert.equal(metrics.transform, "none", `${key}: export card has a transform.`);
  assert.ok(metrics.text.length > 0, `${key}: no [data-og-text] regions.`);
  for (const text of metrics.text) {
    assert.ok(text.text, `${key}: empty text region.`);
    assert.ok(text.rects.length > 0, `${key}: hidden text: ${text.text}`);
    assert.equal(text.overflow, false, `${key}: clipped text: ${text.text}`);
    assert.equal(text.clipped, false, `${key}: text crosses a clipping boundary: ${text.text}`);
    for (const rect of text.rects) {
      assert.ok(rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= width + 1 && rect.y + rect.height <= height + 1, `${key}: text outside card: ${text.text}`);
      if (text.copyBounds) assert.ok(rect.x >= text.copyBounds.x - 1 && rect.x + rect.width <= text.copyBounds.right + 1, `${key}: text crosses into the photo: ${text.text}`);
    }
  }
  for (const overlap of metrics.overlaps) {
    assert.fail(`${key}: text regions overlap: ${overlap.join(" / ")}`);
  }
  assert.ok(metrics.images.length > 0, `${key}: card has no image.`);
  for (const image of metrics.images) assert.ok(image.width > 0 && image.height > 0, `${key}: undecoded image ${image.source}`);
}

try {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce", locale: "en-CA" });
  const page = await context.newPage();
  const errors = watchErrors(page);
  const response = await page.goto(exportUrl.href, { waitUntil: "load" });
  assert.equal(response?.status(), 200, "Start the local Eleventy development server before exporting.");
  await page.locator("[data-og-card]").first().waitFor({ state: "visible" });
  report.fonts = await ready(page);
  assert.equal(await page.locator("html").getAttribute("data-og-export"), "true", "Studio did not enter export mode.");
  assert.equal(await page.locator("script#og-card-data[type='application/json']").count(), 1, "Studio needs one JSON inventory.");
  const descriptors = JSON.parse(await page.locator("#og-card-data").textContent());
  validateDescriptors(descriptors);
  report.descriptors = descriptors;
  const actualKeys = await page.locator("[data-og-card]").evaluateAll(cards => cards.map(card => card.dataset.ogCard));
  assert.deepEqual([...actualKeys].sort(), descriptors.map(card => card.key).sort(), "DOM cards do not match the JSON inventory.");
  const exportGeometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(exportGeometry.document <= exportGeometry.viewport + 1, "Export studio overflows horizontally.");
  const staged = [];
  const next = {};
  for (const descriptor of descriptors) {
    const { key } = descriptor;
    const card = page.locator(`[data-og-card="${key}"]`);
    assert.equal(await card.count(), 1, `${key}: expected exactly one card.`);
    const metrics = await card.evaluate(element => {
      const box = element.getBoundingClientRect();
      const nodes = [...element.querySelectorAll("[data-og-text]")];
      const text = nodes.map(node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const css = getComputedStyle(node);
        const rangeRects = [...range.getClientRects()].filter(rect => rect.width && rect.height);
        const copyBox = node.closest(".og-card-copy")?.getBoundingClientRect();
        let clipped = false;
        for (let ancestor = node; ancestor && element.contains(ancestor); ancestor = ancestor.parentElement) {
          const ancestorCss = getComputedStyle(ancestor);
          const bounds = ancestor.getBoundingClientRect();
          const clipsX = ancestorCss.overflowX !== "visible";
          const clipsY = ancestorCss.overflowY !== "visible";
          if (rangeRects.some(rect => (clipsX && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) || (clipsY && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)))) clipped = true;
        }
        return {
          text: node.textContent.trim(), fontFamily: css.fontFamily, fontSize: css.fontSize, fontWeight: css.fontWeight,
          color: css.color, clipped, copyBounds: copyBox ? { x: copyBox.x - box.x, right: copyBox.right - box.x } : null,
          overflow: (css.overflowX !== "visible" && node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1) || (css.overflowY !== "visible" && node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 1),
          rects: rangeRects.map(rect => ({ x: rect.x - box.x, y: rect.y - box.y, width: rect.width, height: rect.height })),
        };
      });
      const overlaps = [];
      for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
        if (nodes[a].contains(nodes[b]) || nodes[b].contains(nodes[a])) continue;
        const intersects = text[a].rects.some(left => text[b].rects.some(right =>
          Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x) > 1 &&
          Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y) > 1));
        if (intersects) overlaps.push([text[a].text, text[b].text]);
      }
      return {
        width: box.width, height: box.height, transform: getComputedStyle(element).transform, text, overlaps,
        images: [...element.querySelectorAll("img")].map(image => ({ source: image.getAttribute("src"), alt: image.alt, width: image.naturalWidth, height: image.naturalHeight })),
      };
    });
    validateMetrics(key, metrics);
    const pngPath = path.join(workDir, `${key}.png`);
    await card.screenshot({ path: pngPath, type: "png", scale: "css", animations: "disabled", caret: "hide" });
    const pngMetadata = await sharp(pngPath).metadata();
    assert.equal(pngMetadata.width, width, `${key}: PNG width.`);
    assert.equal(pngMetadata.height, height, `${key}: PNG height.`);
    const jpeg = await sharp(pngPath).jpeg(jpegOptions).toBuffer();
    const metadata = await sharp(jpeg).metadata();
    assert.equal(metadata.format, "jpeg", `${key}: output format.`);
    assert.equal(metadata.width, width, `${key}: JPEG width.`);
    assert.equal(metadata.height, height, `${key}: JPEG height.`);
    assert.equal(metadata.chromaSubsampling, "4:4:4", `${key}: chroma subsampling.`);
    assert.ok(jpeg.length < maxBytes, `${key}: JPEG must be under 1 MiB.`);
    const hash = createHash("sha256").update(jpeg).digest("hex").slice(0, 12);
    const filename = `${key}.${hash}.jpg`;
    next[key] = { src: `/assets/images/og/${filename}`, width, height, type: "image/jpeg" };
    staged.push({ filename, jpeg });
    const thumbnail = `${key}-600x315.png`;
    await sharp(jpeg).resize(600, 315).png().toFile(path.join(workDir, thumbnail));
    report.cards.push({ key, route: descriptor.route, ...next[key], bytes: jpeg.length, hash, chromaSubsampling: metadata.chromaSubsampling, png: `${key}.png`, thumbnail, ...metrics });
  }
  assert.deepEqual(errors, [], "Export studio browser errors.");
  await context.close();
  for (const size of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const previewContext = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, reducedMotion: "reduce", locale: "en-CA" });
    const preview = await previewContext.newPage();
    const previewErrors = watchErrors(preview);
    const previewResponse = await preview.goto(studio.href, { waitUntil: "load" });
    assert.equal(previewResponse?.status(), 200, `${size.name}: studio response.`);
    const fonts = await ready(preview);
    const geometry = await preview.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
    assert.ok(geometry.scrollWidth <= geometry.width + 1, `${size.name}: preview overflows horizontally.`);
    const screenshot = `studio-${size.name}.png`;
    await preview.screenshot({ path: path.join(workDir, screenshot), fullPage: true, type: "png", scale: "css", animations: "disabled", caret: "hide" });
    assert.deepEqual(previewErrors, [], `${size.name}: studio browser errors.`);
    report.previews.push({ ...size, ...geometry, screenshot, fonts });
    await previewContext.close();
  }
  // Source assets and manifest change only after every card and preview passes.
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  for (const output of staged) await fs.writeFile(path.join(outputDir, output.filename), output.jpeg);
  const temporaryManifest = `${manifestPath}.tmp`;
  await fs.writeFile(temporaryManifest, `${JSON.stringify(next, null, 2)}\n`);
  await fs.rename(temporaryManifest, manifestPath);
  await fs.writeFile(path.join(workDir, "export-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ count: report.cards.length, cards: report.cards.map(({ key, src, bytes }) => ({ key, src, bytes })), report: path.relative(root, path.join(workDir, "export-report.json")) }, null, 2));
} finally {
  await browser.close();
}
