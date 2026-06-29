const palette = ["#69d5c7", "#f2b967", "#8ba0ff", "#65d59a", "#d66a5e", "#c994e8", "#8ecf73", "#d7d0ba"];

const state = {
  mode: "pic",
  assets: [
    { symbol: "AAPL", name: "Apple Inc.", weight: 35 },
    { symbol: "MSFT", name: "Microsoft Corporation", weight: 25 },
    { symbol: "NVDA", name: "NVIDIA Corporation", weight: 20 },
    { symbol: "SPY", name: "SPDR S&P 500 ETF", weight: 20 },
  ],
  result: null,
  searchTimer: null,
  hover: {
    equity: null,
    drawdown: null,
    volatility: null,
  },
};

const nodes = {
  assetBody: document.querySelector("#asset-body"),
  searchInput: document.querySelector("#asset-search"),
  searchResults: document.querySelector("#search-results"),
  manualAdd: document.querySelector("#manual-add"),
  weightState: document.querySelector("#weight-state"),
  form: document.querySelector("#backtest-form"),
  runButton: document.querySelector("#run-button"),
  formMessage: document.querySelector("#form-message"),
  exportButton: document.querySelector("#export-button"),
  equityChart: document.querySelector("#equity-chart"),
  equityTooltip: document.querySelector("#equity-tooltip"),
  drawdownChart: document.querySelector("#drawdown-chart"),
  drawdownTooltip: document.querySelector("#drawdown-tooltip"),
  volatilityChart: document.querySelector("#volatility-chart"),
  volatilityTooltip: document.querySelector("#volatility-tooltip"),
  allocationChart: document.querySelector("#allocation-chart"),
  allocationList: document.querySelector("#allocation-list"),
  holdingsBody: document.querySelector("#holdings-body"),
  statList: document.querySelector("#stat-list"),
  annualBody: document.querySelector("#annual-body"),
  monthlyHeatmap: document.querySelector("#monthly-heatmap"),
  correlationMatrix: document.querySelector("#correlation-matrix"),
  benchmarkLegend: document.querySelector("#benchmark-legend"),
  modeButtons: document.querySelectorAll("[data-mode]"),
  pacFields: document.querySelectorAll(".pac-field"),
  start: document.querySelector("#start"),
  end: document.querySelector("#end"),
  initial: document.querySelector("#initial"),
  baseCurrency: document.querySelector("#base-currency"),
  contribution: document.querySelector("#contribution"),
  contributionFrequency: document.querySelector("#contribution-frequency"),
  rebalance: document.querySelector("#rebalance"),
  benchmark: document.querySelector("#benchmark"),
  fee: document.querySelector("#fee"),
};

const metricNodes = {
  final: document.querySelector("#metric-final"),
  invested: document.querySelector("#metric-invested"),
  profit: document.querySelector("#metric-profit"),
  contributions: document.querySelector("#metric-contributions"),
  fees: document.querySelector("#metric-fees"),
  return: document.querySelector("#metric-return"),
  twr: document.querySelector("#metric-twr"),
  mwr: document.querySelector("#metric-mwr"),
  cagr: document.querySelector("#metric-cagr"),
  drawdown: document.querySelector("#metric-drawdown"),
  worstDay: document.querySelector("#metric-worst-day"),
  volatility: document.querySelector("#metric-volatility"),
  positiveDays: document.querySelector("#metric-positive-days"),
  sharpe: document.querySelector("#metric-sharpe"),
  sortino: document.querySelector("#metric-sortino"),
  benchmark: document.querySelector("#metric-benchmark"),
};

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function initializeDates() {
  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - 4);
  nodes.start.value = toIsoDate(start);
  nodes.end.value = toIsoDate(end);
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}%`;
}

function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const currency = state.result?.market?.currency || "USD";
  if (currency === "MIX") return formatNumber(value, 0);
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${formatNumber(value, 0)} ${currency}`;
  }
}

function formatRatio(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return formatNumber(value, 2);
}

