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

  function getSchemaVersion(raw) {
    // Anything without a usable schemaVersion is v1 (the v0.1.0 flat {enabled, format} shape).
    const version = raw && typeof raw.schemaVersion === "number" ? raw.schemaVersion : 1;
    return Number.isFinite(version) && version >= 1 ? version : 1;
  }

  function migrateFromV1(raw) {
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

  function readCurrentSchema(raw) {
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

  function normalizeSettings(raw) {
    if (!raw || typeof raw !== "object") return cloneDefaultSettings();
    // Branch on the version explicitly. Only older schemas are migrated; a newer one
    // (e.g. after downgrading the extension) is read with the fields this version knows,
    // so its urlRules survive instead of being wiped by the v1 migration path.
    if (getSchemaVersion(raw) < SCHEMA_VERSION) return migrateFromV1(raw);
    return readCurrentSchema(raw);
  }

  async function loadSettings() {
    let raw = {};
    try {
      raw = await storageGet(null);
    } catch (e) {
      raw = {};
    }
    const settings = normalizeSettings(raw);
    // Persist only when an actual migration happened. Writing back over a newer schema
    // would destroy fields this version does not understand.
    if (!raw || typeof raw !== "object" || getSchemaVersion(raw) < SCHEMA_VERSION) {
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

  function isValidMatchHost(host) {
    if (host === "*") return true;
    // Chrome match-pattern host: either a concrete hostname, or "*." + hostname (no other *).
    if (host.startsWith("*.")) {
      const base = host.slice(2);
      return base.length > 0 && !base.includes("*") && /^[A-Za-z0-9.-]+$/.test(base);
    }
    return !host.includes("*") && /^[A-Za-z0-9.-]+$/.test(host);
  }

  function getMatchPatternError(pattern) {
    if (typeof pattern !== "string" || !pattern.trim()) return "empty";
    const value = pattern.trim();
    const match = value.match(/^(\*|http|https|file):\/\/([^/]+|\*)\/(.*)$/);
    if (!match) return "format";
    if (match[1] === "file") return match[2] === "*" ? "" : "fileHost";
    if (!isValidMatchHost(match[2])) return "host";
    return "";
  }

  function validateMatchPattern(pattern) {
    return !getMatchPatternError(pattern);
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function pathPatternToRegExp(pathPattern) {
    let source = "";
    for (const ch of pathPattern) {
      source += ch === "*" ? ".*" : escapeRegExp(ch);
    }
    return new RegExp(`^${source}$`);
  }

  function hostMatchesPattern(hostname, hostPattern) {
    const host = String(hostname || "").toLowerCase();
    const pattern = String(hostPattern || "").toLowerCase();
    if (pattern === "*") return true;
    if (pattern.startsWith("*.")) {
      const base = pattern.slice(2);
      return host === base || host.endsWith(`.${base}`);
    }
    return host === pattern;
  }

  /**
   * Match a URL string against a Chrome-style match pattern.
   * Uses URL parsing so ports do not break host matching (unlike a full-URL regex).
   * "*.example.com" matches the apex and any subdomain, per Chrome match-pattern rules.
   */
  function urlMatchesPattern(urlValue, pattern) {
    if (!validateMatchPattern(pattern)) return false;
    let url;
    try {
      url = new URL(urlValue);
    } catch (e) {
      return false;
    }

    const value = pattern.trim();
    const schemeEnd = value.indexOf("://");
    const scheme = value.slice(0, schemeEnd);
    const rest = value.slice(schemeEnd + 3);
    const slashIndex = rest.indexOf("/");
    const hostPattern = rest.slice(0, slashIndex);
    const pathPattern = rest.slice(slashIndex);

    if (scheme === "*") {
      if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    } else if (url.protocol !== `${scheme}:`) {
      return false;
    }

    if (scheme === "file") {
      // file:///* — host is always empty in practice; path is the local path.
      return pathPatternToRegExp(pathPattern).test(`${url.pathname}${url.search}`);
    }

    if (!hostMatchesPattern(url.hostname, hostPattern)) return false;
    return pathPatternToRegExp(pathPattern).test(`${url.pathname}${url.search}`);
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
    getSchemaVersion,
    loadSettings,
    normalizeSettings,
    storageSet,
    urlMatchesPattern,
    validateMatchPattern,
  };
})(this);
