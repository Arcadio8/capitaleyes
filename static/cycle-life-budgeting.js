const storageKey = "capitaleyes-cycle-life-budgeting-v2";
const targetAge = 90;
const palette = ["#69d5c7", "#f2b967", "#8ba0ff", "#65d59a", "#d66a5e", "#c994e8"];

const defaultPlan = {
  profile: {
    currency: "EUR",
    age: 34,
    initialWealth: 93000,
    returnRate: 5.0,
  },
  income: [
    { name: "Stipendio netto", amount: 5200 },
  ],
  expenses: [
    { name: "Casa e mutuo/affitto", amount: 1350 },
    { name: "Spesa e beni base", amount: 560 },
    { name: "Utenze e assicurazioni", amount: 310 },
    { name: "Trasporti", amount: 260 },
    { name: "Lifestyle", amount: 520 },
    { name: "Viaggi e tempo libero", amount: 300 },
    { name: "Rate debiti", amount: 220 },
    { name: "Investimenti automatici", amount: 900 },
  ],
};

let plan = loadPlan();

const nodes = {
  sidebarPhase: document.querySelector("#sidebar-phase"),
  sidebarStatus: document.querySelector("#sidebar-status"),
  savePlan: document.querySelector("#save-plan"),
  exportPlan: document.querySelector("#export-plan"),
  resetPlan: document.querySelector("#reset-plan"),
  currency: document.querySelector("#currency"),
  age: document.querySelector("#age"),
  initialWealth: document.querySelector("#initial-wealth"),
  returnRate: document.querySelector("#return-rate"),
  incomeBody: document.querySelector("#income-body"),
  expenseBody: document.querySelector("#expense-body"),
  addIncome: document.querySelector("#add-income"),
  addExpense: document.querySelector("#add-expense"),
  wealthChart: document.querySelector("#wealth-chart"),
  cashflowChart: document.querySelector("#cashflow-chart"),
  projectionBody: document.querySelector("#projection-body"),
  statusList: document.querySelector("#status-list"),
  metrics: {
    income: document.querySelector("#metric-income"),
    incomeCount: document.querySelector("#metric-income-count"),
    expenses: document.querySelector("#metric-expenses"),
    expenseCount: document.querySelector("#metric-expense-count"),
    savings: document.querySelector("#metric-savings"),
    savingsRate: document.querySelector("#metric-savings-rate"),
    initialWealth: document.querySelector("#metric-initial-wealth"),
    currentAge: document.querySelector("#metric-current-age"),
    finalWealth: document.querySelector("#metric-final-wealth"),
    horizon: document.querySelector("#metric-horizon"),
    wealthDelta: document.querySelector("#metric-wealth-delta"),
    returnRate: document.querySelector("#metric-return-rate"),
  },
  summary: {
    annualSavings: document.querySelector("#summary-annual-savings"),
    totalSavings: document.querySelector("#summary-total-savings"),
    totalContributed: document.querySelector("#summary-total-contributed"),
    totalReturn: document.querySelector("#summary-total-return"),
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadPlan() {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      profile: { ...clone(defaultPlan.profile), ...(parsed.profile || {}) },
      income: Array.isArray(parsed.income) ? parsed.income : clone(defaultPlan.income),
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : clone(defaultPlan.expenses),
    };
  } catch {
    return clone(defaultPlan);
  }
}

function savePlan() {
  localStorage.setItem(storageKey, JSON.stringify(plan));
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0);
}

function formatMoney(value, digits = 0) {
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: plan.profile.currency,
      maximumFractionDigits: digits,
    }).format(value || 0);
  } catch {
    return `${formatNumber(value, digits)} ${plan.profile.currency}`;
  }
}

