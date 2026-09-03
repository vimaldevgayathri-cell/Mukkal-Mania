// =============================================================================
// MUKKAL-MANIA MASTER ENGINE (Full 160x100 Background Integration)
// =============================================================================

window.MukkalState = {
  currentScene: "INTRO_PAN", // "INTRO_PAN", "MENU", "BISCUIT_SELECT", "GAMEPLAY", "GAMEOVER", "VICTORY"
  
  selectedBiscuit: "oreo",
  biscuitCatalog: {
    oreo: { id: "oreo", name: "Oreo", slideFrame: 0, snapMultiplier: 0.6, soundSFX: "oreo_meme" },
    good_day: { id: "good_day", name: "Good Day", slideFrame: 1, snapMultiplier: 0.9, soundSFX: "goodday_meme" },
    marie: { id: "marie", name: "Marie", slideFrame: 2, snapMultiplier: 1.3, soundSFX: "marie_meme" },
    butter_cookie: { id: "butter_cookie", name: "Butter Cookie", slideFrame: 3, snapMultiplier: 0.8, soundSFX: "butter_meme" },
    plain_round: { id: "plain_round", name: "Plain Round", slideFrame: 4, snapMultiplier: 1.1, soundSFX: "plain_meme" }
  },

  introAnimation: {
    currentFrame: 0,
    totalFrames: 31,
    frameTimer: 0,
    frameInterval: 80
  },

  dipDepth: 0,
  isHoldingDip: false,
  isCrumbled: false,
  isWon: false,
  isBlessedRun: false,
  crumbleThreshold: 0,
  score: 0
};

