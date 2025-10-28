(function () {
  function findBoardElement() {
    const selectors = ['.board', '.board-wrap', '.board-board', '.cg-board', '.board-layout', '.board-area'];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    const candidates = Array.from(document.querySelectorAll('div'));
    for (const c of candidates) {
      const rect = c.getBoundingClientRect();
      if (rect.width > 120 && rect.height > 120 && rect.width < window.innerWidth) {
        if (c.querySelectorAll('*').length > 40) return c;
      }
    }
    return null;
  }

  function removeOverlay() {
    const ex = document.getElementById('ca-arrow-overlay');
    if (ex) ex.remove();
  }

  function createOverlay(boardRect) {
    removeOverlay();
    const overlay = document.createElement('div');
    overlay.id = 'ca-arrow-overlay';
    overlay.style.position = 'absolute';
    overlay.style.left = boardRect.left + 'px';
    overlay.style.top = boardRect.top + 'px';
    overlay.style.width = boardRect.width + 'px';
    overlay.style.height = boardRect.height + 'px';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = 999999;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', boardRect.width);
    svg.setAttribute('height', boardRect.height);
    svg.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);
    svg.style.overflow = 'visible';

    const defs = document.createElementNS(svgNS, 'defs');
    const marker = document.createElementNS(svgNS, 'marker');
    marker.setAttribute('id', 'ca-arrowhead');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('refX', '0');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M0,0 L6,3 L0,6 L2,3 z');
    path.setAttribute('fill', 'rgba(76, 201, 240, 0.95)');
    marker.appendChild(path);
    defs.appendChild(marker);
    svg.appendChild(defs);

    overlay.appendChild(svg);
    document.body.appendChild(overlay);
    return svg;
  }

  function drawArrowFromTo(svg, x1, y1, x2, y2) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', 'rgba(76, 201, 240, 0.95)');
    line.setAttribute('stroke-width', '6');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('marker-end', 'url(#ca-arrowhead)');
    line.style.filter = 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))';
    svg.appendChild(line);
  }

  function detectOrientation(boardEl) {
    try {
      if (!boardEl) return true;
      const cls = (boardEl.className || '').toString().toLowerCase();
      if (cls.includes('flip') || cls.includes('flipped') || cls.includes('reverse')) return false;
      const dataFlip = boardEl.getAttribute('data-flipped') || boardEl.getAttribute('data-rotation') || '';
      if (dataFlip === '1' || dataFlip === 'true' || dataFlip === 'black') return false;
    } catch (e) {}
    return true; // white at bottom
  }

  function squareToCenter(boardRect, square, orientationWhite) {
    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1], 10);
    let col = file;
    let row = 8 - rank;
    if (!orientationWhite) {
      col = 7 - col;
      row = 7 - row;
    }
    const squareWidth = boardRect.width / 8;
    const squareHeight = boardRect.height / 8;
    const x = (col + 0.5) * squareWidth;
    const y = (row + 0.5) * squareHeight;
    return { x, y };
  }

  function drawArrowForUci(uci) {
    try {
      if (!uci || typeof uci !== 'string' || uci.length < 4) return;
      const from = uci.slice(0,2);
      const to = uci.slice(2,4);
      const boardEl = findBoardElement();
      if (!boardEl) return;
      const rect = boardEl.getBoundingClientRect();
      const svg = createOverlay(rect);
      const orientationWhite = detectOrientation(boardEl);
      const fromC = squareToCenter(rect, from, orientationWhite);
      const toC = squareToCenter(rect, to, orientationWhite);
      drawArrowFromTo(svg, fromC.x, fromC.y, toC.x, toC.y);
      setTimeout(removeOverlay, 8000);
    } catch (e) {
      console.error('CA overlay error', e);
    }
  }

  window.addEventListener('message', (e) => {
    try {
      if (!e.data) return;
      if (e.data.type === 'CA_SHOW_BESTMOVE') {
        drawArrowForUci(e.data.uci || '');
      } else if (e.data.type === 'CA_CLEAR_ARROWS') {
        removeOverlay();
      }
    } catch (err) {}
  });
})();
