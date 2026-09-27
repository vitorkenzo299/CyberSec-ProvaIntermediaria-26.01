async function loadCurrentPage() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  document.querySelector("#page-title").textContent =
    tab?.title || "Página não identificada";
}

loadCurrentPage().catch(() => {
  document.querySelector("#status").textContent =
    "Não foi possível consultar a página atual.";
});

