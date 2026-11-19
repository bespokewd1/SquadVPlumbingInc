const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

// Run after npm run build. Every request is intercepted: no telemetry or inquiry is sent.
async function main() {
  const browser = await chromium.launch({ headless: true });
  const output = path.resolve(__dirname, "../public");
  const measurementId = "G-H5H4WMWS2G";
  async function fixture(host = "www.squadvplumbing.ca", options = {}) {
    const context = await browser.newContext();
    const commands = [];
    const googleRequests = [];
    let submissions = 0;
    let responseMode = "success";
    await context.exposeBinding("recordAnalytics", (_, command) => commands.push(command));
    await context.addInitScript(() => {
      window.dataLayer = [];
      window.dataLayer.push = function (entry) {
        window.recordAnalytics(Array.from(entry));
        return Array.prototype.push.call(this, entry);
      };
      // Contact links exercise their real delegated tracking handlers without opening apps.
      document.addEventListener("click", (event) => {
        if (event.target.closest?.('a[href^="tel:"], a[href^="mailto:"]')) event.preventDefault();
      });
    });
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "www.googletagmanager.com") {
        googleRequests.push(url.href);
        return route.fulfill({ contentType: "application/javascript", body: "" });
      }
      if (url.hostname === "api.web3forms.com") {
        submissions++;
        await new Promise((resolve) => setTimeout(resolve, 30));
        if (responseMode === "network") return route.abort();
        return route.fulfill({
          status: responseMode === "http" ? 500 : 200,
          contentType: "application/json",
          body: responseMode === "json" ? "invalid-json" : JSON.stringify({ success: responseMode !== "rejected" }),
        });
      }
      if (url.hostname !== host) return route.abort();
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      const file = path.resolve(output, "." + pathname);
      if (!file.startsWith(output + path.sep)) return route.abort();
      try {
        // Supply a dummy provider key only in this isolated test fixture.
        if (pathname === "/contact/index.html") {
          const body = (await fs.readFile(file, "utf8"))
            .replace(/name="access_key"\s+value="[^"]*"/, 'name="access_key" value="isolated-test-key"');
          return route.fulfill({ contentType: "text/html", body });
        }
        return route.fulfill({ path: file });
      } catch { return route.abort(); }
    });
    const page = await context.newPage();
    await page.goto(`https://${host}${options.route || "/contact/?service=plumbing&email=private%40example.test#private"}`,
      { referer: "https://referrer.test/path/?email=private%40example.test#secret" });
    await page.waitForLoadState("load");
    const events = (name) => commands.filter((c) => c[0] === "event" && (!name || c[1] === name));
    const fillForm = async () => {
      await page.locator('[name="name"]').fill("Private Test Name");
      await page.locator('[name="email"]').fill("private@example.test");
      await page.locator('[name="phone"]').fill("5551234567");
      await page.locator('[name="service"]').selectOption({ index: 1 });
      await page.locator('[name="message"]').fill("Private inquiry content");
    };
    const submit = () => page.locator("#cs-form-265").evaluate((form) => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    return { context, page, commands, googleRequests, events, fillForm, submit,
      submissions: () => submissions, mode: (value) => { responseMode = value; } };
  }
  try {
    const f = await fixture();
    await f.page.waitForFunction(() => window.__squadVAnalytics);
    assert.equal(f.events("page_view").length, 1);
    assert.equal(f.commands.filter((c) => c[0] === "config").length, 1);
    assert.equal(f.commands.find((c) => c[0] === "config")[2].send_page_view, false);
    assert.deepEqual(f.commands[0], ["set", "send_page_view", false]);
    assert.equal(f.events("page_view")[0][2].page_title, await f.page.title());
    assert.equal(f.events("page_view")[0][2].page_location, "https://www.squadvplumbing.ca/contact/");
    assert.equal(f.events("page_view")[0][2].page_referrer, "https://referrer.test/path/");
    await f.page.addScriptTag({ url: "/assets/js/analytics.js" });
    assert.equal(f.events("page_view").length, 1, "Repeated initialization must not duplicate pageviews");
    assert.equal(f.googleRequests.length, 1);
    await f.page.locator('a[href^="tel:"]').filter({ visible: true }).first().click();
    await f.page.locator('a[href^="mailto:"]').filter({ visible: true }).first().click();
    assert.equal(f.events("phone_click").length, 1);
    assert.equal(f.events("email_click").length, 1);
    await f.page.evaluate(() => { location.hash = "another-private-fragment"; });
    assert.equal(f.events("page_view").length, 1);
    await f.submit();
    assert.equal(f.submissions(), 0, "Invalid forms must not submit or emit leads");
    await f.fillForm();
    for (const mode of ["rejected", "http", "json", "network"]) {
      f.mode(mode);
      await f.submit();
      await f.page.waitForFunction(() => !document.querySelector("#cs-form-265").hasAttribute("aria-busy"));
      assert.equal(f.events("generate_lead").length, 0, `${mode} failure must not emit a lead`);
      assert.equal(await f.page.locator('button[type="submit"]').isEnabled(), true);
    }
    f.mode("success");
    const before = f.submissions();
    await f.page.locator("#cs-form-265").evaluate((form) => {
      for (let i = 0; i < 2; i++) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await f.page.waitForURL("**/thank-you/");
    assert.equal(f.submissions(), before + 1, "Duplicate submit must send one provider request");
    assert.equal(f.events("generate_lead").length, 1);
    assert.equal(f.events("generate_lead")[0][2].form_id, "request-service");
    assert.equal(f.events("generate_lead")[0][2].page_location, "https://www.squadvplumbing.ca/contact/");
    await f.page.reload();
    assert.equal(f.events("generate_lead").length, 1, "Thank-you reload must not emit a lead");
    assert.ok(f.events("page_view").some((c) => c[2].page_location.endsWith("/thank-you/")));
    await f.page.goto("https://www.squadvplumbing.ca/services/");
    await f.page.goBack();
    assert.ok(f.events("page_view").some((c) => c[2].page_location.endsWith("/services/")));
    assert.equal(f.events("page_view").at(-1)[2].page_location, "https://www.squadvplumbing.ca/thank-you/");
    for (const event of f.events()) assert.equal(event[2].send_to, measurementId);
    assert.doesNotMatch(JSON.stringify(f.commands), /Private Test Name|private@|5551234567|Private inquiry|email=|#private|G-VY3HSP8678|GTM-/i);
    await f.context.close();

    const dedup = await fixture("squadvplumbing.ca");
    await dedup.page.evaluate(() => {
      for (let i = 0; i < 2; i++) document.dispatchEvent(new Event("squadv:service-request-accepted"));
    });
    assert.equal(dedup.events("generate_lead").length, 1, "Repeated success notification must emit one lead");
    await dedup.page.reload();
    await dedup.page.evaluate(() => { window.gtag = () => { throw new Error("Analytics blocked"); }; });
    await dedup.fillForm();
    await dedup.submit();
    await dedup.page.waitForURL("**/thank-you/");
    await dedup.context.close();

    for (const host of ["localhost", "squadvplumbinginc.netlify.app", "squadvplumbinginc.pages.dev", "preview.squadvplumbing.ca"]) {
      const excluded = await fixture(host);
      assert.equal(excluded.commands.length, 0, `${host} must not track`);
      assert.equal(excluded.googleRequests.length, 0, `${host} must not load Google`);
      await excluded.context.close();
    }
    const admin = await fixture("www.squadvplumbing.ca", { route: "/admin/" });
    assert.equal(admin.commands.length, 0);
    assert.equal(admin.googleRequests.length, 0);
    await admin.context.close();
    console.log("Analytics checks passed: isolated destination, page/contact events, navigation, form failure/success, deduplication, URL privacy, blocked tracking, and excluded hosts/admin.");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
