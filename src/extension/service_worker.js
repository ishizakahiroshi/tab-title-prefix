async function getContainerName(tab) {
  if (!tab || !tab.cookieStoreId || tab.cookieStoreId === "firefox-default") {
    return null;
  }
  try {
    const identity = await browser.contextualIdentities.get(tab.cookieStoreId);
    return identity ? identity.name : null;
  } catch (e) {
    return null;
  }
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== "getContainerName") return;
  return getContainerName(sender.tab);
});
