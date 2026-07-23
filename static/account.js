(function () {
  const state = {
    user: null,
    ready: false,
    open: false,
    mode: "login",
    listeners: new Set(),
  };

  let root;
  let message = "";
  let messageIsError = false;

  function emitChange() {
    state.listeners.forEach((listener) => listener(state.user));
    window.dispatchEvent(new CustomEvent("capitaleyes:auth-change", { detail: { user: state.user } }));
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
    if (!response.ok) {
      throw new Error(payload.error || "Richiesta non riuscita.");
    }
    return payload;
  }

  function setMessage(value, isError = false) {
    message = value;
    messageIsError = isError;
    render();
  }

  function mount() {
    root = document.createElement("div");
    root.className = "ce-account";
    document.body.append(root);
    root.addEventListener("click", handleClick);
    root.addEventListener("submit", handleSubmit);
  }

  function render() {
    if (!root) return;
    const user = state.user;
    const title = user ? "Account" : state.mode === "login" ? "Accedi" : "Crea account";
    const formAction = state.mode === "login" ? "Accedi" : "Crea account";
    const toggleText = user ? user.email : "Account";
    root.innerHTML = `
      <button class="ce-account-toggle" type="button" data-account-toggle>${escapeHtml(toggleText)}</button>
      <section class="ce-account-panel" ${state.open ? "" : "hidden"}>
        <div class="ce-account-head">
          <div>
            <span>CapitalEyes</span>
            <strong>${escapeHtml(title)}</strong>
          </div>
          <button class="ce-account-close" type="button" data-account-close>x</button>
        </div>
        ${
          user
            ? `
              <div class="ce-account-user">
                <strong>${escapeHtml(user.email)}</strong>
                <small>I dati dei prodotti vengono salvati nel tuo account quando modifichi o salvi.</small>
                <button class="ce-account-secondary" type="button" data-account-logout>Esci</button>
              </div>
            `
            : `
              <form class="ce-account-form">
                <label>
                  <span>Email</span>
                  <input name="email" type="email" autocomplete="email" required />
                </label>
                <label>
                  <span>Password</span>
                  <input name="password" type="password" autocomplete="${state.mode === "login" ? "current-password" : "new-password"}" minlength="8" required />
                </label>
                <button class="ce-account-primary" type="submit" data-account-submit>${escapeHtml(formAction)}</button>
                <button class="ce-account-link" type="button" data-account-mode="${state.mode === "login" ? "register" : "login"}">
                  ${state.mode === "login" ? "Crea un nuovo account" : "Ho gia un account"}
                </button>
              </form>
            `
        }
        <div class="ce-account-message ${messageIsError ? "error" : ""}">${escapeHtml(message)}</div>
      </section>
    `;
  }

  async function refreshUser() {
    const payload = await requestJson("/api/auth/me", { method: "GET" });
    state.user = payload.user || null;
    state.ready = true;
    render();
    emitChange();
    window.dispatchEvent(new CustomEvent("capitaleyes:account-ready", { detail: { user: state.user } }));
    return state.user;
  }

  async function handleSubmit(event) {
    const form = event.target.closest(".ce-account-form");
    if (!form) return;
    event.preventDefault();
    const formData = new FormData(form);
    const endpoint = state.mode === "login" ? "/api/auth/login" : "/api/auth/register";
    try {
      const payload = await requestJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          email: String(formData.get("email") || ""),
          password: String(formData.get("password") || ""),
        }),
      });
      state.user = payload.user || null;
      message = state.mode === "login" ? "Accesso effettuato." : "Account creato.";
      messageIsError = false;
      render();
      emitChange();
    } catch (error) {
      setMessage(error.message, true);
    }
  }

  async function handleClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-account-toggle]")) {
      state.open = !state.open;
      render();
      return;
    }
    if (target.closest("[data-account-close]")) {
      state.open = false;
      render();
      return;
    }
    const modeButton = target.closest("[data-account-mode]");
    if (modeButton) {
      state.mode = modeButton.dataset.accountMode || "login";
      message = state.mode === "register" ? "Password minima: 8 caratteri." : "";
      messageIsError = false;
      render();
      return;
    }
    if (target.closest("[data-account-logout]")) {
      try {
        await requestJson("/api/auth/logout", { method: "POST", body: "{}" });
        state.user = null;
        message = "Sessione chiusa.";
        messageIsError = false;
        render();
        emitChange();
      } catch (error) {
        setMessage(error.message, true);
      }
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  const api = {
    ready: null,
    getUser() {
      return state.user;
    },
    onChange(listener) {
      state.listeners.add(listener);
      if (state.ready) listener(state.user);
      return () => state.listeners.delete(listener);
    },
    async refresh() {
      return refreshUser();
    },
    async loadProductData(product) {
      if (!state.user) return null;
      const payload = await requestJson(`/api/user-data?product=${encodeURIComponent(product)}`, { method: "GET" });
      return payload.data || null;
    },
    async saveProductData(product, data) {
      if (!state.user) return { skipped: true };
      return requestJson("/api/user-data", {
        method: "PUT",
        body: JSON.stringify({ product, data }),
      });
    },
  };

  window.CapitalEyesAccount = api;

  function start() {
    mount();
    render();
    api.ready = refreshUser().catch(() => {
      state.ready = true;
      render();
      window.dispatchEvent(new CustomEvent("capitaleyes:account-ready", { detail: { user: null } }));
      return null;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
