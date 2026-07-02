(function () {
  const DEFAULT_FORMAT = "[{name}] ";
  let prefix = "";

  function applyPrefix() {
    if (!prefix) return;
    if (!document.title.startsWith(prefix)) {
      document.title = prefix + document.title;
    }
  }

  function computePrefix(containerName, format) {
    if (!containerName) return "";
    return format.replace("{name}", containerName);
  }

  async function init() {
    let settings = {};
    try {
      settings = await browser.storage.local.get(["enabled", "format"]);
    } catch (e) {
      settings = {};
    }
    const enabled = settings.enabled !== false;
    if (!enabled) return;
    const format = settings.format || DEFAULT_FORMAT;

    let containerName = null;
    try {
      containerName = await browser.runtime.sendMessage({ type: "getContainerName" });
    } catch (e) {
      containerName = null;
    }
    prefix = computePrefix(containerName, format);
    if (!prefix) return;

    applyPrefix();

    const titleEl = document.querySelector("title");
    if (titleEl) {
      new MutationObserver(applyPrefix).observe(titleEl, { childList: true });
    }
  }

  init();
})();
