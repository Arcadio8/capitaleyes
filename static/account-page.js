const nodes = {
  tabs: document.querySelectorAll("[data-account-tab]"),
  forms: {
    login: document.querySelector("#login-form"),
    register: document.querySelector("#register-form"),
    forgot: document.querySelector("#forgot-form"),
    reset: document.querySelector("#reset-form"),
    manage: document.querySelector("#manage-form"),
  },
  manageTab: document.querySelector("#manage-tab"),
  message: document.querySelector("#account-message"),
};

function setActiveTab(name) {
  nodes.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.accountTab === name));
  Object.entries(nodes.forms).forEach(([key, form]) => form.classList.toggle("active", key === name));
  setMessage("");
}

function setMessage(text, isError = false) {
  nodes.message.textContent = text;
  nodes.message.classList.toggle("error", isError);
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Richiesta non riuscita.");
  return payload;
}

function formObject(form) {
  const formData = new FormData(form);
  return Object.fromEntries(formData.entries());
}

function passwordIssue(value) {
  if (value.length < 10) return "La password deve avere almeno 10 caratteri.";
  const categories = [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;
  if (categories < 3) {
    return "Usa almeno tre categorie tra maiuscole, minuscole, numeri e simboli.";
  }
  return "";
}

function redirectTarget() {
  const fallback = "/platform";
  const raw = new URLSearchParams(window.location.search).get("next");
  if (!raw) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    const allowedPaths = new Set(["/platform", "/backtest", "/cycle-life-budgeting"]);
    if (url.origin !== window.location.origin || !allowedPaths.has(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

nodes.tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.accountTab));
});

document.querySelector("[data-open-forgot]").addEventListener("click", () => setActiveTab("forgot"));

nodes.forms.login.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formObject(event.currentTarget);
  try {
    await requestJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        password: data.password,
      }),
    });
    setMessage("Accesso effettuato. Apertura area richiesta...");
    window.location.href = redirectTarget();
  } catch (error) {
    setMessage(error.message, true);
  }
});

nodes.forms.register.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formObject(event.currentTarget);
  if (data.password !== data.passwordConfirm) {
    setMessage("Le due password non coincidono.", true);
    return;
  }
  const issue = passwordIssue(data.password);
  if (issue) {
    setMessage(issue, true);
    return;
  }
  try {
    await requestJson("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        passwordConfirm: data.passwordConfirm,
        privacyConsent: data.privacyConsent === "on",
        termsConsent: data.termsConsent === "on",
        marketingConsent: data.marketingConsent === "on",
      }),
    });
    setMessage("Account creato. Apertura area richiesta...");
    window.setTimeout(() => {
      window.location.href = redirectTarget();
    }, 450);
  } catch (error) {
    setMessage(error.message, true);
  }
});

nodes.forms.forgot.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formObject(event.currentTarget);
  try {
    const payload = await requestJson("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: data.email }),
    });
    if (!payload.emailConfigured) {
      setMessage("Il servizio email non è ancora configurato. Riprova più tardi.", true);
      return;
    }
    setMessage(payload.message);
    if (payload.resetUrl) {
      nodes.message.innerHTML = `${payload.message} <a href="${payload.resetUrl}">Apri il link locale di recupero</a>`;
    }
  } catch (error) {
    setMessage(error.message, true);
  }
});

nodes.forms.reset.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formObject(event.currentTarget);
  if (data.password !== data.passwordConfirm) {
    setMessage("Le due password non coincidono.", true);
    return;
  }
  const issue = passwordIssue(data.password);
  if (issue) {
    setMessage(issue, true);
    return;
  }
  const token = new URLSearchParams(window.location.search).get("token") || "";
  try {
    await requestJson("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password: data.password, passwordConfirm: data.passwordConfirm }),
    });
    setMessage("Password aggiornata. Accesso effettuato.");
    window.setTimeout(() => { window.location.href = "/platform"; }, 500);
  } catch (error) {
    setMessage(error.message, true);
  }
});

nodes.forms.manage.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formObject(event.currentTarget);
  if (String(data.confirmation || "").trim().toUpperCase() !== "ELIMINA") {
    setMessage("Scrivi ELIMINA per confermare.", true);
    return;
  }
  if (!window.confirm("Vuoi eliminare definitivamente account e dati salvati?")) return;
  try {
    const payload = await requestJson("/api/auth/delete-account", {
      method: "POST",
      body: JSON.stringify({ password: data.password, confirmation: data.confirmation }),
    });
    setMessage(payload.message);
    window.setTimeout(() => { window.location.href = "/"; }, 700);
  } catch (error) {
    setMessage(error.message, true);
  }
});

const params = new URLSearchParams(window.location.search);
if (params.get("token")) {
  setActiveTab("reset");
} else if (params.get("tab") && params.get("tab") !== "manage" && nodes.forms[params.get("tab")]) {
  setActiveTab(params.get("tab"));
}

requestJson("/api/auth/me", { method: "GET" }).then((payload) => {
  if (!payload.user) return;
  nodes.manageTab.hidden = false;
  if (!params.get("token") && params.get("tab") === "manage") setActiveTab("manage");
}).catch(() => undefined);
