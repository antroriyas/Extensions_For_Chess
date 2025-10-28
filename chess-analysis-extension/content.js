function injectAnalyzeButton() {
  const toolbar = document.querySelector(".game-controls,.toolbar,.board-controls");
  if (!toolbar || document.getElementById("ca-analyze-btn")) return;

  const btn = document.createElement("button");
  btn.id = "ca-analyze-btn";
  btn.textContent = "Analyze";
  btn.className = "ca-button";
  btn.addEventListener("click", startAnalysis);
  toolbar.appendChild(btn);
}

async function getGamePGN() {
  // Try common PGN containers
  const nodes = [
    ".pgn", ".share-pgn", "textarea.pgn", "[data-pgn]", ".game-pgn"
  ];
  for (const sel of nodes) {
    const el = document.querySelector(sel);
    if (el) {
      const val = el.value || el.textContent || el.getAttribute("data-pgn");
      if (val && val.includes("1.")) return val.trim();
    }
  }

  // Fallback: some pages embed PGN in scripts or via network calls.
  // If not found, ask the user to copy-paste.
  const manual = prompt("PGN not found automatically. Paste PGN here:");
  if (manual) return manual.trim();
  throw new Error("PGN not found");
}

async function startAnalysis() {
  try {
    const pgn = await getGamePGN();
    showPanel();
    setPanelState({ status: "Analyzing locally...", progress: 0 });
    chrome.runtime.sendMessage({ type: "ANALYZE_PGN", pgn }, (res) => {
      if (!res || !res.ok) {
        setPanelState({ status: "Error: " + (res?.error || "Unknown") });
        return;
      }
      renderAnalysis(res);
    });
  } catch (e) {
    showPanel();
    setPanelState({ status: "Error: " + String(e) });
  }
}

function showPanel() {
  if (document.getElementById("ca-panel-container")) return;
  const container = document.createElement("div");
  container.id = "ca-panel-container";

  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("ui/panel.html");
  iframe.className = "ca-panel-iframe";
  container.appendChild(iframe);

  document.body.appendChild(container);

  window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "CA_READY") {
      // Panel ready
    }
  });
}

function setPanelState(state) {
  const iframe = document.querySelector("#ca-panel-container .ca-panel-iframe");
  if (!iframe) return;
  iframe.contentWindow.postMessage({ type: "CA_STATE", state }, "*");
}

function renderAnalysis(res) {
  const iframe = document.querySelector("#ca-panel-container .ca-panel-iframe");
  if (!iframe) return;
  iframe.contentWindow.postMessage({ type: "CA_RESULT", data: res }, "*");
}

const observer = new MutationObserver(() => injectAnalyzeButton());
observer.observe(document.body, { childList: true, subtree: true });
injectAnalyzeButton();