function formatPercent(value, digits = 1) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value || 0, digits)}%`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sumItems(items) {
  return items.reduce((sum, item) => sum + Math.max(toNumber(item.amount), 0), 0);
}

function calculate() {
  const age = clamp(toNumber(plan.profile.age), 18, targetAge);
  const initialWealth = toNumber(plan.profile.initialWealth);
  const annualRate = Math.max(toNumber(plan.profile.returnRate), -99.9);
  const monthlyRate = (1 + annualRate / 100) ** (1 / 12) - 1;
  const monthlyIncome = sumItems(plan.income);
  const monthlyExpenses = sumItems(plan.expenses);
  const monthlySavings = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
  const horizonYears = Math.max(targetAge - age, 0);
  const horizonMonths = Math.round(horizonYears * 12);
  const points = projection({
    age,
    initialWealth,
    annualRate,
    monthlyRate,
    monthlySavings,
    horizonMonths,
  });
  const finalPoint = points[points.length - 1];
  const finalWealth = finalPoint.value;
  const totalSavings = finalPoint.saved;
  const totalReturn = finalPoint.growth;
  const totalContributed = initialWealth + totalSavings;
  const wealthDelta = finalWealth - initialWealth;
  return {
    age,
    initialWealth,
    annualRate,
    monthlyRate,
    monthlyIncome,
    monthlyExpenses,
    monthlySavings,
    annualSavings: monthlySavings * 12,
    savingsRate,
    horizonYears,
    horizonMonths,
    points,
    finalWealth,
    totalSavings,
    totalReturn,
    totalContributed,
    wealthDelta,
  };
}

function projection(model) {
  let value = model.initialWealth;
  let saved = 0;
  const points = [
    {
      month: 0,
      age: model.age,
      value,
      saved,
      growth: 0,
    },
  ];

  for (let month = 1; month <= model.horizonMonths; month += 1) {
    value += model.monthlySavings;
    saved += model.monthlySavings;
    const growth = value * model.monthlyRate;
    value += growth;

    if (month % 12 === 0 || month === model.horizonMonths) {
      points.push({
        month,
        age: model.age + month / 12,
        value,
        saved,
        growth: value - model.initialWealth - saved,
      });
    }
  }

  return points;
}

function renderInputs() {
  nodes.currency.value = plan.profile.currency;
  nodes.age.value = plan.profile.age;
  nodes.initialWealth.value = plan.profile.initialWealth;
  nodes.returnRate.value = plan.profile.returnRate;
}

function renderRows(type) {
  const items = plan[type];
  const body = type === "income" ? nodes.incomeBody : nodes.expenseBody;
  const removeAttribute = type === "income" ? "data-remove-income" : "data-remove-expense";
  body.innerHTML = items
    .map(
      (item, index) => `
        <tr>
          <td><input class="name-input" data-table="${type}" data-index="${index}" data-field="name" value="${escapeHtml(item.name)}" /></td>
          <td><input class="amount-input" type="number" min="0" step="50" data-table="${type}" data-index="${index}" data-field="amount" value="${item.amount}" /></td>
          <td><button class="remove-button" type="button" ${removeAttribute}="${index}">x</button></td>
        </tr>
      `,
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderDashboard() {
  const model = calculate();
  renderMetrics(model);
  renderStatus(model);
  renderProjectionTable(model);
  drawWealthChart(model);
  drawCashflowChart(model);
  savePlan();
}

function renderMetrics(model) {
  nodes.metrics.income.textContent = formatMoney(model.monthlyIncome);
  nodes.metrics.incomeCount.textContent = `${plan.income.length} voci`;
  nodes.metrics.expenses.textContent = formatMoney(model.monthlyExpenses);
  nodes.metrics.expenseCount.textContent = `${plan.expenses.length} voci`;
  nodes.metrics.savings.textContent = formatMoney(model.monthlySavings);
  nodes.metrics.savings.className = model.monthlySavings >= 0 ? "positive" : "negative";
  nodes.metrics.savingsRate.textContent = `Saving rate ${formatPercent(model.savingsRate)}`;
  nodes.metrics.initialWealth.textContent = formatMoney(model.initialWealth);
  nodes.metrics.currentAge.textContent = `Eta ${formatNumber(model.age, 0)} anni`;
  nodes.metrics.finalWealth.textContent = formatMoney(model.finalWealth);
  nodes.metrics.horizon.textContent = `${formatNumber(model.horizonYears, 0)} anni`;
  nodes.metrics.wealthDelta.textContent = formatMoney(model.wealthDelta);
  nodes.metrics.wealthDelta.className = model.wealthDelta >= 0 ? "positive" : "negative";
  nodes.metrics.returnRate.textContent = `Tasso ${formatPercent(model.annualRate)}`;

  nodes.summary.annualSavings.textContent = formatMoney(model.annualSavings);
  nodes.summary.totalSavings.textContent = formatMoney(model.totalSavings);
  nodes.summary.totalContributed.textContent = formatMoney(model.totalContributed);
  nodes.summary.totalReturn.textContent = formatMoney(model.totalReturn);
  nodes.summary.totalReturn.className = model.totalReturn >= 0 ? "positive" : "negative";

  nodes.sidebarPhase.textContent = `Fino a ${targetAge} anni`;
  nodes.sidebarStatus.textContent = `${formatMoney(model.monthlySavings, 0)}/mese investiti al ${formatPercent(model.annualRate)} annuo.`;
}

function renderStatus(model) {
  const items = [];
  if (model.monthlySavings < 0) {
    items.push(["Deficit mensile", `${formatMoney(Math.abs(model.monthlySavings))}/mese riducono il patrimonio proiettato.`]);
  } else if (model.savingsRate < 10) {
    items.push(["Risparmio contenuto", `Il delta positivo e ${formatMoney(model.monthlySavings)}/mese, pari al ${formatPercent(model.savingsRate)} delle entrate.`]);
  } else {
    items.push(["Risparmio positivo", `${formatMoney(model.monthlySavings)}/mese vengono sommati al patrimonio e capitalizzati.`]);
  }

  if (model.annualRate < 0) {
    items.push(["Rendimento negativo", `Il tasso annuo ipotetico riduce la traiettoria del capitale: ${formatPercent(model.annualRate)}.`]);
  } else {
    items.push(["Rendimento ipotetico", `Il patrimonio cresce con capitalizzazione mensile al ${formatPercent(model.annualRate)} annuo.`]);
  }

  items.push(["Arrivo a 90 anni", `Valore stimato ${formatMoney(model.finalWealth)}, delta ${formatMoney(model.wealthDelta)}.`]);

  nodes.statusList.innerHTML = items
    .map(
      ([title, body], index) => `
        <article class="action-card">
          <div class="action-index">${index + 1}</div>
          <div>
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(body)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderProjectionTable(model) {
  nodes.projectionBody.innerHTML = model.points
    .map(
      (point) => `
        <tr>
          <td>${formatNumber(point.age, 0)}</td>
          <td>${formatMoney(point.value)}</td>
          <td>${formatMoney(point.saved)}</td>
          <td>${formatMoney(point.growth)}</td>
        </tr>
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

function drawWealthChart(model) {
  const { ctx, width, height } = setupCanvas(nodes.wealthChart);
  const points = model.points;
  ctx.clearRect(0, 0, width, height);
  const left = 70;
  const right = 24;
  const top = 28;
  const bottom = 48;
  const values = points.map((point) => point.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values) * 1.08 || 1;
  const x = (index) => left + (index / Math.max(points.length - 1, 1)) * (width - left - right);
  const y = (value) => top + ((max - value) / Math.max(max - min, 1)) * (height - top - bottom);

  drawGrid(ctx, width, height, left, right, top, bottom, min, max);
  drawZeroLine(ctx, width, left, right, y(0));
  drawLine(ctx, points.map((point, index) => ({ x: x(index), y: y(point.value) })), model.finalWealth >= model.initialWealth ? palette[0] : palette[4], 3);

  ctx.fillStyle = "rgba(255, 248, 234, 0.6)";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  [0, Math.floor(points.length / 2), points.length - 1].forEach((index) => {
    ctx.fillText(`${formatNumber(points[index].age, 0)} anni`, x(index), height - 15);
  });

  ctx.fillStyle = model.finalWealth >= model.initialWealth ? palette[0] : palette[4];
  ctx.textAlign = "left";
  ctx.fillText(`Fine: ${formatMoney(model.finalWealth)}`, left, top + 8);
  ctx.fillStyle = "rgba(255, 248, 234, 0.58)";
  ctx.fillText(`Inizio: ${formatMoney(model.initialWealth)}`, left, top + 28);
}

function drawCashflowChart(model) {
  const { ctx, width, height } = setupCanvas(nodes.cashflowChart);
  ctx.clearRect(0, 0, width, height);
  const left = 62;
  const right = 24;
  const top = 30;
  const bottom = 54;
  const bars = [
    ["Entrate", model.monthlyIncome, palette[0]],
    ["Uscite", -model.monthlyExpenses, palette[4]],
    ["Risparmio", model.monthlySavings, model.monthlySavings >= 0 ? palette[3] : palette[4]],
  ];
  const min = Math.min(0, ...bars.map((bar) => bar[1])) * 1.15;
  const max = Math.max(0, ...bars.map((bar) => bar[1])) * 1.15 || 1;
  const y = (value) => top + ((max - value) / Math.max(max - min, 1)) * (height - top - bottom);
  const zeroY = y(0);
  const slot = (width - left - right) / bars.length;

  drawGrid(ctx, width, height, left, right, top, bottom, min, max);
  drawZeroLine(ctx, width, left, right, zeroY);

  bars.forEach(([label, value, color], index) => {
    const x = left + index * slot + slot * 0.22;
    const barWidth = slot * 0.56;
    const valueY = y(value);
    const barTop = Math.min(valueY, zeroY);
    const barHeight = Math.max(Math.abs(zeroY - valueY), 2);
    ctx.fillStyle = color;
    ctx.fillRect(x, barTop, barWidth, barHeight);
    ctx.fillStyle = "rgba(255, 248, 234, 0.62)";
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x + barWidth / 2, height - 20);
  });
}

function drawGrid(ctx, width, height, left, right, top, bottom, min, max) {
  ctx.strokeStyle = "rgba(255, 248, 234, 0.08)";
  ctx.fillStyle = "rgba(255, 248, 234, 0.52)";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const y = (value) => top + ((max - value) / Math.max(max - min, 1)) * (height - top - bottom);
  for (let i = 0; i <= 4; i += 1) {
    const value = min + ((max - min) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(left, y(value));
    ctx.lineTo(width - right, y(value));
    ctx.stroke();
    ctx.fillText(formatMoney(value), left - 8, y(value));
  }
}

function drawZeroLine(ctx, width, left, right, y) {
  ctx.strokeStyle = "rgba(255, 248, 234, 0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(width - right, y);
  ctx.stroke();
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

function updateProfileFromInputs() {
  plan.profile.currency = nodes.currency.value;
  plan.profile.age = clamp(toNumber(nodes.age.value), 18, targetAge);
  plan.profile.initialWealth = toNumber(nodes.initialWealth.value);
  plan.profile.returnRate = toNumber(nodes.returnRate.value);
}

function updateCollection(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const table = target.dataset.table;
  if (!table) return;
  const index = Number(target.dataset.index);
  const field = target.dataset.field;
  if (!plan[table]?.[index] || !field) return;
  plan[table][index][field] = target.type === "number" ? toNumber(target.value) : target.value;
  renderDashboard();
}

function exportCsv() {
  const model = calculate();
  const rows = [
    ["section", "name", "value", "extra"],
    ["profile", "currency", plan.profile.currency, ""],
    ["profile", "age", model.age, ""],
    ["profile", "initialWealth", model.initialWealth, ""],
    ["profile", "annualReturnRatePct", model.annualRate, ""],
    ["metrics", "monthlyIncome", model.monthlyIncome, ""],
    ["metrics", "monthlyExpenses", model.monthlyExpenses, ""],
    ["metrics", "monthlySavings", model.monthlySavings, ""],
    ["metrics", "finalWealthAt90", model.finalWealth, ""],
    ...plan.income.map((item) => ["income", item.name, item.amount, "monthly"]),
    ...plan.expenses.map((item) => ["expense", item.name, item.amount, "monthly"]),
    ...model.points.map((point) => ["projection", `age ${formatNumber(point.age, 0)}`, point.value, `saved=${point.saved};growth=${point.growth}`]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "capitaleyes-cycle-life-budgeting.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function initialize() {
  renderInputs();
  renderRows("income");
  renderRows("expenses");
  renderDashboard();
}

document.querySelectorAll("#currency, #age, #initial-wealth, #return-rate").forEach((input) => {
  input.addEventListener("input", () => {
    updateProfileFromInputs();
    renderDashboard();
  });
});

nodes.incomeBody.addEventListener("input", updateCollection);
nodes.expenseBody.addEventListener("input", updateCollection);

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const income = event.target.closest("[data-remove-income]");
  const expense = event.target.closest("[data-remove-expense]");
  if (income) {
    plan.income.splice(Number(income.dataset.removeIncome), 1);
    renderRows("income");
    renderDashboard();
  }
  if (expense) {
    plan.expenses.splice(Number(expense.dataset.removeExpense), 1);
    renderRows("expenses");
    renderDashboard();
  }
});

nodes.addIncome.addEventListener("click", () => {
  plan.income.push({ name: "Nuova entrata", amount: 1000 });
  renderRows("income");
  renderDashboard();
});

nodes.addExpense.addEventListener("click", () => {
  plan.expenses.push({ name: "Nuova uscita", amount: 250 });
  renderRows("expenses");
  renderDashboard();
});

nodes.savePlan.addEventListener("click", () => {
  updateProfileFromInputs();
  savePlan();
  nodes.savePlan.textContent = "Salvato";
  setTimeout(() => {
    nodes.savePlan.textContent = "Salva";
  }, 1000);
});

nodes.exportPlan.addEventListener("click", exportCsv);

nodes.resetPlan.addEventListener("click", () => {
  plan = clone(defaultPlan);
  localStorage.removeItem(storageKey);
  initialize();
});

window.addEventListener("resize", () => renderDashboard());

initialize();
