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

  handY: 5,
  biscuitState: "regular", // "regular" | "cracked" | "soggy"
  roundOutcome: null,      // "crack" | "soggy" — pre-rolled the moment PLAY is pressed
  roundOutcomeAt: 0,       // performance.now() timestamp when that outcome fires
  roundResolved: false,
  keyPressCount: 0,        // distinct ArrowUp/ArrowDown presses this round — crumble is gated on >= 2
  pendingResultScene: null,// "GAMEOVER" | "VICTORY" — where we go once resultRevealAt passes
  resultRevealAt: 0,       // timestamp when the flashing WON/FAILED text should appear
  resultSceneEntered: false,
  isCrumbled: false,
  isWon: false,
  score: 0
};

window.MukkalEngine = (function () {
  let canvas, ctx;
  const sprites = {};
  let hoveredButton = null;

  const VIRTUAL_WIDTH = 160;
  const VIRTUAL_HEIGHT = 100;

  // --- Gameplay scene layout (all measured directly off the uploaded PNGs) ---
  const HAND_ANCHOR = { x: 38, y: 48 };
  const HAND_DRAW_X = 42; // fixed horizontally — centers the anchor over the cup

  const CUP_DRAW_X = 64;
  const CUP_DRAW_Y = 53;
  const CUP_LIQUID_SURFACE_Y = 19; // measured directly off cup.png pixels

  const HAND_MIN_Y = 5;   // topmost hand position (raised away from cup)
  const HAND_MAX_Y = CUP_DRAW_Y + CUP_LIQUID_SURFACE_Y - HAND_ANCHOR.y; // 53 + 19 - 48 = 24
  const HAND_SPEED = 0.06; // canvas px per ms of key-hold
  const HAND_CONTACT_EPSILON = 0.5; // float-safe tolerance for "has the hand reached HAND_MAX_Y"

  const BISCUIT_DRAW_SIZE = 20; // target size on canvas — fills the 19px green anchor disc
  const BISCUIT_SRC_CROP = { x: 6, y: 7, w: 19, h: 19 };
  // The hand sprite is chroma-keyed clean of its green anchor marker at
  // load time (see chromaKeyGreenAnchor), so this is now just a small
  // safety-net radius for any leftover anti-aliased fringe pixels — not the
  // primary masking mechanism anymore. Kept deliberately small so it
  // doesn't eat into real finger/hand art the way the old large blanket
  // radius did.
  const ANCHOR_SAFETY_PATCH_RADIUS = 6;

  // Edit this to your actual home page URL — used when QUIT is clicked.
  const HOME_PAGE_URL = "/";

  const RESULT_REVEAL_DELAY_MS = 2000; // how long the crumbled/soggy cookie shows before WON/FAILED flashes in

  const CRACK_PROBABILITY = 0.8; // win chance raised to 1 in 5 (20%)
  const OUTCOME_MIN_DELAY_MS = 1200;
  const OUTCOME_MAX_DELAY_MS = 5000;

  const handKeys = { up: false, down: false };
  let lastGameplayTimestamp = null;

  // Measured directly off chayakada.png (160x100): the two orange boxes sit
  // at y 90-99. Left box spans x 35-74, right box spans x 79-118.
  const hitboxes = {
    playBtn: { x: 35, y: 90, w: 39, h: 9 },
    selectBtn: { x: 79, y: 90, w: 39, h: 9 },
    carouselLeft: { x: 10, y: 40, w: 15, h: 20 },
    carouselRight: { x: 135, y: 40, w: 15, h: 20 },
    closeModalBtn: { x: 138, y: 8, w: 12, h: 12 },
    tryAgainBtn: { x: 15, y: 90, w: 60, h: 8 },
    quitBtn: { x: 85, y: 90, w: 60, h: 8 }
  };

  function loadAssets(callback) {
    const assetManifest = {
      loadingIntro: "assets/sprites/loading.png",
      chayaKadam: "assets/sprites/chayakada.png", // static MENU background, buttons baked in
      titleLogo: "assets/sprites/title_logo.png",
      menuButtons: "assets/sprites/menu_buttons.png",
      modalBg: "assets/sprites/modal_bg.png",
      biscuitSlides: "assets/sprites/biscuit_slides.png",
      carouselArrows: "assets/sprites/carousel_arrows.png",
      closeBtn: "assets/sprites/close_btn.png",
      // Gameplay scene assets
      hand: "assets/sprites/hand.png",
      cup: "assets/sprites/cup.png",
      biscuitRegular: "assets/sprites/regular.png",
      biscuitDipped: "assets/sprites/regulardipped.png",
      biscuitCracked: "assets/sprites/regularcracked.png",
      biscuitSoggy: "assets/sprites/regularsoggy.png",
      // NEW: real button art replacing the drawn text labels on MENU.
      // Drop the files at these paths — filenames/paths can be changed here
      // if yours differ.
      playBtnImg: "assets/sprites/play.png",
      weaponBtnImg: "assets/sprites/change.png",
      // NEW this round:
      arrowIndicator: "assets/sprites/arrow.png",       // replaces the "ARROW UP/DOWN TO MOVE" text — decorative, not clickable
      playAgainBtnImg: "assets/sprites/playagain.png",  // replaces "TRY AGAIN" text on GAMEOVER/VICTORY
      quitBtnImg: "assets/sprites/quit.png",            // replaces "QUIT" text on GAMEOVER/VICTORY
      gameBackground: "assets/sprites/gbg.png" // replaces the flat #1d3557 fill behind gameplay
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

  function chromaKeyGreenAnchor(image) {
    // hand.png bakes its green anchor-marker circle directly into the
    // sprite's pixels. Runs once at load time: draws the sprite to an
    // offscreen canvas and makes only the actually-green pixels
    // transparent, leaving every other hand/finger pixel untouched. This
    // replaces the old approach of erasing a big flat circle at draw time,
    // which was removing legitimate hand art around the cookie along with
    // the green (visible as "missing" finger pixels around the biscuit).
    const off = document.createElement("canvas");
    off.width = image.naturalWidth;
    off.height = image.naturalHeight;
    const octx = off.getContext("2d");
    octx.drawImage(image, 0, 0);

    let data;
    try {
      const imageData = octx.getImageData(0, 0, off.width, off.height);
      data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        // Generous "is this greenish" test (not a single exact hex match)
        // so it also catches lightly anti-aliased edge pixels between the
        // green marker and the skin-tone art, without touching the actual
        // skin tones (which are red/orange dominant, not green dominant).
        if (a > 0 && g > 50 && g > r * 1.1 && g > b * 1.1) {
          data[i + 3] = 0;
        }
      }
      octx.putImageData(imageData, 0, 0);
    } catch (e) {
      // If the browser blocks getImageData (e.g. running the file straight
      // off disk with file:// and no local server — a canvas "tainted by
      // cross-origin data" security error), just fall back to the original
      // sprite untouched rather than breaking the whole scene.
      console.warn("[MukkalEngine] Could not chroma-key hand.png (likely a file:// / CORS restriction — serve the game over http:// instead). Falling back to the original sprite.", e);
      return image;
    }
    return off; // a <canvas> works anywhere ctx.drawImage accepts an image source
  }

  function init() {
    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext("2d");
    
    canvas.width = VIRTUAL_WIDTH;
    canvas.height = VIRTUAL_HEIGHT;
    ctx.imageSmoothingEnabled = false;

    loadAssets(() => {
      if (sprites.hand && sprites.hand.complete && sprites.hand.naturalWidth > 0) {
        sprites.handClean = chromaKeyGreenAnchor(sprites.hand);
      }
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
    });

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && window.MukkalState.currentScene === "INTRO_PAN") {
        window.MukkalState.currentScene = "MENU";
        return;
      }

      if (window.MukkalState.currentScene === "GAMEPLAY") {
        if (e.code === "ArrowUp") {
          handKeys.up = true;
          if (!e.repeat) window.MukkalState.keyPressCount++; // e.repeat is true for OS key-hold auto-repeat, not a new press
          e.preventDefault();
        }
        if (e.code === "ArrowDown") {
          handKeys.down = true;
          if (!e.repeat) window.MukkalState.keyPressCount++;
          e.preventDefault();
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "ArrowUp") handKeys.up = false;
      if (e.code === "ArrowDown") handKeys.down = false;
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
        // play.png -> straight into gameplay, unchanged.
        if (window.MukkalAudio) window.MukkalAudio.playSFX("button_click");
        startGameplay();
      } else if (isInside(x, y, hitboxes.selectBtn)) {
        // change.png -> "another page".
        // TODO: confirm what "another page" means:
        //   (a) navigate the browser away entirely — e.g.
        //       window.location.href = "weapon-select.html";
        //   (b) keep the existing in-game BISCUIT_SELECT modal (current
        //       behavior below) just with the new button art.
        // Left as (b) for now so nothing breaks; swap in the
        // window.location line above once you confirm it should leave
        // the game.
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
        // playagain.png -> restart the round, same as before.
        if (window.MukkalAudio) window.MukkalAudio.playSFX("button_click");
        startGameplay();
      } else if (isInside(x, y, hitboxes.quitBtn)) {
        // quit.png -> leave the game entirely and go to the home page.
        if (window.MukkalAudio) window.MukkalAudio.playSFX("button_click");
        window.location.href = HOME_PAGE_URL;
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
    const state = window.MukkalState;
    state.currentScene = "GAMEPLAY";
    state.handY = HAND_MIN_Y;
    state.biscuitState = "regular";
    state.roundResolved = false;
    state.keyPressCount = 0;
    state.pendingResultScene = null;
    state.resultSceneEntered = false;
    state.isCrumbled = false;
    state.isWon = false;
    lastGameplayTimestamp = null;

    const willCrack = Math.random() < CRACK_PROBABILITY;
    state.roundOutcome = willCrack ? "crack" : "soggy";
    const delay = OUTCOME_MIN_DELAY_MS + Math.random() * (OUTCOME_MAX_DELAY_MS - OUTCOME_MIN_DELAY_MS);
    state.roundOutcomeAt = performance.now() + delay;

    if (window.MukkalAudio && window.MukkalAudio.playBGM) {
      window.MukkalAudio.playBGM();
    }
  }

  function resolveRoundOutcome(timestamp) {
    const state = window.MukkalState;
    state.roundResolved = true;

    if (state.roundOutcome === "crack") {
      state.biscuitState = "cracked";
      state.isCrumbled = true;
      state.pendingResultScene = "GAMEOVER";
      if (window.MukkalAudio && window.MukkalAudio.playMemeFail) {
        window.MukkalAudio.playMemeFail();
      }
    } else {
      state.biscuitState = "soggy";
      state.isWon = true;
      state.score += 100;
      state.pendingResultScene = "VICTORY";
      if (window.MukkalAudio && window.MukkalAudio.playVictory) {
        window.MukkalAudio.playVictory();
      }
    }

    state.resultSceneEntered = false;
    state.resultRevealAt = timestamp + RESULT_REVEAL_DELAY_MS;
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
        updateAndRenderGameplay(timestamp);
        break;
      case "GAMEOVER":
        renderGameOverScene(false, timestamp);
        break;
      case "VICTORY":
        renderGameOverScene(true, timestamp);
        break;
    }

    requestAnimationFrame(gameLoop);
  }

  function renderMenuScene(timestamp) {
    if (window.MukkalState.currentScene === "INTRO_PAN") {
      renderIntroPan(timestamp);
    } else {
      renderMenuBackground();
    }
  }

  function renderIntroPan(timestamp) {
    ctx.fillStyle = "#8d99ae";
    ctx.fillRect(0, 0, 160, 100);

    const anim = window.MukkalState.introAnimation;
    const drawnAnim = drawSpriteFrame(
      sprites.loadingIntro,
      anim.currentFrame,
      anim.totalFrames,
      0, 0,
      160, 100
    );

    if (drawnAnim) {
      if (!anim.frameTimer) anim.frameTimer = timestamp;
      if (timestamp - anim.frameTimer >= anim.frameInterval) {
        anim.currentFrame++;
        anim.frameTimer = timestamp;

        if (anim.currentFrame >= anim.totalFrames) {
          anim.currentFrame = anim.totalFrames - 1;
          window.MukkalState.currentScene = "MENU";
        }
      }
    }
  }

  function renderMenuBackground() {
    if (sprites.chayaKadam && sprites.chayaKadam.complete && sprites.chayaKadam.naturalWidth > 0) {
      ctx.drawImage(sprites.chayaKadam, 0, 0, 160, 100);
    } else {
      ctx.fillStyle = "#8d99ae";
      ctx.fillRect(0, 0, 160, 100);
    }

    drawMenuButtonLabels();
  }

  function drawContainFit(image, box) {
    // Scales the image uniformly (preserving its aspect ratio) to fit
    // entirely inside box, then centers it — never stretches non-uniformly,
    // which is what was smearing/garbling the button text before.
    const scale = Math.min(box.w / image.naturalWidth, box.h / image.naturalHeight);
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const drawX = box.x + (box.w - drawW) / 2;
    const drawY = box.y + (box.h - drawH) / 2;
    ctx.drawImage(image, drawX, drawY, drawW, drawH);
  }

  function drawMenuButtonLabels() {
    const playBox = hitboxes.playBtn;
    const selectBox = hitboxes.selectBtn;

    // --- PLAY button ---
    if (sprites.playBtnImg && sprites.playBtnImg.complete && sprites.playBtnImg.naturalWidth > 0) {
      drawContainFit(sprites.playBtnImg, playBox);
      if (hoveredButton === "PLAY") {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(playBox.x, playBox.y, playBox.w, playBox.h);
        ctx.globalAlpha = 1.0;
      }
    } else {
      // Fallback to the old text label until play.png is uploaded/loads.
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 6px sans-serif";
      ctx.fillStyle = hoveredButton === "PLAY" ? "#3d2b1f" : "#ffffff";
      ctx.fillText("PLAY", playBox.x + playBox.w / 2, playBox.y + playBox.h / 2 + 1);
    }

    // --- CHOOSE YOUR WEAPON button ---
    if (sprites.weaponBtnImg && sprites.weaponBtnImg.complete && sprites.weaponBtnImg.naturalWidth > 0) {
      drawContainFit(sprites.weaponBtnImg, selectBox);
      if (hoveredButton === "SELECT") {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(selectBox.x, selectBox.y, selectBox.w, selectBox.h);
        ctx.globalAlpha = 1.0;
      }
    } else {
      // Fallback to the old text label until change.png is uploaded/loads.
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 5px sans-serif";
      ctx.fillStyle = hoveredButton === "SELECT" ? "#3d2b1f" : "#ffffff";
      ctx.fillText("CHOOSE YOUR WEAPON", selectBox.x + selectBox.w / 2, selectBox.y + selectBox.h / 2 + 1);
    }
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

  function drawGameplayBackground() {
    // Shared by the initial scene draw AND the anchor-mask patch below, so
    // the green-circle cover-up always matches whatever is actually behind
    // it (the background image), instead of a flat color that would show
    // up as a visible disc now that the background is a photo, not a solid fill.
    if (sprites.gameBackground && sprites.gameBackground.complete && sprites.gameBackground.naturalWidth > 0) {
      ctx.drawImage(sprites.gameBackground, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle = "#1d3557";
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      if (!window.__mukkalBgWarned) {
        // Still on the flat navy fill means gbg.png either 404'd or hasn't
        // finished loading. Check the Network tab for a 404 and confirm
        // it's really sitting at assets/sprites/gbg.png (exact
        // filename/case) relative to this script.
        console.warn("[MukkalEngine] gbg.png did not load — check assets/sprites/gbg.png exists and the path/case matches exactly.");
        window.__mukkalBgWarned = true;
      }
    }
  }

  function updateAndRenderGameplay(timestamp) {
    const state = window.MukkalState;

    if (!state.roundResolved) {
      if (lastGameplayTimestamp === null) lastGameplayTimestamp = timestamp;
      const dt = timestamp - lastGameplayTimestamp;
      lastGameplayTimestamp = timestamp;

      if (handKeys.up) state.handY -= HAND_SPEED * dt;
      if (handKeys.down) state.handY += HAND_SPEED * dt;
      state.handY = Math.min(HAND_MAX_Y, Math.max(HAND_MIN_Y, state.handY));

      state.biscuitState = (state.handY >= HAND_MAX_Y - HAND_CONTACT_EPSILON) ? "dipped" : "regular";

      if (timestamp >= state.roundOutcomeAt && state.keyPressCount >= 2) {
        resolveRoundOutcome(timestamp);
      }
    } else {
      lastGameplayTimestamp = null;

      if (!state.resultSceneEntered && timestamp >= state.resultRevealAt) {
        state.resultSceneEntered = true;
        state.currentScene = state.pendingResultScene;
      }
    }

    // --- draw scene ---
    drawGameplayBackground();

    // Cup only shows during a live, unresolved round. The instant the round
    // is won or lost (state.roundResolved flips true, same moment the
    // cookie sprite swaps to cracked/soggy) the cup is skipped entirely —
    // this also covers the 2s reveal window and the GAMEOVER/VICTORY
    // scenes, since both keep calling this same draw function.
    if (!state.roundResolved) {
      if (sprites.cup && sprites.cup.complete && sprites.cup.naturalWidth > 0) {
        ctx.drawImage(sprites.cup, CUP_DRAW_X, CUP_DRAW_Y, 32, 32);
      } else if (!window.__mukkalCupWarned) {
        console.warn("[MukkalEngine] cup.png did not load — check assets/sprites/cup.png exists and the path/case matches exactly.");
        window.__mukkalCupWarned = true;
      }
    }

    if (sprites.hand && sprites.hand.complete && sprites.hand.naturalWidth > 0) {
      const handSpriteToDraw = sprites.handClean || sprites.hand;
      ctx.drawImage(handSpriteToDraw, HAND_DRAW_X, state.handY, 64, 64);
    }

    const biscuitSprite =
      state.biscuitState === "cracked" ? sprites.biscuitCracked :
      state.biscuitState === "soggy" ? sprites.biscuitSoggy :
      state.biscuitState === "dipped" ? sprites.biscuitDipped :
      sprites.biscuitRegular;

    const anchorX = HAND_DRAW_X + HAND_ANCHOR.x;
    const anchorY = state.handY + HAND_ANCHOR.y;

    // Patch the anchor circle with the real background (image or fallback
    // color). The hand sprite is now pre-cleaned of its green anchor
    // marker (see chromaKeyGreenAnchor), so this no longer needs to erase a
    // wide flat circle — it's just a small safety patch in case any tiny
    // bit of anti-aliased green edge slipped past the chroma key.
    ctx.save();
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, ANCHOR_SAFETY_PATCH_RADIUS, 0, Math.PI * 2);
    ctx.clip();
    drawGameplayBackground();
    ctx.restore();

    if (biscuitSprite && biscuitSprite.complete && biscuitSprite.naturalWidth > 0) {
      ctx.drawImage(
        biscuitSprite,
        BISCUIT_SRC_CROP.x, BISCUIT_SRC_CROP.y, BISCUIT_SRC_CROP.w, BISCUIT_SRC_CROP.h,
        anchorX - BISCUIT_DRAW_SIZE / 2,
        anchorY - BISCUIT_DRAW_SIZE / 2,
        BISCUIT_DRAW_SIZE, BISCUIT_DRAW_SIZE
      );
    }

    // Score display removed per request — state.score is still tracked
    // internally (used for the win increment) even though nothing draws it.

    if (!state.roundResolved && sprites.arrowIndicator && sprites.arrowIndicator.complete && sprites.arrowIndicator.naturalWidth > 0) {
      // Decorative only — not a button, so no hitbox/click handling.
      // Cap the scale at 1:1 (never upscale, and only downscale as much as
      // needed to fit the available width) — the previous fixed 80px
      // target width was shrinking this ~2.3x, and at that ratio
      // nearest-neighbor scaling was dropping whole letter strokes,
      // producing the garbled/gappy text seen in testing.
      const maxArrowW = VIRTUAL_WIDTH - 10; // 5px margin on each side
      const scale = Math.min(1, maxArrowW / sprites.arrowIndicator.naturalWidth);
      const arrowW = sprites.arrowIndicator.naturalWidth * scale;
      const arrowH = sprites.arrowIndicator.naturalHeight * scale;
      ctx.drawImage(sprites.arrowIndicator, 5, VIRTUAL_HEIGHT - arrowH - 3, arrowW, arrowH);
    }
  }

  function renderGameOverScene(isVictory, timestamp) {
    updateAndRenderGameplay(timestamp);

    const flashOn = Math.floor(timestamp / 400) % 2 === 0;
    ctx.textAlign = "center";
    ctx.font = "bold 10px monospace";
    ctx.fillStyle = flashOn ? "#ffe066" : "#8a7a1a";
    ctx.fillText(isVictory ? "WON" : "FAILED", 80, 80);

    drawResultButton(sprites.playAgainBtnImg, hitboxes.tryAgainBtn, "TRY_AGAIN", "TRY AGAIN");
    drawResultButton(sprites.quitBtnImg, hitboxes.quitBtn, "QUIT", "QUIT");
  }

  function drawResultButton(image, box, hoverKey, fallbackText) {
    if (image && image.complete && image.naturalWidth > 0) {
      drawContainFit(image, box);
      if (hoveredButton === hoverKey) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.globalAlpha = 1.0;
      }
    } else {
      // Fallback text until the image asset loads.
      ctx.textAlign = "center";
      ctx.font = "bold 5px monospace";
      ctx.fillStyle = hoveredButton === hoverKey ? "#ffe066" : "#ffffff";
      ctx.fillText(fallbackText, box.x + box.w / 2, box.y + box.h / 2 + 2);
    }
  }

  window.addEventListener("DOMContentLoaded", init);

  return { init, startGameplay };
})();