try {
  importScripts("settings.js");
} catch (e) {
  // settings.js is shared with non-worker contexts; container lookup can still work without it.
}

function getApi() {
  if (typeof browser !== "undefined") return browser;
  if (typeof chrome !== "undefined") return chrome;
  return null;
}

async function getContainerName(tab) {
  if (!tab || !tab.cookieStoreId || tab.cookieStoreId === "firefox-default") {
    return null;
  }
  const api = getApi();
  if (!api || !api.contextualIdentities) {
    return null;
  }
  try {
    const identity = await api.contextualIdentities.get(tab.cookieStoreId);
    return identity ? identity.name : null;
  } catch (e) {
    return null;
  }
}

function isChromeDynamicContentScriptTarget() {
  const api = getApi();
  return typeof chrome !== "undefined" && api && api.scripting && api.permissions;
}

function containsPermission(api, origin) {
  return new Promise((resolve) => {
    api.permissions.contains({ origins: [origin] }, (granted) => {
      resolve(Boolean(granted) && !api.runtime.lastError);
    });
  });
}

async function getGrantedUrlRuleMatches(settings) {
  const api = getApi();
  const matches = [];
  if (!settings || !settings.enabled || settings.urlRulesEnabled === false) return matches;
  const rules = settings.urlRules || [];
  for (const rule of rules) {
    if (!rule.enabled || !TTPSettings.validateMatchPattern(rule.match)) continue;
    if (await containsPermission(api, rule.match)) {
      matches.push(rule.match);
    }
  }
  return [...new Set(matches)];
}

// Serialize dynamic content-script refreshes to avoid unregister/register races
// when onInstalled / onStartup / permissions / options messages fire close together.
let refreshChain = Promise.resolve();

function refreshDynamicContentScripts() {
  refreshChain = refreshChain
    .then(() => refreshDynamicContentScriptsNow())
    .catch(() => {});
  return refreshChain;
}

async function refreshDynamicContentScriptsNow() {
  if (!isChromeDynamicContentScriptTarget()) return;
  if (typeof TTPSettings === "undefined" || !TTPSettings.loadSettings) return;
  const api = getApi();
  if (!api || !api.scripting) return;

  const scriptId = "url-rule-title-prefix";
  try {
    await api.scripting.unregisterContentScripts({ ids: [scriptId] });
  } catch (e) {
    // The script may not have been registered yet.
  }
  const settings = await TTPSettings.loadSettings();
  const matches = await getGrantedUrlRuleMatches(settings);
  if (!matches.length) return;
  await api.scripting.registerContentScripts([{
    id: scriptId,
    matches,
    js: ["settings.js", "content.js"],
    runAt: "document_idle",
    persistAcrossSessions: true,
  }]);
}

const api = getApi();

if (api && api.runtime && api.runtime.onInstalled) {
  api.runtime.onInstalled.addListener(() => {
    refreshDynamicContentScripts();
  });
}

if (api && api.runtime && api.runtime.onStartup) {
  api.runtime.onStartup.addListener(() => {
    refreshDynamicContentScripts();
  });
}

if (api && api.permissions && api.permissions.onAdded) {
  api.permissions.onAdded.addListener(() => {
    refreshDynamicContentScripts();
  });
}

if (api && api.permissions && api.permissions.onRemoved) {
  api.permissions.onRemoved.addListener(() => {
    refreshDynamicContentScripts();
  });
}

if (api && api.runtime && api.runtime.onMessage) {
  api.runtime.onMessage.addListener((message, sender) => {
    if (!message) return;
    if (message.type === "getContainerName") {
      return getContainerName(sender && sender.tab);
    }
    if (message.type === "urlRulesChanged") {
      refreshDynamicContentScripts();
    }
  });
}