function formatFrequency(value) {
  const labels = {
    monthly: "Mensile",
    quarterly: "Trimestrale",
    yearly: "Annuale",
    none: "Nessuno",
  };
  return labels[value] || value || "-";
}

function hasBenchmark(result = state.result) {
  return Boolean(result?.market?.benchmark);
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAssets() {
  nodes.assetBody.innerHTML = state.assets
    .map(
      (asset, index) => `
        <tr>
          <td><input class="ticker-input" data-index="${index}" data-field="symbol" value="${escapeHtml(asset.symbol)}" spellcheck="false" /></td>
          <td>${escapeHtml(asset.name || asset.symbol)}</td>
          <td><input class="weight-input" data-index="${index}" data-field="weight" type="number" min="0.01" max="100" step="0.01" value="${asset.weight}" /></td>
          <td><button class="remove-button" type="button" data-remove="${index}" aria-label="Rimuovi ${asset.symbol}">x</button></td>
        </tr>
      `,
    )
    .join("");
  updateWeightState();
}

function readAssets() {
  nodes.assetBody.querySelectorAll("input").forEach((input) => {
    const index = Number(input.dataset.index);
    const field = input.dataset.field;
    if (!state.assets[index]) return;
    if (field === "symbol") state.assets[index].symbol = input.value.trim().toUpperCase();
    if (field === "weight") state.assets[index].weight = Number(input.value);
  });
}

function updateWeightState() {
  const total = state.assets.reduce((sum, asset) => sum + (Number(asset.weight) || 0), 0);
  nodes.weightState.textContent = `Totale ${formatNumber(total)}%`;
  nodes.weightState.classList.toggle("invalid", Math.abs(total - 100) > 0.05);
  return total;
}

function addAsset(asset) {
  const symbol = asset.symbol.trim().toUpperCase();
  if (!symbol) return;
  readAssets();
  if (state.assets.some((item) => item.symbol === symbol)) {
    nodes.formMessage.textContent = `${symbol} e gia nel portafoglio.`;
    return;
  }
  const currentTotal = state.assets.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  const remaining = Math.max(0, 100 - currentTotal);
  state.assets.push({ symbol, name: asset.name || symbol, weight: remaining || 0 });
  renderAssets();
  nodes.searchInput.value = "";
  nodes.searchResults.innerHTML = "";
}

function validateAssets() {
  readAssets();
  const assets = state.assets.filter((asset) => asset.symbol && Number(asset.weight) > 0);
  if (!assets.length) throw new Error("Inserisci almeno un asset.");
  if (new Set(assets.map((asset) => asset.symbol)).size !== assets.length) throw new Error("Rimuovi i ticker duplicati.");
  const total = assets.reduce((sum, asset) => sum + Number(asset.weight), 0);
  if (Math.abs(total - 100) > 0.05) throw new Error("La somma dei pesi deve essere 100%.");
  state.assets = assets;
  return assets;
}

async function searchAssets(query) {
  if (query.trim().length < 2) {
    nodes.searchResults.innerHTML = "";
    return;
  }
  nodes.searchResults.innerHTML = `<div class="search-result"><strong>...</strong><div><small>Ricerca dati mercato</small></div></div>`;
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Ricerca non riuscita.");
    renderSearchResults(payload.results || []);
  } catch (error) {
    nodes.searchResults.innerHTML = `<div class="search-result"><strong>Errore</strong><div><small>${error.message}</small></div></div>`;
  }
}

function renderSearchResults(results) {
  if (!results.length) {
    nodes.searchResults.innerHTML = `<div class="search-result"><strong>Nessun risultato</strong><div><small>Puoi inserire manualmente il ticker.</small></div></div>`;
    return;
  }
  nodes.searchResults.innerHTML = results
    .map(
      (result) => `
        <div class="search-result">
          <strong>${escapeHtml(result.symbol)}</strong>
          <div>
            <span>${escapeHtml(result.name)}</span>
            <small>${escapeHtml([result.exchange, result.type, result.currency].filter(Boolean).join(" / "))}</small>
          </div>
          <button type="button" data-add="${escapeHtml(result.symbol)}" data-name="${escapeHtml(result.name)}">Add</button>
        </div>
      `,
    )
    .join("");
}

