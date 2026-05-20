(() => {
  if (window.__chatCarryoverLoaded) return;
  window.__chatCarryoverLoaded = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "EXTRACT_CHAT") {
      waitForReadableChat()
        .then(() => sendResponse({ ok: true, ...extractChat() }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    if (message?.type === "INSERT_BRIEF") {
      try {
        const inserted = insertIntoComposer(message.text || "");
        sendResponse({ ok: inserted });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
      return true;
    }

    return false;
  });

  async function waitForReadableChat() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const messages = findConversationNodes().map(nodeToMessage).filter(Boolean);
      const totalText = messages.reduce((total, message) => total + message.text.length, 0);
      if (messages.length >= 2 && totalText > 600) return;
      await delay(750);
    }
  }

  function extractChat() {
    const title = document.title || location.hostname;
    const url = location.href;
    const platform = location.hostname.replace(/^www\./, "");
    const nodes = findConversationNodes();
    const messages = nodes.map(nodeToMessage).filter(Boolean);

    if (messages.length < 2) {
      const fallbackText = readableText(document.body);
      return {
        title,
        url,
        platform,
        messages: chunkFallbackText(fallbackText),
        extractedAt: new Date().toISOString()
      };
    }

    return {
      title,
      url,
      platform,
      messages,
      extractedAt: new Date().toISOString()
    };
  }

  function findConversationNodes() {
    const chatGptNodes = findChatGptMessages();
    if (chatGptNodes.length >= 2) return chatGptNodes;

    const selectors = [
      "[data-message-author-role]",
      "[data-message-id]",
      "[data-testid^='conversation-turn-']",
      "[data-testid*='conversation-turn']",
      "[data-testid*='message']",
      "[class*='message']",
      "[class*='Message']",
      "article",
      "[role='article']",
      "main li",
      "main section"
    ];

    const seen = new Set();
    const candidates = [];

    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        if (seen.has(node)) continue;
        const text = readableText(node);
        if (text.length < 20 || looksLikeChrome(text)) continue;
        seen.add(node);
        candidates.push(node);
      }
    }

    const filtered = candidates.filter((node) => {
      const hasLargerCandidate = candidates.some((other) => {
        if (other === node) return false;
        return other.contains(node) && readableText(other).length < readableText(node).length * 3.5;
      });
      return !hasLargerCandidate;
    });

    return filtered.slice(-80);
  }

  function findChatGptMessages() {
    const roleNodes = Array.from(document.querySelectorAll("[data-message-author-role]"));
    if (roleNodes.length >= 2) return roleNodes.slice(-80);

    const turnNodes = Array.from(document.querySelectorAll("[data-testid^='conversation-turn-']"));
    if (turnNodes.length >= 2) return turnNodes.slice(-80);

    return [];
  }

  function nodeToMessage(node) {
    const text = readableText(node);
    if (!text || text.length < 20) return null;

    return {
      role: detectRole(node, text),
      text,
      codeBlocks: Array.from(node.querySelectorAll("pre, code"))
        .map((code) => code.innerText.trim())
        .filter((value) => value.length > 12)
        .slice(0, 4)
    };
  }

  function detectRole(node, text) {
    const explicitRole = node.getAttribute("data-message-author-role");
    if (explicitRole) return normalizeRole(explicitRole);

    const label = [
      node.getAttribute("aria-label"),
      node.getAttribute("data-testid"),
      node.closest("[data-message-author-role]")?.getAttribute("data-message-author-role"),
      node.className,
      text.slice(0, 80)
    ].join(" ").toLowerCase();

    if (/\b(user|human|you|prompt)\b/.test(label)) return "user";
    if (/\b(assistant|ai|model|response|answer)\b/.test(label)) return "assistant";
    return "unknown";
  }

  function normalizeRole(value) {
    const role = String(value).toLowerCase();
    if (role.includes("user") || role.includes("human")) return "user";
    if (role.includes("assistant") || role.includes("ai") || role.includes("model")) return "assistant";
    return role;
  }

  function readableText(root) {
    if (!root) return "";
    const clone = root.cloneNode(true);
    clone.querySelectorAll("script, style, nav, aside, footer, header, button, svg, canvas, noscript, [aria-hidden='true']").forEach((node) => node.remove());
    const text = clone.innerText || clone.textContent || "";
    return text
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function looksLikeChrome(text) {
    const lower = text.toLowerCase();
    return lower.includes("sign in") && lower.includes("privacy") && lower.length < 250;
  }

  function chunkFallbackText(text) {
    const chunks = [];
    const paragraphs = text.split(/\n{2,}/).filter((line) => line.trim().length > 40);
    let current = "";

    for (const paragraph of paragraphs) {
      if ((current + "\n\n" + paragraph).length > 2200) {
        chunks.push({ role: "unknown", text: current.trim(), codeBlocks: [] });
        current = paragraph;
      } else {
        current += `${current ? "\n\n" : ""}${paragraph}`;
      }
    }

    if (current.trim()) {
      chunks.push({ role: "unknown", text: current.trim(), codeBlocks: [] });
    }

    return chunks.slice(-30);
  }

  function insertIntoComposer(text) {
    const selectors = [
      "textarea",
      "[contenteditable='true']",
      "[role='textbox']",
      "div.ProseMirror",
      "p[contenteditable='true']"
    ];

    const fields = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    const target = fields.find(isVisible);
    if (!target) return false;

    target.focus();

    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
      target.value = text;
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      return true;
    }

    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    return true;
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 80 && rect.height > 20 && style.visibility !== "hidden" && style.display !== "none";
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
