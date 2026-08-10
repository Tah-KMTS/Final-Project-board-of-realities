import { Game } from "./game.js";

const canvas = document.getElementById("game");

function fit() {
  // Canvas keeps internal 720x960 resolution; CSS handles display size.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  // Keep logical game coords stable; only crisp upscale via CSS.
  canvas.width = 720;
  canvas.height = 960;
  void dpr;
  void cssW;
  void cssH;
}

fit();
window.addEventListener("resize", fit);

new Game(canvas);
