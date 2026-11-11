# Grupo D Todo · sitios web

Este repositorio contiene **todo** el conjunto web de Grupo D Todo y se publica
en Netlify como un solo sitio que atiende tres dominios:

| Dominio                        | Carpeta                | Qué es                                              |
|--------------------------------|------------------------|-----------------------------------------------------|
| `grupodtodo.com`               | `sites/grupo/`         | Hub del grupo: reparte hacia las dos empresas       |
| `distribuidora.grupodtodo.com` | `sites/distribuidora/` | Distribuidora D Todo                                |
| `logistica.grupodtodo.com`     | `sites/transporte/`    | Transporte D Todo + plataforma de rastreo de envíos |

La API de rastreo (`/api/...` en `logistica.grupodtodo.com`) vive en
`netlify/functions/api.mjs` y guarda los viajes en **Netlify Blobs**, el
almacenamiento integrado de Netlify. No hace falta servidor ni base de datos
aparte.

## Publicar en Netlify (primera vez)

1. En Netlify: **Add new site → Import an existing project → GitHub** y elige
   este repositorio y la rama que quieras publicar. Netlify lee `netlify.toml`
   y configura solo la carpeta a publicar (`sites`) y las funciones. No hay que
   escribir ningún comando de build.
2. Espera el primer deploy. Verás el hub en la dirección `*.netlify.app` que
   te asigne Netlify. En esa misma dirección puedes revisar las otras dos
   páginas en `/distribuidora/` y `/transporte/`, y la API en `/api/salud`.
3. **Dominios.** En *Domain management → Add a domain* agrega, al mismo sitio:
   - `grupodtodo.com` (márcalo como dominio principal)
   - `www.grupodtodo.com`
   - `distribuidora.grupodtodo.com`
   - `logistica.grupodtodo.com`
4. **DNS.** Lo más simple es usar Netlify DNS: al agregar `grupodtodo.com`,
   Netlify te ofrece gestionar el DNS y te da los nameservers para ponerlos
   donde compraste el dominio. Con eso los subdominios quedan configurados
   solos. Si prefieres dejar el DNS en tu registrador, crea estos registros:

   | Tipo  | Nombre          | Valor                          |
   |-------|-----------------|--------------------------------|
   | A     | `@`             | `75.2.60.5`                    |
   | CNAME | `www`           | `TU-SITIO.netlify.app`         |
   | CNAME | `distribuidora` | `TU-SITIO.netlify.app`         |
   | CNAME | `logistica`     | `TU-SITIO.netlify.app`         |

5. Netlify emite el certificado HTTPS para los cuatro dominios en unos
   minutos (*Domain management → HTTPS*). Listo: cada dominio sirve su carpeta.

A partir de ahí, **cada push a la rama conectada publica solo**.

### Variables de entorno (opcionales)

En *Site configuration → Environment variables*:

| Variable             | Para qué                                                                 |
|----------------------|--------------------------------------------------------------------------|
| `CLAVE_ADMIN`        | Si la defines, crear viajes y recargar datos de ejemplo exigen el encabezado `x-clave` con ese valor. Recomendado. |
| `UMBRAL_ALERTA_MIN`  | Minutos sin cambios para marcar un viaje como atascado en el panel. Por defecto 60. |

## La plataforma de rastreo

Las vistas son las mismas de antes: `logistica.grupodtodo.com/cliente.html`
(seguimiento), `/conductor.html` (avanza estados y envía ubicación) y
`/panel.html` (panel del dueño). La primera vez que alguien consulta la API se
cargan solos los tres viajes de ejemplo (`TRK-1001`, `TRK-1002`, `TRK-1003`).

Crear un viaje real:

```bash
curl -X POST https://logistica.grupodtodo.com/api/viajes \
  -H "content-type: application/json" -H "x-clave: TU_CLAVE" \
  -d '{"cliente":"Panadería Luna","origen":"San Salvador","destino":"Ahuachapán","conductor":"Mario Pérez"}'
```

Devuelve el código asignado (`TRK-1004`, `TRK-1005`, …) o puedes mandar tu
propio `"codigo"`. Para volver a los datos de ejemplo:
`POST /api/semilla` con el mismo encabezado.

Las rutas de la API están documentadas al inicio de `netlify/functions/api.mjs`.
Probarla sin Netlify: `node pruebas/api.test.mjs` (usa memoria en vez de Blobs).

## Cómo hacer cambios

- **Hub del grupo**: `sites/grupo/index.html`. Las direcciones de cada empresa
  están en el bloque `DESTINOS` al final del archivo.
- **Distribuidora**: `sites/distribuidora/index.html`, un solo archivo con todo
  (estilos, logotipo y cotizador).
- **Transporte**: `sites/transporte/index.html` es la página pública; las otras
  tres son la plataforma. `marca.css` es la hoja de estilos compartida.
- **Logotipos**: `sites/grupo/assets/` tiene los tres en vector (SVG). Los
  colores de marca son grupo `#EB9938`, Distribuidora `#F18711` y Transporte
  `#0056A1`.
- **Imágenes para compartir** (WhatsApp, redes): cada carpeta tiene su
  `og-image.png` de 1200×630.

## SEO

Cada empresa tiene su propio dominio, título, descripción, datos estructurados
(`schema.org`), `robots.txt`, `sitemap.xml` y `llms.txt`, para que en Google y
en los asistentes de IA aparezca **la página de la empresa**, no el hub:

- Distribuidora: "distribuidora mayorista", "huevos al por mayor", "harina de
  trigo por quintal", "proveedor para panaderías", etc.
- Transporte: "transporte de carga El Salvador", "empresa de logística",
  "fletes empresariales", "distribución de mercancía", etc.

Después de publicar, registra los tres dominios en **Google Search Console** y
envía cada `sitemap.xml`. Las vistas internas de la plataforma (`panel.html`,
`conductor.html`) llevan `noindex`.

## Fotos de la Distribuidora

Las fotos de `sites/distribuidora/index.html` y `sites/transporte/index.html` vienen de Unsplash (direcciones directas de images.unsplash.com) (licencia
libre para uso comercial, sin atribución obligatoria). Si una foto deja de
estar disponible, la página muestra el degradado naranja en su lugar. Para
cambiarlas por fotos propias, basta con reemplazar el `src` de cada `<img>`
en la página, o subir las fotos a `sites/distribuidora/` y apuntar ahí.
