// Very lightweight PGN parser and FEN generator using a simple chess engine state.
// For production, consider using a robust move generator, but this works for analysis sequences.

export function parsePgnToGame(pgn) {
  const headers = {};
  const headerRe = /\[(\w+)\s+"([^"]+)"\]/g;
  let m;
  while ((m = headerRe.exec(pgn)) !== null) {
    headers[m[1]] = m[2];
  }

  const movesSection = pgn
    .replace(/\{[^}]*\}/g, "") // remove comments
    .replace(/\[[^\]]*\]/g, "") // remove headers
    .replace(/(\d+)\.(\s?)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = movesSection.split(" ");
  const moves = [];
  let color = "w";
  for (const t of tokens) {
    if (!t || t === "1-0" || t === "0-1" || t === "1/2-1/2" || t === "*") break;
    moves.push({ san: t, color });
    color = color === "w" ? "b" : "w";
  }

  return { headers, moves };
}

// Minimal board state to produce FENs from SAN.
// Supports common SAN formats; does not validate illegal moves deeply.
export function gameToFenSequence(game) {
  const fenSeq = [];
  const state = initialState();

  for (let i = 0; i < game.moves.length; i++) {
    const san = game.moves[i].san;
    applySan(state, san);
    fenSeq.push(stateToFen(state));
  }

  return fenSeq;
}

function initialState() {
  const board = [];
  // Setup pieces using FEN ranks
  const fenStart = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
  const ranks = fenStart.split("/");
  for (let r = 0; r < 8; r++) {
    const row = [];
    for (const ch of ranks[r]) {
      if (/\d/.test(ch)) {
        for (let k = 0; k < parseInt(ch, 10); k++) row.push(null);
      } else {
        row.push(ch);
      }
    }
    board.push(row);
  }
  return {
    board,
    activeColor: "w",
    castling: { K: true, Q: true, k: true, q: true },
    enPassant: "-",
    halfmove: 0,
    fullmove: 1
  };
}

function stateToFen(s) {
  let rows = [];
  for (let r = 0; r < 8; r++) {
    let row = "";
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = s.board[r][c];
      if (!p) empty++;
      else {
        if (empty > 0) {
          row += String(empty);
          empty = 0;
        }
        row += p;
      }
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }
  const castlingStr =
    (s.castling.K ? "K" : "") +
    (s.castling.Q ? "Q" : "") +
    (s.castling.k ? "k" : "") +
    (s.castling.q ? "q" : "");
  return (
    rows.join("/") +
    " " +
    (s.activeColor === "w" ? "w" : "b") +
    " " +
    (castlingStr ? castlingStr : "-") +
    " " +
    s.enPassant +
    " " +
    s.halfmove +
    " " +
    s.fullmove
  );
}

