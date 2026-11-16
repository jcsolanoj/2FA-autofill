/**
 * 2FA Autofill - Content Script multi-empresa.
 * Se ejecuta únicamente en orígenes autorizados por el usuario o bajo demanda vía activeTab.
 */

(() => {
  if (window.__twoFactorAutofillInitialized) {
    return;
  }
  window.__twoFactorAutofillInitialized = true;

  const processedInputs = new WeakSet();
  const TRACKER_TTL_MS = 5 * 60 * 1000;
  let mutationTimer = null;
  let isFilling = false;

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      el.offsetParent !== null
    );
  }

  function hasVisiblePasswordField() {
    return Array.from(document.querySelectorAll('input[type="password"]')).some(isVisible);
  }

  function setupLoginTracker() {
    if (!hasVisiblePasswordField()) return;

    const userInputs = document.querySelectorAll(
      'input[type="email"], input[type="text"][name*="user" i], input[type="text"][name*="email" i], input[autocomplete="username"], input#username, input#email'
    );

    userInputs.forEach((input) => {
      if (input.dataset.twoFaTracked) return;
      input.dataset.twoFaTracked = "1";

      const saveUser = () => {
        const val = input.value.trim();
        if (!val) return;
        chrome.storage.local.set({
          ultimo_usuario: {
            email: val,
            origin: window.location.origin,
            expiresAt: Date.now() + TRACKER_TTL_MS,
          },
        });
      };

      input.addEventListener("change", saveUser);
      input.addEventListener("blur", saveUser);
      if (input.form) {
        input.form.addEventListener("submit", saveUser);
      }
    });
  }

  function find2FAInput() {
    if (hasVisiblePasswordField()) {
      return null;
    }

    const explicitSelectors = [
      'input[autocomplete="one-time-code"]',
      'input[name*="totp" i]',
      'input[id*="totp" i]',
      'input[name*="otp" i]',
      'input[id*="otp" i]',
      'input[name*="2fa" i]',
      'input[id*="2fa" i]',
      'input[name*="mfa" i]',
      'input[id*="mfa" i]',
      'input[name="token" i]',
      'input#token',
      'input[name*="code" i]',
      'input[id*="code" i]',
      'input[placeholder*="código" i]',
      'input[placeholder*="code" i]',
      'input[placeholder*="token" i]',
      'input[placeholder*="otp" i]',
    ];

    for (const sel of explicitSelectors) {
      const candidates = document.querySelectorAll(sel);
      for (const el of candidates) {
        if (isVisible(el) && el.type !== "password" && !el.disabled && !el.readOnly) {
          return el;
        }
      }
    }

    // Fallback seguro: input de 6 dígitos solo si el texto de la página menciona 2FA/OTP/verificación
    const bodyText = (document.body?.innerText || "").toLowerCase();
    const looksLike2FAPage =
      /\b(2fa|mfa|totp|otp|autenticador|authenticator|verificación|verification)\b/.test(bodyText);
    if (!looksLike2FAPage) {
      return null;
    }

    const maxLenCandidates = document.querySelectorAll('input[maxlength="6"]');
    for (const el of maxLenCandidates) {
      if (isVisible(el) && ["text", "tel", "number", ""].includes(el.type) && !el.disabled && !el.readOnly) {
        return el;
      }
    }

    return null;
  }

  function findSubmitButton(codeInput) {
    const scope = codeInput.form || document;
    const candidates = Array.from(
      scope.querySelectorAll('button[type="submit"], input[type="submit"], button')
    ).filter(isVisible);

    const actionRegex = /\b(verificar|verify|confirmar|confirm|enviar|submit|continuar|continue|iniciar|sign in|log in|next)\b/i;

    for (const btn of candidates) {
      const label = (btn.innerText || btn.value || btn.getAttribute("aria-label") || "").trim();
      if (actionRegex.test(label)) {
        return btn;
      }
    }

    return candidates.find((btn) => btn.type === "submit") || null;
  }

  async function fillInputWithAccount(codeInput, account) {
    if (!codeInput || !account || processedInputs.has(codeInput)) return false;

    const code = await generateTOTP(account.secret, {
      digits: account.digits || 6,
      period: account.period || 30,
      algorithm: account.algorithm || "SHA-1",
    });

    processedInputs.add(codeInput);
    codeInput.focus();

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    nativeInputValueSetter.call(codeInput, code);

    codeInput.dispatchEvent(new Event("input", { bubbles: true }));
    codeInput.dispatchEvent(new Event("change", { bubbles: true }));

    // Limpiar tracker tras autocompletado exitoso
    chrome.storage.local.remove("ultimo_usuario");

    if (account.autoSubmit === true) {
      setTimeout(() => {
        const submitBtn = findSubmitButton(codeInput);
        if (submitBtn) {
          submitBtn.click();
        } else if (codeInput.form) {
          codeInput.form.requestSubmit ? codeInput.form.requestSubmit() : codeInput.form.submit();
        }
      }, 600);
    }

    return true;
  }

  function selectAccountForOrigin(accounts, tracker) {
    const currentOrigin = window.location.origin;
    const matching = accounts.filter((acc) => {
      if (!acc.origin) return false;
      return acc.origin.toLowerCase() === currentOrigin.toLowerCase();
    });

    if (matching.length === 0) return null;

    if (
      tracker &&
      tracker.origin === currentOrigin &&
      tracker.expiresAt > Date.now() &&
      tracker.email
    ) {
      const exact = matching.find(
        (acc) => acc.email.toLowerCase() === tracker.email.toLowerCase()
      );
      if (exact) return exact;
    }

    return matching.length === 1 ? matching[0] : matching[0];
  }

  async function autofill2FA() {
    if (isFilling) return;
    const codeInput = find2FAInput();
    if (!codeInput || processedInputs.has(codeInput)) return;

    isFilling = true;
    try {
      const res = await new Promise((resolve) => {
        chrome.storage.local.get(["accounts", "ultimo_usuario"], (data) => {
          if (chrome.runtime.lastError) {
            resolve({});
          } else {
            resolve(data || {});
          }
        });
      });

      const accounts = res.accounts || [];
      const account = selectAccountForOrigin(accounts, res.ultimo_usuario);
      if (account) {
        await fillInputWithAccount(codeInput, account);
      }
    } finally {
      isFilling = false;
    }
  }

  // API para inyección manual bajo demanda desde popup.js (activeTab)
  window.__2faFillAccount = async (account) => {
    const codeInput = find2FAInput();
    if (!codeInput) {
      throw new Error("No se detectó un campo de código 2FA visible en esta página.");
    }
    processedInputs.delete(codeInput);
    return fillInputWithAccount(codeInput, account);
  };

  function init() {
    setupLoginTracker();
    autofill2FA();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  const observer = new MutationObserver(() => {
    if (mutationTimer) clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      setupLoginTracker();
      autofill2FA();
    }, 150);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
