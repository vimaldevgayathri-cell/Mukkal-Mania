gi// ============================================================
// MUKKAL-MANIA — UI (Frontend / Assets laptop owns this file)
// ============================================================
// Zero-conflict rule: everything under window.MukkalUI.
// NOTHING in this file touches CSS or creates DOM buttons/text —
// every visual (title, buttons, carousel cards, HUD) is drawn
// directly onto #gameCanvas using ctx + MukkalEngine.drawSpriteFrame.
// Placeholder rectangles + fillText stand in until LibreSprite
// sheets land in Milestone 2 (swap happens ONLY inside the draw*
// functions below, so nothing else needs to change later).

window.MukkalUI = (function () {

  let canvas, ctx;

  function cacheDom() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
      console.error('[MukkalUI] Missing #gameCanvas — check index.html');
      return;
    }
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
  }

  // ---- Coordinate mapping: DOM click -> canvas pixel space ----
  // Needed because the canvas can be CSS-scaled (border, responsive
  // layout, mobile) while its drawing surface stays 960x540.
  function toCanvasCoords(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  }

  // ---- Screen: INTRO ----
  function drawIntroScreen() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cloud-pan / tea shop art goes here in Milestone 3 via
    // MukkalEngine.drawSpriteFrame(ctx, 'cloudSheet', frame, ...)

    ctx.fillStyle = '#f5e6c8';
    ctx.font = '48px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff3860';
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    ctx.fillText('MUKKAL-MANIA', canvas.width / 2, 120);
    ctx.shadowColor = 'transparent';

    window.MukkalEngine.clearRegions('intro');
    drawButton('intro', 'btnPlay', 240, 420, 200, 50, 'PLAY', () => {
      window.MukkalState.selectedBiscuit = window.MukkalState.selectedBiscuit || 'marie';
      window.MukkalState.currentScreen = 'game';
    });
    drawButton('intro', 'btnChooseBiscuit', 480, 420, 260, 50, 'CHOOSE YOUR BISCUIT', () => {
      window.MukkalState.currentScreen = 'carousel';
    });
  }

  // ---- Screen: BISCUIT CAROUSEL ----
  function drawCarouselScreen() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    window.MukkalEngine.clearRegions('carousel');

    const biscuits = Object.entries(window.MukkalEngine.BISCUITS);
    const cardW = 180, cardH = 220, gap = 24;
    const totalW = biscuits.length * cardW + (biscuits.length - 1) * gap;
    let x = (canvas.width - totalW) / 2;
    const y = 150;

    biscuits.forEach(([key, biscuit]) => {
      const selected = window.MukkalState.selectedBiscuit === key;

      // Placeholder card — swap to drawSpriteFrame(ctx, biscuit.sprite, ...) in Milestone 2/3
      ctx.fillStyle = selected ? '#ffb703' : '#2a2a45';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = '#f5e6c8';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, cardW, cardH);

      ctx.fillStyle = '#f5e6c8';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(biscuit.label, x + cardW / 2, y + cardH - 20);

      window.MukkalEngine.registerRegion('carousel', {
        id: `biscuit_${key}`, x, y, w: cardW, h: cardH,
        onClick: () => {
          window.MukkalState.selectedBiscuit = key;
          window.MukkalState.currentScreen = 'intro';
        },
      });

      x += cardW + gap;
    });

    drawButton('carousel', 'btnCarouselClose', canvas.width / 2 - 100, 440, 200, 50, 'BACK', () => {
      window.MukkalState.currentScreen = 'intro';
    });
  }

  // ---- Screen: GAME (Level 2) ----
  function drawGameScreen() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    window.MukkalEngine.clearRegions('game');

    // Dipping mechanics render here in Milestone 4.

    ctx.fillStyle = '#f5e6c8';
    ctx.font = '18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${window.MukkalState.score}`, 16, 30);
  }

  // ---- Reusable canvas "button" (draws + registers a hit region) ----
  function drawButton(screen, id, x, y, w, h, label, onClick) {
    ctx.fillStyle = '#ff3860';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#f5e6c8';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.textBaseline = 'alphabetic';

    window.MukkalEngine.registerRegion(screen, { id, x, y, w, h, onClick });
  }

  // ---- Screen dispatch ----
  const SCREEN_DRAWERS = {
    intro: drawIntroScreen,
    carousel: drawCarouselScreen,
    game: drawGameScreen,
  };

  function render() {
    const screen = window.MukkalState.currentScreen;
    const draw = SCREEN_DRAWERS[screen];
    if (draw) draw();
    requestAnimationFrame(render);
  }

  // ---- Single canvas click listener drives every "button" ----
  function bindEvents() {
    canvas.addEventListener('click', (evt) => {
      window.MukkalAudio.unlockOnFirstGesture();

      const { x, y } = toCanvasCoords(evt);
      const screen = window.MukkalState.currentScreen;
      const hit = window.MukkalEngine.hitTest(screen, x, y);
      if (hit && hit.onClick) hit.onClick();
    });
  }

  function init() {
    cacheDom();
    if (!canvas) return;
    bindEvents();
    window.MukkalState.currentScreen = 'intro';
    requestAnimationFrame(render);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  window.MukkalUI.init();
});
