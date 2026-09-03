// =============================================================================
// MUKKAL-MANIA MASTER ENGINE (With Sprite Fallbacks)
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
    totalFrames: 14,
    frameWidth: 640,
    frameHeight: 360,
    frameTimer: 0,
    frameInterval: 90
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

  const VIRTUAL_WIDTH = 640;
  const VIRTUAL_HEIGHT = 360;

  const hitboxes = {
    playBtn: { x: 220, y: 190, w: 200, h: 40 },
    selectBtn: { x: 220, y: 245, w: 200, h: 40 },
    carouselLeft: { x: 80, y: 155, w: 40, h: 60 },
    carouselRight: { x: 520, y: 155, w: 40, h: 60 },
    closeModalBtn: { x: 535, y: 45, w: 30, h: 30 },
    tryAgainBtn: { x: 140, y: 240, w: 160, h: 45 },
    quitBtn: { x: 340, y: 240, w: 160, h: 45 }
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
        if (key === "loadingIntro") {
          window.MukkalState.introAnimation.totalFrames = Math.floor(sprites[key].naturalWidth / 640) || 14;
        }
        loaded++;
        if (loaded === total && callback) callback();
      };
      sprites[key].onerror = () => {
        loaded++;
        if (loaded === total && callback) callback();
      };
    }
  }

  function drawSpriteFrame(image, frameIdx, frameW, frameH, drawX, drawY, targetW, targetH) {
    if (!image || !image.complete || image.naturalWidth === 0) return false;
    const sourceX = frameIdx * frameW;
    ctx.drawImage(
      image,
      sourceX, 0, frameW, frameH,
      drawX, drawY, targetW || frameW, targetH || frameH
    );
    return true;
  }

  function init() {
    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext("2d");
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
        renderIntroLoadingSequence(timestamp);
        break;
      case "MENU":
        renderMenuScene();
        break;
      case "BISCUIT_SELECT":
        renderBiscuitSelectModal();
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

  function renderIntroLoadingSequence(timestamp) {
    const anim = window.MukkalState.introAnimation;

    const drawn = drawSpriteFrame(
      sprites.loadingIntro, 
      anim.currentFrame, 
      anim.frameWidth, 
      anim.frameHeight, 
      0, 0, 
      VIRTUAL_WIDTH, VIRTUAL_HEIGHT
    );

    if (!drawn) {
      ctx.fillStyle = "#1e1e2f";
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("LOADING CHAYA KADAM...", 320, 180);
      return;
    }

    if (!anim.frameTimer) anim.frameTimer = timestamp;

    if (timestamp - anim.frameTimer >= anim.frameInterval) {
      anim.currentFrame++;
      anim.frameTimer = timestamp;

      if (anim.currentFrame >= anim.totalFrames) {
        window.MukkalState.currentScene = "MENU";
      }
    }
  }

  function renderMenuScene() {
    const drawn = drawSpriteFrame(sprites.chayaKadam, 0, 640, 360, 0, 0, 640, 360);
    if (!drawn) {
      ctx.fillStyle = "#a8dadc";
      ctx.fillRect(0, 0, 640, 240);
      ctx.fillStyle = "#457b9d";
      ctx.fillRect(0, 240, 640, 120);
    }

    drawSpriteFrame(sprites.titleLogo, 0, 400, 100, 120, 40, 400, 100);

    const playFrame = hoveredButton === "PLAY" ? 1 : 0;
    const selectFrame = hoveredButton === "SELECT" ? 1 : 0;

    const drewPlay = drawSpriteFrame(sprites.menuButtons, playFrame, 200, 40, hitboxes.playBtn.x, hitboxes.playBtn.y, 200, 40);
    const drewSelect = drawSpriteFrame(sprites.menuButtons, selectFrame + 2, 200, 40, hitboxes.selectBtn.x, hitboxes.selectBtn.y, 200, 40);

    if (!drewPlay) {
      ctx.fillStyle = hoveredButton === "PLAY" ? "#ffb703" : "#fb8500";
      ctx.fillRect(hitboxes.playBtn.x, hitboxes.playBtn.y, hitboxes.playBtn.w, hitboxes.playBtn.h);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("PLAY", hitboxes.playBtn.x + 100, hitboxes.playBtn.y + 25);
    }

    if (!drewSelect) {
      ctx.fillStyle = hoveredButton === "SELECT" ? "#ffb703" : "#fb8500";
      ctx.fillRect(hitboxes.selectBtn.x, hitboxes.selectBtn.y, hitboxes.selectBtn.w, hitboxes.selectBtn.h);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText("CHOOSE YOUR BISCUIT", hitboxes.selectBtn.x + 100, hitboxes.selectBtn.y + 25);
    }
  }

  function renderBiscuitSelectModal() {
    renderMenuScene();

    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, 640, 360);

    drawSpriteFrame(sprites.modalBg, 0, 520, 300, 60, 30, 520, 300);

    const keys = Object.keys(window.MukkalState.biscuitCatalog);
    const currentKey = window.MukkalState.selectedBiscuit;

    const slideW = 160;
    const slideH = 200;
    const centerY = 85;
    const activeIndex = keys.indexOf(currentKey);

    [-1, 0, 1].forEach((offset) => {
      const itemIndex = (activeIndex + offset + keys.length) % keys.length;
      const itemKey = keys[itemIndex];
      const itemObj = window.MukkalState.biscuitCatalog[itemKey];

      const posX = 240 + (offset * 140);

      if (offset === 0) {
        const highlightFrame = itemObj.slideFrame * 2 + 1;
        const drew = drawSpriteFrame(sprites.biscuitSlides, highlightFrame, slideW, slideH, posX - 10, centerY - 10, 180, 220);
        if (!drew) {
          ctx.fillStyle = "#ffb703";
          ctx.fillRect(posX - 10, centerY - 10, 180, 220);
          ctx.fillStyle = "#023e8a";
          ctx.font = "bold 18px monospace";
          ctx.textAlign = "center";
          ctx.fillText(itemObj.name, posX + 80, centerY + 100);
        }
      } else {
        ctx.globalAlpha = 0.4;
        const normalFrame = itemObj.slideFrame * 2;
        drawSpriteFrame(sprites.biscuitSlides, normalFrame, slideW, slideH, posX, centerY, slideW, slideH);
        ctx.globalAlpha = 1.0;
      }
    });

    drawSpriteFrame(sprites.carouselArrows, hoveredButton === "PREV_BISCUIT" ? 1 : 0, 40, 60, hitboxes.carouselLeft.x, hitboxes.carouselLeft.y, 40, 60);
    drawSpriteFrame(sprites.carouselArrows, (hoveredButton === "NEXT_BISCUIT" ? 1 : 0) + 2, 40, 60, hitboxes.carouselRight.x, hitboxes.carouselRight.y, 40, 60);
    drawSpriteFrame(sprites.closeBtn, hoveredButton === "CLOSE_MODAL" ? 1 : 0, 30, 30, hitboxes.closeModalBtn.x, hitboxes.closeModalBtn.y, 30, 30);
  }

  function updateAndRenderGameplay() {
    if (window.MukkalState.isHoldingDip && !window.MukkalState.isCrumbled && !window.MukkalState.isWon) {
      window.MukkalState.dipDepth += 1.8;

      if (window.MukkalState.dipDepth >= window.MukkalState.crumbleThreshold && !window.MukkalState.isBlessedRun) {
        triggerCrumble();
      }
    }

    const drawnBg = drawSpriteFrame(sprites.chayaKadam, 1, 640, 360, 0, 0, 640, 360);
    if (!drawnBg) {
      ctx.fillStyle = "#1d3557";
      ctx.fillRect(0, 0, 640, 360);
      // Tea Cup Fallback
      ctx.fillStyle = "#6c584c";
      ctx.fillRect(260, 220, 120, 100);
      ctx.fillStyle = "#d4a373";
      ctx.fillRect(270, 220, 100, 15);
    }

    const currentDepth = Math.min(window.MukkalState.dipDepth, 100);
    const handY = 20 + (currentDepth * 1.2);

    const animFrame = Math.min(Math.floor((currentDepth / 100) * 10), 9);
    const drewHand = drawSpriteFrame(sprites.handDipSheet, animFrame, 128, 128, 256, handY);

    if (!drewHand) {
      ctx.fillStyle = "#e0ac69";
      ctx.fillRect(285, handY, 70, 90);
      ctx.fillStyle = "#b08968";
      ctx.beginPath();
      ctx.arc(320, handY + 95, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#ffb703";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE: ${window.MukkalState.score}`, 20, 30);
    ctx.fillText(`HOLD SPACE / CLICK TO DIP`, 20, 340);
  }

  function renderGameOverScene(isVictory) {
    updateAndRenderGameplay();

    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(100, 50, 440, 260);
    ctx.strokeStyle = isVictory ? "#ffb703" : "#e63946";
    ctx.lineWidth = 4;
    ctx.strokeRect(100, 50, 440, 260);

    ctx.textAlign = "center";
    ctx.font = "bold 24px monospace";

    if (isVictory) {
      ctx.fillStyle = "#ffb703";
      ctx.fillText("PERFECT DIP!", 320, 100);
      ctx.fillStyle = "#ffffff";
      ctx.font = "16px monospace";
      ctx.fillText(`SCORE: ${window.MukkalState.score}`, 320, 140);
    } else {
      ctx.fillStyle = "#e63946";
      ctx.fillText("BISCUIT CRUMBLED!", 320, 100);
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px monospace";
      ctx.fillText("Soggy disaster in Chaya Kadam's cup.", 320, 140);
      ctx.fillText(`TOTAL SCORE: ${window.MukkalState.score}`, 320, 170);
    }

    ctx.fillStyle = hoveredButton === "TRY_AGAIN" ? "#ffb703" : "#ffffff";
    ctx.fillRect(hitboxes.tryAgainBtn.x, hitboxes.tryAgainBtn.y, hitboxes.tryAgainBtn.w, hitboxes.tryAgainBtn.h);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 14px monospace";
    ctx.fillText("TRY AGAIN", hitboxes.tryAgainBtn.x + 80, hitboxes.tryAgainBtn.y + 27);

    ctx.fillStyle = hoveredButton === "QUIT" ? "#e63946" : "#ffffff";
    ctx.fillRect(hitboxes.quitBtn.x, hitboxes.quitBtn.y, hitboxes.quitBtn.w, hitboxes.quitBtn.h);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 14px monospace";
    ctx.fillText("JUST QUIT ALR", hitboxes.quitBtn.x + 80, hitboxes.quitBtn.y + 27);
  }

  window.addEventListener("DOMContentLoaded", init);

  return { init, startGameplay };
})();