(function () {
  let settings = null;
  let containerName = null;
  let prefix = "";
  let lastUrl = location.href;
  const knownPrefixes = new Set();

  function getApi() {
    if (typeof browser !== "undefined") return browser;
    if (typeof chrome !== "undefined") return chrome;
    return null;
  }

  function sendMessage(message) {
    const api = getApi();
    if (!api || !api.runtime || !api.runtime.sendMessage) {
      return Promise.resolve(null);
    }
    if (typeof browser !== "undefined") {
      return api.runtime.sendMessage(message);
    }
    return new Promise((resolve) => {
      api.runtime.sendMessage(message, (response) => {
        resolve(api.runtime.lastError ? null : response);
      });
    });
  }

  function renderTemplate(template, context) {
    return template
      .replaceAll("{domain}", context.domain || "")
      .replaceAll("{container}", context.container || "")
      .replaceAll("{name}", context.container || "");
  }

  function computePrefix(currentSettings, currentContainerName) {
    if (!currentSettings || !currentSettings.enabled) return "";
    const context = {
      container: currentContainerName || "",
      domain: location.hostname || "",
    };
    const parts = [];
    if (currentSettings.containerRule && currentSettings.containerRule.enabled && currentContainerName) {
      parts.push(renderTemplate(currentSettings.containerRule.template, context));
    }
    const matchedRule = currentSettings.urlRulesEnabled === false
      ? null
      : (currentSettings.urlRules || []).find(
        (rule) => rule.enabled && TTPSettings.urlMatchesPattern(location.href, rule.match),
      );
    if (matchedRule) {
      parts.push(renderTemplate(matchedRule.template, context));
    }
    return parts.join("");
  }

  function stripKnownPrefix(title) {
    // Longest match first so a short prefix cannot leave a longer composite prefix half-stripped
    // (e.g. known "[A] " and "[A] [B] " must not strip only "[A] " from "[A] [B] Page").
    let best = "";
    for (const knownPrefix of knownPrefixes) {
      if (knownPrefix && knownPrefix.length > best.length && title.startsWith(knownPrefix)) {
        best = knownPrefix;
      }
    }
    return best ? title.slice(best.length) : title;
  }

  function applyPrefix() {
    const baseTitle = stripKnownPrefix(document.title);
    const nextTitle = prefix ? prefix + baseTitle : baseTitle;
    if (document.title !== nextTitle) {
      document.title = nextTitle;
    }
  }

  function refreshPrefix() {
    prefix = computePrefix(settings, containerName);
    if (prefix) {
      knownPrefixes.add(prefix);
    }
    applyPrefix();
  }

  function refreshIfUrlChanged() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    refreshPrefix();
  }

  function watchNavigationChanges() {
    // Content scripts run in an isolated world in both Firefox and Chrome, so patching
    // history.pushState here would never observe the page's own calls. Instead compare
    // location on the events we do receive (popstate / hashchange) and on head mutations,
    // which an SPA triggers when it swaps the document title after a route change.
    window.addEventListener("popstate", refreshIfUrlChanged);
    window.addEventListener("hashchange", refreshIfUrlChanged);
  }

  function watchTitleChanges() {
    // Observe <head> (not only the current <title> node) so SPA replacements of the
    // title element still get a prefix re-applied, without watching the whole document.
    const root = document.head || document.documentElement;
    if (!root) return;

    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        // A route change may land here before popstate/hashchange (or without either),
        // so re-evaluate the rules when the URL moved, then re-apply the prefix.
        refreshIfUrlChanged();
        applyPrefix();
      });
    };

    new MutationObserver(schedule).observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }

  function watchStorageChanges() {
    const api = getApi();
    if (!api || !api.storage || !api.storage.onChanged) return;
    api.storage.onChanged.addListener((changes, area) => {
      if (area && area !== "local") return;
      // Reload full settings (normalize + migration) rather than patching keys.
      TTPSettings.loadSettings().then((next) => {
        settings = next;
        refreshPrefix();
      }).catch(() => {});
    });
  }

  function watchContainerChanges() {
    const api = getApi();
    if (!api || !api.runtime || !api.runtime.onMessage) return;
    api.runtime.onMessage.addListener((message) => {
      // Renaming a container does not touch storage, so the background script tells
      // open tabs to re-read the name instead of leaving a stale prefix behind.
      if (!message || message.type !== "containerChanged") return;
      sendMessage({ type: "getContainerName" }).then((name) => {
        containerName = name;
        refreshPrefix();
      }).catch(() => {});
    });
  }

  async function init() {
    settings = await TTPSettings.loadSettings();

    try {
      containerName = await sendMessage({ type: "getContainerName" });
    } catch (e) {
      containerName = null;
    }

    // Always wire listeners so re-enable / template edits apply without a full reload.
    refreshPrefix();
    watchNavigationChanges();
    watchTitleChanges();
    watchStorageChanges();
    watchContainerChanges();
  }

  init();
})();
