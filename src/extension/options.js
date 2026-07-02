const DEFAULT_FORMAT = "[{name}] ";

function localize() {
  document.title = browser.i18n.getMessage("optionsTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = browser.i18n.getMessage(el.getAttribute("data-i18n"));
  });
}

async function load() {
  const settings = await browser.storage.local.get(["enabled", "format"]);
  document.getElementById("enabled").checked = settings.enabled !== false;
  document.getElementById("format").value = settings.format || DEFAULT_FORMAT;
}

async function save() {
  const enabled = document.getElementById("enabled").checked;
  const formatInput = document.getElementById("format");
  const format = formatInput.value || DEFAULT_FORMAT;
  formatInput.value = format;
  await browser.storage.local.set({ enabled, format });

  const status = document.getElementById("status");
  status.textContent = browser.i18n.getMessage("optionsSaved");
  setTimeout(() => {
    status.textContent = "";
  }, 1500);
}

document.addEventListener("DOMContentLoaded", () => {
  localize();
  load();
  document.getElementById("enabled").addEventListener("change", save);
  document.getElementById("format").addEventListener("change", save);
});
