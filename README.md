# 2FA-autofill — Autenticador TOTP Multi-Empresa (PC & Móvil)

Suite de autenticación en dos pasos (**2FA / TOTP** compatible con **RFC 6238**) 100% offline, sin dependencias externas ni servidores propios:

- **Extensión de Chrome (`chrome-extension/`):** Autocompletado inteligente por dominio autorizado (Manifest V3) y botón de rellenado bajo demanda en la pestaña actual.
- **PWA Móvil (`mobile-pwa/`):** Aplicación web instalable en Android e iOS (Safari) con soporte offline mediante Service Worker y Content Security Policy (CSP) estricta.

---

## Estructura del proyecto

```text
2FA-autofill/
├── chrome-extension/      # Extensión Chrome (Manifest V3)
│   ├── manifest.json
│   ├── popup.html / css / js
│   ├── content.js
│   ├── totp.js
│   └── README.md
├── mobile-pwa/            # Progressive Web App offline
│   ├── index.html
│   ├── app.css / app.js
│   ├── totp.js
│   ├── manifest.json
│   ├── sw.js
│   └── README.md
├── tests/
│   └── totp.test.mjs      # Pruebas contra vectores oficiales RFC 6238
├── LICENSE
└── README.md
```

---

## Cómo obtener tu clave secreta (Base32)

Al activar la verificación en dos pasos (2FA) en cualquier portal o empresa, normalmente verás un código QR. Para usar **2FA-autofill**:

1. Haz clic en la opción **"¿No puedes escanear el código?"** o **"Ingresar clave manualmente"**.
2. Copia la clave alfanumérica Base32 (por ejemplo: `JBSWY3DPEHPK3PXP`) o el enlace completo `otpauth://totp/...`.

---

## 1. Instalación rápida — Extensión de Chrome (PC)

1. Clona o descarga este repositorio (si descargas el ZIP, descomprímelo):
   ```bash
   git clone https://github.com/jcsolanoj/2FA-autofill.git
   ```
2. Abre `chrome://extensions/` en Chrome, Edge o Brave y activa el **Modo de desarrollador**.
3. Haz clic en **Cargar descomprimida** y selecciona la carpeta `chrome-extension/`.
4. Abre la extensión, ve a **Agregar Cuenta** e ingresa:
   - **Usuario / Correo o Alias:** ej. `usuario@tu-empresa.com`
   - **Dominio / Origen (opcional):** ej. `https://login.tu-empresa.com` (puedes pulsar **Pestaña** para capturarlo de la pestaña activa). Al guardar, Chrome te pedirá autorizar ese dominio específico para autocompletado automático.
   - **Clave Secreta 2FA:** tu semilla Base32 o URI `otpauth://totp/...`.
5. Si no deseas dar permiso permanente a un dominio, puedes dejar el origen vacío y usar el botón **Rellenar** en cualquier pestaña cuando estés en la pantalla de 2FA.

Consulta más detalles en [chrome-extension/README.md](chrome-extension/README.md).

---

## 2. Instalación rápida — PWA Móvil

1. Despliega la carpeta `mobile-pwa/` en cualquier hosting estático con **HTTPS** (Cloudflare Pages, Netlify, Vercel o GitHub Pages).
2. Abre la URL desde tu teléfono (**Safari en iOS** o **Chrome en Android**) y selecciona **Añadir a pantalla de inicio** / **Instalar aplicación**.

Consulta más detalles en [mobile-pwa/README.md](mobile-pwa/README.md).

---

## Seguridad y pruebas

- **Motor TOTP estándar:** Implementado con Web Crypto API (`HMAC-SHA1`, `HMAC-SHA256`, `HMAC-SHA512`; 6, 7 u 8 dígitos).
- **Almacenamiento local:** Los secretos se guardan únicamente en el navegador del usuario (`chrome.storage.local` / `localStorage`), por lo que se recomienda usar la herramienta solo en dispositivos personales confiables.
- **Ejecutar pruebas unitarias (Node.js ≥ 18):**
  ```bash
  node --test tests/totp.test.mjs
  ```

---

## Licencia

Distribuido bajo licencia MIT. Consulta [LICENSE](LICENSE) para más detalles.
