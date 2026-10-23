const fs = require("node:fs");
const path = require("node:path");

function keyForRoute(route) {
  const pathname = route.replace(/index\.html$/, "");
  return pathname === "/" ? "home" : pathname.replace(/^\/+|\/+$/g, "").replaceAll("/", "-");
}

function cardFromItem(item) {
  const data = item.data;
  const route = item.url.replace(/index\.html$/, "");
  const card = {
    key: keyForRoute(route),
    route,
    title: data.ogTitle || data.metaTitle || data.title,
    description: data.ogDescription || data.description,
    headline: data.ogHeadline || data.ogTitle || data.title,
    detail: data.ogDetail || "",
    action: data.ogAction,
    photo: data.ogPhoto || data.image,
    photoAlt: data.ogPhotoAlt || data.alt || data.imageAlt,
    photoPosition: data.ogImagePosition || "center center",
    alt: data.ogImageAlt,
    kind: data.ogKind || (data.ogType === "article" ? "article" : "page"),
  };
  for (const field of ["title", "description", "headline", "action", "photo", "photoAlt", "alt"]) {
    if (typeof card[field] !== "string" || !card[field].trim()) {
      throw new Error(`OG card ${route} needs ${field}`);
    }
  }
  if (!card.photo.startsWith("/assets/") || !fs.existsSync(path.join("src", card.photo))) {
    throw new Error(`OG card ${route} has a missing local photo: ${card.photo}`);
  }
  return card;
}

module.exports = { keyForRoute, cardFromItem };
