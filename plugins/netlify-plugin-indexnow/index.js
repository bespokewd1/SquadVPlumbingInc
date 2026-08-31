const { readFile } = require("node:fs/promises");
const path = require("node:path");
const indexNow = require("../../src/_data/indexnow");

function getPublishedUrls(sitemap) {
  const now = new Date();

  return [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .filter(([, entry]) => {
      const lastModified = entry.match(/<lastmod>(.*?)<\/lastmod>/)?.[1];
      return !lastModified || new Date(lastModified) <= now;
    })
    .map(([, entry]) => entry.match(/<loc>(.*?)<\/loc>/)?.[1])
    .filter(Boolean);
}

module.exports = {
  onSuccess: async ({ constants, utils }) => {
    if (constants.IS_LOCAL) return;

    try {
      const sitemap = await readFile(path.join(constants.PUBLISH_DIR, "sitemap.xml"), "utf8");
      const urlList = getPublishedUrls(sitemap);

      if (urlList.length === 0) return;

      const response = await fetch(indexNow.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: "www.squadvplumbing.ca",
          key: indexNow.key,
          keyLocation: `https://www.squadvplumbing.ca/${indexNow.key}.txt`,
          urlList,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`IndexNow returned HTTP ${response.status}`);
      }

      console.log(`IndexNow accepted ${urlList.length} URLs.`);
    } catch (error) {
      utils.build.failPlugin("IndexNow submission failed; the site deployment remains available.", {
        error,
      });
    }
  },
};
