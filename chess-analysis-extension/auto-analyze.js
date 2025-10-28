(function () {
  // Auto-analyze finished games on chess.com. This script expects content.js to expose
  // getGamePGN() and startAnalysis() in the page context. It checks a chrome.storage flag
  // `auto_analyze_enabled` (default true) so users can opt out via extension options.

  const CHECK_INTERVAL = 2500; // ms
  const DEBOUNCE_DELAY = 600; // ms delay before starting analysis to allow UI to settle
  let lastAnalyzedPgn = null;
  let intervalId = null;

  function log(...args) {
    try { console.debug("[CA:auto]", ...args); } catch (e) {}
  }

  async function isEnabled() {
    return new Promise((resolve) => {
      if (!chrome || !chrome.storage || !chrome.storage.sync) {
        // If storage isn't available, default to enabled
        resolve(true);
        return;
      }
      chrome.storage.sync.get({ auto_analyze_enabled: true }, (items) => {
        resolve(Boolean(items.auto_analyze_enabled));
      });
    });
  }

  async function checkAndAutoAnalyze() {
    if (typeof getGamePGN !== 'function' || typeof startAnalysis !== 'function') {
      // content.js not yet loaded
      return;
    }

    try {
      const enabled = await isEnabled();
      if (!enabled) return;

      const pgn = await getGamePGN();
      if (!pgn || typeof pgn !== 'string') return;

      // Avoid re-analyzing the same PGN
      if (pgn === lastAnalyzedPgn) return;

      // Detect final result in PGN: 1-0, 0-1, 1/2-1/2 or '*'
      if (/(1-0|0-1|1\/2-1\/2|\*)/.test(pgn)) {
        lastAnalyzedPgn = pgn;
        log('Detected finished game, scheduling analysis');
        setTimeout(() => {
          try {
            startAnalysis();
          } catch (err) {
            console.error('Auto-analyze: failed to start analysis', err);
          }
        }, DEBOUNCE_DELAY);
      }
    } catch (err) {
      // swallow errors to avoid noisy logs
      log('check error', err && err.message ? err.message : err);
    }
  }

  function startAutoChecker() {
    if (intervalId) return;
    checkAndAutoAnalyze();
    intervalId = setInterval(checkAndAutoAnalyze, CHECK_INTERVAL);
    // Also observe DOM mutations to catch quick updates
    try {
      const observer = new MutationObserver(() => checkAndAutoAnalyze());
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      // ignore if observer cannot be created
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    startAutoChecker();
  } else {
    window.addEventListener('DOMContentLoaded', startAutoChecker, { once: true });
  }
})();