function buildQuery() {
  const assets = validateAssets();
  const query = new URLSearchParams();
  query.set("symbols", assets.map((asset) => asset.symbol).join(","));
  query.set("weights", assets.map((asset) => asset.weight).join(","));
  query.set("mode", state.mode);
  query.set("start", nodes.start.value);
  query.set("end", nodes.end.value);
  query.set("initial", nodes.initial.value || "0");
  query.set("currency", nodes.baseCurrency.value || "EUR");
  query.set("contribution", state.mode === "pac" ? nodes.contribution.value || "0" : "0");
  query.set("contributionFrequency", nodes.contributionFrequency.value);
  query.set("rebalance", nodes.rebalance.value);
  query.set("benchmark", nodes.benchmark.value.trim());
  query.set("fee", nodes.fee.value || "0");
  return query.toString();
}

async function runBacktest() {
  try {
    nodes.runButton.disabled = true;
    nodes.formMessage.textContent = "Scarico dati daily adjusted close dal provider dati...";
    const response = await fetch(`/api/backtest?${buildQuery()}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Backtest non riuscito.");
    state.result = payload;
    renderResult(payload);
    nodes.formMessage.textContent = `${payload.range.bars} sessioni dal ${payload.range.start} al ${payload.range.end}.`;
    nodes.exportButton.disabled = false;
  } catch (error) {
    nodes.formMessage.textContent = error.message;
  } finally {
    nodes.runButton.disabled = false;
  }
}

function renderResult(result) {
  const m = result.metrics;
  const s = result.strategy;
  const benchmarkActive = hasBenchmark(result);
  metricNodes.final.textContent = formatMoney(m.finalValue);
  metricNodes.benchmark.textContent = benchmarkActive ? `${result.market.benchmark} TWR ${formatPercent(m.benchmarkPct)}` : "Benchmark non selezionato";
  metricNodes.invested.textContent = formatMoney(m.investedCapital);
  metricNodes.contributions.textContent = `${m.contributions} versamenti`;
  metricNodes.profit.textContent = formatMoney(m.profit);
  metricNodes.fees.textContent = `Costi ${formatMoney(m.feesPaid || s.feesPaid || 0)}`;
  metricNodes.return.textContent = formatPercent(m.returnPct);
  metricNodes.twr.textContent = `TWR ${formatPercent(m.timeWeightedReturnPct)}`;
  metricNodes.mwr.textContent = formatPercent(m.moneyWeightedReturnPct);
  metricNodes.cagr.textContent = `CAGR ${formatPercent(m.cagrPct)}`;
  metricNodes.drawdown.textContent = formatPercent(m.maxDrawdownPct);
  metricNodes.worstDay.textContent = `Worst day ${formatPercent(m.worstDayPct)}`;
  metricNodes.volatility.textContent = formatPercent(m.volatilityPct);
  metricNodes.positiveDays.textContent = `Giorni positivi ${formatPercent(m.positiveDaysPct)}`;
  metricNodes.sharpe.textContent = formatRatio(m.sharpe);
  metricNodes.sortino.textContent = `Sortino ${formatRatio(m.sortino)}`;
  metricNodes.profit.className = m.profit >= 0 ? "positive" : "negative";
  metricNodes.return.className = m.returnPct >= 0 ? "positive" : "negative";
  metricNodes.mwr.className = (m.moneyWeightedReturnPct ?? 0) >= 0 ? "positive" : "negative";
  metricNodes.drawdown.className = "negative";
  metricNodes.sharpe.className = m.sharpe >= 0 ? "positive" : "negative";
  nodes.benchmarkLegend.hidden = !benchmarkActive;
  renderStats(result);
  renderAnnualReturns(result.annualReturns || []);
  renderMonthlyHeatmap(result.monthlyReturns || []);
  renderCorrelation(result.correlation);
  renderHoldings(result.assets);
  renderAllocation(result.assets);
  drawEquityChart(result.curve);
  drawDrawdownChart(result.curve);
  drawVolatilityChart(result.curve);
  drawAllocationChart(result.assets);
}

function renderStats(result) {
  const m = result.metrics;
  const s = result.strategy;
  const benchmarkActive = hasBenchmark(result);
  const rows = [
    ["Strategia", `${s.type} / Rebalance ${formatFrequency(s.rebalance)}`],
    ["Valuta investimento", result.market.baseCurrency || result.market.currency],
    ["Valute strumenti", (result.market.currencies || []).join(", ") || "-"],
    ["Conversioni FX", (result.market.fxConversions || []).length ? (result.market.fxConversions || []).map((item) => `${item.from}/${item.to}`).join(", ") : "Non necessarie"],
    ["Versamento PAC", s.type === "PAC" ? `${formatMoney(s.contribution)} ${formatFrequency(s.contributionFrequency).toLowerCase()}` : "Non attivo"],
    ["Versamenti eseguiti", `${m.contributions} totali, ${m.pacContributions} PAC`],
    ["Ribilanciamenti", `${m.rebalances}`],
    ["Benchmark TWR", benchmarkActive ? formatPercent(m.benchmarkPct) : "-"],
    ["Benchmark CAGR", benchmarkActive ? formatPercent(m.benchmarkCagrPct) : "-"],
    ["Alpha TWR", benchmarkActive ? formatPercent(m.alphaPct) : "-"],
    ["Best month / Worst month", `${formatPercent(m.bestMonthPct)} / ${formatPercent(m.worstMonthPct)}`],
    ["Best year / Worst year", `${formatPercent(m.bestYearPct)} / ${formatPercent(m.worstYearPct)}`],
    ["Best day / Worst day", `${formatPercent(m.bestDayPct)} / ${formatPercent(m.worstDayPct)}`],
    ["Downside deviation", formatPercent(m.downsideDeviationPct)],
    ["Calmar ratio", formatRatio(m.calmar)],
    ["Commissioni stimate", formatMoney(m.feesPaid || s.feesPaid || 0)],
  ];
  nodes.statList.innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="stat-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");
}

function renderAnnualReturns(rows) {
  if (!rows.length) {
    nodes.annualBody.innerHTML = `<tr><td colspan="5" class="empty-state">Esegui un backtest.</td></tr>`;
    return;
  }
  nodes.annualBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.period)}</td>
          <td class="${row.returnPct >= 0 ? "positive" : "negative"}">${formatPercent(row.returnPct)}</td>
          <td>${formatMoney(row.cashflow)}</td>
          <td>${formatMoney(row.investedCapital)}</td>
          <td>${formatMoney(row.endValue)}</td>
        </tr>
      `,
    )
    .join("");
}

function returnColor(value, alpha = 0.82) {
  if (value === null || value === undefined) return "rgba(255, 248, 234, 0.04)";
  const capped = Math.max(-18, Math.min(18, Number(value)));
  if (capped >= 0) {
    const intensity = capped / 18;
    return `rgba(101, 213, 154, ${0.14 + intensity * alpha})`;
  }
  const intensity = Math.abs(capped) / 18;
  return `rgba(214, 106, 94, ${0.14 + intensity * alpha})`;
}

function correlationColor(value) {
  const capped = Math.max(-1, Math.min(1, Number(value)));
  if (capped >= 0) {
    return `rgba(101, 213, 154, ${0.12 + capped * 0.68})`;
  }
  return `rgba(214, 106, 94, ${0.12 + Math.abs(capped) * 0.68})`;
}

function renderMonthlyHeatmap(rows) {
  const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
  if (!rows.length) {
    nodes.monthlyHeatmap.innerHTML = `<div class="empty-state">Esegui un backtest.</div>`;
    return;
  }
  const byYear = new Map();
  rows.forEach((row) => {
    const [year, month] = row.period.split("-");
    if (!byYear.has(year)) byYear.set(year, new Map());
    byYear.get(year).set(Number(month), row);
  });
  const header = `
    <div class="heatmap-row">
      <div class="heatmap-cell header">Anno</div>
      ${months.map((month) => `<div class="heatmap-cell header">${month}</div>`).join("")}
    </div>
  `;
  const body = [...byYear.entries()]
    .map(([year, monthMap]) => {
      const cells = months
        .map((_, index) => {
          const row = monthMap.get(index + 1);
          if (!row) return `<div class="heatmap-cell"></div>`;
          return `
            <div class="heatmap-cell value" style="background:${returnColor(row.returnPct)}" title="${escapeHtml(row.period)} ${formatPercent(row.returnPct)}">
              ${formatPercent(row.returnPct)}
            </div>
          `;
        })
        .join("");
      return `<div class="heatmap-row"><div class="heatmap-cell year">${escapeHtml(year)}</div>${cells}</div>`;
    })
    .join("");
  nodes.monthlyHeatmap.innerHTML = header + body;
}

function renderCorrelation(correlation) {
  if (!correlation?.symbols?.length) {
    nodes.correlationMatrix.innerHTML = `<div class="empty-state">Esegui un backtest.</div>`;
    return;
  }
  const symbols = correlation.symbols;
  const columns = `repeat(${symbols.length + 1}, minmax(64px, 1fr))`;
  const header = `
    <div class="correlation-row" style="grid-template-columns:${columns}">
      <div class="correlation-cell header"></div>
      ${symbols.map((symbol) => `<div class="correlation-cell header">${escapeHtml(symbol)}</div>`).join("")}
    </div>
  `;
  const rows = symbols
    .map((symbol, rowIndex) => {
      const cells = symbols
        .map((other, columnIndex) => {
          const value = correlation.matrix[rowIndex][columnIndex];
          return `
            <div class="correlation-cell value" style="background:${correlationColor(value)}" title="${escapeHtml(symbol)} / ${escapeHtml(other)}: ${formatNumber(value, 3)}">
              ${formatNumber(value, 2)}
            </div>
          `;
        })
        .join("");
      return `<div class="correlation-row" style="grid-template-columns:${columns}"><div class="correlation-cell header">${escapeHtml(symbol)}</div>${cells}</div>`;
    })
    .join("");
  nodes.correlationMatrix.innerHTML = header + rows;
}

function renderHoldings(assets) {
  nodes.holdingsBody.innerHTML = assets
    .map(
      (asset) => `
        <tr>
          <td>${escapeHtml(asset.symbol)}</td>
          <td>${formatNumber(asset.targetWeightPct)}%</td>
          <td>${formatNumber(asset.finalWeightPct)}%</td>
          <td class="${asset.returnPct >= 0 ? "positive" : "negative"}">${formatPercent(asset.returnPct)}</td>
          <td class="${asset.localReturnPct >= 0 ? "positive" : "negative"}">${formatPercent(asset.localReturnPct)}</td>
          <td class="${asset.fxEffectPct >= 0 ? "positive" : "negative"}">${formatPercent(asset.fxEffectPct)}</td>
          <td>${formatPercent(asset.volatilityPct)}</td>
          <td>${formatNumber(asset.shares, 4)}</td>
          <td>${escapeHtml(asset.exchange)} / ${escapeHtml(asset.localCurrency || asset.currency)}</td>
        </tr>
      `,
    )
    .join("");
}

function renderAllocation(assets) {
  nodes.allocationList.innerHTML = assets
    .map(
      (asset, index) => `
        <div class="allocation-item">
          <span class="color-dot" style="background:${palette[index % palette.length]}"></span>
          <span>${escapeHtml(asset.symbol)}</span>
          <strong>${formatNumber(asset.finalWeightPct)}%</strong>
        </div>
      `,
    )
    .join("");
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(320, rect.width);
  const height = Math.max(220, rect.height);
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}

function getRange(values) {
  const cleanValues = values.map(Number).filter(Number.isFinite);
  const min = Math.min(...cleanValues);
  const max = Math.max(...cleanValues);
  const pad = Math.max((max - min) * 0.08, Math.abs(max) * 0.02, 1);
  return { min: min - pad, max: max + pad };
}

function formatAxisDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", { month: "short", year: "2-digit" }).format(date);
}

