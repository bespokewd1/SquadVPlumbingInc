(() => {
	const text = (element) => element?.textContent.trim().replace(/\s+/g, " ") || "";

	document.querySelectorAll("[data-home-reviews]").forEach((carousel) => {
		if (carousel.hasAttribute("data-enhanced")) return;

		const slides = Array.from(carousel.querySelectorAll("[data-review]"));
		const controls = carousel.querySelector("[data-review-controls]");
		const position = carousel.querySelector("[data-review-position]");
		const status = carousel.querySelector("[data-review-status]");
		const buttons = Array.from(carousel.querySelectorAll("button[data-review-direction]"));
		if (!slides.length || !controls || !position || !status) return;
		if (slides.length > 1 && buttons.length < 2) return;

		let current = 0;
		let animation;
		const show = (index) => {
			current = (index + slides.length) % slides.length;
			slides.forEach((slide, slideIndex) => {
				const active = slideIndex === current;
				slide.setAttribute("aria-hidden", String(!active));
				slide.inert = !active;
			});
			position.textContent = `${current + 1} of ${slides.length}`;
		};

		show(0);
		carousel.setAttribute("data-enhanced", "");
		controls.hidden = slides.length < 2;

		buttons.forEach((button) => {
			button.addEventListener("click", () => {
				const direction = Number(button.dataset.reviewDirection);
				if (direction !== -1 && direction !== 1) return;
				animation?.cancel();
				show(current + direction);
				const active = slides[current];
				const author = text(active.querySelector("[data-review-author]"));
				const rating = active.querySelector("[data-review-rating]")?.getAttribute("aria-label") || "";
				const quote = text(active.querySelector("blockquote"));
				status.textContent = [`Review ${current + 1} of ${slides.length}.`, author && `${author}.`, rating && `${rating}.`, quote].filter(Boolean).join(" ");

				if (typeof active.animate === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
					animation = active.animate(
						[{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }],
						{ duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
					);
				}
			});
		});
	});
})();
