const sourceUrl = document.querySelector("#sourceUrl");
const readCurrent = document.querySelector("#readCurrent");
const compile = document.querySelector("#compile");
const brief = document.querySelector("#brief");
const briefMeta = document.querySelector("#briefMeta");
const status = document.querySelector("#status");
const copyBrief = document.querySelector("#copyBrief");
const insertBrief = document.querySelector("#insertBrief");
const includeTranscript = document.querySelector("#includeTranscript");

let lastExtraction = null;

restoreState();

readCurrent.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  sourceUrl.value = tab?.url || "";
});

compile.addEventListener("click", async () => {
  setBusy(true, "Opening and reading the previous chat...");

  try {
    const url = sourceUrl.value.trim();
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = urlsMatch(url, activeTab?.url)
      ? await extractFromActiveTab(activeTab.id)
      : await chrome.runtime.sendMessage({
          type: "EXTRACT_FROM_URL",
          url
        });

    if (!response?.ok) {
      throw new Error(response?.error || "Could not compile that chat.");
    }

    lastExtraction = response;
    const text = createContinuationBrief(response, includeTranscript.checked);
    brief.value = text;
    updateMeta();
    await chrome.storage.local.set({
      sourceUrl: url,
      includeTranscript: includeTranscript.checked,
      brief: text
    });
    setStatus(`Compiled ${response.messages.length} message sections from ${response.platform}.`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setBusy(false);
  }
});

async function extractFromActiveTab(tabId) {
  if (!tabId) throw new Error("Open the previous chat tab first.");
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  return chrome.tabs.sendMessage(tabId, { type: "EXTRACT_CHAT" });
}

includeTranscript.addEventListener("change", async () => {
  if (lastExtraction) {
    brief.value = createContinuationBrief(lastExtraction, includeTranscript.checked);
    updateMeta();
  }
  await chrome.storage.local.set({ includeTranscript: includeTranscript.checked, brief: brief.value });
});

brief.addEventListener("input", async () => {
  updateMeta();
  await chrome.storage.local.set({ brief: brief.value });
});

copyBrief.addEventListener("click", async () => {
  await navigator.clipboard.writeText(brief.value);
  setStatus("Copied continuation brief.");
});

insertBrief.addEventListener("click", async () => {
  if (!brief.value.trim()) {
    setStatus("Compile or write a brief first.", true);
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("Open the new AI chat tab first.", true);
    return;
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const response = await chrome.tabs.sendMessage(tab.id, { type: "INSERT_BRIEF", text: brief.value });
    if (!response?.ok) {
      throw new Error("I could not find a visible chat input. The brief is still ready to copy.");
    }
    setStatus("Inserted into the current chat input.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

async function restoreState() {
  const saved = await chrome.storage.local.get(["sourceUrl", "includeTranscript", "brief"]);
  sourceUrl.value = saved.sourceUrl || "";
  includeTranscript.checked = saved.includeTranscript !== false;
  brief.value = saved.brief || "";
  updateMeta();
}

function createContinuationBrief(extraction, includeRawTranscript) {
  const messages = extraction.messages || [];
  const allText = messages.map((message) => message.text).join("\n\n");
  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.text);
  const assistantMessages = messages.filter((message) => message.role === "assistant").map((message) => message.text);
  const goalSource = userMessages.length ? userMessages.join("\n") : allText;
  const codeBlocks = messages.flatMap((message) => message.codeBlocks || []).slice(-8);

  const goals = pickSentences(goalSource, [
    "want",
    "need",
    "build",
    "design",
    "create",
    "fix",
    "implement",
    "explain",
    "deploy"
  ], 6);

  const decisions = pickSentences(allText, [
    "decided",
    "choose",
    "chosen",
    "use",
    "approach",
    "architecture",
    "constraint",
    "requirement",
    "must",
    "should"
  ], 8);

  const openItems = pickSentences(allText, [
    "todo",
    "next",
    "remaining",
    "still",
    "error",
    "issue",
    "blocked",
    "missing",
    "follow"
  ], 8);

  const latestAssistant = assistantMessages.at(-1) || "";
  const latestUser = userMessages.at(-1) || messages.at(-1)?.text || "";

  const sections = [
    "Continue this conversation from the previous chat. Do not ask me to repeat context unless something is genuinely missing.",
    "",
    "Previous chat source:",
    `- Platform: ${extraction.platform || "unknown"}`,
    `- Title: ${cleanLine(extraction.title || "Untitled")}`,
    `- URL: ${extraction.url || ""}`,
    "",
    "User goal:",
    listOrFallback(goals, latestUser, "The user wants to continue the work described in the previous chat."),
    "",
    "Important context and decisions:",
    listOrFallback(decisions, allText, "Use the prior conversation as the source of truth."),
    "",
    "Current state:",
    listOrFallback([summarizeLatest(latestAssistant)], latestAssistant, "No assistant state was detected."),
    "",
    "Likely next steps / unresolved items:",
    listOrFallback(openItems, latestUser, "Continue from the latest user request and ask only for missing specifics."),
    "",
    "Relevant code or exact snippets mentioned:",
    codeBlocks.length ? codeBlocks.map((block, index) => `Snippet ${index + 1}:\n${trimToWords(block, 140)}`).join("\n\n") : "- None detected.",
    "",
    "Instruction for this new chat:",
    "- Pick up from this handoff brief as if you had read the original conversation.",
    "- Preserve user preferences and constraints from the prior chat.",
    "- Start by continuing the next useful step, not by summarizing this brief back to me."
  ];

  const baseWordCount = sections.join(" ").split(/\s+/).filter(Boolean).length;
  if (includeRawTranscript || baseWordCount < 300) {
    sections.push("", "Compressed transcript appendix:", compressTranscript(messages));
  }

  return sections.join("\n");
}

function pickSentences(text, keywords, limit) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  const scored = sentences
    .map((sentence, index) => ({
      sentence: cleanLine(sentence),
      index,
      score: keywords.reduce((score, keyword) => {
        return score + (sentence.toLowerCase().includes(keyword) ? 1 : 0);
      }, 0)
    }))
    .filter((item) => item.sentence.length > 35 && item.score > 0)
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((item) => trimToWords(item.sentence, 38));

  return unique(scored);
}

function summarizeLatest(text) {
  if (!text) return "";
  return trimToWords(cleanLine(text), 85);
}

function listOrFallback(items, fallbackText, fallback) {
  const usable = unique(items.filter(Boolean)).slice(0, 8);
  if (usable.length) return usable.map((item) => `- ${item}`).join("\n");
  if (fallbackText && fallbackText.trim().length > 40) return `- ${trimToWords(cleanLine(fallbackText), 60)}`;
  return `- ${fallback}`;
}

function compressTranscript(messages) {
  return messages
    .slice(-24)
    .map((message, index) => {
      const role = message.role === "unknown" ? "message" : message.role;
      return `${index + 1}. ${role}: ${trimToWords(cleanLine(message.text), 70)}`;
    })
    .join("\n");
}

function trimToWords(text, maxWords) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function cleanLine(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^[#*\-\s]+/, "")
    .trim();
}

function unique(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function urlsMatch(left, right) {
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    leftUrl.hash = "";
    rightUrl.hash = "";
    return leftUrl.toString() === rightUrl.toString();
  } catch {
    return false;
  }
}

function updateMeta() {
  const wordCount = brief.value.trim() ? brief.value.trim().split(/\s+/).length : 0;
  briefMeta.textContent = `${wordCount} words`;
}

function setBusy(isBusy, message) {
  compile.disabled = isBusy;
  readCurrent.disabled = isBusy;
  if (message) setStatus(message);
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}
