# Cocuyo

> **English:** [README.md](README.md)

Monitoreo de apagones eléctricos en tiempo real para Venezuela. Anónimo, código abierto, independiente de cualquier gobierno.

Cocuyo observa la red eléctrica con datos públicos (satélite, señales de internet, clima, reportes de la comunidad) y publica el estado de cada zona cada 10 minutos — sin necesidad de cooperación de Corpoelec. Cuando se va la luz, los venezolanos se enteran al instante: dónde, cuánto tiempo, y cuándo podría volver.

## En vivo

| Qué | Dónde |
|-----|-------|
| App web | https://app.cocuyo.kralgor.com |
| Estado actual (formato máquina) | https://cocuyo.kralgor.com/status.json |
| Historial por región (semanal) | https://cocuyo.kralgor.com/history/{region}.json |
| App móvil | Android/iOS vía Expo EAS (envío a tiendas pendiente) |

## Por qué

Corpoelec no publica datos de apagones. Los venezolanos no tienen información cuando se va la luz: causa, duración o tiempo estimado de restauración. Cocuyo existe para llenar ese vacío con datos abiertos, anónimos y confiables.

**Principios de diseño que definen todo:**

- **Sin servidor para lecturas** — el frontend es un sitio estático que lee JSON precalculado desde un CDN. Sobrevive a los apagones, no tiene punto único de falla y cuesta casi nada operarlo.
- **Anónimo por diseño** — sin cuentas, sin rastreo, sin almacenamiento de ubicación. Los reportes no llevan identidad.
- **Primero offline** — el internet venezolano es poco confiable; la app móvil guarda el estado en caché y pone los reportes en cola hasta que vuelva la conexión.
- **Privacidad sobre analítica** — la única llave en el código cliente es la anon key de Supabase (ADR-007).

## Funcionalidades

**App web** — estado por zona con desglose de señales, historial de apagones de 30 días, pronóstico de riesgo a 48h, patrones de racionamiento detectados, seguimiento de bajones, envío de reportes, bilingüe ES/EN, mapa interactivo, service worker para uso offline.

**App móvil (React Native / Expo)** — todo lo de la web más:

- Notificaciones push para apagones, restauraciones y avisos de zonas vecinas
- Temporizadores de alimentos que inician solos al detectar un apagón (lista de alimentos venezolanos + artículos personalizados)
- Modo offline completo: estado en caché, temporizadores locales, reportes en cola que se sincronizan al recuperar conexión
- Compartir por WhatsApp ("sin luz hace 3 horas en Maracaibo")
- Modo oscuro AMOLED negro puro + menor frecuencia de actualización con batería baja
- Contactos de emergencia por zona
- Pantalla de bienvenida de confianza + sección persistente de privacidad/código abierto

## Arquitectura

```
APIs externas → recolectores → puntuador → status.json → CDN Cloudflare R2 → frontend
Toque del usuario → Supabase outage_reports → el pipeline lee en el siguiente cron
```

Tres capas, cada una reemplazable de forma independiente:

1. **Recolección** — pipeline en Python (cron de GitHub Actions, cada 10 min) que consulta fuentes públicas gratuitas
2. **Análisis** — combina señales en una puntuación 0–1 por región, escribe `status.json` y lo sube a R2; un trabajo semanal entrena los modelos de duración y genera el historial por región
3. **Frontends estáticos** — web (export estático de Next.js) y móvil (Expo) leen el mismo contrato de `status.json`; ningún servidor atiende lecturas

**Fuentes de datos:** luces nocturnas satelitales (VIIRS), señal de internet (RIPE Atlas, M-Lab, Cloudflare Radar), clima NASA POWER, reportes de la comunidad en Supabase y un modelo de duración entrenado con patrones históricos.

**Cobertura:** 17 regiones en toda Venezuela (Occidente → Centro → Oriente).

## Estructura del repositorio

```
/               este repositorio
  /pipeline     Python: recolectores, puntuador, notify (envío de push), historial
  /tests        suite de pruebas del pipeline (547 pruebas)
  /app          frontend web — export estático de Next.js
  /mobile       app móvil — React Native (Expo SDK 56), Expo Router
  /models       modelos de duración entrenados
  /docs         SPEC.md (especificación completa), ARCHITECTURE.md, ADRs, schema.sql
  /.github      collect.yml — recolección cada 10 min + retrain semanal
  /.planning    planificación GSD: hoja de ruta, requisitos, planes de fases
```

## Primeros pasos

### Pipeline

```bash
pip install -r requirements.txt
cp .env.example .env          # completa los tokens de Supabase/R2/NASA
python -m pipeline.main
python -m pytest tests/ -q    # 547 pruebas
```

### App web

```bash
cd app
npm install
npm run dev                   # o: npm run build && npx serve out
npm run lint
```

La app web es un export estático — `npm run build` produce `app/out/`, desplegable en cualquier host estático. `status.json` y `history/` se obtienen del CDN en tiempo de ejecución (se pueden sobrescribir con `NEXT_PUBLIC_STATUS_URL` / `NEXT_PUBLIC_HISTORY_BASE`).

### App móvil

```bash
cd mobile
npm install
npx expo start                # Expo Go / emulador / build de desarrollo
npm test                      # 206 pruebas (jest-expo)
npx tsc --noEmit
npx expo lint
```

Los builds de producción y el envío a tiendas pasan por EAS (`eas build --profile production`). El envío a tiendas está pendiente de las cuentas de Google Play ($25) y Apple Developer ($99/año) — ver la lista de pasos humanos en `.planning/phases/05-polish-store-submission/05-03-SUMMARY.md`.

### Supabase

Crea las tablas `outage_reports`, `push_tokens` y `notification_log` ejecutando [`docs/schema.sql`](docs/schema.sql) en el editor SQL de Supabase (tablas + RLS + funciones + trigger). El pipeline lee con la llave `service_role`; las apps cliente solo incorporan la anon key.

## Pruebas

| Suite | Comando | Cantidad |
|-------|---------|----------|
| Pipeline | `python -m pytest tests/ -q` | 547 |
| Móvil | `cd mobile && npm test` | 206 |
| Web | `cd app && npm run lint` + build | limpio |

## Estado

Las cinco fases de la hoja de ruta están completas a nivel de código:

1. ✅ Base + núcleo offline
2. ✅ Reportes, compartir por WhatsApp, optimizaciones de batería
3. ✅ Notificaciones push (código; UAT en dispositivo pendiente)
4. ✅ Temporizadores de alimentos
5. ✅ Historial + estimación de retorno (código; envío a tiendas pendiente de pasos humanos)

Temas humanos pendientes: UAT en dispositivos físicos (push + temporizadores), envío a Play/App Store y números reales de contacto de emergencia de Corpoelec.

## Confianza

Cocuyo es código abierto por convicción — la vigilancia no es el negocio. Sin cuentas de usuario, sin rastreo, sin venta de datos. Cada línea de código está en este repositorio. Los reportes son anónimos: la ubicación se usa solo para detectar tu zona al enviar y nunca se almacena, y nada identifica a quien reporta.

## Licencia

Bien público de código abierto. Aún no se ha tomado una decisión de licencia — consulta al mantenedor antes de reutilizar el código comercialmente.
