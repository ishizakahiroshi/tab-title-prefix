let currentSettings = null;

function getApi() {
  if (typeof browser !== "undefined") return browser;
  if (typeof chrome !== "undefined") return chrome;
  return null;
}

function msg(name) {
  const api = getApi();
  return api && api.i18n ? api.i18n.getMessage(name) : name;
}

function localize() {
  document.title = msg("optionsTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = msg(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = msg(el.getAttribute("data-i18n-placeholder"));
  });
}

function showStatus(messageName) {
  const status = document.getElementById("status");
  status.textContent = msg(messageName);
  setTimeout(() => {
    status.textContent = "";
  }, 1800);
}

function renderTemplate(template, context) {
  return template
    .replaceAll("{domain}", context.domain || "")
    .replaceAll("{container}", context.container || "")
    .replaceAll("{name}", context.container || "");
}

function getPreview(match, template) {
  let domain = "example.com";
  const pattern = match && TTPSettings.validateMatchPattern(match) ? match : "https://example.com/*";
  try {
    const host = pattern.split("://")[1].split("/")[0].replace(/^\*\./, "");
    domain = host === "*" ? "example.com" : host;
  } catch (e) {
    domain = "example.com";
  }
  const prefix = renderTemplate(template || "", { domain, container: "Work" });
  return `${prefix}${msg("optionsPreviewTitle")}`;
}

function getValidationMessage(pattern, template) {
  if (!template) return msg("optionsTemplateRequiredError");
  const error = TTPSettings.getMatchPatternError(pattern);
  return error ? msg(`optionsMatchPatternError_${error}`) : "";
}

function setValidation(el, message) {
  el.textContent = message;
}

function requestPermission(request) {
  const api = getApi();
  if (!api || !api.permissions || !api.permissions.request) return Promise.resolve(true);
  if (typeof browser !== "undefined") {
    return api.permissions.request(request).catch(() => false);
  }
  return new Promise((resolve) => {
    api.permissions.request(request, (granted) => {
      resolve(Boolean(granted));
    });
  });
}

function requestHostPermission(pattern) {
  if (typeof chrome === "undefined" || !chrome.permissions) return Promise.resolve(true);
  if (!TTPSettings.validateMatchPattern(pattern)) return Promise.resolve(false);
  return requestPermission({ origins: [pattern] });
}

function notifyRulesChanged() {
  const api = getApi();
  if (!api || !api.runtime || !api.runtime.sendMessage) return;
  const message = { type: "urlRulesChanged" };
  if (typeof browser !== "undefined") {
    api.runtime.sendMessage(message).catch(() => {});
    return;
  }
  api.runtime.sendMessage(message, () => {
    void api.runtime.lastError;
  });
}

function queryActiveTab() {
  const api = getApi();
  if (!api || !api.tabs || !api.tabs.query) return Promise.resolve(null);
  if (typeof browser !== "undefined") {
    return api.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0] || null).catch(() => null);
  }
  return new Promise((resolve) => {
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(api.runtime.lastError ? null : tabs && tabs[0]);
    });
  });
}

async function getCurrentTabPattern() {
  const granted = await requestPermission({ permissions: ["tabs"] });
  if (!granted) return "";
  const tab = await queryActiveTab();
  return tab && tab.url ? TTPSettings.createPatternFromUrl(tab.url) : "";
}

async function saveSettings(settings, statusMessage = "optionsSaved") {
  currentSettings = TTPSettings.normalizeSettings(settings);
  await TTPSettings.storageSet(currentSettings);
  notifyRulesChanged();
  render();
  showStatus(statusMessage);
}

function readBaseSettingsFromForm() {
  return {
    ...currentSettings,
    enabled: document.getElementById("enabled").checked,
    containerRule: {
      enabled: document.getElementById("containerEnabled").checked,
      template: document.getElementById("containerTemplate").value || TTPSettings.DEFAULT_CONTAINER_TEMPLATE,
    },
    urlRulesEnabled: document.getElementById("urlRulesEnabled").checked,
  };
}

async function saveBaseSettings() {
  await saveSettings(readBaseSettingsFromForm());
}

function updateRulePreview(row) {
  const match = row.querySelector(".rule-match").value.trim();
  const template = row.querySelector(".rule-template").value;
  const message = getValidationMessage(match, template);
  setValidation(row.querySelector(".rule-match-error"), message);
  row.querySelector(".rule-preview").textContent = getPreview(match, template);
}

function renderRule(rule, index) {
  const template = document.getElementById("ruleTemplate");
  const row = template.content.firstElementChild.cloneNode(true);
  row.dataset.ruleId = rule.id;
  row.querySelector(".rule-enabled").checked = rule.enabled;
  row.querySelector(".rule-match").value = rule.match;
  row.querySelector(".rule-template").value = rule.template;
  row.querySelector(".rule-enabled-label").textContent = msg("optionsRuleEnabledLabel");
  row.querySelector(".rule-match-label").textContent = msg("optionsRuleMatchLabel");
  row.querySelector(".rule-template-label").textContent = msg("optionsRuleTemplateLabel");
  row.querySelector(".rule-preview-label").textContent = msg("optionsPreviewLabel");
  row.querySelector(".rule-up").textContent = msg("optionsRuleUpButton");
  row.querySelector(".rule-up").disabled = index === 0;
  row.querySelector(".rule-down").textContent = msg("optionsRuleDownButton");
  row.querySelector(".rule-down").disabled = index === currentSettings.urlRules.length - 1;
  row.querySelector(".rule-save").textContent = msg("optionsRuleSaveButton");
  row.querySelector(".rule-delete").textContent = msg("optionsRuleDeleteButton");
  updateRulePreview(row);
  return row;
}

