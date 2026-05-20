const LOAD_TIMEOUT_MS = 18000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "EXTRACT_FROM_URL") {
    extractFromUrl(message.url)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function extractFromUrl(url) {
  if (!isAllowedUrl(url)) {
    throw new Error("Enter a valid http or https chat URL.");
  }

  const tab = await chrome.tabs.create({ url, active: false });

  try {
    await waitForTabLoad(tab.id);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    const response = await readChatWithRetries(tab.id);
    if (!response?.ok) {
      throw new Error(response?.error || "Could not read the chat page.");
    }

    return response;
  } finally {
    if (tab?.id) {
      await chrome.tabs.remove(tab.id).catch(() => {});
    }
  }
}

async function readChatWithRetries(tabId) {
  let lastResponse = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    lastResponse = await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_CHAT" }).catch((error) => ({
      ok: false,
      error: error.message
    }));

    const totalText = (lastResponse?.messages || []).reduce((total, message) => total + (message.text?.length || 0), 0);
    if (lastResponse?.ok && lastResponse.messages?.length >= 2 && totalText > 600) {
      return lastResponse;
    }

    await delay(1500);
  }

  return lastResponse;
}

function isAllowedUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("The previous chat page took too long to load."));
    }, LOAD_TIMEOUT_MS);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1200);
      }
    }

    chrome.tabs.onUpdated.addListener(listener);

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      if (tab?.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1200);
      }
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
