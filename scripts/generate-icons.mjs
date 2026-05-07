// Generates minimal valid PNG icons using raw PNG encoding
import { writeFileSync } from "fs";
import { createCanvas } from "canvas";

function make(size) {
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");

  // Orange rounded background
  ctx.fillStyle = "#f5a623";
  ctx.beginPath();
  const r = size * 0.2;
  ctx.roundRect(0, 0, size, size, r);
  ctx.fill();

  // Dark chart line
  const p = size * 0.22;
  ctx.strokeStyle = "#0a0f1e";
  ctx.lineWidth = size * 0.09;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(p, size - p);
  ctx.lineTo(size * 0.42, size * 0.5);
  ctx.lineTo(size * 0.65, size * 0.62);
  ctx.lineTo(size - p, p);
  ctx.stroke();

  return c.toBuffer("image/png");
}

writeFileSync("public/icon-192.png", make(192));
writeFileSync("public/icon-512.png", make(512));
console.log("Done");
