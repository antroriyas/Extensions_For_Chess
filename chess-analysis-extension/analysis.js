export function normalizeScore(scoreObj, colorToMove) {
  if (!scoreObj) return 0;
  if (scoreObj.type === "mate") {
    // Map mate score to large CP for tagging; sign matters
    const cp = 10000 * Math.sign(scoreObj.value);
    return colorToMove === "w" ? cp : -cp;
  }
  const cp = scoreObj.value;
  return colorToMove === "w" ? cp : -cp;
}

export function classifyMoves(evals) {
  // Compute deltas from previous position
  const out = [];
  for (let i = 0; i < evals.length; i++) {
    const prev = i > 0 ? evals[i - 1].score : 0;
    const cur = evals[i].score;
    const delta = cur - prev;

    let tag = "OK";
    if (delta <= -300) tag = "Blunder";
    else if (delta <= -150) tag = "Mistake";
    else if (delta <= -60) tag = "Inaccuracy";

    out.push({ ...evals[i], delta, tag });
  }
  return out;
}

export function computeAccuracy(tagged) {
  // Simple accuracy model: start 100, subtract scaled penalties
  let acc = 100;
  for (const e of tagged) {
    if (e.tag === "Inaccuracy") acc -= 2;
    else if (e.tag === "Mistake") acc -= 6;
    else if (e.tag === "Blunder") acc -= 15;
  }
  return Math.max(0, Math.min(100, Math.round(acc)));
}