window.MukkalEngine = (function () {
  let canvas, ctx;
  const sprites = {};
  let hoveredButton = null;

  const VIRTUAL_WIDTH = 160;
  const VIRTUAL_HEIGHT = 100;

  // Repositioned buttons to sit nicely on top of the stall banner/counter area
  // NOTE: these hitboxes are now INVISIBLE — used only for hover/click detection,
  // since the art already has PLAY / CHOOSE YOUR BISCUIT baked into the background.
  const hitboxes = {
    playBtn: { x: 30, y: 55, w: 100, h: 14 },
    selectBtn: { x: 30, y: 73, w: 100, h: 14 },
    carouselLeft: { x: 10, y: 40, w: 15, h: 20 },
    carouselRight: { x: 135, y: 40, w: 15, h: 20 },
    closeModalBtn: { x: 138, y: 8, w: 12, h: 12 },
    tryAgainBtn: { x: 15, y: 68, w: 60, h: 18 },
    quitBtn: { x: 85, y: 68, w: 60, h: 18 }
  };

  function loadAssets(callback) {
    const assetManifest = {
      loadingIntro: "assets/sprites/loading.png",
      chayaKadam: "assets/sprites/chaya_kadam_bg.png",
      titleLogo: "assets/sprites/title_logo.png",
      menuButtons: "assets/sprites/menu_buttons.png",
      modalBg: "assets/sprites/modal_bg.png",
      biscuitSlides: "assets/sprites/biscuit_slides.png",
      carouselArrows: "assets/sprites/carousel_arrows.png",
      closeBtn: "assets/sprites/close_btn.png",
      handDipSheet: "assets/sprites/hand_biscuit_dip.png",
      crumbleSheet: "assets/sprites/biscuit_crumble.png"
    };

    let loaded = 0;
    const total = Object.keys(assetManifest).length;

    for (let key in assetManifest) {
      sprites[key] = new Image();
      sprites[key].src = assetManifest[key];
      sprites[key].onload = () => {
        loaded++;
        if (loaded === total && callback) callback();
      };
      sprites[key].onerror = () => {
        loaded++;
        if (loaded === total && callback) callback();
      };
    }
  }

  function drawSpriteFrame(image, frameIdx, totalFrames, drawX, drawY, targetW, targetH) {
    if (!image || !image.complete || image.naturalWidth === 0) return false;
    
    const frameW = image.naturalWidth / totalFrames;
    const frameH = image.naturalHeight;
    const sourceX = frameIdx * frameW;

    ctx.drawImage(
      image,
      sourceX, 0, frameW, frameH,
      drawX, drawY, targetW, targetH
    );
    return true;
  }

  function init() {
    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext("2d");
    
    canvas.width = VIRTUAL_WIDTH;
    canvas.height = VIRTUAL_HEIGHT;
    ctx.imageSmoothingEnabled = false;

    loadAssets(() => {
      bindInputEvents();
      requestAnimationFrame(gameLoop);
    });
  }

  function bindInputEvents() {
    canvas.addEventListener("mousemove", (e) => {
      const coords = getScaledCanvasCoords(e);
      checkHoverStates(coords.x, coords.y);
    });

    canvas.addEventListener("mousedown", (e) => {
      if (window.MukkalState.currentScene === "INTRO_PAN") {
        window.MukkalState.currentScene = "MENU";
        return;
      }

      const coords = getScaledCanvasCoords(e);
      handleClicks(coords.x, coords.y);

      if (window.MukkalState.currentScene === "GAMEPLAY") {
        startDipping();
      }
    });

    canvas.addEventListener("mouseup", () => {
      if (window.MukkalState.currentScene === "GAMEPLAY") {
        stopDipping();
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        if (window.MukkalState.currentScene === "INTRO_PAN") {
          window.MukkalState.currentScene = "MENU";
        } else if (window.MukkalState.currentScene === "GAMEPLAY") {
          startDipping();
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "Space" && window.MukkalState.currentScene === "GAMEPLAY") {
        stopDipping();
      }
    });
  }

  function getScaledCanvasCoords(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (VIRTUAL_WIDTH / rect.width),
      y: (event.clientY - rect.top) * (VIRTUAL_HEIGHT / rect.height)
    };
  }

  function checkHoverStates(x, y) {
    let lastHover = hoveredButton;
    hoveredButton = null;

    if (window.MukkalState.currentScene === "MENU") {
      if (isInside(x, y, hitboxes.playBtn)) hoveredButton = "PLAY";
      if (isInside(x, y, hitboxes.selectBtn)) hoveredButton = "SELECT";
    } else if (window.MukkalState.currentScene === "BISCUIT_SELECT") {
      if (isInside(x, y, hitboxes.carouselLeft)) hoveredButton = "PREV_BISCUIT";
      if (isInside(x, y, hitboxes.carouselRight)) hoveredButton = "NEXT_BISCUIT";
      if (isInside(x, y, hitboxes.closeModalBtn)) hoveredButton = "CLOSE_MODAL";
    } else if (window.MukkalState.currentScene === "GAMEOVER" || window.MukkalState.currentScene === "VICTORY") {
      if (isInside(x, y, hitboxes.tryAgainBtn)) hoveredButton = "TRY_AGAIN";
      if (isInside(x, y, hitboxes.quitBtn)) hoveredButton = "QUIT";
    }

    if (hoveredButton && hoveredButton !== lastHover && window.MukkalAudio) {
      window.MukkalAudio.playSFX("button_hover");
    }
  }

  function isInside(x, y, box) {
    return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
  }

  function handleClicks(x, y) {
    if (window.MukkalState.currentScene === "MENU") {
      if (isInside(x, y, hitboxes.playBtn)) {
        if (window.MukkalAudio) window.MukkalAudio.playSFX("button_click");
        startGameplay();
      } else if (isInside(x, y, hitboxes.selectBtn)) {
        if (window.MukkalAudio) window.MukkalAudio.playSFX("button_click");
        window.MukkalState.currentScene = "BISCUIT_SELECT";
      }
    } else if (window.MukkalState.currentScene === "BISCUIT_SELECT") {
      if (isInside(x, y, hitboxes.carouselLeft)) {
        navigateBiscuitCatalog(-1);
      } else if (isInside(x, y, hitboxes.carouselRight)) {
        navigateBiscuitCatalog(1);
      } else if (isInside(x, y, hitboxes.closeModalBtn)) {
        if (window.MukkalAudio) window.MukkalAudio.playSFX("button_click");
        window.MukkalState.currentScene = "MENU";
      }
    } else if (window.MukkalState.currentScene === "GAMEOVER" || window.MukkalState.currentScene === "VICTORY") {
      if (isInside(x, y, hitboxes.tryAgainBtn)) {
        if (window.MukkalAudio) window.MukkalAudio.playSFX("button_click");
        startGameplay();
      } else if (isInside(x, y, hitboxes.quitBtn)) {
        if (window.MukkalAudio) window.MukkalAudio.playSFX("button_click");
        window.MukkalState.currentScene = "MENU";
      }
    }
  }

  function navigateBiscuitCatalog(direction) {
    const keys = Object.keys(window.MukkalState.biscuitCatalog);
    let index = keys.indexOf(window.MukkalState.selectedBiscuit);
    index = (index + direction + keys.length) % keys.length;
    
    const newBiscuitKey = keys[index];
    window.MukkalState.selectedBiscuit = newBiscuitKey;

    const selectedObj = window.MukkalState.biscuitCatalog[newBiscuitKey];
    if (window.MukkalAudio && typeof window.MukkalAudio.playSFX === "function") {
      window.MukkalAudio.playSFX(selectedObj.soundSFX);
    }
  }

  function startGameplay() {
    window.MukkalState.currentScene = "GAMEPLAY";
    window.MukkalState.dipDepth = 0;
    window.MukkalState.isHoldingDip = false;
    window.MukkalState.isCrumbled = false;
    window.MukkalState.isWon = false;

    if (window.MukkalAudio && window.MukkalAudio.playBGM) {
      window.MukkalAudio.playBGM();
    }
  }

  function startDipping() {
    if (window.MukkalState.isCrumbled || window.MukkalState.isWon) return;

    window.MukkalState.isHoldingDip = true;
    window.MukkalState.isBlessedRun = Math.random() < 0.10;

    if (window.MukkalState.isBlessedRun) {
      window.MukkalState.crumbleThreshold = 999;
    } else {
      const currentBiscuit = window.MukkalState.biscuitCatalog[window.MukkalState.selectedBiscuit];
      const rawRng = Math.floor(Math.random() * 70) + 15;
      window.MukkalState.crumbleThreshold = Math.min(85, rawRng * currentBiscuit.snapMultiplier);
    }
  }

  function stopDipping() {
    if (!window.MukkalState.isHoldingDip) return;
    window.MukkalState.isHoldingDip = false;

    if (!window.MukkalState.isCrumbled) {
      if (window.MukkalState.dipDepth >= 50 || window.MukkalState.isBlessedRun) {
        triggerVictory();
      }
    }
  }

  function triggerCrumble() {
    window.MukkalState.isCrumbled = true;
    window.MukkalState.isHoldingDip = false;
    window.MukkalState.currentScene = "GAMEOVER";

    if (window.MukkalAudio && window.MukkalAudio.playMemeFail) {
      window.MukkalAudio.playMemeFail();
    }
  }

  function triggerVictory() {
    window.MukkalState.isWon = true;
    window.MukkalState.isHoldingDip = false;
    window.MukkalState.score += Math.floor(window.MukkalState.dipDepth * 10);
    window.MukkalState.currentScene = "VICTORY";

    if (window.MukkalAudio && window.MukkalAudio.playVictory) {
      window.MukkalAudio.playVictory();
    }
  }

  function gameLoop(timestamp) {
    ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    switch (window.MukkalState.currentScene) {
      case "INTRO_PAN":
      case "MENU":
        renderMenuScene(timestamp);
        break;
      case "BISCUIT_SELECT":
        renderBiscuitSelectModal(timestamp);
        break;
      case "GAMEPLAY":
        updateAndRenderGameplay();
        break;
      case "GAMEOVER":
        renderGameOverScene(false);
        break;
      case "VICTORY":
        renderGameOverScene(true);
        break;
    }

    requestAnimationFrame(gameLoop);
  }

  function renderMenuScene(timestamp) {
    // 1. Uniform background color matching the periwinkle sky (#8d99ae)
    ctx.fillStyle = "#8d99ae";
    ctx.fillRect(0, 0, 160, 100);

    // 2. Render 31-Frame Intro Animation across the full 160x100 canvas
    const anim = window.MukkalState.introAnimation;
    const drawnAnim = drawSpriteFrame(
      sprites.loadingIntro, 
      anim.currentFrame, 
      anim.totalFrames, 
      0, 0, 
      160, 100
    );

    if (window.MukkalState.currentScene === "INTRO_PAN" && drawnAnim) {
      if (!anim.frameTimer) anim.frameTimer = timestamp;
      if (timestamp - anim.frameTimer >= anim.frameInterval) {
        anim.currentFrame++;
        anim.frameTimer = timestamp;

        if (anim.currentFrame >= anim.totalFrames) {
          anim.currentFrame = anim.totalFrames - 1; 
        }
      }
    }

    // 3. Buttons removed — the background art already shows PLAY / CHOOSE YOUR
    // BISCUIT baked in. hitboxes above still drive hover sound + click handling,
    // they're just no longer drawn as orange rectangles.
  }

  function renderBiscuitSelectModal(timestamp) {
    renderMenuScene(timestamp);

    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, 160, 100);

    drawSpriteFrame(sprites.modalBg, 0, 1, 15, 10, 130, 80);

    const keys = Object.keys(window.MukkalState.biscuitCatalog);
    const currentKey = window.MukkalState.selectedBiscuit;

    const slideW = 40;
    const slideH = 50;
    const centerY = 22;
    const activeIndex = keys.indexOf(currentKey);

    [-1, 0, 1].forEach((offset) => {
      const itemIndex = (activeIndex + offset + keys.length) % keys.length;
      const itemKey = keys[itemIndex];
      const itemObj = window.MukkalState.biscuitCatalog[itemKey];

      const posX = 60 + (offset * 35);

      if (offset === 0) {
        ctx.fillStyle = "#ffb703";
        ctx.fillRect(posX - 2, centerY - 2, slideW + 4, slideH + 4);
        ctx.fillStyle = "#023e8a";
        ctx.font = "bold 6px monospace";
        ctx.textAlign = "center";
        ctx.fillText(itemObj.name, posX + 20, centerY + 25);
      } else {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#cccccc";
        ctx.fillRect(posX, centerY, slideW, slideH);
        ctx.globalAlpha = 1.0;
      }
    });

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 8px monospace";
    ctx.fillText("<", hitboxes.carouselLeft.x + 5, hitboxes.carouselLeft.y + 12);
    ctx.fillText(">", hitboxes.carouselRight.x + 5, hitboxes.carouselRight.y + 12);
    ctx.fillText("X", hitboxes.closeModalBtn.x + 3, hitboxes.closeModalBtn.y + 8);
  }

  function updateAndRenderGameplay() {
    if (window.MukkalState.isHoldingDip && !window.MukkalState.isCrumbled && !window.MukkalState.isWon) {
      window.MukkalState.dipDepth += 1.8;

      if (window.MukkalState.dipDepth >= window.MukkalState.crumbleThreshold && !window.MukkalState.isBlessedRun) {
        triggerCrumble();
      }
    }

    ctx.fillStyle = "#1d3557";
    ctx.fillRect(0, 0, 160, 100);
    ctx.fillStyle = "#6c584c";
    ctx.fillRect(65, 60, 30, 25);
    ctx.fillStyle = "#d4a373";
    ctx.fillRect(68, 60, 24, 4);

    const currentDepth = Math.min(window.MukkalState.dipDepth, 100);
    const handY = 5 + (currentDepth * 0.35);

    ctx.fillStyle = "#e0ac69";
    ctx.fillRect(72, handY, 16, 22);
    ctx.fillStyle = "#b08968";
    ctx.beginPath();
    ctx.arc(80, handY + 24, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffb703";
    ctx.font = "bold 6px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE: ${window.MukkalState.score}`, 5, 10);
    ctx.fillText(`HOLD SPACE TO DIP`, 5, 95);
  }

  function renderGameOverScene(isVictory) {
    updateAndRenderGameplay();

    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(20, 15, 120, 70);
    ctx.strokeStyle = isVictory ? "#ffb703" : "#e63946";
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 15, 120, 70);

    ctx.textAlign = "center";
    ctx.font = "bold 8px monospace";

    if (isVictory) {
      ctx.fillStyle = "#ffb703";
      ctx.fillText("PERFECT DIP!", 80, 30);
      ctx.fillStyle = "#ffffff";
      ctx.font = "6px monospace";
      ctx.fillText(`SCORE: ${window.MukkalState.score}`, 80, 42);
    } else {
      ctx.fillStyle = "#e63946";
      ctx.fillText("CRUMBLED!", 80, 30);
      ctx.fillStyle = "#ffffff";
      ctx.font = "5px monospace";
      ctx.fillText("Soggy disaster!", 80, 42);
      ctx.fillText(`SCORE: ${window.MukkalState.score}`, 80, 50);
    }

    ctx.fillStyle = hoveredButton === "TRY_AGAIN" ? "#ffb703" : "#ffffff";
    ctx.fillRect(hitboxes.tryAgainBtn.x, hitboxes.tryAgainBtn.y, hitboxes.tryAgainBtn.w, hitboxes.tryAgainBtn.h);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 5px monospace";
    ctx.fillText("TRY AGAIN", hitboxes.tryAgainBtn.x + 30, hitboxes.tryAgainBtn.y + 11);

    ctx.fillStyle = hoveredButton === "QUIT" ? "#e63946" : "#ffffff";
    ctx.fillRect(hitboxes.quitBtn.x, hitboxes.quitBtn.y, hitboxes.quitBtn.w, hitboxes.quitBtn.h);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 5px monospace";
    ctx.fillText("QUIT", hitboxes.quitBtn.x + 30, hitboxes.quitBtn.y + 11);
  }

  window.addEventListener("DOMContentLoaded", init);

  return { init, startGameplay };
})();