function drawDateAxis(ctx, curve, scales, width, height) {
  if (!curve.length) return;
  const tickCount = width < 620 ? 3 : 5;
  ctx.save();
  ctx.fillStyle = "rgba(255, 248, 234, 0.54)";
  ctx.strokeStyle = "rgba(255, 248, 234, 0.12)";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let tick = 0; tick < tickCount; tick += 1) {
    const index = Math.round((tick / Math.max(tickCount - 1, 1)) * (curve.length - 1));
    const x = scales.x(index, curve.length);
    ctx.beginPath();
    ctx.moveTo(x, height - scales.bottom + 6);
    ctx.lineTo(x, height - scales.bottom + 12);
    ctx.stroke();
    ctx.fillText(formatAxisDate(curve[index].date), Math.min(Math.max(x, scales.left + 20), width - scales.right - 20), height - 15);
  }
  ctx.restore();
}

function drawGrid(ctx, width, height, range, left = 62, right = 24, top = 24, bottom = 50) {
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255, 248, 234, 0.08)";
  ctx.fillStyle = "rgba(255, 248, 234, 0.56)";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const y = (value) => top + ((range.max - value) / (range.max - range.min || 1)) * (height - top - bottom);
  for (let i = 0; i <= 4; i += 1) {
    const value = range.min + ((range.max - range.min) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(left, y(value));
    ctx.lineTo(width - right, y(value));
    ctx.stroke();
    ctx.fillText(formatMoney(value), left - 10, y(value));
  }
  return {
    x: (index, count) => left + (index / Math.max(count - 1, 1)) * (width - left - right),
    y,
    left,
    right,
    top,
    bottom,
  };
}

