const loader = document.querySelector("#intro-loader");
const header = document.querySelector("#site-header");
const progress = document.querySelector("#scroll-progress");
const canvas = document.querySelector("#motion-canvas");
const riskValue = document.querySelector("#risk-value");
const alphaValue = document.querySelector("#alpha-value");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;
let ratio = 1;
let time = 0;
let pointerX = 0.5;
let pointerY = 0.5;

const nodes = Array.from({ length: 72 }, (_, index) => ({
  x: (index * 97.31) % 1,
  y: (Math.sin(index * 8.71) + 1) / 2,
  speed: 0.00034 + (index % 8) * 0.0001,
  size: 0.9 + (index % 5) * 0.28,
}));

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  ratio = window.devicePixelRatio || 1;
  width = Math.max(320, rect.width);
  height = Math.max(420, rect.height);
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawWave() {
  const baseY = height * 0.54;
  const amplitude = height * 0.072;
  const startX = width * 0.39;
  const endX = width * 1.02;

  for (let layer = 0; layer < 4; layer += 1) {
    ctx.beginPath();
    for (let i = 0; i <= 180; i += 1) {
      const t = i / 180;
      const x = startX + (endX - startX) * t;
      const drift = Math.sin(t * Math.PI * (4.5 + layer * 0.5) + time * (0.011 + layer * 0.003));
      const fine = Math.cos(t * Math.PI * 15 + time * 0.016);
      const y = baseY + drift * amplitude * (0.7 - layer * 0.11) + fine * 8 + layer * 24;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle =
      layer === 0
        ? "rgba(105, 213, 199, 0.72)"
        : layer === 1
          ? "rgba(242, 185, 103, 0.5)"
          : "rgba(255, 248, 234, 0.2)";
    ctx.lineWidth = layer === 0 ? 2.35 : 1.2;
    ctx.shadowColor = layer === 0 ? "rgba(105, 213, 199, 0.72)" : "transparent";
    ctx.shadowBlur = layer === 0 ? 18 : 0;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawNodes() {
  const offsetX = (pointerX - 0.5) * 36;
  const offsetY = (pointerY - 0.5) * 22;
  nodes.forEach((node, index) => {
    node.x += node.speed;
    if (node.x > 1.05) node.x = -0.05;
    const x = node.x * width + offsetX;
    const y = node.y * height + Math.sin(time * 0.01 + index) * 20 + offsetY;
    ctx.beginPath();
    ctx.arc(x, y, node.size, 0, Math.PI * 2);
    ctx.fillStyle = index % 4 === 0 ? "rgba(242, 185, 103, 0.72)" : "rgba(105, 213, 199, 0.56)";
    ctx.fill();

    if (index % 3 === 0) {
      const next = nodes[(index + 9) % nodes.length];
      const nx = next.x * width + offsetX;
      const ny = next.y * height + Math.cos(time * 0.01 + index) * 17 + offsetY;
      const distance = Math.hypot(nx - x, ny - y);
      if (distance < 280) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = `rgba(105, 213, 199, ${Math.max(0, 0.2 - distance / 1700)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  });
}

function drawBars() {
  const left = width * 0.62;
  const bottom = height * 0.77;
  const barWidth = 5;
  for (let i = 0; i < 42; i += 1) {
    const value = 22 + Math.sin(i * 0.72 + time * 0.034) * 22 + Math.cos(i * 0.31 + time * 0.018) * 13;
    const x = left + i * 9;
    const h = Math.max(8, value);
    ctx.fillStyle = i % 5 === 0 ? "rgba(242, 185, 103, 0.62)" : "rgba(105, 213, 199, 0.38)";
    ctx.fillRect(x, bottom - h, barWidth, h);
  }
}

function drawSweep() {
  const x = ((time * 2.2) % (width * 1.3)) - width * 0.15;
  const gradient = ctx.createLinearGradient(x - 80, 0, x + 80, 0);
  gradient.addColorStop(0, "rgba(105, 213, 199, 0)");
  gradient.addColorStop(0.5, "rgba(105, 213, 199, 0.16)");
  gradient.addColorStop(1, "rgba(105, 213, 199, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x - 80, 0, 160, height);
}

function animate() {
  time += 1;
  ctx.clearRect(0, 0, width, height);
  drawSweep();
  drawNodes();
  drawWave();
  drawBars();
  if (time % 8 === 0) {
    riskValue.textContent = (0.62 + Math.sin(time * 0.018) * 0.16).toFixed(2);
    alphaValue.textContent = `${1.55 + Math.cos(time * 0.016) * 0.44 > 0 ? "+" : ""}${(1.55 + Math.cos(time * 0.016) * 0.44).toFixed(2)}`;
  }
  requestAnimationFrame(animate);
}

function setupReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.18 },
  );
  document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));
}

function handleScroll() {
  header.classList.toggle("scrolled", window.scrollY > 24);
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progressValue = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  progress.style.width = `${Math.min(100, Math.max(0, progressValue))}%`;
}

window.addEventListener("load", () => {
  setTimeout(() => loader.classList.add("done"), 480);
});

window.addEventListener("resize", resizeCanvas);
window.addEventListener("scroll", handleScroll, { passive: true });
window.addEventListener("pointermove", (event) => {
  pointerX = event.clientX / Math.max(window.innerWidth, 1);
  pointerY = event.clientY / Math.max(window.innerHeight, 1);
});

resizeCanvas();
setupReveal();
handleScroll();
animate();
