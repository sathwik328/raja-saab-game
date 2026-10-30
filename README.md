# 🗝️ Shadows of the Labyrinth - 2D Survival Horror Escape

A 2D top-down survival horror maze game built with HTML5, JavaScript, and Canvas, featuring a dark moody gothic horror aesthetic, dynamic torchlight and fog of war, BFS villain tracking AI, proximity heartbeat audio, and follower train queue mechanics.

---

## 🎭 The Cast & Asset Mapping

All character avatars and sprites are rendered inside sleek boxed containers with clean, smooth rounded corners:

- **Hero**: `hero.png` (or `assets/images/hero.png`)
- **Villain**: `villain.png` (or `assets/images/villain.png`)
- **Heroine 1**: `heroine1.png` (or `assets/images/heroine1.png`)
- **Heroine 2**: `heroine2.png` (or `assets/images/heroine2.png`)
- **Heroine 3**: `heroine3.png` (or `assets/images/heroine3.png`)
- **Key Item**: `key.png` (or `assets/images/key.png`)

### 🔊 Audio Mapping & Auto-Fallback Engine

- **`heroine3_sound.mp3`**: Plays when Heroine 3 is freed from Cage 3 (*"Woah! Nenu vallala pichi danni anukunnava?"*).
- **`villain_sound.mp3`**: Plays and scales volume dynamically as the villain approaches.
  - *Fallback*: If this file is missing, the built-in **Web Audio API Synth Engine** automatically kicks in with a terrifying deep sub-bass drone and accelerating organic heartbeat pulse synchronized with a blood-red screen vignette!
- **`gameover.mp3`**: Plays when caught by the villain.
  - *Fallback*: Built-in multi-oscillator horror jumpscare sting.

> 💡 **Adding audio files later:** You can simply drop your `villain_sound.mp3` or `gameover.mp3` files into the `assets/audio/` folder (or project root), and the game will automatically detect and play them!

---

## 🎮 Game Progression & Features

1. **5-Second Countdown Head Start**:
   - When the game starts, a large gothic countdown timer displays (*"Villain approaches in: 5... 4... 3... 2... 1..."*).
   - The hero can move freely to establish distance from the spawn chamber while the villain remains sealed in the crypt.
2. **Key & Cage Progression Loop**:
   - **Stage 1**: Find **Key 1** in the South-West catacombs $\rightarrow$ Reach **Cage 1** $\rightarrow$ Press Unlock $\rightarrow$ Heroine 1 joins the train.
   - **Stage 2**: Find **Key 2** in the Grand Central Hall $\rightarrow$ Reach **Cage 2** $\rightarrow$ Unlock $\rightarrow$ Heroine 2 joins behind Heroine 1.
   - **Stage 3**: Find **Key 3** in the dark corridors $\rightarrow$ Reach **Cage 3** $\rightarrow$ Unlock $\rightarrow$ Heroine 3 is freed, plays `heroine3_sound.mp3`, and triggers the **Victory Screen**!
3. **Follower Train Mechanic**:
   - Rescued heroines trail smoothly along the hero's exact corridor path (`Hero -> Heroine 1 -> Heroine 2 -> Heroine 3`) without clipping through walls.
   - Rescued companions illuminate the dark maze with their own ambient warmth!
4. **Villain AI**:
   - Uses Breadth-First Search (BFS) pathfinding through corridors.
   - Surges into an enraged sprint when direct line-of-sight to the hero is established!
5. **Controls**:
   - **PC**: WASD / Arrow keys to move. `E` or `Space` to Collect Key / Unlock Cage. `M` to toggle mute.
   - **Mobile / Touch**: On-screen 4-way D-Pad + interactive Context Action Button.

---

## 🚀 How to Run Locally

You can test the game using any static file server:

### Option A: Python (Built-in)
```bash
python -m http.server 8080
```
Then open [http://localhost:8080](http://localhost:8080) in your browser.

### Option B: Node.js `serve` / `npx`
```bash
npx serve .
```

---

## 🌐 How to Deploy to Vercel

This repository is pre-configured for **instant zero-config deployment on Vercel**:

### Method 1: Using GitHub + Vercel Dashboard (Recommended)
1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of RS Horror Maze"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```
2. Log into [vercel.com](https://vercel.com).
3. Click **"Add New Project"** $\rightarrow$ Select your GitHub repository.
4. Leave all build settings as default (Framework Preset: **Other**; Root Directory: `./`).
5. Click **"Deploy"**! Your game will be live with a free `.vercel.app` domain.

### Method 2: Using Vercel CLI
```bash
npm i -g vercel
vercel
```
Follow the short interactive prompts and accept defaults to deploy instantly.
