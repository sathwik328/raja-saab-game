/**
 * ============================================================================
 * THE RAJA SAAB: SHADOWS OF THE LABYRINTH
 * Complete Survival Horror Game Engine (V3 Final Polish)
 * ============================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. CONFIGURATION & BALANCED GAMEPLAY
  // --------------------------------------------------------------------------
  const TILE_SIZE = 60;
  const GRID_W = 31;
  const GRID_H = 23;
  const WORLD_W = GRID_W * TILE_SIZE;
  const WORLD_H = GRID_H * TILE_SIZE;

  // Perfectly tuned speeds: comfortable control, no overshooting
  const HERO_SPEED = 3.6;          // Responsive, smooth, controllable
  const VILLAIN_BASE_SPEED = 1.35; // Slow, suspenseful stalker
  const VILLAIN_CHASE_SPEED = 1.75;// Line-of-sight chase
  const INTERACTION_RADIUS = 72;   // Distance to unlock cages

  // Characters box rendering dimensions (Strictly rounded box containers)
  const CHAR_BOX_SIZE = 48;
  const CHAR_BOX_RADIUS = 10;

  // --------------------------------------------------------------------------
  // 2. AUDIO PACK & QUEUE SYSTEM (NO OVERLAPPING, PRIORITY QUEUE)
  // --------------------------------------------------------------------------
  class AudioPackManager {
    constructor() {
      this.isMuted = false;
      this.bgmVolume = 0.30;
      this.audioElements = {
        loopStart: document.getElementById('audio-loop-start'),
        bgm: document.getElementById('audio-bgm'),
        onSee: document.getElementById('audio-on-see'),
        run1: document.getElementById('audio-run1'),
        die1: document.getElementById('audio-die1'),
        heroine3: document.getElementById('audio-heroine3')
      };

      // Voice queue to prevent overlap
      this.voiceQueue = [];
      this.isVoicePlaying = false;
      this.activeVoiceEl = null;

      // Cooldown tracking for on_see and run1
      this.hasPlayedOnSee = false;
      this.lastSawHeroTime = 0;
      this.hasPlayedRun1 = false;
      this.hasRunAway = true;

      this.initAudio();
    }

    initAudio() {
      if (this.audioElements.loopStart) {
        this.audioElements.loopStart.volume = 0.45;
      }
      if (this.audioElements.bgm) {
        this.audioElements.bgm.volume = this.bgmVolume;
      }

      // Add ended listener to voice clips to process queue sequentially
      ['onSee', 'run1', 'die1', 'heroine3'].forEach(key => {
        const el = this.audioElements[key];
        if (el) {
          el.addEventListener('ended', () => {
            this.isVoicePlaying = false;
            this.activeVoiceEl = null;
            this.playNextInQueue();
          });
        }
      });
    }

    playStartLoop() {
      if (this.isMuted) return;
      if (this.audioElements.loopStart) {
        this.audioElements.loopStart.currentTime = 0;
        this.audioElements.loopStart.volume = 0.45;
        this.audioElements.loopStart.play().catch(() => {});
      }
    }

    stopStartLoop() {
      if (this.audioElements.loopStart) {
        this.audioElements.loopStart.pause();
        this.audioElements.loopStart.currentTime = 0;
      }
    }

    playBGM() {
      if (this.isMuted) return;
      if (this.audioElements.bgm) {
        this.audioElements.bgm.volume = this.bgmVolume;
        this.audioElements.bgm.play().catch(() => {});
      }
    }

    stopBGM() {
      if (this.audioElements.bgm) {
        this.audioElements.bgm.pause();
      }
    }

    setBGMVolume(val) {
      this.bgmVolume = Math.max(0, Math.min(1, val));
      if (this.audioElements.bgm && !this.isMuted) {
        this.audioElements.bgm.volume = this.bgmVolume;
      }
    }

    // Queue voice clip to ensure sequential playback (on_see first, then run1)
    queueVoice(clipId) {
      if (this.isMuted) return;

      // Prevent duplicate identical entries in queue
      if (this.voiceQueue.includes(clipId)) return;
      if (this.activeVoiceEl === this.audioElements[clipId]) return;

      this.voiceQueue.push(clipId);
      if (!this.isVoicePlaying) {
        this.playNextInQueue();
      }
    }

    playNextInQueue() {
      if (this.voiceQueue.length === 0) {
        this.isVoicePlaying = false;
        return;
      }

      const nextClipId = this.voiceQueue.shift();
      const el = this.audioElements[nextClipId];
      if (el && !this.isMuted) {
        this.isVoicePlaying = true;
        this.activeVoiceEl = el;
        el.currentTime = 0;
        el.volume = 1.0;
        el.play().catch(() => {
          this.isVoicePlaying = false;
          this.playNextInQueue();
        });
      } else {
        this.playNextInQueue();
      }
    }

    triggerOnSee() {
      if (this.hasPlayedOnSee) return;
      this.hasPlayedOnSee = true;
      // High priority: on_see plays first
      this.queueVoice('onSee');
    }

    triggerRun1() {
      if (this.hasPlayedRun1) return;
      this.hasPlayedRun1 = true;
      this.hasRunAway = false;
      this.queueVoice('run1');
    }

    resetRun1State() {
      this.hasPlayedRun1 = false;
      this.hasRunAway = true;
    }

    resetOnSeeState() {
      this.hasPlayedOnSee = false;
    }

    triggerDie1() {
      // Clear queue and play die1 immediately
      this.voiceQueue = [];
      if (this.activeVoiceEl) {
        this.activeVoiceEl.pause();
      }
      this.stopBGM();

      if (this.audioElements.die1 && !this.isMuted) {
        this.audioElements.die1.currentTime = 0;
        this.audioElements.die1.volume = 1.0;
        this.audioElements.die1.play().catch(() => {});
      }
    }

    triggerHeroine3() {
      this.queueVoice('heroine3');
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      if (this.isMuted) {
        if (this.audioElements.loopStart) this.audioElements.loopStart.volume = 0;
        if (this.audioElements.bgm) this.audioElements.bgm.volume = 0;
        if (this.activeVoiceEl) this.activeVoiceEl.volume = 0;
      } else {
        if (this.audioElements.bgm) this.audioElements.bgm.volume = this.bgmVolume;
        if (this.activeVoiceEl) this.activeVoiceEl.volume = 1.0;
      }
      return this.isMuted;
    }
  }

  // --------------------------------------------------------------------------
  // 3. ASSET LOADER (IMAGES)
  // --------------------------------------------------------------------------
  const ASSETS = {
    hero: { path: 'assets/images/hero.png', fallback: 'hero.png', img: new Image() },
    villain: { path: 'assets/images/villain.png', fallback: 'villain.png', img: new Image() },
    heroine1: { path: 'assets/images/heroine1.png', fallback: 'heroine1.png', img: new Image() },
    heroine2: { path: 'assets/images/heroine2.png', fallback: 'heroine2.png', img: new Image() },
    heroine3: { path: 'assets/images/heroine3.png', fallback: 'heroine3.png', img: new Image() },
    key: { path: 'assets/images/key.png', fallback: 'key.png', img: new Image() }
  };

  function loadAllAssets(onComplete) {
    let loadedCount = 0;
    const keys = Object.keys(ASSETS);
    const total = keys.length;

    function checkDone() {
      loadedCount++;
      if (loadedCount >= total && onComplete) onComplete();
    }

    keys.forEach(k => {
      const item = ASSETS[k];
      item.img.onload = () => checkDone();
      item.img.onerror = () => {
        if (item.img.src.indexOf(item.fallback) === -1) {
          item.img.src = item.fallback;
        } else {
          checkDone();
        }
      };
      item.img.src = item.path;
    });
  }

  // --------------------------------------------------------------------------
  // 4. MAZE ARCHITECTURE
  // --------------------------------------------------------------------------
  const MAZE_GRID = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,1,0,1,0,1,1,0,0,0,0,1,0,1,0,1,1,0,1,1,1,1,1,0,1],
    [1,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,1,0,1], // Cage 3 at (4,3); Crypt at (15,3); Cage 2 at (26,3)
    [1,0,1,0,1,1,0,1,1,1,0,1,0,0,0,0,0,1,0,1,1,1,0,1,1,0,1,0,1,0,1],
    [1,0,0,0,1,0,0,0,0,1,0,1,1,1,0,1,1,1,0,1,0,0,0,0,1,0,1,0,0,0,1],
    [1,1,1,0,1,0,1,1,0,1,0,0,0,0,0,0,0,0,0,1,0,1,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,1,0,0,0,0,0,1,0,1], // Key 3 at (9,7)
    [1,0,1,1,1,0,1,0,1,1,0,1,0,0,0,0,0,1,0,1,1,0,1,0,1,1,1,0,1,0,1],
    [1,0,1,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,1,1,1,0,1,0,1,0,2,0,0,2,0,1,0,1,1,1,1,0,1,0,1,0,1],   // Central Pillars
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // Key 2 at (15,11)
    [1,0,1,0,1,1,1,1,0,1,0,1,0,2,0,0,2,0,1,0,1,1,1,1,0,1,0,1,0,1],   // Central Pillars
    [1,0,1,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,1,0,1,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,1,0,0,0,0,0,1,0,1,1,0,1,0,1,1,1,0,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,1,0,0,0,0,0,1,0,1],
    [1,1,1,0,1,0,1,1,0,1,0,0,0,0,0,0,0,0,0,1,0,1,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,1,0,0,0,0,1,0,1,1,1,0,1,1,1,0,1,0,0,0,0,1,0,1,0,0,0,1],
    [1,0,1,0,1,1,0,1,1,1,0,1,0,0,0,0,0,1,0,1,1,1,0,1,1,0,1,0,1,0,1],
    [1,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,1,0,1], // Hero (15,19); Key 1 at (4,19); Cage 1 at (26,19)
    [1,0,1,1,1,0,1,1,0,1,0,1,1,0,0,0,0,1,0,1,0,1,1,0,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ];

  const TORCHES = [
    { x: 3 * TILE_SIZE + 30, y: 1 * TILE_SIZE + 30, flicker: 0 },
    { x: 27 * TILE_SIZE + 30, y: 1 * TILE_SIZE + 30, flicker: 0.5 },
    { x: 15 * TILE_SIZE + 30, y: 1 * TILE_SIZE + 30, flicker: 0.2 },
    { x: 13 * TILE_SIZE + 30, y: 10 * TILE_SIZE + 30, flicker: 0.7 },
    { x: 17 * TILE_SIZE + 30, y: 10 * TILE_SIZE + 30, flicker: 0.3 },
    { x: 13 * TILE_SIZE + 30, y: 12 * TILE_SIZE + 30, flicker: 0.8 },
    { x: 17 * TILE_SIZE + 30, y: 12 * TILE_SIZE + 30, flicker: 0.4 },
    { x: 4 * TILE_SIZE + 30, y: 18 * TILE_SIZE + 30, flicker: 0.1 },
    { x: 26 * TILE_SIZE + 30, y: 18 * TILE_SIZE + 30, flicker: 0.6 },
    { x: 15 * TILE_SIZE + 30, y: 21 * TILE_SIZE + 30, flicker: 0.9 }
  ];

  // --------------------------------------------------------------------------
  // 5. GAME STATE & ENTITIES
  // --------------------------------------------------------------------------
  const STATE = {
    phase: 'INTRO',
    countdownTime: 5.0,
    startTime: 0,
    currentStep: 1, // 1: Key 1, 2: Cage 1, 3: Key 2, 4: Cage 2, 5: Key 3, 6: Cage 3
    hasKey: false,
    keysCollectedTotal: 0,
    heroinesRescued: 0,
    activePrompt: null
  };

  const audioPack = new AudioPackManager();

  const hero = {
    x: 15 * TILE_SIZE + 30,
    y: 19 * TILE_SIZE + 30,
    vx: 0,
    vy: 0,
    radius: 13, // Slim radius leaves 34px buffer in 60px corridor!
    facing: 'down',
    posHistory: []
  };

  const villain = {
    x: 15 * TILE_SIZE + 30,
    y: 3 * TILE_SIZE + 30,
    vx: 0,
    vy: 0,
    speed: VILLAIN_BASE_SPEED,
    radius: 18,
    active: false,
    path: [],
    pathTimer: 0,
    pauseTimer: 0,
    isEnraged: false
  };

  const cages = [
    {
      id: 1,
      tileX: 26,
      tileY: 19,
      x: 26 * TILE_SIZE + 30,
      y: 19 * TILE_SIZE + 30,
      heroineKey: 'heroine1',
      name: 'Malavika',
      unlocked: false,
      shakeTimer: 0
    },
    {
      id: 2,
      tileX: 26,
      tileY: 3,
      x: 26 * TILE_SIZE + 30,
      y: 3 * TILE_SIZE + 30,
      heroineKey: 'heroine2',
      name: 'Nidhhi',
      unlocked: false,
      shakeTimer: 0
    },
    {
      id: 3,
      tileX: 4,
      tileY: 3,
      x: 4 * TILE_SIZE + 30,
      y: 3 * TILE_SIZE + 30,
      heroineKey: 'heroine3',
      name: 'Riddhi',
      unlocked: false,
      shakeTimer: 0
    }
  ];

  const keys = [
    {
      id: 1,
      tileX: 4,
      tileY: 19,
      x: 4 * TILE_SIZE + 30,
      y: 19 * TILE_SIZE + 30,
      collected: false,
      visible: true
    },
    {
      id: 2,
      tileX: 15,
      tileY: 11,
      x: 15 * TILE_SIZE + 30,
      y: 11 * TILE_SIZE + 30,
      collected: false,
      visible: false
    },
    {
      id: 3,
      tileX: 9,
      tileY: 7,
      x: 9 * TILE_SIZE + 30,
      y: 7 * TILE_SIZE + 30,
      collected: false,
      visible: false
    }
  ];

  const followers = [];

  const camera = {
    x: hero.x,
    y: hero.y,
    w: window.innerWidth,
    h: window.innerHeight
  };

  const particles = [];

  // Input states
  const keysDown = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    Space: false,
    KeyE: false
  };

  const pointerInput = {
    active: false,
    startX: 0,
    startY: 0,
    currX: 0,
    currY: 0,
    moveX: 0,
    moveY: 0
  };

  // DOM Elements
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const minimapCanvas = document.getElementById('minimapCanvas');
  const mmCtx = minimapCanvas.getContext('2d');

  const countdownOverlay = document.getElementById('countdown-overlay');
  const countdownNumberEl = document.getElementById('countdown-number');
  const objectiveTextEl = document.getElementById('objective-text');
  const keyCountDisplayEl = document.getElementById('key-count-display');
  const threatIndicatorEl = document.getElementById('threat-indicator');
  const threatDotEl = document.getElementById('threat-dot');
  const heartbeatVignetteEl = document.getElementById('heartbeat-vignette');
  const actionPromptFloat = document.getElementById('action-prompt-float');
  const actionPromptText = document.getElementById('action-prompt-text');
  const actionPromptKey = document.getElementById('action-prompt-key');
  const dialogueBoxEl = document.getElementById('dialogue-box');
  const bgmVolumeSlider = document.getElementById('bgm-volume-slider');

  const touchJoystickBase = document.getElementById('touch-joystick-base');
  const touchJoystickStick = document.getElementById('touch-joystick-stick');

  const startModal = document.getElementById('start-modal');
  const gameoverModal = document.getElementById('gameover-modal');
  const victoryModal = document.getElementById('victory-modal');

  const btnStartGame = document.getElementById('btn-start-game');
  const btnRestartGame = document.getElementById('btn-restart-game');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const btnToggleSound = document.getElementById('btn-toggle-sound');

  // --------------------------------------------------------------------------
  // 6. HELPER: RENDERING BOXED CONTAINERS WITH ROUNDED CORNERS (NOT CIRCULAR)
  // --------------------------------------------------------------------------
  function renderBoxedSprite(ctx, img, x, y, size, radius, options = {}) {
    const half = size / 2;
    const rx = x - half;
    const ry = y - half;

    ctx.save();

    ctx.shadowColor = options.shadowColor || 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = options.shadowBlur !== undefined ? options.shadowBlur : 8;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = options.bgColor || '#151722';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rx, ry, size, size, radius);
    else ctx.rect(rx, ry, size, size);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rx, ry, size, size, radius);
    else ctx.rect(rx, ry, size, size);
    ctx.clip();

    if (img && img.complete && img.naturalWidth > 0) {
      const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
    } else {
      ctx.fillStyle = '#26293a';
      ctx.fillRect(rx, ry, size, size);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(options.label || '?', x, y);
    }

    ctx.restore();

    ctx.strokeStyle = options.borderColor || '#ffd700';
    ctx.lineWidth = options.borderWidth || 2.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rx, ry, size, size, radius);
    else ctx.rect(rx, ry, size, size);
    ctx.stroke();

    // Clean name label beneath avatar
    if (options.tag) {
      ctx.fillStyle = options.tagBg || 'rgba(10, 12, 18, 0.9)';
      ctx.strokeStyle = options.borderColor || '#ffd700';
      ctx.lineWidth = 1;
      const tagW = size + 16;
      const tagH = 16;
      const tagX = x - tagW / 2;
      const tagY = ry + size + 3;

      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(tagX, tagY, tagW, tagH, 4);
      else ctx.rect(tagX, tagY, tagW, tagH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = options.tagColor || '#ffffff';
      ctx.font = 'bold 9px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(options.tag, x, tagY + tagH / 2);
    }

    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // 7. PATHFINDING & CORNER-ASSIST COLLISION
  // --------------------------------------------------------------------------
  function isWalkable(tileX, tileY) {
    if (tileX < 0 || tileX >= GRID_W || tileY < 0 || tileY >= GRID_H) return false;
    return MAZE_GRID[tileY][tileX] === 0;
  }

  function canMoveTo(x, y, radius) {
    const left = Math.floor((x - radius) / TILE_SIZE);
    const right = Math.floor((x + radius) / TILE_SIZE);
    const top = Math.floor((y - radius) / TILE_SIZE);
    const bottom = Math.floor((y + radius) / TILE_SIZE);

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (!isWalkable(tx, ty)) return false;
      }
    }
    return true;
  }

  function findPathBFS(startTileX, startTileY, targetTileX, targetTileY) {
    if (startTileX === targetTileX && startTileY === targetTileY) return [];

    const queue = [[startTileX, startTileY]];
    const visited = new Set([`${startTileX},${startTileY}`]);
    const parentMap = new Map();
    let found = false;

    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      if (cx === targetTileX && cy === targetTileY) {
        found = true;
        break;
      }

      const neighbors = [
        [cx, cy - 1],
        [cx + 1, cy],
        [cx, cy + 1],
        [cx - 1, cy]
      ];

      for (let i = 0; i < neighbors.length; i++) {
        const [nx, ny] = neighbors[i];
        const key = `${nx},${ny}`;
        if (isWalkable(nx, ny) && !visited.has(key)) {
          visited.add(key);
          parentMap.set(key, [cx, cy]);
          queue.push([nx, ny]);
        }
      }
    }

    if (!found) return [];

    const path = [];
    let curr = [targetTileX, targetTileY];
    while (curr) {
      const key = `${curr[0]},${curr[1]}`;
      if (curr[0] === startTileX && curr[1] === startTileY) break;
      path.unshift(curr);
      curr = parentMap.get(key);
    }
    return path;
  }

  function hasLineOfSight(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist / 20);

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const tx = Math.floor(px / TILE_SIZE);
      const ty = Math.floor(py / TILE_SIZE);
      if (!isWalkable(tx, ty)) return false;
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // 8. FOLLOWER MECHANIC
  // --------------------------------------------------------------------------
  function updateHeroHistory() {
    const last = hero.posHistory[hero.posHistory.length - 1];
    if (!last || Math.hypot(hero.x - last.x, hero.y - last.y) >= 4) {
      hero.posHistory.push({ x: hero.x, y: hero.y, facing: hero.facing });
      if (hero.posHistory.length > 250) hero.posHistory.shift();
    }
  }

  function updateFollowers() {
    const spacingStep = 11;
    followers.forEach((f, idx) => {
      const targetIndex = hero.posHistory.length - 1 - (idx + 1) * spacingStep;
      if (targetIndex >= 0 && targetIndex < hero.posHistory.length) {
        const targetPos = hero.posHistory[targetIndex];
        f.x += (targetPos.x - f.x) * 0.35;
        f.y += (targetPos.y - f.y) * 0.35;
        f.facing = targetPos.facing;
      } else if (hero.posHistory.length > 0) {
        const oldest = hero.posHistory[0];
        f.x += (oldest.x - f.x) * 0.35;
        f.y += (oldest.y - f.y) * 0.35;
      }
    });
  }

  // --------------------------------------------------------------------------
  // 9. VILLAIN HUNTING AI & AUDIO TRIGGERS (ON_SEE & RUN1)
  // --------------------------------------------------------------------------
  function updateVillain(dt) {
    if (!villain.active) return;

    if (villain.pauseTimer > 0) {
      villain.pauseTimer -= dt;
      return;
    }

    villain.pathTimer -= dt;

    const vTileX = Math.floor(villain.x / TILE_SIZE);
    const vTileY = Math.floor(villain.y / TILE_SIZE);
    const hTileX = Math.floor(hero.x / TILE_SIZE);
    const hTileY = Math.floor(hero.y / TILE_SIZE);

    const distToHero = Math.hypot(hero.x - villain.x, hero.y - villain.y);
    const inSight = distToHero < 380 && hasLineOfSight(villain.x, villain.y, hero.x, hero.y);

    // Audio Trigger 1: on_see ("Abba... abba... abba...")
    if (inSight) {
      villain.isEnraged = true;
      villain.speed = VILLAIN_CHASE_SPEED;
      audioPack.lastSawHeroTime = Date.now();
      audioPack.triggerOnSee();
    } else {
      villain.isEnraged = false;
      villain.speed = VILLAIN_BASE_SPEED;
      // If villain hasn't seen hero for 4 seconds, reset on_see trigger
      if (Date.now() - audioPack.lastSawHeroTime > 4000) {
        audioPack.resetOnSeeState();
      }
    }

    // Audio Trigger 2: run1 ("PattarEntra... Parigettandi!")
    // Triggers when villain is close to hero (< 280px).
    // If hero runs away (> 420px), resets so it can trigger again on next close encounter!
    if (distToHero < 280) {
      audioPack.triggerRun1();
    } else if (distToHero > 420) {
      audioPack.resetRun1State();
    }

    // Pathfinding update
    if (villain.pathTimer <= 0 || villain.path.length === 0) {
      villain.pathTimer = inSight ? 0.35 : 0.6;
      villain.path = findPathBFS(vTileX, vTileY, hTileX, hTileY);
      if (Math.random() < 0.2) villain.pauseTimer = 0.2;
    }

    if (villain.path.length > 0) {
      const nextTile = villain.path[0];
      const targetX = nextTile[0] * TILE_SIZE + TILE_SIZE / 2;
      const targetY = nextTile[1] * TILE_SIZE + TILE_SIZE / 2;

      const dx = targetX - villain.x;
      const dy = targetY - villain.y;
      const distToNode = Math.hypot(dx, dy);

      if (distToNode < 6) {
        villain.path.shift();
      } else {
        const moveStep = Math.min(distToNode, villain.speed);
        const vx = (dx / distToNode) * moveStep;
        const vy = (dy / distToNode) * moveStep;

        if (canMoveTo(villain.x + vx, villain.y + vy, villain.radius)) {
          villain.x += vx;
          villain.y += vy;
        } else if (canMoveTo(villain.x + vx, villain.y, villain.radius)) {
          villain.x += vx;
        } else if (canMoveTo(villain.x, villain.y + vy, villain.radius)) {
          villain.y += vy;
        }
      }
    }

    // Shadow particles
    if (Math.random() < 0.3) {
      particles.push({
        x: villain.x + (Math.random() - 0.5) * 28,
        y: villain.y + (Math.random() - 0.5) * 28,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        color: villain.isEnraged ? 'rgba(255, 30, 50, 0.7)' : 'rgba(120, 10, 30, 0.5)',
        radius: Math.random() * 4 + 2,
        life: 0.5,
        maxLife: 0.5
      });
    }

    // Collision with Hero -> Game Over ("YOU LOSE") & die1 sound!
    if (distToHero < (hero.radius + villain.radius + 6)) {
      triggerGameOver();
    }
  }

  // --------------------------------------------------------------------------
  // 10. GAME STATE & OBJECTIVES
  // --------------------------------------------------------------------------
  function getCurrentTarget() {
    if (STATE.currentStep === 1) return { target: keys[0], name: 'Key #1', type: 'key' };
    if (STATE.currentStep === 2) return { target: cages[0], name: 'Malavika', type: 'cage' };
    if (STATE.currentStep === 3) return { target: keys[1], name: 'Key #2', type: 'key' };
    if (STATE.currentStep === 4) return { target: cages[1], name: 'Nidhhi', type: 'cage' };
    if (STATE.currentStep === 5) return { target: keys[2], name: 'Key #3', type: 'key' };
    if (STATE.currentStep === 6) return { target: cages[2], name: 'Riddhi', type: 'cage' };
    return null;
  }

  function startGameCountdown() {
    STATE.phase = 'COUNTDOWN';
    STATE.countdownTime = 5.0;
    STATE.startTime = Date.now();
    villain.active = false;

    villain.x = 15 * TILE_SIZE + 30;
    villain.y = 3 * TILE_SIZE + 30;
    villain.path = [];

    // Stop intro loop, prepare BGM
    audioPack.stopStartLoop();

    countdownOverlay.classList.add('active');
    updateCountdownUI(5);

    updateObjective('STEP 1/3: Walk over Key #1 in South-West Corridor (Follow Golden Arrow ➔)');
  }

  function updateCountdownUI(val) {
    if (val > 0) {
      countdownNumberEl.textContent = val;
    } else {
      countdownNumberEl.textContent = 'THE SHADOW AWAKENS!';
      countdownNumberEl.style.fontSize = '40px';
      setTimeout(() => {
        countdownOverlay.classList.remove('active');
        countdownNumberEl.style.fontSize = '80px';
      }, 1400);
    }
  }

  function onCountdownFinished() {
    STATE.phase = 'PLAYING';
    villain.active = true;

    // Start background music at configured volume
    audioPack.playBGM();

    triggerVignettePulse(1.0);

    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30;
      particles.push({
        x: villain.x,
        y: villain.y,
        vx: Math.cos(angle) * (Math.random() * 3 + 2),
        vy: Math.sin(angle) * (Math.random() * 3 + 2),
        color: 'rgba(255, 30, 50, 0.9)',
        radius: 4,
        life: 1.0,
        maxLife: 1.0
      });
    }
  }

  function updateObjective(text) {
    if (objectiveTextEl) objectiveTextEl.textContent = text;
  }

  function triggerVignettePulse(intensity) {
    if (!heartbeatVignetteEl) return;
    heartbeatVignetteEl.style.opacity = Math.min(0.9, intensity * 0.85);
    setTimeout(() => {
      heartbeatVignetteEl.style.opacity = '0';
    }, 180);
  }

  // AUTO-COLLECT KEYS ON STEP OVER + CAGE PROMPT
  function checkInteractions() {
    // 1. Auto-Collect Key on step-over!
    keys.forEach(k => {
      if (k.visible && !k.collected) {
        const dist = Math.hypot(hero.x - k.x, hero.y - k.y);
        if (dist <= 36) {
          collectKey(k);
        }
      }
    });

    // 2. Cage Interactions
    let prompt = null;
    cages.forEach(c => {
      if (!c.unlocked) {
        const dist = Math.hypot(hero.x - c.x, hero.y - c.y);
        if (dist <= INTERACTION_RADIUS) {
          if (STATE.hasKey && STATE.currentStep === c.id * 2) {
            prompt = {
              type: 'cage',
              target: c,
              label: `UNLOCK ${c.name.toUpperCase()}`
            };
          } else {
            prompt = {
              type: 'cage_locked',
              target: c,
              label: `KEY #${c.id} REQUIRED`
            };
          }
        }
      }
    });

    STATE.activePrompt = prompt;

    if (prompt) {
      actionPromptFloat.classList.add('active');
      actionPromptText.textContent = prompt.label;
      if (prompt.type === 'cage_locked') {
        actionPromptFloat.classList.add('denied');
        actionPromptKey.textContent = '[LOCKED]';
      } else {
        actionPromptFloat.classList.remove('denied');
        actionPromptKey.textContent = '[CLICK / E]';
      }
    } else {
      actionPromptFloat.classList.remove('active');
      actionPromptFloat.classList.remove('denied');
    }
  }

  function executeInteraction() {
    if (!STATE.activePrompt) return;
    const { type, target } = STATE.activePrompt;

    if (type === 'cage') {
      unlockCage(target);
    } else if (type === 'cage_locked') {
      // Vibrate / shake the cage bars and show denied alert!
      target.shakeTimer = 0.5;
      actionPromptFloat.classList.add('denied');
      actionPromptText.textContent = `🔒 KEY #${target.id} REQUIRED! ACCESS DENIED`;
      setTimeout(() => {
        if (STATE.activePrompt && STATE.activePrompt.target === target) {
          actionPromptText.textContent = `KEY #${target.id} REQUIRED`;
        }
      }, 1200);
    }
  }

  function collectKey(keyObj) {
    if (keyObj.collected) return;
    keyObj.collected = true;
    keyObj.visible = false;
    STATE.hasKey = true;
    STATE.keysCollectedTotal++;

    for (let i = 0; i < 25; i++) {
      particles.push({
        x: keyObj.x,
        y: keyObj.y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        color: 'rgba(255, 215, 0, 0.9)',
        radius: Math.random() * 3 + 2,
        life: 0.8,
        maxLife: 0.8
      });
    }

    keyCountDisplayEl.textContent = `KEY #${keyObj.id} READY`;
    keyCountDisplayEl.classList.add('ready');

    if (keyObj.id === 1) {
      STATE.currentStep = 2;
      updateObjective('STEP 1/3: Approach Cage #1 in South-East to Unlock Malavika');
    } else if (keyObj.id === 2) {
      STATE.currentStep = 4;
      updateObjective('STEP 2/3: Approach Cage #2 in North-East to Unlock Nidhhi');
    } else if (keyObj.id === 3) {
      STATE.currentStep = 6;
      updateObjective('STEP 3/3: Approach Cage #3 in West Chamber to Free Riddhi!');
    }

    checkInteractions();
  }

  function unlockCage(cageObj) {
    cageObj.unlocked = true;
    STATE.hasKey = false;
    STATE.heroinesRescued++;

    keyCountDisplayEl.textContent = 'NONE (0/1)';
    keyCountDisplayEl.classList.remove('ready');

    const rosterBox = document.getElementById(`roster-heroine-${cageObj.id}`);
    if (rosterBox) rosterBox.classList.add('rescued');

    followers.push({
      id: cageObj.id,
      img: ASSETS[cageObj.heroineKey].img,
      name: cageObj.name,
      x: cageObj.x,
      y: cageObj.y,
      facing: 'down'
    });

    for (let i = 0; i < 30; i++) {
      particles.push({
        x: cageObj.x,
        y: cageObj.y,
        vx: (Math.random() - 0.5) * 3.5,
        vy: (Math.random() - 0.5) * 3.5,
        color: 'rgba(255, 190, 50, 0.95)',
        radius: Math.random() * 3 + 2,
        life: 0.9,
        maxLife: 0.9
      });
    }

    if (cageObj.id === 1) {
      STATE.currentStep = 3;
      keys[1].visible = true;
      updateObjective('STEP 2/3: Malavika Freed! Walk over Key #2 in Grand Central Hall');
    } else if (cageObj.id === 2) {
      STATE.currentStep = 5;
      keys[2].visible = true;
      updateObjective('STEP 3/3: Nidhhi Freed! Walk over Key #3 in North-West Corridors');
    } else if (cageObj.id === 3) {
      triggerVictory();
    }

    checkInteractions();
  }

  // --------------------------------------------------------------------------
  // 11. VICTORY & GAME OVER SEQUENCES
  // --------------------------------------------------------------------------
  function triggerVictory() {
    STATE.phase = 'VICTORY';
    villain.active = false;
    audioPack.stopBGM();

    // Play Telugu voice clip
    audioPack.triggerHeroine3();
    dialogueBoxEl.classList.add('active');

    const totalSeconds = Math.floor((Date.now() - STATE.startTime) / 1000);
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    document.getElementById('vic-total-time').textContent = `${mins}:${secs}`;

    setTimeout(() => {
      victoryModal.classList.add('active');
    }, 2800);
  }

  function triggerGameOver() {
    STATE.phase = 'GAMEOVER';
    villain.active = false;

    // Play die1 voice clip ("Chachesadu baboi!")
    audioPack.triggerDie1();
    triggerVignettePulse(1.0);

    const totalSeconds = Math.floor((Date.now() - STATE.startTime) / 1000);
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');

    document.getElementById('go-heroines-rescued').textContent = `${STATE.heroinesRescued} / 3`;
    document.getElementById('go-time-survived').textContent = `${mins}:${secs}`;

    setTimeout(() => {
      gameoverModal.classList.add('active');
    }, 800);
  }

  function resetGame() {
    STATE.phase = 'PLAYING';
    STATE.hasKey = false;
    STATE.keysCollectedTotal = 0;
    STATE.heroinesRescued = 0;
    STATE.currentStep = 1;
    STATE.activePrompt = null;

    hero.x = 15 * TILE_SIZE + 30;
    hero.y = 19 * TILE_SIZE + 30;
    hero.vx = 0;
    hero.vy = 0;
    hero.posHistory = [{ x: hero.x, y: hero.y, facing: 'down' }];

    followers.length = 0;

    cages.forEach(c => { c.unlocked = false; c.shakeTimer = 0; });
    keys[0].collected = false; keys[0].visible = true;
    keys[1].collected = false; keys[1].visible = false;
    keys[2].collected = false; keys[2].visible = false;

    keyCountDisplayEl.textContent = 'NONE (0/1)';
    keyCountDisplayEl.classList.remove('ready');

    [1, 2, 3].forEach(id => {
      const box = document.getElementById(`roster-heroine-${id}`);
      if (box) box.classList.remove('rescued');
    });

    gameoverModal.classList.remove('active');
    victoryModal.classList.remove('active');
    dialogueBoxEl.classList.remove('active');

    startGameCountdown();
  }

  // --------------------------------------------------------------------------
  // 12. UNIVERSAL INPUT HANDLING (KEYBOARD, MOUSE, TOUCH DRAG)
  // --------------------------------------------------------------------------
  function setupInputListeners() {
    // Keyboard
    window.addEventListener('keydown', e => {
      if (keysDown.hasOwnProperty(e.code)) keysDown[e.code] = true;
      if (e.code === 'KeyE' || e.code === 'Space') executeInteraction();
      if (e.code === 'KeyM') {
        const muted = audioPack.toggleMute();
        btnToggleSound.textContent = muted ? '🔇' : '🔊';
      }
    });

    window.addEventListener('keyup', e => {
      if (keysDown.hasOwnProperty(e.code)) keysDown[e.code] = false;
    });

    // Touch & Mouse Dragging / Virtual Joystick
    function handlePointerStart(clientX, clientY) {
      if (STATE.phase !== 'COUNTDOWN' && STATE.phase !== 'PLAYING') return;
      pointerInput.active = true;
      pointerInput.startX = clientX;
      pointerInput.startY = clientY;
      pointerInput.currX = clientX;
      pointerInput.currY = clientY;
      pointerInput.moveX = 0;
      pointerInput.moveY = 0;

      if (touchJoystickBase) {
        touchJoystickBase.style.left = `${clientX}px`;
        touchJoystickBase.style.top = `${clientY}px`;
        touchJoystickBase.classList.add('active');
        if (touchJoystickStick) {
          touchJoystickStick.style.transform = 'translate(-50%, -50%)';
        }
      }
    }

    function handlePointerMove(clientX, clientY) {
      if (!pointerInput.active) return;
      pointerInput.currX = clientX;
      pointerInput.currY = clientY;

      const dx = clientX - pointerInput.startX;
      const dy = clientY - pointerInput.startY;
      const dist = Math.hypot(dx, dy);

      if (dist > 8) {
        pointerInput.moveX = Math.max(-1, Math.min(1, dx / 40));
        pointerInput.moveY = Math.max(-1, Math.min(1, dy / 40));

        if (touchJoystickStick) {
          const maxStick = 32;
          const sx = (dx / dist) * Math.min(dist, maxStick);
          const sy = (dy / dist) * Math.min(dist, maxStick);
          touchJoystickStick.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
        }
      } else {
        pointerInput.moveX = 0;
        pointerInput.moveY = 0;
      }
    }

    function handlePointerEnd() {
      pointerInput.active = false;
      pointerInput.moveX = 0;
      pointerInput.moveY = 0;
      if (touchJoystickBase) {
        touchJoystickBase.classList.remove('active');
      }
    }

    // Touch Events
    window.addEventListener('touchstart', e => {
      // Don't intercept HUD clicks
      if (e.target.closest('#hud-top') || e.target.closest('.modal-screen') || e.target.closest('#action-prompt-float')) return;
      const t = e.touches[0];
      handlePointerStart(t.clientX, t.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', e => {
      if (!pointerInput.active) return;
      const t = e.touches[0];
      handlePointerMove(t.clientX, t.clientY);
    }, { passive: false });

    window.addEventListener('touchend', () => handlePointerEnd());
    window.addEventListener('touchcancel', () => handlePointerEnd());

    // Mouse Dragging
    window.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.closest('#hud-top') || e.target.closest('.modal-screen') || e.target.closest('#action-prompt-float')) return;
      handlePointerStart(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', e => {
      if (pointerInput.active) {
        handlePointerMove(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', () => handlePointerEnd());

    // Prompt click
    actionPromptFloat.addEventListener('click', () => {
      executeInteraction();
    });

    // BGM Volume Slider
    if (bgmVolumeSlider) {
      bgmVolumeSlider.addEventListener('input', e => {
        const val = parseFloat(e.target.value) / 100;
        audioPack.setBGMVolume(val);
      });
    }

    // Sound toggle
    btnToggleSound.addEventListener('click', () => {
      const muted = audioPack.toggleMute();
      btnToggleSound.textContent = muted ? '🔇' : '🔊';
    });

    // Start / Restart
    btnStartGame.addEventListener('click', () => {
      startModal.classList.remove('active');
      resetGame();
    });

    btnRestartGame.addEventListener('click', () => { resetGame(); });
    btnPlayAgain.addEventListener('click', () => { resetGame(); });

    // Initial click on start modal plays intro loop theme
    window.addEventListener('click', () => {
      if (STATE.phase === 'INTRO') {
        audioPack.playStartLoop();
      }
    }, { once: true });
  }

  // --------------------------------------------------------------------------
  // 13. HERO UPDATE WITH CORNER-ALIGNMENT ASSIST (SMOOTH GRID TURNS)
  // --------------------------------------------------------------------------
  function updateHero() {
    if (STATE.phase !== 'COUNTDOWN' && STATE.phase !== 'PLAYING') return;

    let moveX = 0;
    let moveY = 0;

    // Keyboard
    if (keysDown.ArrowUp || keysDown.KeyW) moveY -= 1;
    if (keysDown.ArrowDown || keysDown.KeyS) moveY += 1;
    if (keysDown.ArrowLeft || keysDown.KeyA) moveX -= 1;
    if (keysDown.ArrowRight || keysDown.KeyD) moveX += 1;

    // Pointer (Touch / Mouse drag)
    if (pointerInput.active) {
      moveX += pointerInput.moveX;
      moveY += pointerInput.moveY;
    }

    const inputMag = Math.hypot(moveX, moveY);
    if (inputMag > 1) {
      moveX /= inputMag;
      moveY /= inputMag;
    }

    if (Math.abs(moveX) > Math.abs(moveY)) {
      hero.facing = moveX > 0 ? 'right' : 'left';
    } else if (moveY !== 0) {
      hero.facing = moveY > 0 ? 'down' : 'up';
    }

    // ========================================================================
    // CORNER-ALIGNMENT ASSIST (Eliminates getting stuck on hallway corners!)
    // ========================================================================
    const colCenter = Math.floor(hero.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    const rowCenter = Math.floor(hero.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    const alignStrength = 0.28;

    // If attempting to move Vertically, automatically center on corridor in X
    if (Math.abs(moveY) > 0.3 && Math.abs(moveX) < 0.3) {
      const xDiff = colCenter - hero.x;
      if (Math.abs(xDiff) < 16) {
        hero.x += xDiff * alignStrength;
      }
    }

    // If attempting to move Horizontally, automatically center on corridor in Y
    if (Math.abs(moveX) > 0.3 && Math.abs(moveY) < 0.3) {
      const yDiff = rowCenter - hero.y;
      if (Math.abs(yDiff) < 16) {
        hero.y += yDiff * alignStrength;
      }
    }

    const currentSpeed = HERO_SPEED;
    const targetVx = moveX * currentSpeed;
    const targetVy = moveY * currentSpeed;

    hero.vx += (targetVx - hero.vx) * 0.6;
    hero.vy += (targetVy - hero.vy) * 0.6;

    // Wall sliding: check X and Y separately
    const nextX = hero.x + hero.vx;
    const nextY = hero.y + hero.vy;

    if (canMoveTo(nextX, hero.y, hero.radius)) {
      hero.x = nextX;
    } else {
      hero.vx = 0;
    }

    if (canMoveTo(hero.x, nextY, hero.radius)) {
      hero.y = nextY;
    } else {
      hero.vy = 0;
    }

    hero.x = Math.max(hero.radius + 10, Math.min(WORLD_W - hero.radius - 10, hero.x));
    hero.y = Math.max(hero.radius + 10, Math.min(WORLD_H - hero.radius - 10, hero.y));

    updateHeroHistory();
    updateFollowers();
    checkInteractions();
  }

  // --------------------------------------------------------------------------
  // 14. RENDERING PIPELINE (HIGH CONTRAST & CLEAN LABELS)
  // --------------------------------------------------------------------------
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.w = canvas.width;
    camera.h = canvas.height;
  }

  function updateCamera() {
    const targetCamX = hero.x - camera.w / 2;
    const targetCamY = hero.y - camera.h / 2;

    camera.x += (targetCamX - camera.x) * 0.14;
    camera.y += (targetCamY - camera.y) * 0.14;

    if (camera.w < WORLD_W) {
      camera.x = Math.max(0, Math.min(WORLD_W - camera.w, camera.x));
    } else {
      camera.x = (WORLD_W - camera.w) / 2;
    }

    if (camera.h < WORLD_H) {
      camera.y = Math.max(0, Math.min(WORLD_H - camera.h, camera.y));
    } else {
      camera.y = (WORLD_H - camera.h) / 2;
    }
  }

  function renderMaze(ctx) {
    const startCol = Math.max(0, Math.floor(camera.x / TILE_SIZE));
    const endCol = Math.min(GRID_W - 1, Math.ceil((camera.x + camera.w) / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(camera.y / TILE_SIZE));
    const endRow = Math.min(GRID_H - 1, Math.ceil((camera.y + camera.h) / TILE_SIZE));

    // 1. Walkable Slate Gray Floors
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const px = c * TILE_SIZE;
        const py = r * TILE_SIZE;

        if (MAZE_GRID[r][c] === 0 || MAZE_GRID[r][c] === 2) {
          const hash = (c * 17 + r * 31) % 4;
          ctx.fillStyle = hash === 0 ? '#272b38' : hash === 1 ? '#2c303f' : hash === 2 ? '#242834' : '#292d3b';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

          ctx.strokeStyle = '#1b1d26';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        }
      }
    }

    // 2. Impassable Dark Crimson Masonry Walls
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const px = c * TILE_SIZE;
        const py = r * TILE_SIZE;

        if (MAZE_GRID[r][c] === 1) {
          // Drop shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 14);

          // Wall face
          ctx.fillStyle = '#381418';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

          // Wall top
          ctx.fillStyle = '#260d10';
          ctx.fillRect(px, py, TILE_SIZE, 10);

          // Top highlight line
          ctx.fillStyle = '#5c222a';
          ctx.fillRect(px, py + 10, TILE_SIZE, 3);

          ctx.strokeStyle = '#1a060a';
          ctx.lineWidth = 2;
          ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        } else if (MAZE_GRID[r][c] === 2) {
          // Pillar
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.beginPath();
          ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 6, TILE_SIZE / 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#36181e';
          ctx.beginPath();
          ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#d4af37';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }
    }

    // 3. Wall Torches
    TORCHES.forEach(t => {
      t.flicker = (t.flicker + 0.08) % (Math.PI * 2);
      const intensity = 0.85 + Math.sin(t.flicker * 3) * 0.15;

      ctx.fillStyle = '#4a4d5a';
      ctx.fillRect(t.x - 5, t.y - 5, 10, 10);

      ctx.fillStyle = '#ff7700';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 6 * intensity, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 2, 3.5 * intensity, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function renderCages(ctx, dt) {
    cages.forEach(c => {
      // Handle wrong key shake animation
      let offsetX = 0;
      if (c.shakeTimer > 0) {
        c.shakeTimer -= dt;
        offsetX = Math.sin(c.shakeTimer * 40) * 5;
      }

      const cx = c.x + offsetX;
      const cy = c.y;

      ctx.fillStyle = 'rgba(10, 12, 18, 0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, 36, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = c.unlocked ? '#4ade80' : (c.shakeTimer > 0 ? '#ff1f43' : '#d4af37');
      ctx.lineWidth = 2.5;
      ctx.stroke();

      if (!c.unlocked) {
        renderBoxedSprite(
          ctx,
          ASSETS[c.heroineKey].img,
          cx,
          cy,
          CHAR_BOX_SIZE,
          CHAR_BOX_RADIUS,
          {
            borderColor: c.shakeTimer > 0 ? '#ff1f43' : '#ffd700',
            borderWidth: 2.5,
            bgColor: '#1a1c28',
            tag: c.name.toUpperCase()
          }
        );

        // Heavy vertical iron bars
        ctx.save();
        const barW = 4;
        const barSpacing = 10;
        const startX = cx - 22;

        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 5;

        for (let bx = startX; bx <= cx + 22; bx += barSpacing) {
          const barGrad = ctx.createLinearGradient(bx, cy - 26, bx + barW, cy - 26);
          barGrad.addColorStop(0, '#2b2d38');
          barGrad.addColorStop(0.5, '#8c91a4');
          barGrad.addColorStop(1, '#1e2029');

          ctx.fillStyle = barGrad;
          ctx.fillRect(bx, cy - 26, barW, 52);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fillRect(bx + 1, cy - 26, 1.2, 52);
        }

        [cy - 14, cy + 14].forEach(hy => {
          ctx.fillStyle = '#363948';
          ctx.fillRect(cx - 26, hy, 52, 5);
          ctx.strokeStyle = '#5a5e73';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx - 26, hy, 52, 5);
        });

        ctx.fillStyle = c.shakeTimer > 0 ? '#ff3344' : '#ffd700';
        ctx.font = 'bold 20px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔒', cx, cy);

        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(74, 222, 128, 0.15)';
        ctx.fillRect(cx - 26, cy - 26, 52, 52);
      }
    });
  }

  function renderKeys(ctx, time) {
    keys.forEach(k => {
      if (k.visible && !k.collected) {
        const floatOffset = Math.sin(time * 3.5 + k.id) * 6;
        const ky = k.y + floatOffset;

        ctx.save();

        const beamGrad = ctx.createLinearGradient(k.x, ky - 50, k.x, ky + 50);
        beamGrad.addColorStop(0, 'rgba(255, 215, 0, 0)');
        beamGrad.addColorStop(0.5, 'rgba(255, 215, 0, 0.35)');
        beamGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(k.x - 14, ky - 50, 28, 100);

        const glow = ctx.createRadialGradient(k.x, ky, 6, k.x, ky, 36);
        glow.addColorStop(0, 'rgba(255, 235, 120, 0.9)');
        glow.addColorStop(0.5, 'rgba(255, 215, 0, 0.45)');
        glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(k.x, ky, 36, 0, Math.PI * 2);
        ctx.fill();

        if (ASSETS.key.img && ASSETS.key.img.complete) {
          ctx.drawImage(ASSETS.key.img, k.x - 21, ky - 21, 42, 42);
        } else {
          ctx.fillStyle = '#ffd700';
          ctx.font = '28px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🗝️', k.x, ky);
        }

        ctx.fillStyle = 'rgba(10, 12, 18, 0.9)';
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1.5;
        const lblW = 68;
        const lblH = 18;
        const lblX = k.x - lblW / 2;
        const lblY = ky + 26;

        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(lblX, lblY, lblW, lblH, 6);
        else ctx.rect(lblX, lblY, lblW, lblH);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 11px Cinzel, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`KEY #${k.id}`, k.x, lblY + lblH / 2);

        ctx.restore();
      }
    });
  }

  function renderCharacters(ctx, time) {
    // 1. Rescued Heroines (Follower Train)
    followers.forEach((f, idx) => {
      const bob = Math.sin(time * 5 + idx * 1.5) * 2;
      renderBoxedSprite(
        ctx,
        f.img,
        f.x,
        f.y + bob,
        CHAR_BOX_SIZE,
        CHAR_BOX_RADIUS,
        {
          borderColor: '#ffd700',
          borderWidth: 2.5,
          bgColor: '#1b1d2c',
          shadowColor: 'rgba(255, 215, 0, 0.55)',
          shadowBlur: 12,
          tag: f.name.toUpperCase()
        }
      );
    });

    // 2. Raja Saab (Hero)
    const heroBob = (Math.abs(hero.vx) > 0.1 || Math.abs(hero.vy) > 0.1) ? Math.sin(time * 12) * 2.5 : 0;
    renderBoxedSprite(
      ctx,
      ASSETS.hero.img,
      hero.x,
      hero.y + heroBob,
      CHAR_BOX_SIZE + 2,
      CHAR_BOX_RADIUS,
      {
        borderColor: '#e2e8f0',
        borderWidth: 2.5,
        bgColor: '#151724',
        shadowColor: 'rgba(200, 220, 255, 0.65)',
        shadowBlur: 14,
        tag: 'RAJA SAAB'
      }
    );

    // 3. Directional Compass Guide Arrow
    const currentTarget = getCurrentTarget();
    if (currentTarget && currentTarget.target) {
      const t = currentTarget.target;
      const dx = t.x - hero.x;
      const dy = t.y - hero.y;
      const angle = Math.atan2(dy, dx);
      const distMeters = Math.round(Math.hypot(dx, dy) / 30);

      ctx.save();
      ctx.translate(hero.x, hero.y);
      ctx.rotate(angle);

      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(38, 0);
      ctx.lineTo(26, -7);
      ctx.lineTo(28, -2);
      ctx.lineTo(18, -2);
      ctx.lineTo(18, 2);
      ctx.lineTo(28, 2);
      ctx.lineTo(26, 7);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      ctx.fillStyle = 'rgba(10, 12, 18, 0.85)';
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      const distW = 86;
      const distH = 16;
      const distY = hero.y + CHAR_BOX_SIZE / 2 + 20;

      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(hero.x - distW / 2, distY, distW, distH, 4);
      else ctx.rect(hero.x - distW / 2, distY, distW, distH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 9px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${currentTarget.name}: ${distMeters}m`, hero.x, distY + distH / 2);
    }

    // 4. The Shadow (Villain)
    ctx.save();
    if (villain.active) {
      const auraPulse = Math.sin(time * 8) * 4;
      const villainGlow = ctx.createRadialGradient(villain.x, villain.y, 10, villain.x, villain.y, 40 + auraPulse);
      villainGlow.addColorStop(0, 'rgba(255, 10, 40, 0.6)');
      villainGlow.addColorStop(1, 'rgba(139, 0, 0, 0)');
      ctx.fillStyle = villainGlow;
      ctx.beginPath();
      ctx.arc(villain.x, villain.y, 40 + auraPulse, 0, Math.PI * 2);
      ctx.fill();

      if (villain.isEnraged) {
        ctx.fillStyle = '#ff1f43';
        ctx.font = 'bold 11px Cinzel, serif';
        ctx.textAlign = 'center';
        ctx.fillText('! HUNTING !', villain.x, villain.y - 34);
      }
    } else {
      ctx.strokeStyle = 'rgba(255, 40, 60, 0.6)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(villain.x, villain.y, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255, 60, 60, 0.9)';
      ctx.font = 'bold 10px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillText('SEALED (5s)', villain.x, villain.y - 34);
    }

    renderBoxedSprite(
      ctx,
      ASSETS.villain.img,
      villain.x,
      villain.y,
      CHAR_BOX_SIZE + 4,
      CHAR_BOX_RADIUS,
      {
        borderColor: villain.isEnraged ? '#ff0033' : '#8b0000',
        borderWidth: 3,
        bgColor: '#100004',
        shadowColor: 'rgba(255, 20, 40, 0.85)',
        shadowBlur: 16,
        tag: 'THE SHADOW'
      }
    );
    ctx.restore();
  }

  function renderDarknessAndLighting(ctx) {
    ctx.save();

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const mCtx = maskCanvas.getContext('2d');

    mCtx.fillStyle = 'rgba(8, 9, 14, 0.60)';
    mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    mCtx.globalCompositeOperation = 'destination-out';

    // 1. Hero's Lantern
    const screenHeroX = hero.x - camera.x;
    const screenHeroY = hero.y - camera.y;

    const lanternRadius = 420;
    const heroGrad = mCtx.createRadialGradient(screenHeroX, screenHeroY, 60, screenHeroX, screenHeroY, lanternRadius);
    heroGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
    heroGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.85)');
    heroGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    mCtx.fillStyle = heroGrad;
    mCtx.beginPath();
    mCtx.arc(screenHeroX, screenHeroY, lanternRadius, 0, Math.PI * 2);
    mCtx.fill();

    // 2. Rescued Heroines
    followers.forEach(f => {
      const fx = f.x - camera.x;
      const fy = f.y - camera.y;
      const fGrad = mCtx.createRadialGradient(fx, fy, 20, fx, fy, 200);
      fGrad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
      fGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      mCtx.fillStyle = fGrad;
      mCtx.beginPath();
      mCtx.arc(fx, fy, 200, 0, Math.PI * 2);
      mCtx.fill();
    });

    // 3. Wall Torches
    TORCHES.forEach(t => {
      const tx = t.x - camera.x;
      const ty = t.y - camera.y;
      if (tx > -150 && tx < camera.w + 150 && ty > -150 && ty < camera.h + 150) {
        const torchRadius = 180 + Math.sin(t.flicker * 3) * 15;
        const tGrad = mCtx.createRadialGradient(tx, ty, 15, tx, ty, torchRadius);
        tGrad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
        tGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        mCtx.fillStyle = tGrad;
        mCtx.beginPath();
        mCtx.arc(tx, ty, torchRadius, 0, Math.PI * 2);
        mCtx.fill();
      }
    });

    // 4. Glowing Keys
    keys.forEach(k => {
      if (k.visible && !k.collected) {
        const kx = k.x - camera.x;
        const ky = k.y - camera.y;
        const kGrad = mCtx.createRadialGradient(kx, ky, 10, kx, ky, 150);
        kGrad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
        kGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        mCtx.fillStyle = kGrad;
        mCtx.beginPath();
        mCtx.arc(kx, ky, 150, 0, Math.PI * 2);
        mCtx.fill();
      }
    });

    // 5. Cages
    cages.forEach(c => {
      if (!c.unlocked) {
        const cx = c.x - camera.x;
        const cy = c.y - camera.y;
        const cGrad = mCtx.createRadialGradient(cx, cy, 15, cx, cy, 180);
        cGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        mCtx.fillStyle = cGrad;
        mCtx.beginPath();
        mCtx.arc(cx, cy, 180, 0, Math.PI * 2);
        mCtx.fill();
      }
    });

    // 6. Villain glow
    const vx = villain.x - camera.x;
    const vy = villain.y - camera.y;
    const vGrad = mCtx.createRadialGradient(vx, vy, 10, vx, vy, 110);
    vGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    vGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    mCtx.fillStyle = vGrad;
    mCtx.beginPath();
    mCtx.arc(vx, vy, 110, 0, Math.PI * 2);
    mCtx.fill();

    ctx.drawImage(maskCanvas, 0, 0);
    ctx.restore();
  }

  function renderParticles(ctx, dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * (p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function renderMiniMap() {
    const mmW = minimapCanvas.width = 145;
    const mmH = minimapCanvas.height = 110;

    mmCtx.fillStyle = '#0f111a';
    mmCtx.fillRect(0, 0, mmW, mmH);

    const scaleX = mmW / WORLD_W;
    const scaleY = mmH / WORLD_H;

    mmCtx.fillStyle = '#3a181e';
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        if (MAZE_GRID[r][c] === 1) {
          mmCtx.fillRect(c * TILE_SIZE * scaleX, r * TILE_SIZE * scaleY, TILE_SIZE * scaleX + 0.5, TILE_SIZE * scaleY + 0.5);
        }
      }
    }

    cages.forEach(c => {
      mmCtx.fillStyle = c.unlocked ? '#22c55e' : '#ef4444';
      mmCtx.beginPath();
      mmCtx.arc(c.x * scaleX, c.y * scaleY, 3.5, 0, Math.PI * 2);
      mmCtx.fill();
    });

    keys.forEach(k => {
      if (k.visible && !k.collected) {
        mmCtx.fillStyle = '#ffd700';
        mmCtx.beginPath();
        mmCtx.arc(k.x * scaleX, k.y * scaleY, 4.5, 0, Math.PI * 2);
        mmCtx.fill();
      }
    });

    followers.forEach(f => {
      mmCtx.fillStyle = '#f59e0b';
      mmCtx.beginPath();
      mmCtx.arc(f.x * scaleX, f.y * scaleY, 3, 0, Math.PI * 2);
      mmCtx.fill();
    });

    mmCtx.fillStyle = '#38bdf8';
    mmCtx.beginPath();
    mmCtx.arc(hero.x * scaleX, hero.y * scaleY, 4, 0, Math.PI * 2);
    mmCtx.fill();

    const dist = Math.hypot(hero.x - villain.x, hero.y - villain.y);
    if (dist < 450 || villain.isEnraged) {
      mmCtx.fillStyle = '#ff1f43';
      mmCtx.beginPath();
      mmCtx.arc(villain.x * scaleX, villain.y * scaleY, 4.5, 0, Math.PI * 2);
      mmCtx.fill();
    }
  }

  // --------------------------------------------------------------------------
  // 15. MAIN GAME LOOP
  // --------------------------------------------------------------------------
  let lastFrameTime = performance.now();

  function gameLoop(now) {
    const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
    lastFrameTime = now;

    if (STATE.phase === 'COUNTDOWN') {
      STATE.countdownTime -= dt;
      const currentSeconds = Math.ceil(STATE.countdownTime);
      if (currentSeconds !== parseInt(countdownNumberEl.textContent)) {
        updateCountdownUI(currentSeconds);
      }
      if (STATE.countdownTime <= 0) {
        updateCountdownUI(0);
        onCountdownFinished();
      }
      updateHero();
    } else if (STATE.phase === 'PLAYING') {
      updateHero();
      updateVillain(dt);

      const dist = Math.hypot(hero.x - villain.x, hero.y - villain.y);
      if (dist < 260) {
        threatIndicatorEl.textContent = 'EXTREME DANGER!';
        threatIndicatorEl.style.color = '#ff1f43';
        threatDotEl.className = 'threat-pulse-dot danger';
      } else if (dist < 460) {
        threatIndicatorEl.textContent = 'APPROACHING...';
        threatIndicatorEl.style.color = '#f59e0b';
        threatDotEl.className = 'threat-pulse-dot caution';
      } else {
        threatIndicatorEl.textContent = 'SAFE (DISTANT)';
        threatIndicatorEl.style.color = '#22c55e';
        threatDotEl.className = 'threat-pulse-dot';
      }
    }

    updateCamera();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    renderMaze(ctx);
    renderCages(ctx, dt);
    renderKeys(ctx, now * 0.001);
    renderCharacters(ctx, now * 0.001);
    renderParticles(ctx, dt);

    ctx.restore();

    renderDarknessAndLighting(ctx);
    renderMiniMap();

    requestAnimationFrame(gameLoop);
  }

  // --------------------------------------------------------------------------
  // 16. INITIALIZATION
  // --------------------------------------------------------------------------
  function init() {
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    setupInputListeners();

    loadAllAssets(() => {
      console.log('The Raja Saab: Shadows of the Labyrinth loaded successfully.');
    });

    requestAnimationFrame(gameLoop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