// NOTE: This SAN handler is simplified; it handles typical moves,
// basic captures, promotions, and castling. For edge cases, consider a full chess move engine.
function applySan(s, san) {
  // Flip color
  const color = s.activeColor;
  const opp = color === "w" ? "b" : "w";
  const isWhite = color === "w";

  // Castling
  if (san === "O-O" || san === "0-0") {
    castle(s, isWhite, true);
    postMove(s);
    return;
  }
  if (san === "O-O-O" || san === "0-0-0") {
    castle(s, isWhite, false);
    postMove(s);
    return;
  }

  // Strip check/mate
  san = san.replace(/[+#]$/, "");

  // Promotion
  let promotion = null;
  const promoMatch = san.match(/=([QRBN])/);
  if (promoMatch) promotion = promoMatch[1];

  // Capture?
  const isCapture = san.includes("x");

  // Piece letter
  let pieceLetter = "P";
  const pieceMatch = san.match(/^[KQRBN]/);
  if (pieceMatch) pieceLetter = pieceMatch[0];

  // Destination square (e.g., e4)
  const sqMatch = san.match(/([a-h][1-8])$/);
  if (!sqMatch) throw new Error("Cannot parse destination from SAN: " + san);
  const dest = algebraicToCoord(sqMatch[1]);

  // Disambiguation file/rank
  const disFileMatch = san.match(/^[KQRBN]?([a-h])x?[a-h][1-8]/);
  const disRankMatch = san.match(/^[KQRBN]?[a-h]?([1-8])x?[a-h][1-8]/);
  const disFile = disFileMatch ? disFileMatch[1] : null;
  const disRank = disRankMatch ? disRankMatch[1] : null;

  // Find source piece
  const source = findSourceForMove(s, pieceLetter, color, dest, {
    isCapture,
    disFile,
    disRank,
    promotion
  });
  if (!source) throw new Error("No source found for SAN: " + san);

  // Execute move
  movePiece(s, source, dest, { isCapture, promotion, pieceLetter, color });
  postMove(s);
}

function postMove(s) {
  s.activeColor = s.activeColor === "w" ? "b" : "w";
  if (s.activeColor === "w") s.fullmove++;
  s.enPassant = "-";
}

function castle(s, isWhite, kingSide) {
  const r = isWhite ? 7 : 0;
  const kingFrom = { r, c: 4 };
  const kingTo = { r, c: kingSide ? 6 : 2 };
  const rookFrom = { r, c: kingSide ? 7 : 0 };
  const rookTo = { r, c: kingSide ? 5 : 3 };
  s.board[kingTo.r][kingTo.c] = isWhite ? "K" : "k";
  s.board[kingFrom.r][kingFrom.c] = null;
  s.board[rookTo.r][rookTo.c] = isWhite ? "R" : "r";
  s.board[rookFrom.r][rookFrom.c] = null;
  if (isWhite) {
    s.castling.K = false;
    s.castling.Q = false;
  } else {
    s.castling.k = false;
    s.castling.q = false;
  }
}

function algebraicToCoord(sq) {
  const file = sq.charCodeAt(0) - 97; // a->0
  const rank = 8 - parseInt(sq[1], 10); // 1->7
  return { r: rank, c: file };
}

function findSourceForMove(s, pieceLetter, color, dest, opts) {
  const candidates = [];
  const targetPieceSet = isWhite(color)
    ? ["P", "N", "B", "R", "Q", "K"]
    : ["p", "n", "b", "r", "q", "k"];
  const pieceChar = pieceToChar(pieceLetter, color);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = s.board[r][c];
      if (p !== pieceChar) continue;
      if (canPieceMove(s, { r, c }, dest, pieceLetter, color, opts)) {
        candidates.push({ r, c });
      }
    }
  }

  // Disambiguation
  if (opts.disFile) {
    const f = opts.disFile.charCodeAt(0) - 97;
    const filtered = candidates.filter((sq) => sq.c === f);
    if (filtered.length) return filtered[0];
  }
  if (opts.disRank) {
    const rr = 8 - parseInt(opts.disRank, 10);
    const filtered = candidates.filter((sq) => sq.r === rr);
    if (filtered.length) return filtered[0];
  }

  return candidates[0] || null;
}

function isWhite(color) {
  return color === "w";
}

function pieceToChar(letter, color) {
  const map = {
    P: isWhite(color) ? "P" : "p",
    N: isWhite(color) ? "N" : "n",
    B: isWhite(color) ? "B" : "b",
    R: isWhite(color) ? "R" : "r",
    Q: isWhite(color) ? "Q" : "q",
    K: isWhite(color) ? "K" : "k"
  };
  return map[letter];
}

// Very simplified move legality; adequate for position progression.
function canPieceMove(s, src, dst, letter, color, opts) {
  const dr = dst.r - src.r;
  const dc = dst.c - src.c;
  const target = s.board[dst.r][dst.c];
  const isCapture = opts.isCapture;
  const w = isWhite(color);

  switch (letter) {
    case "P": {
      // White pawn
      const dir = w ? -1 : 1;
      const startRank = w ? 6 : 1;
      if (isCapture) {
        if (Math.abs(dc) === 1 && dr === dir) return true;
      } else {
        if (dc === 0 && dr === dir && target === null) return true;
        if (dc === 0 && src.r === startRank && dr === 2 * dir && target === null) return true;
      }
      return false;
    }
    case "N":
      return (dr * dr + dc * dc) === 5;
    case "B":
      return Math.abs(dr) === Math.abs(dc);
    case "R":
      return dr === 0 || dc === 0;
    case "Q":
      return dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc);
    case "K":
      return Math.max(Math.abs(dr), Math.abs(dc)) === 1;
    default:
      return false;
  }
}

function movePiece(s, src, dst, { isCapture, promotion, pieceLetter, color }) {
  const piece = s.board[src.r][src.c];
  s.board[dst.r][dst.c] = piece;
  s.board[src.r][src.c] = null;

  // Promotion: overwrite piece
  if (promotion && pieceLetter === "P") {
    s.board[dst.r][dst.c] = pieceToChar(promotion, color);
  }

  // Update castling rights if king/rook moved
  if (piece === "K") {
    s.castling.K = false;
    s.castling.Q = false;
  }
  if (piece === "k") {
    s.castling.k = false;
    s.castling.q = false;
  }
  if (src.r === 7 && src.c === 0) s.castling.Q = false;
  if (src.r === 7 && src.c === 7) s.castling.K = false;
  if (src.r === 0 && src.c === 0) s.castling.q = false;
  if (src.r === 0 && src.c === 7) s.castling.k = false;
}
