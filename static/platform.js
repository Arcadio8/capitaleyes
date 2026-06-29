const moduleGrid = document.querySelector(".module-grid");
const launchOverlay = document.querySelector("#launch-overlay");
const launchTitle = document.querySelector("#launch-title");

document.querySelectorAll(".module-card").forEach((card) => {
  card.addEventListener("click", (event) => {
    const href = card.getAttribute("href");
    if (!href) return;
    event.preventDefault();
    moduleGrid.classList.add("is-launching");
    card.classList.add("launching");
    launchTitle.textContent = card.dataset.module || card.querySelector("h2")?.textContent || "CapitalEyes";
    launchOverlay.classList.add("active");
    window.setTimeout(() => {
      window.location.href = href;
    }, 620);
  });
});
