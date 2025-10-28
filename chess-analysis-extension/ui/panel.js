window.addEventListener("load", () => {
  window.parent.postMessage({ type: "CA_READY" }, "*");
});

window.addEventListener("message", (e) => {
  const { type } = e.data || {};
  if (type === "CA_STATE") {
    const { state } = e.data;
    document.getElementById("status").textContent = state.status || "—";
  }
  if (type === "CA_RESULT") {
    render(e.data.data);
  }
});

function render(data) {
  const statusEl = document.getElementById("status");
  statusEl.textContent = "Analysis complete";

  const metaEl = document.getElementById("game-meta");
  const h = data.game.headers || {};
  const title = [h.White, h.Black].filter(Boolean).join(" vs ");
  metaEl.textContent = title || "Unknown players";

  document.getElementById("accuracy").textContent = data.accuracy + "%";

  drawEvalChart(data.evals);
  drawMoves(data.evals);
}

function drawEvalChart(evals) {
  const canvas = document.getElementById("eval-chart");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Axis
  ctx.strokeStyle = "#888";
  ctx.beginPath();
  ctx.moveTo(30, 10);
  ctx.lineTo(30, 170);
  ctx.lineTo(590, 170);
  ctx.stroke();

  // Scale
  const scores = evals.map(e => clamp(e.score, -600, 600));
  const maxAbs = 600;
  const toY = (cp) => 90 - (cp / maxAbs) * 80;
  const toX = (i) => 30 + (i / Math.max(1, evals.length - 1)) * (560);

  // Line
  ctx.strokeStyle = "#4cc9f0";
  ctx.beginPath();
  for (let i = 0; i < scores.length; i++) {
    const x = toX(i);
    const y = toY(scores[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function drawMoves(evals) {
  const list = document.getElementById("moves-list");
  list.innerHTML = "";
  for (let i = 0; i < evals.length; i++) {
    const e = evals[i];
    const li = document.createElement("li");
    li.className = "move-item";
    const tag = document.createElement("span");
    tag.className = "tag " + e.tag;
    tag.textContent = e.tag;

    const text = document.createElement("span");
    text.textContent = `${moveNumberLabel(i, e.color)} ${e.san} | eval: ${formatEval(e.score)} | Δ ${formatEval(e.delta)} | best: ${e.bestmove || "-"}`;

    li.appendChild(tag);
    li.appendChild(text);
    list.appendChild(li);
  }
}

function moveNumberLabel(i, color) {
  const mv = Math.floor(i / 2) + 1;
  return color === "w" ? `${mv}.` : `${mv}...`;
}

function formatEval(cp) {
  if (Math.abs(cp) >= 10000) return `M${Math.abs(Math.round(cp / 10000))}`;
  return (cp >= 0 ? "+" : "") + (cp / 100).toFixed(2);
}