function drawPercentGrid(ctx, width, height, range, left = 62, right = 24, top = 24, bottom = 50) {
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255, 248, 234, 0.08)";
  ctx.fillStyle = "rgba(255, 248, 234, 0.56)";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const y = (value) => top + ((range.max - value) / (range.max - range.min || 1)) * (height - top - bottom);
  for (let i = 0; i <= 4; i += 1) {
    const value = range.min + ((range.max - range.min) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(left, y(value));
    ctx.lineTo(width - right, y(value));
    ctx.stroke();
    ctx.fillText(formatPercent(value), left - 10, y(value));
  }
  return {
    x: (index, count) => left + (index / Math.max(count - 1, 1)) * (width - left - right),
    y,
    left,
    right,
    top,
    bottom,
  };
}

function drawLine(ctx, points, color, width = 2.4) {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function drawArea(ctx, points, baseline, color) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, baseline);
  points.forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.lineTo(points[points.length - 1].x, baseline);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawCrosshair(ctx, x, top, bottom, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 248, 234, 0.24)";
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, height - bottom);
  ctx.stroke();
  ctx.restore();
}

function drawMarker(ctx, point, color) {
  ctx.beginPath();
  ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#07090b";
  ctx.stroke();
}

function chartIndexFromPointer(canvas, event, count) {
  const rect = canvas.getBoundingClientRect();
  const left = 62;
  const right = 24;
  const x = Math.max(left, Math.min(rect.width - right, event.clientX - rect.left));
  return Math.max(0, Math.min(count - 1, Math.round(((x - left) / Math.max(rect.width - left - right, 1)) * (count - 1))));
}

