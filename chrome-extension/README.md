# 2FA Autofill — Extensión de Chrome (Manifest V3)

Extensión de navegador para generar códigos TOTP (RFC 6238) y autocompletarlos en portales de cualquier empresa o servicio, utilizando el principio de mínimos privilegios (`optional_host_permissions` + `activeTab`).

---

## Características

- **Multi-empresa sin permisos globales (`<all_urls>`):** Solo solicita permiso para los dominios que tú configures explícitamente.
- **Autocompletado seguro por origen:** Cada cuenta se vincula a su origen (`https://login.tu-empresa.com`), evitando fugas o colisiones entre empresas distintas.
- **Modo manual con 1 clic (`activeTab`):** Usa el botón **Rellenar** en cualquier tarjeta para inyectar el código en la pestaña actual sin necesidad de guardar permisos permanentes.
- **Auto-envío opcional:** Desactivado por defecto para evitar envíos accidentales; puedes activarlo por cuenta si el portal lo soporta bien.
- **Soporte completo RFC 6238:** Claves Base32 manuales o URIs `otpauth://totp/...` (`SHA-1`, `SHA-256`, `SHA-512`, 6–8 dígitos).

---

## Instalación

1. Abre `chrome://extensions/` en Chrome, Edge o Brave.
2. Activa el **Modo de desarrollador** (esquina superior derecha).
3. Pulsa **Cargar descomprimida** y elige esta carpeta (`chrome-extension/`).
4. Fija la extensión en tu barra de herramientas.

*(Si realizas cambios en el código, pulsa el botón **Recargar** ↻ de la tarjeta en `chrome://extensions/`).*

---

## Configuración de una empresa o portal

1. Abre el popup de **2FA Autofill** y ve a la pestaña **Agregar Cuenta**.
2. Ingresa tu **Usuario / Correo o Alias** (ej. `usuario@tu-empresa.com`).
3. En **Dominio / Origen del Portal**, escribe la URL base (ej. `https://sso.tu-empresa.com`) o haz clic en **Pestaña** si ya estás en la página de login.
4. Pega tu **Clave Secreta Base32** (obtenida con *"Ingresar clave manualmente"* al configurar el 2FA) o el URI `otpauth://totp/...`.
5. Al guardar, acepta el diálogo de Chrome para autorizar el dominio.
