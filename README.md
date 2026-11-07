# Grupo D Todo · grupodtodo.com

Landing page del grupo. Es una sola página estática (`index.html`) que presenta
al grupo y reparte a cada visitante hacia una de las dos empresas:

| Empresa               | Qué hace                                         | Dirección prevista                 |
|-----------------------|--------------------------------------------------|------------------------------------|
| Distribuidora D Todo  | Huevos de granja propia, harinas y aceites (B2B) | `distribuidora.grupodtodo.com`     |
| Transporte D Todo     | Fletes, distribución y rastreo de envíos         | `logistica.grupodtodo.com`         |

No necesita servidor ni dependencias: cualquier hosting que sirva archivos
estáticos la publica tal cual (Netlify, Vercel, Cloudflare Pages, GitHub Pages,
o el mismo servidor Node de Transporte D Todo si se prefiere).

## Cómo cambiar a dónde apunta cada botón

Al final de `index.html` hay un bloque con las dos direcciones:

```js
var DESTINOS = {
  distribuidora: 'https://distribuidora.grupodtodo.com',
  transporte:    'https://logistica.grupodtodo.com'
};
```

Se cambian ahí y todos los enlaces de la página (tarjetas, botones y pie)
se actualizan solos. Los `href` del HTML llevan las mismas direcciones como
respaldo por si el navegador no ejecuta JavaScript.

## Cómo conectar las tres páginas con un solo dominio

Con un único dominio comprado (`grupodtodo.com`) se publican las tres páginas
usando subdominios. Los subdominios no tienen costo adicional; se crean en el
panel de DNS del mismo proveedor donde se compra el dominio.

1. **Landing del grupo** → `grupodtodo.com` y `www.grupodtodo.com`
   Apuntan al hosting donde se suba este `index.html`.
2. **Distribuidora** → `distribuidora.grupodtodo.com`
   Registro `CNAME` apuntando al hosting donde esté publicada su página.
3. **Transporte / Logística** → `logistica.grupodtodo.com`
   Registro `CNAME` (o `A` si es un servidor propio) apuntando a donde corra la
   plataforma de trazabilidad.

Cada hosting pide además que se le "agregue el dominio personalizado" desde su
propio panel; con eso emite el certificado HTTPS automáticamente.

## Pendientes antes de publicar

- Confirmar los nombres finales de los subdominios (arriba son una propuesta).
- Reemplazar `TU-DOMINIO.com` en la página de la Distribuidora por su subdominio
  definitivo (su propio README lo indica).
- Agregar una imagen `og-image.jpg` de 1200×630 si se quiere vista previa al
  compartir el enlace en WhatsApp o redes.
