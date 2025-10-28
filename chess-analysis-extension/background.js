import { parsePgnToGame, gameToFenSequence } from "./pgn.js";
import { classifyMoves, computeAccuracy, normalizeScore } from "./analysis.js";

let engineWorker = null;
let ready = false;

function initEngine() {
  if (engineWorker) return engineWorker;
  engineWorker = new Worker(chrome.runtime.getURL("stockfish/stockfish.js"));
  engineWorker.postMessage("uci");
  engineWorker.onmessage = (e) => {
    const msg = String(e.data || "");
    if (msg.includes("uciok")) {
      ready = true;
    }
  };
  return engineWorker;
}

function goDepth(depth) {
  engineWorker.postMessage("go depth " + depth);
}

function setPositionFen(fen) {
  engineWorker.postMessage("position fen " + fen);
}

function waitForBestmove() {
  return new Promise((resolve) => {
    const onMsg = (e) => {
      const msg = String(e.data || "");
      if (msg.startsWith("info ")) {
        // collect evals from "score cp" or "score mate" (no-op here)
        // info lines are processed inside analyzeOne's handler; ignore in this helper
      } else if (msg.startsWith("bestmove")) {
        engineWorker.removeEventListener("message", onMsg);
        resolve(msg);
      }
    };
    engineWorker.addEventListener("message", onMsg);
  });
}

function analyzeOne(depth) {
  return new Promise((resolve) => {
    let score = null;
    let pv = null;
    const onMsg = (e) => {
      const msg = String(e.data || "");
      if (msg.startsWith("info ")) {
        // Parse best line and eval from info
        const sCp = msg.match(/score cp (-?\d+)/);
        const sMate = msg.match(/score mate (-?\d+)/);
        const pvMatch = msg.match(/ pv (.+)$/);
        if (sCp) score = { type: "cp", value: parseInt(sCp[1], 10) };
        else if (sMate) score = { type: "mate", value: parseInt(sMate[1], 10) };
        if (pvMatch) pv = pvMatch[1];
      } else if (msg.startsWith("bestmove")) {
        engineWorker.removeEventListener("message", onMsg);
        resolve({ score, pv, bestmove: msg.split(" ")[1] || null });
      }
    };
    engineWorker.addEventListener("message", onMsg);
    goDepth(depth);
  });
}

async function analyzePositions(fens, depth = 18) {
  initEngine();
  // Wait until ready
  while (!ready) {
    await new Promise((r) => setTimeout(r, 50));
  }
  engineWorker.postMessage("isready");
  engineWorker.postMessage("ucinewgame");

  const results = [];
  for (let i = 0; i < fens.length; i++) {
    setPositionFen(fens[i]);
    const r = await analyzeOne(depth);
    results.push({
      index: i,
      fen: fens[i],
      score: r.score,
      pv: r.pv,
      bestmove: r.bestmove
    });
  }
  return results;
}

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "ANALYZE_PGN") {
    try {
      const game = parsePgnToGame(msg.pgn);
      const fenSeq = gameToFenSequence(game);
      const raw = await analyzePositions(fenSeq, msg.depth || 18);

      // Build move-by-move evals
      const evals = raw.map((r, i) => {
        const whoMoves = game.moves[i]?.color; // "w"/"b"
        const score = normalizeScore(r.score, whoMoves);
        return {
          moveIndex: i,
          fen: r.fen,
          score,
          pv: r.pv,
          bestmove: r.bestmove,
          san: game.moves[i]?.san || "-",
          color: whoMoves
        };
      });

      const tagged = classifyMoves(evals);
      const accuracy = computeAccuracy(tagged);

      sendResponse({
        ok: true,
        game: {
          headers: game.headers,
          moves: game.moves
        },
        evals: tagged,
        accuracy
      });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
    return true; // keep channel open for async
  }
});
