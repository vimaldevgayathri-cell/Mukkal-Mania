// =============================================================================
// MUKKAL-MANIA MASTER ENGINE
// Zero Dependencies | Pure Vanilla JS + HTML5 Canvas
// =============================================================================

// -------------------------------------------------------------
// 1. GLOBAL STATE & BISCUIT CATALOG
// -------------------------------------------------------------
window.MukkalState = {
  currentScene: "INTRO_PAN", // "INTRO_PAN", "MENU", "BISCUIT_SELECT", "GAMEPLAY", "GAMEOVER"
  
  // Customization State: 5 Iconic Round Biscuits
  selectedBiscuit: "oreo",
  biscuitCatalog: {
    oreo: { 
      id: "oreo", 
      name: "Oreo", 
      slideFrame: 0,        // Frame pair 0 in biscuit_slides.png (0 = normal, 1 = highlighted)
      snapMultiplier: 0.6,  // Sturdy / Cream-filled
      soundSFX: "oreo_meme" 
    },
    good_day: { 
      id: "good_day", 
      name: "Good Day", 
      slideFrame: 1,        // Frame pair 1 (2 = normal, 3 = highlighted)
      snapMultiplier: 0.9,  // Standard Crunch
      soundSFX: "goodday_meme" 
    },
    marie: { 
      id: "marie", 
      name: "Marie", 
      slideFrame: 2,        // Frame pair 2 (4 = normal, 5 = highlighted)
      snapMultiplier: 1.3,  // High Soggy / Crumble Risk
      soundSFX: "marie_meme" 
    },
    butter_cookie: { 
      id: "butter_cookie", 
      name: "Butter Cookie", 
      slideFrame: 3,        // Frame pair 3 (6 = normal, 7 = highlighted)
      snapMultiplier: 0.8,  // Soft / Rich
      soundSFX: "butter_meme" 
    },
    plain_round: { 
      id: "plain_round", 
      name: "Plain Round", 
      slideFrame: 4,        // Frame pair 4 (8 = normal, 9 = highlighted)
      snapMultiplier: 1.1,  // Classic Basic Dip
      soundSFX: "plain_meme" 
    }
  },

  // Level 1 Intro Pan Camera Track
  introPan: {
    cameraY: -360,
    targetY: 0,
    speed: 2.5
  },

  // Level 2 Gameplay Physics State
  dipDepth: 0,            // 0 to 100
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
  let assetsLoaded = false;

  // Virtual Canvas Resolution (Scaling Target)
  const VIRTUAL_WIDTH = 640;
  const VIRTUAL_HEIGHT = 360;

  // Hitbox Coordinates for Custom LibreSprite Menu Buttons
  const hitboxes = {
    playBtn: { x: 220, y: 210, w: 200, h: 40 },
    selectBtn: { x: 220, y: 260, w: 200, h: 40 },
    carouselLeft: { x: 80, y: 155, w: 40, h: 60 },
    carouselRight: { x: 520, y: 155, w: 40, h: 60 },
    closeModalBtn: { x: 535, y: 45, w: 30, h: 30 }
  };

  let hoveredButton = null;

  // -------------------------------------------------------------
  // 2. ASSET PIPELINE & SPRITE FRAME SLICER
  // -------------------------------------------------------------
  function loadAssets(callback) {
    const assetManifest = {
      clouds: "assets/sprites/clouds_bg.png",            // Sky layer
      chayaKadam: "assets/sprites/chaya_kadam_bg.png",    // 640x360 tea shop
      titleLogo: "assets/sprites/title_logo.png",        // Main game title
      menuButtons: "assets/sprites/menu_buttons.png",    // Play / Choose Biscuit buttons
      modalBg: "assets/sprites/modal_bg.png",            // Custom frame for carousel
      biscuitSlides: "assets/sprites/biscuit_slides.png",// 10 frames: normal/highlighted pairs
      carouselArrows: "assets/sprites/carousel_arrows.png",
      closeBtn: "assets/sprites/close_btn.png",
      handDipSheet: "assets/sprites/hand_biscuit_dip.png",// Hand dipping animation
      crumbleSheet: "assets/sprites/biscuit_crumble.png"  // Collapse animation
    };

    let loaded = 0;
    const total = Object.keys(assetManifest).length;

    for (let key in assetManifest) {
      sprites[key] = new Image();
      sprites[key].src = assetManifest[key];
      sprites[key].onload = () => {
        loaded++;
        if (loaded === total) {
          assetsLoaded = true;
          console.log("[MukkalEngine] All LibreSprite assets loaded!");
          if (callback) callback();
        }
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

  // -------------------------------------------------------------
  // 3. ENGINE INITIALIZATION & CANVAS INPUTS
  // -------------------------------------------------------------
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

    canvas.addEventListener("click", (e) => {
      const coords = getScaledCanvasCoords(e);
      handleClicks(coords.x, coords.y);
    });

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        if (window.MukkalState.currentScene === "INTRO_PAN") {
          // Skip Intro Pan
          window.MukkalState.introPan.cameraY = 0;
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
    const scaleX = VIRTUAL_WIDTH / rect.width;
    const scaleY = VIRTUAL_HEIGHT / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
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
    }

    if (hoveredButton && hoveredButton !== lastHover && window.MukkalAudio) {
      window.MukkalAudio.playSFX("button_hover");
    }
  }

  function isInside(x, y, box) {
    return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
  }

  // -------------------------------------------------------------
  // 4. SCENE LOGIC & CAROUSEL NAVIGATION
  // -------------------------------------------------------------
  function handleClicks(x, y) {
    if (window.MukkalState.currentScene === "MENU") {
      if (isInside(x, y, hitboxes.playBtn)) {
        if (window.MukkalAudio) window.MukkalAudio.playSFX("button_click");
        startLevel2();
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
    }
  }

  function navigateBiscuitCatalog(direction) {
    const keys = Object.keys(window.MukkalState.biscuitCatalog);
    let index = keys.indexOf(window.MukkalState.selectedBiscuit);
    index = (index + direction + keys.length) % keys.length;
    
    const newBiscuitKey = keys[index];
    window.MukkalState.selectedBiscuit = newBiscuitKey;

    // Play specific meme audio trigger for the selected biscuit!
    const selectedObj = window.MukkalState.biscuitCatalog[newBiscuitKey];
    if (window.MukkalAudio && typeof window.MukkalAudio.playSFX === "function") {
      window.MukkalAudio.playSFX(selectedObj.soundSFX);
    }
  }

  // -------------------------------------------------------------
  // 5. LEVEL 2 DIPPING PHYSICS & RNG PITY SYSTEM
  // -------------------------------------------------------------
  function startLevel2() {
    window.MukkalState.currentScene = "GAMEPLAY";
    window.MukkalState.dipDepth = 0;
    window.MukkalState.isHoldingDip = false;
    window.MukkalState.isCrumbled = false;
    window.MukkalState.isWon = false;
  }

  function startDipping() {
    if (window.MukkalState.isCrumbled || window.MukkalState.isWon) return;

    window.MukkalState.isHoldingDip = true;
    window.MukkalState.dipDepth = 0;

    // 10% MERCY / PITY ROLL: Guaranteed safe run!
    window.MukkalState.isBlessedRun = Math.random() < 0.10;

    if (window.MukkalState.isBlessedRun) {
      window.MukkalState.crumbleThreshold = 999;
    } else {
      const currentBiscuit = window.MukkalState.biscuitCatalog[window.MukkalState.selectedBiscuit];
      const rawRng = Math.floor(Math.random() * 80) + 5;
      window.MukkalState.crumbleThreshold = Math.min(88, rawRng * currentBiscuit.snapMultiplier);
    }
  }

  function stopDipping() {
    if (!window.MukkalState.isHoldingDip) return;
    window.MukkalState.isHoldingDip = false;

    if (!window.MukkalState.isCrumbled) {
      if (window.MukkalState.dipDepth >= 85 || window.MukkalState.isBlessedRun) {
        triggerVictory();
      }
    }
  }

  function triggerRagebaitCrumble() {
    window.MukkalState.isCrumbled = true;
    window.MukkalState.isHoldingDip = false;
    if (window.MukkalAudio && window.MukkalAudio.playMemeFail) {
      window.MukkalAudio.playMemeFail();
    }
  }

  function triggerVictory() {
    window.MukkalState.isWon = true;
    window.MukkalState.isHoldingDip = false;
    window.MukkalState.score += 1000;
    if (window.MukkalAudio && window.MukkalAudio.playVictory) {
      window.MukkalAudio.playVictory();
    }
  }

  // -------------------------------------------------------------
  // 6. MASTER RENDER LOOP
  // -------------------------------------------------------------
  function gameLoop(timestamp) {
    ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    switch (window.MukkalState.currentScene) {
      case "INTRO_PAN":
        renderIntroPanScene();
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
    }

    requestAnimationFrame(gameLoop);
  }

  // --- SCENE 1: INTRO CAMERA PAN ---
  function renderIntroPanScene() {
    const pan = window.MukkalState.introPan;
    pan.cameraY += pan.speed;

    if (!drawSpriteFrame(sprites.chayaKadam, 0, 640, 360, 0, pan.cameraY + 360, 640, 360)) {
      ctx.fillStyle = "#3a86ff";
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = "#ffb703";
      ctx.fillRect(0, pan.cameraY + 360, 640, 360);
    }

    drawSpriteFrame(sprites.clouds, 0, 640, 720, 0, pan.cameraY, 640, 720);

    if (pan.cameraY >= pan.targetY) {
      pan.cameraY = pan.targetY;
      window.MukkalState.currentScene = "MENU";
      if (window.MukkalAudio) window.MukkalAudio.playSFX("title_drop");
    }
  }

  // --- SCENE 2: MAIN MENU & TITLE DROP ---
  function renderMenuScene() {
    drawSpriteFrame(sprites.chayaKadam, 0, 640, 360, 0, 0, 640, 360);
    drawSpriteFrame(sprites.titleLogo, 0, 400, 100, 120, 40, 400, 100);

    const playFrame = hoveredButton === "PLAY" ? 1 : 0;
    const selectFrame = hoveredButton === "SELECT" ? 1 : 0;

    drawSpriteFrame(sprites.menuButtons, playFrame, 200, 40, hitboxes.playBtn.x, hitboxes.playBtn.y, 200, 40);
    drawSpriteFrame(sprites.menuButtons, selectFrame + 2, 200, 40, hitboxes.selectBtn.x, hitboxes.selectBtn.y, 200, 40);
  }

  // --- SCENE 3: BISCUIT CAROUSEL MODAL ---
  function renderBiscuitSelectModal() {
    renderMenuScene();

    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, 640, 360);

    drawSpriteFrame(sprites.modalBg, 0, 520, 300, 60, 30, 520, 300);

    const keys = Object.keys(window.MukkalState.biscuitCatalog);
    const currentKey = window.MukkalState.selectedBiscuit;

    // Side-Scrolling Carousel Engine
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
        // ACTIVE SELECTED SLIDE: Highlighted PNG frame state
        const highlightFrame = itemObj.slideFrame * 2 + 1;
        drawSpriteFrame(sprites.biscuitSlides, highlightFrame, slideW, slideH, posX - 10, centerY - 10, 180, 220);
      } else {
        // INACTIVE SLIDE: Dimmed unselected PNG frame state
        ctx.globalAlpha = 0.4;
        const normalFrame = itemObj.slideFrame * 2;
        drawSpriteFrame(sprites.biscuitSlides, normalFrame, slideW, slideH, posX, centerY, slideW, slideH);
        ctx.globalAlpha = 1.0;
      }
    });

    // Arrow & Close Controls
    const leftArrowFrame = hoveredButton === "PREV_BISCUIT" ? 1 : 0;
    const rightArrowFrame = hoveredButton === "NEXT_BISCUIT" ? 1 : 0;
    const closeFrame = hoveredButton === "CLOSE_MODAL" ? 1 : 0;

    drawSpriteFrame(sprites.carouselArrows, leftArrowFrame, 40, 60, hitboxes.carouselLeft.x, hitboxes.carouselLeft.y, 40, 60);
    drawSpriteFrame(sprites.carouselArrows, rightArrowFrame + 2, 40, 60, hitboxes.carouselRight.x, hitboxes.carouselRight.y, 40, 60);
    drawSpriteFrame(sprites.closeBtn, closeFrame, 30, 30, hitboxes.closeModalBtn.x, hitboxes.closeModalBtn.y, 30, 30);
  }

  // --- SCENE 4: LEVEL 2 GAMEPLAY RENDER & PHYSICS ---
  function updateAndRenderGameplay() {
    if (window.MukkalState.isHoldingDip && !window.MukkalState.isCrumbled && !window.MukkalState.isWon) {
      window.MukkalState.dipDepth += 1.5;

      if (window.MukkalState.dipDepth >= window.MukkalState.crumbleThreshold && !window.MukkalState.isBlessedRun) {
        triggerRagebaitCrumble();
      }

      if (window.MukkalState.dipDepth >= 100 && window.MukkalState.isBlessedRun) {
        triggerVictory();
      }
    }

    drawSpriteFrame(sprites.chayaKadam, 1, 640, 360, 0, 0, 640, 360);

    const currentDepth = Math.min(window.MukkalState.dipDepth, 100);

    if (window.MukkalState.isCrumbled) {
      drawSpriteFrame(sprites.crumbleSheet, 2, 128, 128, 256, 150);
    } else if (window.MukkalState.isWon) {
      drawSpriteFrame(sprites.handDipSheet, 9, 128, 128, 256, 180);
    } else {
      const dipY = 30 + (currentDepth * 1.3);
      const frameIndex = Math.min(Math.floor((currentDepth / 100) * 10), 9);
      drawSpriteFrame(sprites.handDipSheet, frameIndex, 128, 128, 256, dipY);
    }
  }

  window.addEventListener("DOMContentLoaded", init);

  return { init, startLevel2 };
})();