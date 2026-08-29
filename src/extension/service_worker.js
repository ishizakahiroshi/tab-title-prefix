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
  // Firefox also defines `chrome`, so Chrome is detected by the absence of `browser`.
  // Firefox uses the static content script declared in manifest.firefox.json instead.
  if (typeof browser !== "undefined" || typeof chrome === "undefined") return false;
  return Boolean(api && api.scripting && api.permissions);
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

function queryAllTabs() {
  const tabsApi = api && api.tabs;
  if (!tabsApi || !tabsApi.query) return Promise.resolve([]);
  if (typeof browser !== "undefined") {
    return tabsApi.query({}).catch(() => []);
  }
  return new Promise((resolve) => {
    tabsApi.query({}, (tabs) => {
      resolve(api.runtime && api.runtime.lastError ? [] : (tabs || []));
    });
  });
}

// Renaming a container never touches storage, so open tabs would keep the old name in
// their prefix. Tell them to re-read it. No extra permission is needed: tabs.query works
// without the "tabs" permission for ids, and tabs.sendMessage rides on host permissions.
async function broadcastContainerChanged() {
  if (!api || !api.tabs || !api.tabs.sendMessage) return;
  const tabs = await queryAllTabs();
  for (const tab of tabs) {
    if (!tab || typeof tab.id !== "number") continue;
    try {
      const result = api.tabs.sendMessage(tab.id, { type: "containerChanged" });
      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }
    } catch (e) {
      // Tabs without our content script (or restricted pages) have no receiver.
    }
  }
}

if (api && api.contextualIdentities && api.contextualIdentities.onUpdated) {
  api.contextualIdentities.onUpdated.addListener(() => {
    broadcastContainerChanged();
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
