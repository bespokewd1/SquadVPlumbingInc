(() => {
  const service = document.querySelector("#service-265");
  if (!service) return;
  const requested = new URLSearchParams(window.location.search).get("service");
  if (requested && Array.from(service.options).some((option) => option.value === requested)) {
    service.value = requested;
  }
})();