function updateNewRulePreview() {
  const match = document.getElementById("newRuleMatch").value.trim();
  const template = document.getElementById("newRuleTemplate").value;
  setValidation(document.getElementById("newRuleMatchError"), getValidationMessage(match, template));
  document.getElementById("newRulePreview").textContent = getPreview(match, template);
}

function render() {
  document.getElementById("enabled").checked = currentSettings.enabled;
  document.getElementById("containerEnabled").checked = currentSettings.containerRule.enabled;
  document.getElementById("containerTemplate").value = currentSettings.containerRule.template;
  document.getElementById("urlRulesEnabled").checked = currentSettings.urlRulesEnabled !== false;

  const rules = document.getElementById("rules");
  rules.innerHTML = "";
  currentSettings.urlRules.forEach((rule, index) => {
    rules.appendChild(renderRule(rule, index));
  });
  document.getElementById("emptyRules").hidden = currentSettings.urlRules.length > 0;
  updateNewRulePreview();
}

function getRuleFromRow(row) {
  return {
    id: row.dataset.ruleId,
    enabled: row.querySelector(".rule-enabled").checked,
    match: row.querySelector(".rule-match").value.trim(),
    template: row.querySelector(".rule-template").value,
  };
}

async function saveRule(row) {
  const nextRule = getRuleFromRow(row);
  const message = getValidationMessage(nextRule.match, nextRule.template);
  if (message) {
    setValidation(row.querySelector(".rule-match-error"), message);
    showStatus("optionsValidationError");
    return;
  }
  const granted = await requestHostPermission(nextRule.match);
  if (!granted) {
    showStatus("optionsPermissionDenied");
    return;
  }
  const nextSettings = readBaseSettingsFromForm();
  nextSettings.urlRules = currentSettings.urlRules.map((rule) => (rule.id === nextRule.id ? nextRule : rule));
  await saveSettings(nextSettings);
}

async function deleteRule(row) {
  const nextSettings = readBaseSettingsFromForm();
  nextSettings.urlRules = currentSettings.urlRules.filter((rule) => rule.id !== row.dataset.ruleId);
  await saveSettings(nextSettings);
}

async function moveRule(row, offset) {
  const index = currentSettings.urlRules.findIndex((rule) => rule.id === row.dataset.ruleId);
  const nextIndex = index + offset;
  if (index < 0 || nextIndex < 0 || nextIndex >= currentSettings.urlRules.length) return;
  const nextRules = [...currentSettings.urlRules];
  const rule = nextRules[index];
  nextRules.splice(index, 1);
  nextRules.splice(nextIndex, 0, rule);
  const nextSettings = readBaseSettingsFromForm();
  nextSettings.urlRules = nextRules;
  await saveSettings(nextSettings);
}

async function addRule() {
  const match = document.getElementById("newRuleMatch").value.trim();
  const template = document.getElementById("newRuleTemplate").value;
  const message = getValidationMessage(match, template);
  if (message) {
    setValidation(document.getElementById("newRuleMatchError"), message);
    showStatus("optionsValidationError");
    return;
  }
  const granted = await requestHostPermission(match);
  if (!granted) {
    showStatus("optionsPermissionDenied");
    return;
  }
  const nextSettings = readBaseSettingsFromForm();
  nextSettings.urlRules = [
    ...currentSettings.urlRules,
    {
      id: TTPSettings.createRuleId(),
      enabled: true,
      match,
      template,
    },
  ];
  document.getElementById("newRuleMatch").value = "";
  document.getElementById("newRuleTemplate").value = "";
  await saveSettings(nextSettings);
}

async function fillFromCurrentTab() {
  const pattern = await getCurrentTabPattern();
  if (!pattern) {
    showStatus("optionsCurrentTabUnavailable");
    return;
  }
  document.getElementById("newRuleMatch").value = pattern;
  updateNewRulePreview();
}

async function load() {
  currentSettings = await TTPSettings.loadSettings();
  render();
}

document.addEventListener("DOMContentLoaded", () => {
  localize();
  load();
  document.getElementById("enabled").addEventListener("change", saveBaseSettings);
  document.getElementById("containerEnabled").addEventListener("change", saveBaseSettings);
  document.getElementById("containerTemplate").addEventListener("change", saveBaseSettings);
  document.getElementById("urlRulesEnabled").addEventListener("change", saveBaseSettings);
  document.getElementById("addRule").addEventListener("click", addRule);
  document.getElementById("useCurrentTab").addEventListener("click", fillFromCurrentTab);
  document.getElementById("newRuleMatch").addEventListener("input", updateNewRulePreview);
  document.getElementById("newRuleTemplate").addEventListener("input", updateNewRulePreview);
  document.getElementById("rules").addEventListener("input", (event) => {
    const row = event.target.closest(".rule");
    if (row) updateRulePreview(row);
  });
  document.getElementById("rules").addEventListener("click", (event) => {
    const row = event.target.closest(".rule");
    if (!row) return;
    if (event.target.classList.contains("rule-up")) {
      moveRule(row, -1);
    }
    if (event.target.classList.contains("rule-down")) {
      moveRule(row, 1);
    }
    if (event.target.classList.contains("rule-save")) {
      saveRule(row);
    }
    if (event.target.classList.contains("rule-delete")) {
      deleteRule(row);
    }
  });
});
