(() => {
  const root = document.querySelector("[data-tabs]");
  const dialog = document.querySelector("[data-gallery-dialog]");
  if (!root || !dialog) return;

  const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
  const panels = Array.from(root.querySelectorAll('[role="tabpanel"]'));
  const tabByCategory = new Map(tabs.map((tab) => [tab.dataset.tab, tab]));
  const panelByCategory = new Map(
    panels.map((panel) => [panel.dataset.panel, panel]),
  );
  const defaultCategory = tabs[0]?.dataset.tab;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const dialogImage = dialog.querySelector("[data-dialog-image]");
  const dialogTitle = dialog.querySelector("[data-dialog-title]");
  const dialogCaption = dialog.querySelector("[data-dialog-caption]");
  const dialogCategory = dialog.querySelector("[data-dialog-category]");
  const dialogCount = dialog.querySelector("[data-dialog-count]");
  const dialogStatus = dialog.querySelector("[data-dialog-status]");
  const dialogCopy = dialog.querySelector("[data-dialog-copy]");
  const dialogPrevious = dialog.querySelector("[data-dialog-prev]");
  const dialogNext = dialog.querySelector("[data-dialog-next]");

  let activeCategory = defaultCategory;
  let currentPhoto = null;
  let returnFocus = null;
  let dialogHistoryEntry = false;
  let panelAnimationTimer = 0;
  let copyResetTimer = 0;

  root.classList.add("is-enhanced");

  function categoryLabel(category) {
    const label = tabByCategory.get(category)?.querySelector("span");
    return label?.textContent.trim() || "Project gallery";
  }

  function updateUrl(category, photo, method = "push") {
    const url = new URL(window.location.href);
    url.searchParams.set("category", category);
    if (photo) {
      url.searchParams.set("photo", photo);
    } else {
      url.searchParams.delete("photo");
    }
    url.hash = "";
    window.history[`${method}State`]({}, "", url);
  }

  function animatePanel(panel) {
    if (reducedMotion.matches) return;

    window.clearTimeout(panelAnimationTimer);
    panel.classList.remove("is-entering");
    window.requestAnimationFrame(() => panel.classList.add("is-entering"));
    panelAnimationTimer = window.setTimeout(
      () => panel.classList.remove("is-entering"),
      300,
    );
  }

  function activateCategory(
    category,
    { focus = false, animate = true, scrollTab = true } = {},
  ) {
    const tab = tabByCategory.get(category);
    const panel = panelByCategory.get(category);
    if (!tab || !panel) return false;

    const changed = activeCategory !== category;
    activeCategory = category;

    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", active ? "true" : "false");
      item.tabIndex = active ? 0 : -1;
    });

    panels.forEach((item) => {
      const active = item === panel;
      item.classList.toggle("is-active", active);
      item.hidden = !active;
    });

    if (changed && animate) animatePanel(panel);
    if (focus) tab.focus();
    if (scrollTab) {
      tab.scrollIntoView({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    }

    panel.querySelectorAll(".cs-blur-up img").forEach((image) => {
      if (image.complete && image.naturalWidth) markLoaded(image);
    });

    return true;
  }

  function itemsForCategory(category) {
    const panel = panelByCategory.get(category);
    return panel
      ? Array.from(panel.querySelectorAll("[data-photo]"))
      : [];
  }

  function findPhoto(category, photoId) {
    return itemsForCategory(category).find(
      (item) => item.dataset.photo === photoId,
    );
  }

  function renderPhoto(item) {
    const category = item.dataset.category;
    const items = itemsForCategory(category);
    const index = items.indexOf(item);
    const thumbnail = item.querySelector("img");
    const description = thumbnail?.alt || "Squad V project photo";
    const fullSource = item.dataset.fullSrc || thumbnail?.src;

    currentPhoto = item;
    activateCategory(category, { animate: false, scrollTab: false });

    dialogImage.classList.add("is-loading");
    dialogImage.dataset.fallbackUsed = "false";
    dialogImage.src = fullSource;
    dialogImage.alt = description;
    dialogTitle.textContent = description;
    dialogCaption.textContent = description;
    dialogCategory.textContent = categoryLabel(category);
    dialogCount.textContent = `Photo ${index + 1} of ${items.length}`;
    dialogStatus.textContent = "";
    dialogPrevious.disabled = items.length < 2;
    dialogNext.disabled = items.length < 2;
  }

  function openPhoto(item, { history = "push", opener = null } = {}) {
    if (!item) return;

    returnFocus = opener;
    renderPhoto(item);

    if (!dialog.open) dialog.showModal();

    if (history) {
      updateUrl(item.dataset.category, item.dataset.photo, history);
      dialogHistoryEntry = history === "push";
    }
  }

  function closeDialogSilently() {
    if (dialog.open) dialog.close();
    currentPhoto = null;
    dialogImage.removeAttribute("src");

    if (returnFocus?.isConnected && !returnFocus.hidden) {
      returnFocus.focus({ preventScroll: true });
    }
    returnFocus = null;
  }

  function requestDialogClose() {
    if (!dialog.open) return;

    if (dialogHistoryEntry) {
      dialogHistoryEntry = false;
      window.history.back();
      return;
    }

    closeDialogSilently();
    updateUrl(activeCategory, null, "replace");
  }

  function showRelativePhoto(direction) {
    if (!currentPhoto) return;

    const category = currentPhoto.dataset.category;
    const items = itemsForCategory(category);
    const currentIndex = items.indexOf(currentPhoto);
    const nextIndex = (currentIndex + direction + items.length) % items.length;
    const item = items[nextIndex];

    renderPhoto(item);
    updateUrl(category, item.dataset.photo, "replace");
  }

  function normalizeLocation() {
    const url = new URL(window.location.href);
    const requestedCategory = url.searchParams.get("category");
    const category = tabByCategory.has(requestedCategory)
      ? requestedCategory
      : defaultCategory;
    const photoId = url.searchParams.get("photo");
    const photo = photoId ? findPhoto(category, photoId) : null;
    const invalidCategory = requestedCategory && requestedCategory !== category;
    const invalidPhoto = photoId && !photo;

    activateCategory(category, {
      animate: false,
      scrollTab: false,
    });

    if (photo) {
      openPhoto(photo, { history: null });
    } else {
      dialogHistoryEntry = false;
      closeDialogSilently();
    }

    if (invalidCategory || invalidPhoto || url.hash) {
      updateUrl(category, photo?.dataset.photo || null, "replace");
    }
  }

  function markLoaded(image) {
    image.closest(".cs-blur-up")?.classList.add("is-loaded");
  }

  async function copyCurrentLink() {
    const link = window.location.href;

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
      } else {
        const field = document.createElement("textarea");
        field.value = link;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        field.remove();
      }

      dialogCopy.textContent = "Copied";
      dialogStatus.textContent = "Link copied to clipboard.";
    } catch {
      dialogStatus.textContent = "Copy failed. Select the address from your browser.";
    }

    window.clearTimeout(copyResetTimer);
    copyResetTimer = window.setTimeout(() => {
      dialogCopy.textContent = "Copy link";
    }, 1800);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", (event) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      const category = tab.dataset.tab;
      activateCategory(category);
      updateUrl(category, null, "push");
    });
  });

  root.addEventListener("keydown", (event) => {
    const currentTab = event.target.closest('[role="tab"]');
    if (!currentTab) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    const currentIndex = tabs.indexOf(currentTab);
    let nextIndex = currentIndex;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    }
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    activateCategory(nextTab.dataset.tab, { focus: true });
    updateUrl(nextTab.dataset.tab, null, "push");
  });

  root.addEventListener("click", (event) => {
    const item = event.target.closest("[data-photo]");
    if (item) {
      openPhoto(item, { opener: item });
      return;
    }

    const moreButton = event.target.closest("[data-gallery-more]");
    if (!moreButton) return;

    const panel = moreButton.closest("[data-panel]");
    const hiddenItems = Array.from(
      panel.querySelectorAll("[data-gallery-extra][hidden]"),
    );
    hiddenItems.slice(0, 24).forEach((galleryItem) => {
      galleryItem.hidden = false;
      const image = galleryItem.querySelector("img");
      if (image?.complete && image.naturalWidth) markLoaded(image);
    });

    const total = panel.querySelectorAll("[data-photo]").length;
    const remaining = panel.querySelectorAll(
      "[data-gallery-extra][hidden]",
    ).length;
    const shown = total - remaining;
    const count = panel.querySelector("[data-gallery-count]");
    if (count) count.textContent = `Showing ${shown} of ${total} photos`;
    if (!remaining) moreButton.hidden = true;
  });

  root.addEventListener(
    "load",
    (event) => {
      if (event.target.matches(".cs-blur-up img")) markLoaded(event.target);
    },
    true,
  );

  root.addEventListener(
    "error",
    (event) => {
      const item = event.target.closest("[data-photo]");
      if (item) item.hidden = true;
    },
    true,
  );

  dialog.querySelector("[data-dialog-close]").addEventListener("click", requestDialogClose);
  dialogPrevious.addEventListener("click", () => showRelativePhoto(-1));
  dialogNext.addEventListener("click", () => showRelativePhoto(1));
  dialogCopy.addEventListener("click", copyCurrentLink);

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestDialogClose();
  });

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showRelativePhoto(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showRelativePhoto(1);
    }
  });

  dialogImage.addEventListener("load", () => {
    dialogImage.classList.remove("is-loading");
  });

  dialogImage.addEventListener("error", () => {
    const thumbnail = currentPhoto?.querySelector("img")?.src;
    const canUseThumbnail =
      thumbnail &&
      dialogImage.dataset.fallbackUsed !== "true" &&
      thumbnail !== dialogImage.src;

    if (canUseThumbnail) {
      dialogImage.dataset.fallbackUsed = "true";
      dialogImage.src = thumbnail;
      dialogStatus.textContent = "Showing the available preview image.";
      return;
    }

    dialogImage.classList.remove("is-loading");
    dialogStatus.textContent = "This image could not be loaded.";
  });

  window.addEventListener("popstate", normalizeLocation);

  root.querySelectorAll(".cs-blur-up img").forEach((image) => {
    if (image.complete && image.naturalWidth) markLoaded(image);
  });

  normalizeLocation();
})();
