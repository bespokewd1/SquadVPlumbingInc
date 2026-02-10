(() => {
  const root = document.querySelector("[data-tabs]");
  if (!root) return;

  const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
  const panels = Array.from(root.querySelectorAll('[role="tabpanel"]'));

  function activate(tab) {
    const target = tab.getAttribute("data-tab");

    tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
      t.tabIndex = active ? 0 : -1;
    });

    panels.forEach((p) => {
      const isTarget = p.getAttribute("data-panel") === target;
      if (isTarget) {
        p.hidden = false;
        // Optional: smooth scroll the panel into view
        // p.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        p.hidden = true;
      }
    });
  }

  // Click
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab));
  });

  // Keyboard support (Left/Right arrows)
  root.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const currentIndex = tabs.findIndex(
      (t) => t.getAttribute("aria-selected") === "true",
    );

    let nextIndex = currentIndex;
    if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (e.key === "Home") nextIndex = 0;
    if (e.key === "End") nextIndex = tabs.length - 1;

    e.preventDefault();
    tabs[nextIndex].focus();
    activate(tabs[nextIndex]);
  });

  // Ensure initial state
  const initiallyActive = tabs.find(
    (t) => t.getAttribute("aria-selected") === "true",
  );
  if (initiallyActive) activate(initiallyActive);
})();