function placeTooltip(tooltip, canvas, event, html) {
  const stage = canvas.parentElement;
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const tooltipWidth = 210;
  const left = Math.min(Math.max(event.clientX - rect.left + 14, 8), rect.width - tooltipWidth - 8);
  const top = Math.min(Math.max(event.clientY - rect.top - 16, 8), rect.height - 112);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip(tooltip) {
  tooltip.hidden = true;
}

function tooltipHtml(type, row) {
  if (type === "equity") {
    const benchmarkLine = hasBenchmark() && isFiniteNumber(row.benchmark) ? `<span>Benchmark TWR ${formatMoney(row.benchmark)}</span>` : "";
    return `
      <strong>${escapeHtml(row.date)}</strong>
      <span>Portfolio ${formatMoney(row.equity)}</span>
      <span>Investito ${formatMoney(row.invested)}</span>
      ${benchmarkLine}
      <span>Drawdown ${formatPercent(row.drawdownPct)}</span>
    `;
  }
  if (type === "volatility") {
    return `
      <strong>${escapeHtml(row.date)}</strong>
      <span>Volatilita ${formatPercent(row.rollingVolatilityPct)}</span>
      <span>Rendimento giorno ${formatPercent(row.dailyReturnPct)}</span>
    `;
  }
  return `
    <strong>${escapeHtml(row.date)}</strong>
    <span>Drawdown ${formatPercent(row.drawdownPct)}</span>
    <span>Portfolio ${formatMoney(row.equity)}</span>
  `;
}

function drawEquityChart(curve) {
  const { ctx, width, height } = setupCanvas(nodes.equityChart);
  const benchmarkActive = hasBenchmark();
  const rangeValues = curve.flatMap((row) => benchmarkActive && isFiniteNumber(row.benchmark) ? [row.equity, row.invested, row.benchmark] : [row.equity, row.invested]);
  const range = getRange(rangeValues);
  const scales = drawGrid(ctx, width, height, range);
  const series = (key) => curve.map((row, index) => ({ x: scales.x(index, curve.length), y: scales.y(row[key]) }));
  const invested = series("invested");
  const benchmark = benchmarkActive ? series("benchmark") : [];
  const equity = series("equity");
  const baseline = height - scales.bottom;
  drawArea(ctx, equity, baseline, "rgba(105, 213, 199, 0.09)");
  drawLine(ctx, invested, "rgba(255, 248, 234, 0.38)", 1.6);
  if (benchmarkActive) drawLine(ctx, benchmark, "#f2b967", 2);
  drawLine(ctx, equity, "#69d5c7", 3);
  if (state.hover.equity !== null) {
    const index = state.hover.equity;
    drawCrosshair(ctx, equity[index].x, scales.top, scales.bottom, height);
    drawMarker(ctx, invested[index], "rgba(255, 248, 234, 0.78)");
    if (benchmarkActive) drawMarker(ctx, benchmark[index], "#f2b967");
    drawMarker(ctx, equity[index], "#69d5c7");
  }
  drawDateAxis(ctx, curve, scales, width, height);
}

function drawDrawdownChart(curve) {
  const { ctx, width, height } = setupCanvas(nodes.drawdownChart);
  const values = curve.map((row) => row.drawdownPct);
  const min = Math.min(...values, -1);
  const range = { min: Math.min(min * 1.08, -1), max: 0 };
  const scales = drawPercentGrid(ctx, width, height, range);
  const points = curve.map((row, index) => ({ x: scales.x(index, curve.length), y: scales.y(row.drawdownPct) }));
  const zeroY = scales.y(0);

  drawArea(ctx, points, zeroY, "rgba(214, 106, 94, 0.18)");
  drawLine(ctx, points, "#d66a5e", 2.5);
  if (state.hover.drawdown !== null) {
    const index = state.hover.drawdown;
    drawCrosshair(ctx, points[index].x, scales.top, scales.bottom, height);
    drawMarker(ctx, points[index], "#d66a5e");
  }
  drawDateAxis(ctx, curve, scales, width, height);
}

function drawVolatilityChart(curve) {
  const { ctx, width, height } = setupCanvas(nodes.volatilityChart);
  const values = curve.map((row) => row.rollingVolatilityPct || 0);
  const max = Math.max(...values, 5);
  const range = { min: 0, max: max * 1.16 };
  const scales = drawPercentGrid(ctx, width, height, range);
  const points = curve.map((row, index) => ({ x: scales.x(index, curve.length), y: scales.y(row.rollingVolatilityPct || 0) }));
  const baseline = height - scales.bottom;

  drawArea(ctx, points, baseline, "rgba(242, 185, 103, 0.12)");
  drawLine(ctx, points, "#f2b967", 2.8);
  if (state.hover.volatility !== null) {
    const index = state.hover.volatility;
    drawCrosshair(ctx, points[index].x, scales.top, scales.bottom, height);
    drawMarker(ctx, points[index], "#f2b967");
  }
  drawDateAxis(ctx, curve, scales, width, height);
}

function drawAllocationChart(assets) {
  const { ctx, width, height } = setupCanvas(nodes.allocationChart);
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;
  const inner = radius * 0.58;
  let start = -Math.PI / 2;
  assets.forEach((asset, index) => {
    const slice = (asset.finalWeightPct / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + slice);
    ctx.arc(cx, cy, inner, start + slice, start, true);
    ctx.closePath();
    ctx.fillStyle = palette[index % palette.length];
    ctx.fill();
    start += slice;
  });
  ctx.fillStyle = "#fff8ea";
  ctx.font = "800 20px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${assets.length}`, cx, cy - 8);
  ctx.fillStyle = "rgba(255, 248, 234, 0.58)";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.fillText("asset", cx, cy + 14);
}

function exportCsv() {
  if (!state.result) return;
  const rows = [
    ["date", "equity", "invested", "benchmark", "drawdownPct", "rollingVolatilityPct", "cashflow"],
    ...state.result.curve.map((row) => [
      row.date,
      row.equity,
      row.invested,
      row.benchmark,
      row.drawdownPct,
      row.rollingVolatilityPct,
      row.cashflow,
    ]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "capital-eyes-backtest.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function redrawChart(type) {
  if (!state.result) return;
  if (type === "equity") drawEquityChart(state.result.curve);
  if (type === "drawdown") drawDrawdownChart(state.result.curve);
  if (type === "volatility") drawVolatilityChart(state.result.curve);
}

function setupChartInteraction(type, canvas, tooltip) {
  canvas.addEventListener("pointermove", (event) => {
    if (!state.result?.curve?.length) return;
    const index = chartIndexFromPointer(canvas, event, state.result.curve.length);
    state.hover[type] = index;
    redrawChart(type);
    placeTooltip(tooltip, canvas, event, tooltipHtml(type, state.result.curve[index]));
  });
  canvas.addEventListener("pointerleave", () => {
    state.hover[type] = null;
    hideTooltip(tooltip);
    redrawChart(type);
  });
}

nodes.assetBody.addEventListener("input", () => {
  readAssets();
  updateWeightState();
});

nodes.assetBody.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  state.assets.splice(Number(button.dataset.remove), 1);
  renderAssets();
});

nodes.searchInput.addEventListener("input", () => {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(() => searchAssets(nodes.searchInput.value), 280);
});

nodes.searchResults.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest("[data-add]");
  if (!button) return;
  addAsset({ symbol: button.dataset.add, name: button.dataset.name });
});

