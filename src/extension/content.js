(function () {
  let settings = null;
  let containerName = null;
  let prefix = "";
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

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function patternToRegExp(pattern) {
    if (!TTPSettings.validateMatchPattern(pattern)) return null;
    const schemeSplit = pattern.split("://");
    const scheme = schemeSplit[0];
    const rest = schemeSplit.slice(1).join("://");
    const slashIndex = rest.indexOf("/");
    const host = rest.slice(0, slashIndex);
    const path = rest.slice(slashIndex);
    const schemePart = scheme === "*" ? "https?" : escapeRegExp(scheme);
    const hostPart = host === "*" ? "[^/]*" : escapeRegExp(host).replaceAll("\\*", "[^/]*");
    const pathPart = escapeRegExp(path).replaceAll("\\*", ".*");
    return new RegExp(`^${schemePart}://${hostPart}${pathPart}$`);
  }

  function matchUrlRule(rule, url) {
    const re = patternToRegExp(rule.match);
    return re ? re.test(url) : false;
  }

  function renderTemplate(template, context) {
    return template
      .replaceAll("{domain}", context.domain || "")
      .replaceAll("{container}", context.container || "")
      .replaceAll("{name}", context.container || "");
  }

  function computePrefix(settings, containerName) {
    if (!settings.enabled) return "";
    const context = {
      container: containerName || "",
      domain: location.hostname || "",
    };
    const parts = [];
    if (settings.containerRule.enabled && containerName) {
      parts.push(renderTemplate(settings.containerRule.template, context));
    }
    const matchedRule = settings.urlRulesEnabled === false
      ? null
      : settings.urlRules.find((rule) => rule.enabled && matchUrlRule(rule, location.href));
    if (matchedRule) {
      parts.push(renderTemplate(matchedRule.template, context));
    }
    return parts.join("");
  }

  function stripKnownPrefix(title) {
    for (const knownPrefix of knownPrefixes) {
      if (knownPrefix && title.startsWith(knownPrefix)) {
        return title.slice(knownPrefix.length);
      }
    }
    return title;
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

  function watchNavigationChanges() {
    ["pushState", "replaceState"].forEach((methodName) => {
      const original = history[methodName];
      history[methodName] = function (...args) {
        const result = original.apply(this, args);
        queueMicrotask(refreshPrefix);
        return result;
      };
    });
    window.addEventListener("popstate", refreshPrefix);
    window.addEventListener("hashchange", refreshPrefix);
  }

  async function init() {
    settings = await TTPSettings.loadSettings();
    if (!settings.enabled) return;

    try {
      containerName = await sendMessage({ type: "getContainerName" });
    } catch (e) {
      containerName = null;
    }

    refreshPrefix();
    watchNavigationChanges();

    const titleEl = document.querySelector("title");
    if (titleEl) {
      new MutationObserver(refreshPrefix).observe(titleEl, { childList: true });
    }
  }

  init();
})();
