(() => {
  const measurementId = "G-H5H4WMWS2G";
  const productionHosts = new Set(["squadvplumbing.ca", "www.squadvplumbing.ca"]);
  if (window.__squadVAnalytics || !productionHosts.has(window.location.hostname)
    || /^\/(admin|og-image-studio)(\/|$)/.test(window.location.pathname)) return;
  window.__squadVAnalytics = true;

  // Public routes are static. Never include query strings, fragments, or form values.
  function cleanUrl(value) {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.origin + url.pathname : "";
    } catch {
      return "";
    }
  }

  const pageReferrer = cleanUrl(document.referrer);
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  function track(name, parameters = {}) {
    try {
      window.gtag("event", name, {
        send_to: measurementId,
        page_location: cleanUrl(window.location.href),
        page_referrer: pageReferrer,
        transport_type: "beacon",
        ...parameters,
      });
    } catch {
      // Analytics must never interrupt a contact action or accepted inquiry.
    }
  }

  // Suppress automatic pageviews before Google's tag initializes its destinations.
  window.gtag("set", "send_page_view", false);
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: false,
    page_location: cleanUrl(window.location.href),
    page_referrer: pageReferrer,
    page_title: document.title,
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(script);

  // Eleventy uses full document navigation, not a client router.
  track("page_view", { page_title: document.title });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) track("page_view", { page_title: document.title });
  });
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    const href = link?.getAttribute("href")?.trim().toLowerCase();
    if (href?.startsWith("tel:")) track("phone_click");
    else if (href?.startsWith("mailto:")) track("email_click");
  });
  let leadSent = false;
  document.addEventListener("squadv:service-request-accepted", () => {
    if (leadSent) return;
    leadSent = true;
    track("generate_lead", { form_id: "request-service", lead_source: "contact_form" });
  });
})();