nodes.manualAdd.addEventListener("click", () => {
  addAsset({ symbol: nodes.searchInput.value, name: nodes.searchInput.value.toUpperCase() });
});

nodes.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    nodes.modeButtons.forEach((item) => item.classList.toggle("active", item === button));
    nodes.pacFields.forEach((field) => {
      field.style.display = state.mode === "pac" ? "grid" : "none";
    });
    nodes.formMessage.textContent = state.mode === "pac" ? "PAC attivo: usero i versamenti periodici." : "PIC attivo: investo il capitale iniziale.";
  });
});

nodes.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runBacktest();
});

nodes.exportButton.addEventListener("click", exportCsv);

window.addEventListener("resize", () => {
  if (state.result) {
    drawEquityChart(state.result.curve);
    drawDrawdownChart(state.result.curve);
    drawVolatilityChart(state.result.curve);
    drawAllocationChart(state.result.assets);
  }
});

setupChartInteraction("equity", nodes.equityChart, nodes.equityTooltip);
setupChartInteraction("drawdown", nodes.drawdownChart, nodes.drawdownTooltip);
setupChartInteraction("volatility", nodes.volatilityChart, nodes.volatilityTooltip);

initializeDates();
nodes.pacFields.forEach((field) => {
  field.style.display = "none";
});
renderAssets();
runBacktest();
