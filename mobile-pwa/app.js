/**
 * 2FA Autofill Mobile (PWA) - CSP-strict client application
 */

document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "2fa_accounts";
  const accountsList = document.getElementById("accounts-list");
  const emptyState = document.getElementById("empty-state");
  const modalOverlay = document.getElementById("modal-overlay");
  const btnOpenModal = document.getElementById("btn-open-modal");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const addForm = document.getElementById("add-form");
  const inputEmail = document.getElementById("input-email");
  const inputSecret = document.getElementById("input-secret");
  const toastEl = document.getElementById("toast");

  let accounts = loadAccounts();
  let timerId = null;
  let toastTimeout = null;
  let pendingDeleteIndex = null;
  let lastWindowIndex = -1;

  function loadAccounts() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveAccounts() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastEl.classList.remove("show"), 2500);
  }

  function openModal() {
    modalOverlay.classList.add("open");
    setTimeout(() => inputEmail.focus(), 100);
  }

  function closeModal() {
    modalOverlay.classList.remove("open");
    addForm.reset();
  }

  btnOpenModal.addEventListener("click", openModal);
  btnCloseModal.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = inputEmail.value.trim();
    const rawSecret = inputSecret.value.trim();

    if (!email || !rawSecret) {
      showToast("Completa todos los campos.");
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
        showToast(err.message);
        return;
      }
    }

    try {
      await generateTOTP(secret, { algorithm, digits, period });
    } catch (err) {
      showToast(`Clave inválida: ${err.message}`);
      return;
    }

    const idx = accounts.findIndex((a) => a.email.toLowerCase() === email.toLowerCase());
    const entry = { email, secret, algorithm, digits, period };
    if (idx >= 0) {
      accounts[idx] = entry;
      showToast("Cuenta actualizada.");
    } else {
      accounts.push(entry);
      showToast("Cuenta agregada.");
    }

    saveAccounts();
    closeModal();
    renderAccounts();
  });

  function createSvgTimer(index) {
    const container = document.createElement("div");
    container.className = "timer-container";

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "timer-ring");
    svg.setAttribute("width", "40");
    svg.setAttribute("height", "40");
    svg.setAttribute("viewBox", "0 0 40 40");

    const bg = document.createElementNS(ns, "circle");
    bg.setAttribute("class", "ring-bg");
    bg.setAttribute("cx", "20");
    bg.setAttribute("cy", "20");
    bg.setAttribute("r", "17");

    const prog = document.createElementNS(ns, "circle");
    prog.setAttribute("class", "ring-progress");
    prog.setAttribute("id", `ring-${index}`);
    prog.setAttribute("cx", "20");
    prog.setAttribute("cy", "20");
    prog.setAttribute("r", "17");
    prog.setAttribute("stroke-dasharray", "106.8");
    prog.setAttribute("stroke-dashoffset", "0");

    svg.appendChild(bg);
    svg.appendChild(prog);

    const span = document.createElement("span");
    span.className = "timer-text";
    span.id = `time-${index}`;
    span.textContent = "30";

    container.appendChild(svg);
    container.appendChild(span);
    return container;
  }

  function renderAccounts() {
    accountsList.replaceChildren();
    if (accounts.length === 0) {
      emptyState.style.display = "flex";
      accountsList.style.display = "none";
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      return;
    }

    emptyState.style.display = "none";
    accountsList.style.display = "flex";

    accounts.forEach((acc, i) => {
      const card = document.createElement("div");
      card.className = "account-card";
      card.addEventListener("click", async () => {
        const codeEl = document.getElementById(`code-${i}`);
        const raw = codeEl?.dataset.rawCode || "";
        if (!raw) return;
        try {
          await navigator.clipboard.writeText(raw);
          showToast("Código copiado al portapapeles");
        } catch {
          showToast(`Código: ${raw}`);
        }
      });

      const header = document.createElement("div");
      header.className = "card-header";

      const emailEl = document.createElement("span");
      emailEl.className = "account-email";
      emailEl.textContent = acc.email;

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn-delete";
      delBtn.textContent = pendingDeleteIndex === i ? "¿Confirmar?" : "🗑️";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (pendingDeleteIndex === i) {
          pendingDeleteIndex = null;
          accounts.splice(i, 1);
          saveAccounts();
          renderAccounts();
          showToast("Cuenta eliminada.");
        } else {
          pendingDeleteIndex = i;
          renderAccounts();
          setTimeout(() => {
            if (pendingDeleteIndex === i) {
              pendingDeleteIndex = null;
              renderAccounts();
            }
          }, 3000);
        }
      });

      header.appendChild(emailEl);
      header.appendChild(delBtn);

      const body = document.createElement("div");
      body.className = "card-body";

      const codeEl = document.createElement("div");
      codeEl.className = "totp-code";
      codeEl.id = `code-${i}`;
      codeEl.textContent = "------";

      body.appendChild(codeEl);
      body.appendChild(createSvgTimer(i));

      card.appendChild(header);
      card.appendChild(body);
      accountsList.appendChild(card);
    });

    lastWindowIndex = -1;
    updateCodes(true);
    if (!timerId) {
      timerId = setInterval(() => updateCodes(false), 1000);
    }
  }

  async function updateCodes(force = false) {
    const epoch = Math.floor(Date.now() / 1000);

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      const period = acc.period || 30;
      const remaining = period - (epoch % period);
      const windowIdx = Math.floor(epoch / period);

      const timeEl = document.getElementById(`time-${i}`);
      const ringEl = document.getElementById(`ring-${i}`);
      const codeEl = document.getElementById(`code-${i}`);

      if (timeEl && ringEl) {
        timeEl.textContent = String(remaining);
        const offset = 106.8 - (106.8 * remaining) / period;
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
          const code = await generateTOTP(acc.secret, {
            digits: acc.digits || 6,
            period,
            algorithm: acc.algorithm || "SHA-1",
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

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  renderAccounts();
});
