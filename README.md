# Gym QR CRM

Sistema web de control de membresías y accesos con QR para un gimnasio local (Lima, Perú).
El dueño registra socios y cobra membresías; cada socio tiene un QR; en la puerta, la pantalla `/acceso`
escanea el QR y muestra al instante **verde** (puede entrar) o **rojo** (no puede). Cada ingreso queda como asistencia.

**Stack:** React + TypeScript + Vite · Tailwind CSS · Supabase (PostgreSQL + Auth + RLS + Storage) · React Router ·
`qrcode.react` · `@yudiel/react-qr-scanner` · Recharts · Vercel. No hay backend aparte.

---

## 1. Requisitos

- Node.js 20 o superior (https://nodejs.org) — verifica con `node -v`
- Una cuenta gratuita en https://supabase.com
- Una cuenta en https://vercel.com (solo para publicar)

## 2. Crear el proyecto en Supabase

1. En Supabase pulsa **New project**, ponle nombre (ej. `gym-qr`), elige una contraseña de base de datos y la región más cercana (São Paulo).
2. Espera a que termine de crearse.
3. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public key** (usa SOLO esta; nunca la `service_role`)
4. **Desactiva el registro público** (importante): **Authentication → Sign In / Providers → Email** → apaga **Allow new users to sign up**.
   Los usuarios se crean únicamente desde el panel de Supabase (paso 4).

## 3. Ejecutar los SQL

En Supabase abre **SQL Editor → New query**, pega el contenido del archivo y pulsa **Run**:

1. `supabase/schema.sql` — crea tablas, índices, funciones, políticas RLS y el bucket de fotos. **Obligatorio.** Se puede volver a ejecutar sin problema.
2. `supabase/seed.sql` — **Opcional.** Carga 3 planes y 15 socios ficticios (vigentes, por vencer, vencidos, con deuda e inactivo) más pagos y asistencias de ejemplo, ideal para probar y grabar demos. Todo queda marcado como demo.
3. `supabase/borrar_demo.sql` — cuando termines las demos, ejecútalo para borrar SOLO los datos ficticios. Tus datos reales no se tocan.

## 4. Crear el primer usuario admin

1. Supabase → **Authentication → Users → Add user → Create new user**. Escribe correo y contraseña y marca **Auto Confirm User**.
2. En **SQL Editor** ejecuta esto (cambia el correo y el nombre):

```sql
insert into public.perfiles (id, nombre, rol)
select id, 'Nombre del Dueño', 'admin' from auth.users where email = 'dueno@tucorreo.com';
```

Para un usuario de recepción repite el paso 1 y usa el mismo SQL con `'recepcion'` en lugar de `'admin'`.
Un usuario sin fila en `perfiles` no puede ver ni hacer nada (es a propósito).

## 5. Configurar el `.env` (PowerShell, Windows)

Desde la carpeta del proyecto:

```powershell
Copy-Item .env.example .env
notepad .env
```

Completa los valores:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_GYM_NAME=Nombre de tu Gimnasio
```

## 6. Instalar y correr en local

```powershell
npm install
npm run dev
```

Abre http://localhost:5173. Para comprobar que compila: `npm run build`.
La cámara solo funciona en `localhost` o en una página con HTTPS.

## 7. Desplegar en Vercel

**Opción A (recomendada, con GitHub):**
1. Sube el proyecto a un repositorio de GitHub (el `.env` no se sube: ya está en `.gitignore`).
2. En Vercel: **Add New → Project** → importa el repositorio. Vercel detecta Vite solo.
3. En **Environment Variables** agrega `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_GYM_NAME`.
4. Pulsa **Deploy**.

**Opción B (CLI, PowerShell):**
```powershell
npm install -g vercel
vercel          # primera vez: responde las preguntas
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_GYM_NAME
vercel --prod
```

El archivo `vercel.json` ya redirige todas las rutas a `index.html` para que React Router funcione al recargar.
Luego abre la URL de Vercel desde la tablet de la puerta, entra a `/acceso` y permite el uso de la cámara.

---

## Cómo funciona

| Rol | Puede |
|---|---|
| `admin` (dueño) | Todo: dashboard, socios (crear/editar/eliminar), planes, pagos, acceso |
| `recepcion` | Pantalla de acceso, ver socios, registrar pagos y abonos. No ve el dashboard, no crea/edita/borra socios ni planes |

- **QR:** contiene únicamente un UUID aleatorio (`codigo_qr`), sin datos personales.
- **Pagos:** se registran con la función `registrar_pago` (atómica). Si la membresía sigue vigente, la nueva `fecha_fin` se suma a la actual; si está vencida, cuenta desde hoy. La `fecha_fin` es inclusiva: un plan de 30 días iniciado hoy vence en hoy + 29.
- **Pagos parciales:** si cobras menos que el precio del plan, la diferencia queda como deuda. Los abonos posteriores se registran en **Pagos → Deudores → Abonar**.
- **Acceso:** verde si todo está en orden; amarillo si vence en 3 días o menos (permite entrar y avisa); rojo si está vencida, sin membresía, con deuda, inactivo o QR no válido. Anti-duplicado de 5 minutos. Zona horaria de negocio: `America/Lima`.
- **Fotos:** se redimensionan a 480 px y se guardan en un bucket público de Supabase con nombre aleatorio.
- **Escritura de pagos/membresías/asistencias:** solo mediante funciones RPC; no hay `insert/update` directo para estas tablas.

## Pruebas manuales

Antes de empezar: ejecuta `seed.sql` e inicia sesión como admin. Abre un socio para ver su QR (puedes mostrarlo en otro dispositivo, o escanear la pantalla del PC con la tablet).

1. **QR válido:** escanea el QR de *Carlos Mendoza* (vigente). Esperado: pantalla verde "ACCESO PERMITIDO", nombre y "Vence en N días", sonido agudo; vuelve solo a escanear a los 4 s. En su detalle aparece la asistencia nueva.
2. **QR amarillo:** escanea a *Sofía Chávez* (vence en 2 días). Esperado: amarillo, acceso permitido y "Tu membresía vence pronto".
3. **QR vencido:** escanea a *Pedro Gutiérrez*. Esperado: rojo "ACCESO DENEGADO — Membresía vencida", sonido grave, no se registra asistencia.
4. **Deuda:** escanea a *Camila Rivera*. Esperado: rojo, "Deuda pendiente" y "Debe S/ 45.00".
5. **Inactivo y QR inválido:** escanea a *Fiorella Navarro* (rojo, "Socio inactivo"). Escanea cualquier otro QR (ej. el de una página web): rojo "QR no válido".
6. **Doble escaneo:** vuelve a escanear a Carlos antes de 5 minutos. Esperado: pantalla azul "Ya ingresó hace X minutos" y **sin** nueva asistencia.
7. **Ingreso manual:** en `/acceso` pulsa "Ingresar DNI" y escribe `99900002`. Esperado: acceso permitido. Con `00000000`: "DNI no registrado".
8. **Pago que renueva:** en *Pagos*, elige a Carlos, plan Mensual, método Yape, cobra el monto completo. Esperado: su vencimiento se corre 30 días respecto al anterior. Repite con *Pedro* (vencido): la nueva fecha cuenta desde hoy.
9. **Pago parcial y abono:** cobra a Pedro un monto menor al precio. Escanéalo: rojo por deuda. En *Pagos → Deudores* pulsa **Abonar** por el saldo; vuelve a escanear: ahora entra.
10. **Roles:** crea un usuario `recepcion` e inicia sesión. Esperado: solo ve Acceso, Socios (lectura) y Pagos; `/planes` y el dashboard lo redirigen.
11. **Dashboard:** como admin revisa tarjetas, "Por vencer esta semana" (botón WhatsApp), deudores y los 2 gráficos.
12. **Limpieza:** ejecuta `borrar_demo.sql` y confirma que los socios ficticios desaparecen y los reales siguen.

## Estructura

```
supabase/   schema.sql · seed.sql · borrar_demo.sql
src/
  lib/        supabase.ts · types.ts · format.ts · sound.ts · imagen.ts
  context/    AuthContext.tsx
  components/ Layout · ProtectedRoute · SocioForm · ui
  pages/      Login · Dashboard · Socios · SocioDetalle · Planes · Pagos · Acceso
```
