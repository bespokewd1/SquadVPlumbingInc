(() => {
	const button = document.getElementById("back-to-top");
	if (!button) return;

	const footer = document.querySelector("footer");
	const nearEndOffset = 240;

	function setVisible(isVisible) {
		button.classList.toggle("is-visible", isVisible);
		button.setAttribute("aria-hidden", isVisible ? "false" : "true");
		button.tabIndex = isVisible ? 0 : -1;
	}

	function handleScroll() {
		const scrollBottom = window.scrollY + window.innerHeight;
		const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
		const footerVisible = footer ? footer.getBoundingClientRect().top <= window.innerHeight : false;
		setVisible(footerVisible || docHeight - scrollBottom <= nearEndOffset);
	}

	button.addEventListener("click", () => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	});

	window.addEventListener("scroll", handleScroll, { passive: true });
	window.addEventListener("resize", handleScroll);
	handleScroll();
})();
