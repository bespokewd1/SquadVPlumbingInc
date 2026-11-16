(() => {
  const service = document.querySelector("#service-265");
  const requested = new URLSearchParams(window.location.search).get("service");
  if (service && requested && Array.from(service.options).some((option) => option.value === requested)) {
    service.value = requested;
  }

  const form = document.querySelector("#cs-form-265");
  const status = document.querySelector("#contact-form-status");
  const button = form?.querySelector('button[type="submit"]');
  if (!form || !status || !button) return;

  const buttonLabel = button.textContent;
  let submitting = false;
  let accepted = false;

  function showStatus(message, focus = false) {
    status.hidden = false;
    status.textContent = message;
    if (focus) status.focus();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting || accepted || !form.reportValidity()) return;

    const payload = Object.fromEntries(new FormData(form));
    if (!payload.access_key?.trim()) {
      showStatus("Online requests are temporarily unavailable. Please call or email us using the contact details on this page.", true);
      return;
    }
    if (payload.botcheck) return;

    submitting = true;
    button.disabled = true;
    button.textContent = "Sending...";
    form.setAttribute("aria-busy", "true");
    showStatus("Sending your service request...");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error("Submission not accepted");

      accepted = true;
      button.textContent = "Request sent";
      showStatus("Your request was submitted. Opening the thank-you page...");
      window.location.assign(form.dataset.successUrl);
    } catch (error) {
      if (!accepted) {
        showStatus(error.name === "AbortError"
          ? "We couldn't confirm whether your request was received. Please call or email us before submitting again."
          : "We couldn't confirm your request. Your details are still here. Please try again, or call or email us for help.", true);
      }
    } finally {
      window.clearTimeout(timeout);
      submitting = false;
      form.removeAttribute("aria-busy");
      if (!accepted) {
        button.disabled = false;
        button.textContent = buttonLabel;
      }
    }
  });
})();
