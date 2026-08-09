/**
 * generate-icons.js
 * Tạo PNG icons cho Chrome extension bằng Canvas API
 * Chạy: node generate-icons.js
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 48, 128];

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size;
  const r = s * 0.18; // border radius

  // Background rounded rect
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(s - r, 0);
  ctx.quadraticCurveTo(s, 0, s, r);
  ctx.lineTo(s, s - r);
  ctx.quadraticCurveTo(s, s, s - r, s);
  ctx.lineTo(r, s);
  ctx.quadraticCurveTo(0, s, 0, s - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, '#0d0d1a');
  grad.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = grad;
  ctx.fill();

  // Arrow arc top-right
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.5, s * 0.28, Math.PI * 1.1, Math.PI * 0.1, false);
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = s * 0.1;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Arrow arc bottom-left
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.5, s * 0.28, Math.PI * 0.1, Math.PI * 1.1, false);
  ctx.strokeStyle = '#7c4dff';
  ctx.lineWidth = s * 0.1;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Arrowhead top
  const ax = s * 0.5 + s * 0.28 * Math.cos(Math.PI * 0.1);
  const ay = s * 0.5 + s * 0.28 * Math.sin(Math.PI * 0.1);
  ctx.beginPath();
  ctx.moveTo(ax, ay - s * 0.1);
  ctx.lineTo(ax + s * 0.1, ay);
  ctx.lineTo(ax - s * 0.04, ay + s * 0.08);
  ctx.fillStyle = '#4fc3f7';
  ctx.fill();

  return canvas.toBuffer('image/png');
}

SIZES.forEach(size => {
  try {
    const buf = drawIcon(size);
    const outPath = path.join(__dirname, 'icons', `icon${size}.png`);
    fs.writeFileSync(outPath, buf);
    console.log(`✓ Created icon${size}.png`);
  } catch (e) {
    console.error(`✗ Failed icon${size}:`, e.message);
  }
});
