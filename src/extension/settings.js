(function (global) {
  const SCHEMA_VERSION = 2;
  const DEFAULT_CONTAINER_TEMPLATE = "[{container}] ";
  const DEFAULT_SETTINGS = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    enabled: true,
    containerRule: {
      enabled: true,
      template: DEFAULT_CONTAINER_TEMPLATE,
    },
    urlRulesEnabled: true,
    urlRules: [],
  });

  function getApi() {
    if (typeof browser !== "undefined") return browser;
    if (typeof chrome !== "undefined") return chrome;
    return null;
  }

  function storageGet(keys) {
    const api = getApi();
    if (!api || !api.storage || !api.storage.local) {
      return Promise.resolve({});
    }
    if (typeof browser !== "undefined") {
      return api.storage.local.get(keys);
    }
    return new Promise((resolve) => {
      api.storage.local.get(keys, (result) => {
        resolve(result || {});
      });
    });
  }

  function storageSet(value) {
    const api = getApi();
    if (!api || !api.storage || !api.storage.local) {
      return Promise.resolve();
    }
    if (typeof browser !== "undefined") {
      return api.storage.local.set(value);
    }
    return new Promise((resolve, reject) => {
      api.storage.local.set(value, () => {
        const err = api.runtime && api.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        resolve();
      });
    });
  }

  function cloneDefaultSettings() {
    return {
      schemaVersion: DEFAULT_SETTINGS.schemaVersion,
      enabled: DEFAULT_SETTINGS.enabled,
      containerRule: { ...DEFAULT_SETTINGS.containerRule },
      urlRulesEnabled: DEFAULT_SETTINGS.urlRulesEnabled,
      urlRules: [],
    };
  }

  function cleanTemplate(value, fallback) {
    return typeof value === "string" && value.length > 0 ? value : fallback;
  }

  function cleanRule(rule) {
    if (!rule || typeof rule !== "object") return null;
    const match = typeof rule.match === "string" ? rule.match.trim() : "";
    const template = typeof rule.template === "string" ? rule.template : "";
    if (!match || !template) return null;
    return {
      id: typeof rule.id === "string" && rule.id ? rule.id : createRuleId(),
      enabled: rule.enabled !== false,
      match,
      template,
    };
  }

  function normalizeSettings(raw) {
    const defaults = cloneDefaultSettings();
    if (!raw || typeof raw !== "object") return defaults;

    if (raw.schemaVersion !== SCHEMA_VERSION) {
      return {
        schemaVersion: SCHEMA_VERSION,
        enabled: raw.enabled !== false,
        containerRule: {
          enabled: raw.enabled !== false,
          template: cleanTemplate(raw.format, DEFAULT_CONTAINER_TEMPLATE).replaceAll("{name}", "{container}"),
        },
        urlRulesEnabled: true,
        urlRules: [],
      };
    }

    const urlRules = Array.isArray(raw.urlRules) ? raw.urlRules.map(cleanRule).filter(Boolean) : [];
    return {
      schemaVersion: SCHEMA_VERSION,
      enabled: raw.enabled !== false,
      containerRule: {
        enabled: raw.containerRule && raw.containerRule.enabled !== false,
        template: cleanTemplate(
          raw.containerRule && raw.containerRule.template,
          DEFAULT_CONTAINER_TEMPLATE,
        ).replaceAll("{name}", "{container}"),
      },
      urlRulesEnabled: raw.urlRulesEnabled !== false,
      urlRules,
    };
  }

  async function loadSettings() {
    let raw = {};
    try {
      raw = await storageGet(null);
    } catch (e) {
      raw = {};
    }
    const settings = normalizeSettings(raw);
    if (!raw || raw.schemaVersion !== SCHEMA_VERSION) {
      try {
        await storageSet(settings);
      } catch (e) {
        // Content scripts may run without storage access in a restricted context.
      }
    }
    return settings;
  }

  function createRuleId() {
    return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function getMatchPatternError(pattern) {
    if (typeof pattern !== "string" || !pattern.trim()) return "empty";
    const value = pattern.trim();
    const match = value.match(/^(\*|http|https|file):\/\/([^/]+|\*)\/.*$/);
    if (!match) return "format";
    if (match[1] === "file") return match[2] === "*" ? "" : "fileHost";
    const host = match[2];
    if (host !== "*" && !/^[A-Za-z0-9.*-]+$/.test(host)) return "host";
    return "";
  }

  function validateMatchPattern(pattern) {
    return !getMatchPatternError(pattern);
  }

  function createPatternFromUrl(urlValue) {
    let url;
    try {
      url = new URL(urlValue);
    } catch (e) {
      return "";
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return `${url.protocol}//${url.hostname}/*`;
  }

  global.TTPSettings = {
    SCHEMA_VERSION,
    DEFAULT_CONTAINER_TEMPLATE,
    createRuleId,
    createPatternFromUrl,
    getMatchPatternError,
    loadSettings,
    normalizeSettings,
    storageSet,
    validateMatchPattern,
  };
})(this);
