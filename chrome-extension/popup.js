/**
 * 2FA Autofill - Popup UI & Dynamic Permission Manager (MV3)
 */

document.addEventListener("DOMContentLoaded", () => {
  const tabAccounts = document.getElementById("tab-accounts");
  const tabAdd = document.getElementById("tab-add");
  const contentAccounts = document.getElementById("content-accounts");
  const contentAdd = document.getElementById("content-add");
  const btnGoToAdd = document.getElementById("btn-go-to-add");

  const addAccountForm = document.getElementById("add-account-form");
  const inputEmail = document.getElementById("input-email");
  const inputOrigin = document.getElementById("input-origin");
  const btnUseCurrentTab = document.getElementById("btn-use-current-tab");
  const inputSecret = document.getElementById("input-secret");
  const inputAutoSubmit = document.getElementById("input-autosubmit");
  const btnToggleSecret = document.getElementById("btn-toggle-secret");

  const accountsList = document.getElementById("accounts-list");
  const emptyState = document.getElementById("empty-state");
  const toastEl = document.getElementById("toast");

  let accounts = [];
  let timerInterval = null;
  let toastTimeout = null;
  let pendingDeleteIndex = null;
  let lastWindowIndex = -1;

  function switchTab(tabName) {
    if (tabName === "accounts") {
      tabAccounts.classList.add("active");
      tabAdd.classList.remove("active");
      contentAccounts.classList.add("active");
      contentAdd.classList.remove("active");
    } else {
      tabAdd.classList.add("active");
      tabAccounts.classList.remove("active");
      contentAdd.classList.add("active");
      contentAccounts.classList.remove("active");
      inputEmail.focus();
    }
  }

  tabAccounts.addEventListener("click", () => switchTab("accounts"));
  tabAdd.addEventListener("click", () => switchTab("add"));
  btnGoToAdd.addEventListener("click", () => switchTab("add"));

  btnToggleSecret.addEventListener("click", () => {
    inputSecret.type = inputSecret.type === "password" ? "text" : "password";
  });

  btnUseCurrentTab.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url && /^https?:\/\//.test(tab.url)) {
        inputOrigin.value = new URL(tab.url).origin;
      } else {
        showToast("La pestaña actual no es una URL http(s).", "error");
      }
    } catch {
      showToast("No se pudo leer la pestaña actual.", "error");
    }
  });

  function showToast(msg, type = "info") {
    toastEl.textContent = msg;
    toastEl.className = `toast show ${type}`;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastEl.classList.remove("show");
    }, 3000);
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (res) => {
        if (chrome.runtime.lastError) resolve({});
        else resolve(res || {});
      });
    });
  }

  function storageSet(obj) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(obj, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  }

  async function syncRegisteredContentScripts() {
    if (!chrome.scripting?.registerContentScripts) return;
    const origins = Array.from(
      new Set(accounts.map((a) => a.origin).filter((o) => o && /^https?:\/\//.test(o)))
    );

    try {
      await chrome.scripting.unregisterContentScripts({ ids: ["2fa-autofill-dynamic"] });
    } catch {
      // No existía previamente
    }

    if (origins.length === 0) return;

    const grantedOrigins = [];
    for (const origin of origins) {
      const pattern = `${origin}/*`;
      const hasPerm = await chrome.permissions.contains({ origins: [pattern] });
      if (hasPerm) grantedOrigins.push(pattern);
    }

    if (grantedOrigins.length > 0) {
      await chrome.scripting.registerContentScripts([
        {
          id: "2fa-autofill-dynamic",
          matches: grantedOrigins,
          js: ["totp.js", "content.js"],
          runAt: "document_idle",
        },
      ]);
    }
  }

  async function fillCurrentTab(account) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        showToast("No hay pestaña activa.", "error");
        return;
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["totp.js", "content.js"],
      });

      const [{ result, error }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (acc) => {
          if (typeof window.__2faFillAccount !== "function") {
            return { ok: false, error: "Script no inicializado." };
          }
          try {
            await window.__2faFillAccount(acc);
            return { ok: true };
          } catch (e) {
            return { ok: false, error: e.message };
          }
        },
        args: [account],
      });

      if (error || !result?.ok) {
        showToast(result?.error || "No se detectó campo 2FA en la pestaña.", "error");
      } else {
        showToast("Código 2FA rellenado en la pestaña.", "success");
      }
    } catch (err) {
      showToast("No se pudo acceder a la pestaña actual.", "error");
    }
  }

  function renderAccounts() {
    accountsList.replaceChildren();
    if (accounts.length === 0) {
      emptyState.style.display = "flex";
      accountsList.style.display = "none";
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      return;
    }

    emptyState.style.display = "none";
    accountsList.style.display = "flex";

    accounts.forEach((account, index) => {
      const card = document.createElement("div");
      card.className = "account-card";
      card.dataset.index = String(index);

      const header = document.createElement("div");
      header.className = "card-header";

      const metaDiv = document.createElement("div");
      const emailSpan = document.createElement("div");
      emailSpan.className = "account-email";
      emailSpan.textContent = account.email;
      emailSpan.title = account.email;
      metaDiv.appendChild(emailSpan);

      if (account.origin) {
        const originDiv = document.createElement("div");
        originDiv.className = "account-origin";
        originDiv.textContent = account.origin;
        metaDiv.appendChild(originDiv);
      }

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "card-actions";

      const fillBtn = document.createElement("button");
      fillBtn.type = "button";
      fillBtn.className = "btn-fill-tab";
      fillBtn.textContent = "Rellenar";
      fillBtn.title = "Rellenar en pestaña actual";
      fillBtn.addEventListener("click", () => fillCurrentTab(account));
      actionsDiv.appendChild(fillBtn);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn-delete";
      if (pendingDeleteIndex === index) {
        delBtn.textContent = "¿Confirmar?";
        delBtn.title = "Clic nuevamente para eliminar";
      } else {
        delBtn.textContent = "🗑️";
        delBtn.title = "Eliminar cuenta";
      }
      delBtn.addEventListener("click", () => {
        if (pendingDeleteIndex === index) {
          pendingDeleteIndex = null;
          deleteAccount(index);
        } else {
          pendingDeleteIndex = index;
          renderAccounts();
          setTimeout(() => {
            if (pendingDeleteIndex === index) {
              pendingDeleteIndex = null;
              renderAccounts();
            }
          }, 3000);
        }
      });
      actionsDiv.appendChild(delBtn);

      header.appendChild(metaDiv);
      header.appendChild(actionsDiv);

      const body = document.createElement("div");
      body.className = "card-body";

      const codeDisplay = document.createElement("div");
      codeDisplay.className = "totp-code";
      codeDisplay.id = `code-${index}`;
      codeDisplay.title = "Clic para copiar";
      codeDisplay.textContent = "------";
      codeDisplay.addEventListener("click", async () => {
        const cleanCode = (codeDisplay.dataset.rawCode || "").trim();
        if (!cleanCode) return;
        await navigator.clipboard.writeText(cleanCode);
        showToast("Código copiado al portapapeles", "success");
      });

      const timerContainer = document.createElement("div");
      timerContainer.className = "timer-container";
      timerContainer.innerHTML = `
        <svg class="timer-ring" width="32" height="32" viewBox="0 0 32 32">
          <circle class="ring-bg" cx="16" cy="16" r="14"></circle>
          <circle class="ring-progress" id="ring-${index}" cx="16" cy="16" r="14" stroke-dasharray="88" stroke-dashoffset="0"></circle>
        </svg>
        <span class="timer-text" id="time-${index}">30</span>
      `;

      body.appendChild(codeDisplay);
      body.appendChild(timerContainer);
      card.appendChild(header);
      card.appendChild(body);
      accountsList.appendChild(card);
    });

    lastWindowIndex = -1;
    updateCodes();
    startTimer();
  }

  async function updateCodes(force = true) {
    const epoch = Math.floor(Date.now() / 1000);

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      const period = account.period || 30;
      const remaining = period - (epoch % period);
      const windowIdx = Math.floor(epoch / period);

      const timeEl = document.getElementById(`time-${i}`);
      const ringEl = document.getElementById(`ring-${i}`);
      const codeEl = document.getElementById(`code-${i}`);

      if (timeEl && ringEl) {
        timeEl.textContent = String(remaining);
        const offset = 88 - (88 * remaining) / period;
        ringEl.style.strokeDashoffset = String(offset);
        if (remaining <= 5) {
          ringEl.classList.add("danger");
          timeEl.classList.add("danger");
        } else {
          ringEl.classList.remove("danger");
          timeEl.classList.remove("danger");
        }
      }

      if (codeEl && (force || windowIdx !== lastWindowIndex || !codeEl.dataset.rawCode)) {
        try {
          const code = await generateTOTP(account.secret, {
            digits: account.digits || 6,
            period,
            algorithm: account.algorithm || "SHA-1",
          });
          codeEl.dataset.rawCode = code;
          codeEl.textContent = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
        } catch {
          codeEl.dataset.rawCode = "";
          codeEl.textContent = "ERROR";
        }
      }
    }

    lastWindowIndex = Math.floor(epoch / 30);
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => updateCodes(false), 1000);
  }

  addAccountForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = inputEmail.value.trim();
    const rawSecret = inputSecret.value.trim();
    const rawOrigin = inputOrigin.value.trim();
    const autoSubmit = inputAutoSubmit.checked;

    if (!email || !rawSecret) {
      showToast("Completa todos los campos requeridos.", "error");
      return;
    }

    let secret = rawSecret.toUpperCase().replace(/\s+/g, "");
    let algorithm = "SHA-1";
    let digits = 6;
    let period = 30;

    if (rawSecret.toLowerCase().startsWith("otpauth://")) {
      try {
        const parsed = parseOtpAuthUri(rawSecret);
        secret = parsed.secret;
        algorithm = parsed.algorithm;
        digits = parsed.digits;
        period = parsed.period;
      } catch (err) {
        showToast(err.message, "error");
        return;
      }
    }

    let origin = "";
    if (rawOrigin) {
      try {
        origin = new URL(rawOrigin).origin;
        const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
        if (!granted) {
          showToast("Permiso de dominio denegado. Puedes usar 'Rellenar' manualmente.", "info");
        }
      } catch {
        showToast("URL de dominio inválida (ej. https://login.empresa.com).", "error");
        return;
      }
    }

    try {
      await generateTOTP(secret, { algorithm, digits, period });
    } catch (err) {
      showToast(`Clave secreta inválida: ${err.message}`, "error");
      return;
    }

    const existingIdx = accounts.findIndex(
      (a) => a.email.toLowerCase() === email.toLowerCase() && (a.origin || "") === origin
    );
    const entry = { email, secret, origin, autoSubmit, algorithm, digits, period };
    if (existingIdx >= 0) {
      accounts[existingIdx] = entry;
      showToast("Cuenta actualizada.", "info");
    } else {
      accounts.push(entry);
      showToast("Cuenta guardada exitosamente.", "success");
    }

    await storageSet({ accounts });
    await syncRegisteredContentScripts();

    addAccountForm.reset();
    inputSecret.type = "password";
    switchTab("accounts");
    renderAccounts();
  });

  async function deleteAccount(index) {
    accounts.splice(index, 1);
    await storageSet({ accounts });
    await syncRegisteredContentScripts();
    renderAccounts();
    showToast("Cuenta eliminada.", "info");
  }

  async function loadAccounts() {
    const res = await storageGet(["accounts"]);
    accounts = Array.isArray(res.accounts) ? res.accounts : [];
    renderAccounts();
  }

  loadAccounts();
});
