const nodes = {
  tabs: document.querySelectorAll("[data-account-tab]"),
  forms: {
    login: document.querySelector("#login-form"),
    register: document.querySelector("#register-form"),
  },
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

nodes.tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.accountTab));
});

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
    setMessage("Accesso effettuato. Apertura platform...");
    window.location.href = "/platform";
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
    setMessage("Account creato. Apertura platform...");
    window.setTimeout(() => {
      window.location.href = "/platform";
    }, 450);
  } catch (error) {
    setMessage(error.message, true);
  }
});

const params = new URLSearchParams(window.location.search);
if (params.get("tab") && nodes.forms[params.get("tab")]) {
  setActiveTab(params.get("tab"));
}
