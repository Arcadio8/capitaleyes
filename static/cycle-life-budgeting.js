const storageKey = "capitaleyes-cycle-life-budgeting-v1";
const palette = ["#69d5c7", "#f2b967", "#8ba0ff", "#65d59a", "#d66a5e", "#c994e8"];

const defaultPlan = {
  profile: {
    currency: "EUR",
    age: 34,
    retirementAge: 58,
    income: 5200,
    emergencyMonths: 6,
    dependents: 1,
  },
  scenario: {
    name: "base",
    returnRate: 5.5,
    inflationRate: 2.2,
    incomeGrowth: 2.0,
  },
  categories: [
    { name: "Casa e mutuo/affitto", type: "essential", amount: 1350, priority: "Alta" },
    { name: "Spesa e beni base", type: "essential", amount: 560, priority: "Alta" },
    { name: "Utenze e assicurazioni", type: "essential", amount: 310, priority: "Alta" },
    { name: "Trasporti", type: "essential", amount: 260, priority: "Media" },
    { name: "Lifestyle", type: "lifestyle", amount: 520, priority: "Media" },
    { name: "Viaggi e tempo libero", type: "lifestyle", amount: 300, priority: "Bassa" },
    { name: "Rate debiti", type: "debt", amount: 220, priority: "Alta" },
    { name: "Investimenti automatici", type: "investing", amount: 900, priority: "Alta" },
  ],
  accounts: [
    { name: "Conto corrente", type: "cash", value: 16000, liquidity: "Alta" },
    { name: "Brokerage", type: "investment", value: 56000, liquidity: "Media" },
    { name: "Previdenza", type: "retirement", value: 28000, liquidity: "Bassa" },
    { name: "Prestito residuo", type: "debt", value: 7000, liquidity: "Debito" },
  ],
  goals: [
    { name: "Fondo emergenza", target: 20000, current: 16000, deadline: "2027-12", monthly: 350 },
    { name: "Acconto casa", target: 55000, current: 14000, deadline: "2029-06", monthly: 650 },
    { name: "Capitale liberta", target: 420000, current: 84000, deadline: "2048-12", monthly: 1000 },
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
  retirementAge: document.querySelector("#retirement-age"),
  income: document.querySelector("#income"),
  emergencyMonths: document.querySelector("#emergency-months"),
  dependents: document.querySelector("#dependents"),
  returnRate: document.querySelector("#return-rate"),
  inflationRate: document.querySelector("#inflation-rate"),
  incomeGrowth: document.querySelector("#income-growth"),
  returnLabel: document.querySelector("#return-label"),
  inflationLabel: document.querySelector("#inflation-label"),
  incomeGrowthLabel: document.querySelector("#income-growth-label"),
  scenarioButtons: document.querySelectorAll("[data-scenario]"),
  categoriesBody: document.querySelector("#categories-body"),
  accountsBody: document.querySelector("#accounts-body"),
  goalsList: document.querySelector("#goals-list"),
  actionList: document.querySelector("#action-list"),
  cycleLanes: document.querySelector("#cycle-lanes"),
  bucketList: document.querySelector("#bucket-list"),
  addCategory: document.querySelector("#add-category"),
  addAccount: document.querySelector("#add-account"),
  addGoal: document.querySelector("#add-goal"),
  wealthChart: document.querySelector("#wealth-chart"),
  cashflowChart: document.querySelector("#cashflow-chart"),
  bucketChart: document.querySelector("#bucket-chart"),
  metrics: {
    netWorth: document.querySelector("#metric-net-worth"),
    assets: document.querySelector("#metric-assets"),
    surplus: document.querySelector("#metric-surplus"),
    savingsRate: document.querySelector("#metric-savings-rate"),
    emergency: document.querySelector("#metric-emergency"),
    runway: document.querySelector("#metric-runway"),
    goals: document.querySelector("#metric-goals"),
    required: document.querySelector("#metric-required"),
    fire: document.querySelector("#metric-fire"),
    fireGap: document.querySelector("#metric-fire-gap"),
    score: document.querySelector("#metric-score"),
    scoreLabel: document.querySelector("#metric-score-label"),
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadPlan() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? { ...clone(defaultPlan), ...JSON.parse(raw) } : clone(defaultPlan);
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

function monthsUntil(deadline) {
  if (!deadline) return 0;
  const [year, month] = deadline.split("-").map(Number);
  if (!year || !month) return 0;
  const now = new Date();
  return Math.max((year - now.getFullYear()) * 12 + (month - (now.getMonth() + 1)), 1);
}

function getPhase(age, retirementAge) {
  if (age >= retirementAge) return "Rendita";
  if (age >= retirementAge - 8) return "Preparazione liberta";
  if (age < 30) return "Costruzione base";
  if (age < 45) return "Crescita";
  return "Consolidamento";
}

function scenarioPreset(name) {
  const presets = {
    defensive: { name: "defensive", returnRate: 3.0, inflationRate: 3.2, incomeGrowth: 1.0 },
    base: { name: "base", returnRate: 5.5, inflationRate: 2.2, incomeGrowth: 2.0 },
    growth: { name: "growth", returnRate: 7.5, inflationRate: 2.5, incomeGrowth: 3.5 },
  };
  return presets[name] || presets.base;
}

function budgetTotals() {
  const totals = { essential: 0, lifestyle: 0, debt: 0, investing: 0 };
  plan.categories.forEach((category) => {
    totals[category.type] += toNumber(category.amount);
  });
  const outflow = totals.essential + totals.lifestyle + totals.debt + totals.investing;
  const surplus = plan.profile.income - outflow;
  const availableToBuild = totals.investing + Math.max(surplus, 0);
  const savingsRate = plan.profile.income > 0 ? (availableToBuild / plan.profile.income) * 100 : 0;
  return { ...totals, outflow, surplus, availableToBuild, savingsRate };
}

function accountTotals() {
  const totals = { cash: 0, investment: 0, retirement: 0, debt: 0 };
  plan.accounts.forEach((account) => {
    const value = Math.abs(toNumber(account.value));
    if (account.type === "cash") totals.cash += value;
    if (account.type === "investment") totals.investment += value;
    if (account.type === "retirement") totals.retirement += value;
    if (account.type === "debt") totals.debt += value;
  });
  const assets = totals.cash + totals.investment + totals.retirement;
  return { ...totals, assets, netWorth: assets - totals.debt };
}

function goalStats() {
  let required = 0;
  let covered = 0;
  plan.goals.forEach((goal) => {
    const remaining = Math.max(goal.target - goal.current, 0);
    const monthlyRequired = remaining / monthsUntil(goal.deadline);
    required += monthlyRequired;
    if (goal.current >= goal.target || goal.monthly >= monthlyRequired * 0.95) covered += 1;
  });
  const coverage = plan.goals.length ? (covered / plan.goals.length) * 100 : 100;
  return { required, covered, coverage };
}

function calculate() {
  const budget = budgetTotals();
  const accounts = accountTotals();
  const goals = goalStats();
  const emergencyTarget = budget.essential * plan.profile.emergencyMonths;
  const emergencyProgress = emergencyTarget > 0 ? (accounts.cash / emergencyTarget) * 100 : 100;
  const runway = budget.essential > 0 ? accounts.cash / budget.essential : 0;
  const annualLiving = (budget.essential + budget.lifestyle) * 12;
  const fireTarget = annualLiving * 25;
  const fireCapital = accounts.cash + accounts.investment + accounts.retirement;
  const fireProgress = fireTarget > 0 ? (fireCapital / fireTarget) * 100 : 0;
  const fireGap = Math.max(fireTarget - fireCapital, 0);
  const debtPressure = accounts.assets > 0 ? (accounts.debt / accounts.assets) * 100 : accounts.debt > 0 ? 100 : 0;
  const score =
    clamp(emergencyProgress, 0, 100) * 0.24 +
    clamp(budget.savingsRate * 3, 0, 100) * 0.25 +
    clamp(100 - debtPressure * 2, 0, 100) * 0.18 +
    clamp(goals.coverage, 0, 100) * 0.18 +
    clamp(fireProgress, 0, 100) * 0.15;
  return {
    budget,
    accounts,
    goals,
    emergencyTarget,
    emergencyProgress,
    runway,
    annualLiving,
    fireTarget,
    fireProgress,
    fireGap,
    debtPressure,
    score,
    phase: getPhase(plan.profile.age, plan.profile.retirementAge),
  };
}

function projection(model) {
  const years = Math.max(plan.profile.retirementAge - plan.profile.age, 1);
  const months = years * 12;
  const monthlyReturn = (1 + plan.scenario.returnRate / 100) ** (1 / 12) - 1;
  const monthlyInflation = (1 + plan.scenario.inflationRate / 100) ** (1 / 12) - 1;
  const monthlyIncomeGrowth = (1 + plan.scenario.incomeGrowth / 100) ** (1 / 12) - 1;
  let income = plan.profile.income;
  let livingCost = model.budget.essential + model.budget.lifestyle;
  let debt = model.accounts.debt;
  let invested = model.accounts.investment + model.accounts.retirement;
  const liquid = model.accounts.cash;
  const points = [];

  for (let month = 0; month <= months; month += 1) {
    if (month > 0) {
      income *= 1 + monthlyIncomeGrowth;
      livingCost *= 1 + monthlyInflation;
      invested *= 1 + monthlyReturn;
      const debtPayment = Math.min(debt, model.budget.debt * 0.7);
      debt = Math.max(0, debt - debtPayment);
      const free = income - livingCost - model.budget.debt - model.budget.investing;
      invested += model.budget.investing + Math.max(free, 0);
    }
    if (month % 12 === 0 || month === months) {
      points.push({
        age: plan.profile.age + month / 12,
        value: liquid + invested - debt,
        target: model.fireTarget,
      });
    }
  }
  return points;
}

function renderInputs() {
  nodes.currency.value = plan.profile.currency;
  nodes.age.value = plan.profile.age;
  nodes.retirementAge.value = plan.profile.retirementAge;
  nodes.income.value = plan.profile.income;
  nodes.emergencyMonths.value = plan.profile.emergencyMonths;
  nodes.dependents.value = plan.profile.dependents;
  nodes.returnRate.value = plan.scenario.returnRate;
  nodes.inflationRate.value = plan.scenario.inflationRate;
  nodes.incomeGrowth.value = plan.scenario.incomeGrowth;
  nodes.scenarioButtons.forEach((button) => button.classList.toggle("active", button.dataset.scenario === plan.scenario.name));
}

function renderCategories() {
  nodes.categoriesBody.innerHTML = plan.categories
    .map(
      (category, index) => `
        <tr>
          <td><input class="name-input" data-table="categories" data-index="${index}" data-field="name" value="${escapeHtml(category.name)}" /></td>
          <td>
            <select data-table="categories" data-index="${index}" data-field="type">
              ${option("essential", "Necessita", category.type)}
              ${option("lifestyle", "Lifestyle", category.type)}
              ${option("debt", "Debito", category.type)}
              ${option("investing", "Investimento", category.type)}
            </select>
          </td>
          <td><input class="amount-input" type="number" min="0" step="10" data-table="categories" data-index="${index}" data-field="amount" value="${category.amount}" /></td>
          <td>
            <select data-table="categories" data-index="${index}" data-field="priority">
              ${option("Alta", "Alta", category.priority)}
              ${option("Media", "Media", category.priority)}
              ${option("Bassa", "Bassa", category.priority)}
            </select>
          </td>
          <td><button class="remove-button" type="button" data-remove-category="${index}">x</button></td>
        </tr>
      `,
    )
    .join("");
}

function renderAccounts() {
  nodes.accountsBody.innerHTML = plan.accounts
    .map(
      (account, index) => `
        <tr>
          <td><input class="name-input" data-table="accounts" data-index="${index}" data-field="name" value="${escapeHtml(account.name)}" /></td>
          <td>
            <select data-table="accounts" data-index="${index}" data-field="type">
              ${option("cash", "Liquidita", account.type)}
              ${option("investment", "Investimenti", account.type)}
              ${option("retirement", "Previdenza", account.type)}
              ${option("debt", "Debito", account.type)}
            </select>
          </td>
          <td><input class="amount-input" type="number" min="0" step="100" data-table="accounts" data-index="${index}" data-field="value" value="${account.value}" /></td>
          <td>
            <select data-table="accounts" data-index="${index}" data-field="liquidity">
              ${option("Alta", "Alta", account.liquidity)}
              ${option("Media", "Media", account.liquidity)}
              ${option("Bassa", "Bassa", account.liquidity)}
              ${option("Debito", "Debito", account.liquidity)}
            </select>
          </td>
          <td><button class="remove-button" type="button" data-remove-account="${index}">x</button></td>
        </tr>
      `,
    )
    .join("");
}

function renderGoals() {
  nodes.goalsList.innerHTML = plan.goals
    .map((goal, index) => {
      const required = Math.max(goal.target - goal.current, 0) / monthsUntil(goal.deadline);
      const progress = goal.target > 0 ? clamp((goal.current / goal.target) * 100, 0, 100) : 0;
      const status = goal.monthly >= required * 0.95 || progress >= 100 ? "In linea" : `Servono ${formatMoney(required, 0)}/mese`;
      return `
        <article class="goal-card">
          <div class="goal-form">
            <input data-table="goals" data-index="${index}" data-field="name" value="${escapeHtml(goal.name)}" />
            <input type="number" min="0" step="100" data-table="goals" data-index="${index}" data-field="target" value="${goal.target}" />
            <input type="number" min="0" step="100" data-table="goals" data-index="${index}" data-field="current" value="${goal.current}" />
            <input type="month" data-table="goals" data-index="${index}" data-field="deadline" value="${goal.deadline}" />
            <button class="remove-button" type="button" data-remove-goal="${index}">x</button>
          </div>
          <footer>
            <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
            <div class="goal-meta">
              <span>${formatPercent(progress, 0)} completato</span>
              <span>${escapeHtml(status)}</span>
              <span>Contributo ${formatMoney(goal.monthly, 0)}/mese</span>
            </div>
            <input type="number" min="0" step="50" data-table="goals" data-index="${index}" data-field="monthly" value="${goal.monthly}" />
          </footer>
        </article>
      `;
    })
    .join("");
}

function option(value, label, selected) {
  return `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`;
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
  const points = projection(model);
  renderMetrics(model);
  renderCycleLanes(model);
  renderActions(model);
  renderBuckets(model);
  drawWealthChart(points, model);
  drawCashflowChart(model);
  drawBucketChart(model);
  savePlan();
}

function renderMetrics(model) {
  nodes.metrics.netWorth.textContent = formatMoney(model.accounts.netWorth);
  nodes.metrics.assets.textContent = `Asset ${formatMoney(model.accounts.assets)} / Debiti ${formatMoney(model.accounts.debt)}`;
  nodes.metrics.surplus.textContent = formatMoney(model.budget.surplus);
  nodes.metrics.surplus.className = model.budget.surplus >= 0 ? "positive" : "negative";
  nodes.metrics.savingsRate.textContent = `Saving rate ${formatPercent(model.budget.savingsRate)}`;
  nodes.metrics.emergency.textContent = `${formatPercent(model.emergencyProgress, 0)}`;
  nodes.metrics.runway.textContent = `Runway ${formatNumber(model.runway, 1)} mesi`;
  nodes.metrics.goals.textContent = `${model.goals.covered}/${plan.goals.length}`;
  nodes.metrics.required.textContent = `Richiesta ${formatMoney(model.goals.required, 0)}/mese`;
  nodes.metrics.fire.textContent = `${formatPercent(model.fireProgress, 0)}`;
  nodes.metrics.fireGap.textContent = `Gap ${formatMoney(model.fireGap)}`;
  nodes.metrics.score.textContent = `${formatNumber(model.score, 0)}/100`;
  nodes.metrics.score.className = model.score >= 70 ? "positive" : model.score < 45 ? "negative" : "";
  nodes.metrics.scoreLabel.textContent = model.score >= 70 ? "Piano solido" : model.score < 45 ? "Da rinforzare" : "In costruzione";
  nodes.sidebarPhase.textContent = model.phase;
  nodes.sidebarStatus.textContent = `${formatMoney(model.budget.availableToBuild, 0)}/mese destinabili a crescita e obiettivi.`;
  nodes.returnLabel.textContent = formatPercent(plan.scenario.returnRate);
  nodes.inflationLabel.textContent = formatPercent(plan.scenario.inflationRate);
  nodes.incomeGrowthLabel.textContent = formatPercent(plan.scenario.incomeGrowth);
}

function renderCycleLanes(model) {
  const lanes = [
    {
      title: "Protezione",
      body: `Fondo emergenza ${formatMoney(model.accounts.cash)} su target ${formatMoney(model.emergencyTarget)}.`,
      score: clamp(model.emergencyProgress, 0, 100),
      color: "#69d5c7",
    },
    {
      title: "Metodo mensile",
      body: `Cashflow ${formatMoney(model.budget.surplus)} e saving rate ${formatPercent(model.budget.savingsRate)}.`,
      score: clamp(model.budget.savingsRate * 3, 0, 100),
      color: "#65d59a",
    },
    {
      title: "Crescita capitale",
      body: `${formatMoney(model.budget.availableToBuild)}/mese tra investimenti e surplus.`,
      score: clamp((model.budget.availableToBuild / Math.max(plan.profile.income, 1)) * 350, 0, 100),
      color: "#f2b967",
    },
    {
      title: "Liberta",
      body: `Copertura attuale ${formatPercent(model.fireProgress, 0)} del capitale target.`,
      score: clamp(model.fireProgress, 0, 100),
      color: "#c994e8",
    },
  ];
  nodes.cycleLanes.innerHTML = lanes
    .map(
      (lane) => `
        <article class="lane-card">
          <div>
            <h3>${escapeHtml(lane.title)}</h3>
            <p>${escapeHtml(lane.body)}</p>
          </div>
          <div class="lane-score" style="background:${lane.color}">${formatNumber(lane.score, 0)}</div>
        </article>
      `,
    )
    .join("");
}

function renderActions(model) {
  const actions = [];
  if (model.budget.surplus < 0) {
    actions.push(["Chiudi il deficit", `Servono ${formatMoney(Math.abs(model.budget.surplus))}/mese tra taglio spese o aumento entrate.`]);
  }
  if (model.emergencyProgress < 100) {
    actions.push(["Completa la protezione", `Mancano ${formatMoney(Math.max(model.emergencyTarget - model.accounts.cash, 0))} al fondo emergenza.`]);
  }
  if (model.accounts.debt > 0 && model.budget.debt < model.accounts.debt * 0.015) {
    actions.push(["Accelera i debiti", "La rata mensile e bassa rispetto al debito residuo: valuta un piano di rientro piu aggressivo."]);
  }
  if (model.budget.savingsRate < 20) {
    actions.push(["Alza il saving rate", "Target operativo: portare risparmio e investimenti almeno verso il 20-25% del reddito."]);
  }
  if (model.goals.required > model.budget.availableToBuild) {
    actions.push(["Riallinea gli obiettivi", `Gli obiettivi richiedono ${formatMoney(model.goals.required)}/mese, sopra la capacita attuale.`]);
  }
  if (actions.length === 0) {
    actions.push(["Piano coerente", "La struttura attuale e sostenibile: monitora scostamenti e aggiorna gli obiettivi ogni mese."]);
  }
  nodes.actionList.innerHTML = actions
    .slice(0, 5)
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

function renderBuckets(model) {
  const buckets = [
    ["Liquidita", model.accounts.cash, palette[0]],
    ["Investimenti", model.accounts.investment, palette[1]],
    ["Previdenza", model.accounts.retirement, palette[2]],
    ["Debiti", model.accounts.debt, palette[4]],
  ];
  nodes.bucketList.innerHTML = buckets
    .map(
      ([label, value, color]) => `
        <div class="bucket-item">
          <span class="color-dot" style="background:${color}"></span>
          <span>${escapeHtml(label)}</span>
          <strong>${formatMoney(value)}</strong>
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

function drawWealthChart(points, model) {
  const { ctx, width, height } = setupCanvas(nodes.wealthChart);
  ctx.clearRect(0, 0, width, height);
  const left = 66;
  const right = 24;
  const top = 26;
  const bottom = 48;
  const values = points.flatMap((point) => [point.value, point.target]);
  const min = Math.min(0, ...values);
  const max = Math.max(...values) * 1.08 || 1;
  const x = (index) => left + (index / Math.max(points.length - 1, 1)) * (width - left - right);
  const y = (value) => top + ((max - value) / Math.max(max - min, 1)) * (height - top - bottom);
  drawGrid(ctx, width, height, left, right, top, bottom, min, max, "money");
  drawLine(ctx, points.map((point, index) => ({ x: x(index), y: y(point.target) })), "rgba(255, 248, 234, 0.28)", 1.8);
  drawLine(ctx, points.map((point, index) => ({ x: x(index), y: y(point.value) })), "#69d5c7", 3);
  ctx.fillStyle = "rgba(255, 248, 234, 0.56)";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  [0, Math.floor(points.length / 2), points.length - 1].forEach((index) => {
    ctx.fillText(`${formatNumber(points[index].age, 0)} anni`, x(index), height - 15);
  });
  ctx.fillStyle = "#69d5c7";
  ctx.textAlign = "left";
  ctx.fillText(`Fine: ${formatMoney(points[points.length - 1].value)}`, left, top + 8);
  ctx.fillStyle = "rgba(255, 248, 234, 0.58)";
  ctx.fillText(`Target: ${formatMoney(model.fireTarget)}`, left, top + 28);
}

function drawCashflowChart(model) {
  const { ctx, width, height } = setupCanvas(nodes.cashflowChart);
  ctx.clearRect(0, 0, width, height);
  const left = 54;
  const right = 24;
  const top = 30;
  const bottom = 54;
  const bars = [
    ["Reddito", plan.profile.income, palette[0]],
    ["Necessita", model.budget.essential, palette[4]],
    ["Lifestyle", model.budget.lifestyle, palette[1]],
    ["Debiti", model.budget.debt, palette[3]],
    ["Invest", model.budget.investing, palette[2]],
    ["Libero", model.budget.surplus, model.budget.surplus >= 0 ? palette[3] : palette[4]],
  ];
  const max = Math.max(...bars.map((bar) => Math.abs(bar[1])), 1) * 1.15;
  drawGrid(ctx, width, height, left, right, top, bottom, 0, max, "money");
  const slot = (width - left - right) / bars.length;
  bars.forEach(([label, value, color], index) => {
    const barHeight = (Math.abs(value) / max) * (height - top - bottom);
    const x = left + index * slot + slot * 0.18;
    const y = height - bottom - barHeight;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, slot * 0.64, barHeight);
    ctx.fillStyle = "rgba(255, 248, 234, 0.58)";
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x + slot * 0.32, height - 19);
  });
}

function drawBucketChart(model) {
  const { ctx, width, height } = setupCanvas(nodes.bucketChart);
  ctx.clearRect(0, 0, width, height);
  const values = [model.accounts.cash, model.accounts.investment, model.accounts.retirement, model.accounts.debt];
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.34;
  const inner = radius * 0.58;
  let start = -Math.PI / 2;
  values.forEach((value, index) => {
    const slice = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + slice);
    ctx.arc(cx, cy, inner, start + slice, start, true);
    ctx.closePath();
    ctx.fillStyle = [palette[0], palette[1], palette[2], palette[4]][index];
    ctx.fill();
    start += slice;
  });
  ctx.fillStyle = "#fff8ea";
  ctx.font = "800 20px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(formatPercent(model.fireProgress, 0), cx, cy - 8);
  ctx.fillStyle = "rgba(255, 248, 234, 0.58)";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.fillText("liberta", cx, cy + 14);
}

function drawGrid(ctx, width, height, left, right, top, bottom, min, max, mode) {
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
    ctx.fillText(mode === "money" ? formatMoney(value) : formatNumber(value), left - 8, y(value));
  }
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
  plan.profile.age = toNumber(nodes.age.value);
  plan.profile.retirementAge = Math.max(toNumber(nodes.retirementAge.value), plan.profile.age + 1);
  plan.profile.income = toNumber(nodes.income.value);
  plan.profile.emergencyMonths = toNumber(nodes.emergencyMonths.value);
  plan.profile.dependents = toNumber(nodes.dependents.value);
  plan.scenario.returnRate = toNumber(nodes.returnRate.value);
  plan.scenario.inflationRate = toNumber(nodes.inflationRate.value);
  plan.scenario.incomeGrowth = toNumber(nodes.incomeGrowth.value);
}

function updateCollection(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
  const table = target.dataset.table;
  if (!table) return;
  const index = Number(target.dataset.index);
  const field = target.dataset.field;
  if (!plan[table]?.[index] || !field) return;
  plan[table][index][field] = target.type === "number" ? toNumber(target.value) : target.value;
  renderDashboard();
  if (table === "goals" && event.type === "change") renderGoals();
}

function exportCsv() {
  const model = calculate();
  const rows = [
    ["section", "name", "type", "value", "extra"],
    ["profile", "currency", "", plan.profile.currency, ""],
    ["profile", "age", "", plan.profile.age, ""],
    ["profile", "retirementAge", "", plan.profile.retirementAge, ""],
    ["profile", "income", "", plan.profile.income, ""],
    ["metrics", "netWorth", "", model.accounts.netWorth, ""],
    ["metrics", "monthlySurplus", "", model.budget.surplus, ""],
    ["metrics", "savingsRatePct", "", model.budget.savingsRate, ""],
    ["metrics", "emergencyProgressPct", "", model.emergencyProgress, ""],
    ["metrics", "fireProgressPct", "", model.fireProgress, ""],
    ...plan.categories.map((item) => ["budget", item.name, item.type, item.amount, item.priority]),
    ...plan.accounts.map((item) => ["account", item.name, item.type, item.value, item.liquidity]),
    ...plan.goals.map((item) => ["goal", item.name, item.deadline, item.target, `current=${item.current};monthly=${item.monthly}`]),
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
  renderCategories();
  renderAccounts();
  renderGoals();
  renderDashboard();
}

document.querySelectorAll("#currency, #age, #retirement-age, #income, #emergency-months, #dependents, #return-rate, #inflation-rate, #income-growth").forEach((input) => {
  input.addEventListener("input", () => {
    updateProfileFromInputs();
    renderDashboard();
  });
});

nodes.scenarioButtons.forEach((button) => {
  button.addEventListener("click", () => {
    plan.scenario = scenarioPreset(button.dataset.scenario);
    renderInputs();
    renderDashboard();
  });
});

nodes.categoriesBody.addEventListener("input", updateCollection);
nodes.categoriesBody.addEventListener("change", updateCollection);
nodes.accountsBody.addEventListener("input", updateCollection);
nodes.accountsBody.addEventListener("change", updateCollection);
nodes.goalsList.addEventListener("input", updateCollection);
nodes.goalsList.addEventListener("change", updateCollection);

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const category = event.target.closest("[data-remove-category]");
  const account = event.target.closest("[data-remove-account]");
  const goal = event.target.closest("[data-remove-goal]");
  if (category) {
    plan.categories.splice(Number(category.dataset.removeCategory), 1);
    renderCategories();
    renderDashboard();
  }
  if (account) {
    plan.accounts.splice(Number(account.dataset.removeAccount), 1);
    renderAccounts();
    renderDashboard();
  }
  if (goal) {
    plan.goals.splice(Number(goal.dataset.removeGoal), 1);
    renderGoals();
    renderDashboard();
  }
});

nodes.addCategory.addEventListener("click", () => {
  plan.categories.push({ name: "Nuova categoria", type: "lifestyle", amount: 100, priority: "Media" });
  renderCategories();
  renderDashboard();
});

nodes.addAccount.addEventListener("click", () => {
  plan.accounts.push({ name: "Nuova voce", type: "investment", value: 1000, liquidity: "Media" });
  renderAccounts();
  renderDashboard();
});

nodes.addGoal.addEventListener("click", () => {
  plan.goals.push({ name: "Nuovo obiettivo", target: 10000, current: 0, deadline: "2028-12", monthly: 250 });
  renderGoals();
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
