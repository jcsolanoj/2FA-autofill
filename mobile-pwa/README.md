# 2FA Autofill Mobile — Progressive Web App (PWA)

Aplicación web progresiva (PWA) instalable y **100% offline** para generar códigos 2FA/TOTP desde cualquier teléfono Android o iOS, sin depender de tiendas de aplicaciones ni servidores externos.

---

## Características

- **100% Offline:** Service Worker (`sw.js`) con caché local de todos los recursos.
- **CSP estricta y cero solicitudes externas:** Sin Google Fonts ni scripts externos; todo el CSS/JS está separado y protegido contra inyección.
- **Compatibilidad universal:** Soporta secretos Base32 manuales y URIs `otpauth://totp/...` (`SHA-1`, `SHA-256`, `SHA-512`, 6–8 dígitos).
- **Rutas relativas:** Funciona tanto en la raíz de un dominio como en subdirectorios (ej. GitHub Pages).

---

## Despliegue en HTTPS

Para que el navegador permita instalar la PWA, debe servirse sobre **HTTPS**:

- **Cloudflare Pages / Netlify / Vercel:** Conecta el repositorio y publica la carpeta `mobile-pwa/` como directorio de salida.
- **GitHub Pages:** Publica desde la rama o carpeta correspondiente; las rutas relativas (`./`) funcionan automáticamente.

---

## Instalación y uso diario

1. Abre la URL desplegada:
   - **iOS:** Usa **Safari** → botón **Compartir** → **Añadir a pantalla de inicio**.
   - **Android:** Usa **Chrome** → menú `⋮` → **Instalar aplicación**.
2. Toca el botón **`+`** abajo a la derecha para agregar una cuenta (ej. `Trabajo - usuario@empresa.com`) y pega tu clave Base32 o URI `otpauth://`.
3. Toca cualquier tarjeta para copiar el código actual al portapapeles. En los últimos 5 segundos del ciclo, el temporizador cambia a rojo como aviso.

---

## Solución de problemas

- **El código es rechazado:** Verifica que la hora del dispositivo esté sincronizada automáticamente con la red; TOTP depende de la hora UTC exacta.
- **No aparece "Instalar":** Asegúrate de abrir la página por **HTTPS** (y en iOS usar **Safari**).
- **Actualizar caché tras modificar archivos:** Cambia `CACHE_NAME` en `sw.js` (ej. `'2fa-autofill-cache-v2'`).
