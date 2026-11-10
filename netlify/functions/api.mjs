/**
 * API de rastreo de Transporte D Todo, como función de Netlify.
 * Es la misma API que tenía server.js (Express + SQLite), pero guardando los
 * viajes en Netlify Blobs, el almacenamiento integrado de Netlify, para que
 * no haga falta un servidor ni una base de datos aparte.
 *
 * Rutas (todas bajo /api):
 *   GET  /salud                     comprobación
 *   GET  /estados                   lista de estados en orden
 *   GET  /viajes                    todos los viajes
 *   POST /viajes                    crear un viaje (clave opcional, ver README)
 *   GET  /panel                     viajes con minutos sin cambio y alertas
 *   GET  /viajes/:idOcodigo         un viaje con su historial
 *   POST /viajes/:idOcodigo/eventos avanzar el estado (vista del conductor)
 *   POST /viajes/:idOcodigo/ubicacion guardar lat/lng del camión
 *   POST /semilla                   volver a cargar los 3 viajes de ejemplo (clave)
 */
import { getStore } from '@netlify/blobs';

export const config = { path: ['/api', '/api/*'] };

export const TRIP_STATES = ['Pendiente', 'Inicio de carga', 'En ruta', 'Llegada al destino'];
const UMBRAL_ALERTA_MIN = Number(process.env.UMBRAL_ALERTA_MIN) || 60;
const CLAVE_ADMIN = process.env.CLAVE_ADMIN || '';

// ---------- Almacenamiento ----------
// En Netlify usa Blobs. Fuera de Netlify (pruebas locales) usa memoria.
const memoria = new Map();
function crearAlmacen() {
  try {
    const store = getStore({ name: 'viajes', consistency: 'strong' });
    return {
      async leer(k) { return store.get(k, { type: 'json' }); },
      async escribir(k, v) { await store.setJSON(k, v); },
      async claves(prefijo) {
        const { blobs } = await store.list({ prefix: prefijo });
        return blobs.map(b => b.key);
      },
      async borrar(k) { await store.delete(k); },
    };
  } catch (e) {
    return {
      async leer(k) { return memoria.has(k) ? JSON.parse(memoria.get(k)) : null; },
      async escribir(k, v) { memoria.set(k, JSON.stringify(v)); },
      async claves(prefijo) { return [...memoria.keys()].filter(k => k.startsWith(prefijo)); },
      async borrar(k) { memoria.delete(k); },
    };
  }
}

const ahora = () => new Date().toISOString();
const claveViaje = (codigo) => 'viaje/' + String(codigo).trim().toUpperCase();

// ---------- Datos de ejemplo (los mismos de seed.js) ----------
const EJEMPLOS = [
  { codigo: 'TRK-1001', cliente: 'Distribuidora El Sol', origen: 'San Salvador', destino: 'Santa Ana', conductor: 'Carlos Mejia',
    estado_actual: 'En ruta', lat: 13.84, lng: -89.39,
    eventos: [['Pendiente', 'Viaje creado'], ['Inicio de carga', 'Carga de 200 cajas'], ['En ruta', 'Salida de bodega central']] },
  { codigo: 'TRK-1002', cliente: 'Ferreteria La Union', origen: 'La Libertad', destino: 'San Miguel', conductor: 'Ana Ramirez',
    estado_actual: 'Llegada al destino', lat: 13.4833, lng: -88.1833,
    eventos: [['Pendiente', 'Viaje creado'], ['Inicio de carga', 'Materiales de construccion'], ['En ruta', 'En carretera Panamericana'], ['Llegada al destino', 'Entregado y firmado']] },
  { codigo: 'TRK-1003', cliente: 'Supermercados Vida', origen: 'Soyapango', destino: 'Sonsonate', conductor: 'Jose Portillo',
    estado_actual: 'Pendiente', lat: null, lng: null,
    eventos: [['Pendiente', 'Viaje creado, esperando carga']] },
];

async function sembrar(almacen) {
  for (const k of await almacen.claves('viaje/')) await almacen.borrar(k);
  let id = 0;
  for (const e of EJEMPLOS) {
    id += 1;
    const t = ahora();
    // TRK-1003 queda "atascado" (3 horas sin cambios) para que el panel muestre una alerta.
    const actualizado = e.codigo === 'TRK-1003' ? new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() : t;
    await almacen.escribir(claveViaje(e.codigo), {
      id, codigo: e.codigo, cliente: e.cliente, origen: e.origen, destino: e.destino, conductor: e.conductor,
      estado_actual: e.estado_actual, creado_en: t, actualizado_en: actualizado,
      lat: e.lat, lng: e.lng, ubicacion_en: e.lat == null ? null : t,
      eventos: e.eventos.map(([estado, nota], i) => ({ id: i + 1, estado, nota, creado_en: t })),
    });
  }
  await almacen.escribir('meta/contador', { ultimo_id: id, ultimo_codigo: 1003 });
}

// ---------- Utilidades ----------
async function todosLosViajes(almacen) {
  await asegurarSemilla(almacen);
  const claves = await almacen.claves('viaje/');
  const viajes = await Promise.all(claves.map(k => almacen.leer(k)));
  return viajes.filter(Boolean);
}

async function asegurarSemilla(almacen) {
  if ((await almacen.claves('viaje/')).length === 0) await sembrar(almacen);
}

async function obtenerViaje(almacen, idOcodigo) {
  await asegurarSemilla(almacen);
  const porCodigo = await almacen.leer(claveViaje(idOcodigo));
  if (porCodigo) return porCodigo;
  const n = Number(idOcodigo);
  if (!Number.isInteger(n)) return null;
  return (await todosLosViajes(almacen)).find(v => v.id === n) || null;
}

const sinEventos = ({ eventos, ...resto }) => resto;
const json = (cuerpo, estado = 200) => new Response(JSON.stringify(cuerpo), {
  status: estado, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const error = (mensaje, estado) => json({ error: mensaje }, estado);

function conClave(req) {
  if (!CLAVE_ADMIN) return true;
  return req.headers.get('x-clave') === CLAVE_ADMIN;
}

async function leerCuerpo(req) {
  try { return await req.json(); } catch (e) { return {}; }
}

// ---------- Rutas ----------
export default async function manejar(req) {
  const almacen = crearAlmacen();
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/\.netlify\/functions\/api/, '').replace(/^\/api/, '').replace(/\/+$/, '') || '/';
  const partes = ruta.split('/').filter(Boolean);
  const metodo = req.method.toUpperCase();

  if (metodo === 'GET' && ruta === '/salud') {
    const viajes = await todosLosViajes(almacen);
    return json({ ok: true, mensaje: 'Servidor en linea', viajes: viajes.length });
  }
  if (metodo === 'GET' && ruta === '/estados') return json({ estados: TRIP_STATES });

  if (metodo === 'GET' && ruta === '/viajes') {
    const viajes = (await todosLosViajes(almacen)).sort((a, b) => b.actualizado_en.localeCompare(a.actualizado_en));
    return json({ viajes: viajes.map(sinEventos) });
  }

  if (metodo === 'POST' && ruta === '/viajes') {
    if (!conClave(req)) return error('Clave incorrecta', 401);
    const c = await leerCuerpo(req);
    for (const campo of ['cliente', 'origen', 'destino', 'conductor']) {
      if (!c[campo] || typeof c[campo] !== 'string') return error(`Falta el campo "${campo}"`, 400);
    }
    await todosLosViajes(almacen); // asegura la semilla y el contador
    const meta = (await almacen.leer('meta/contador')) || { ultimo_id: 0, ultimo_codigo: 1000 };
    meta.ultimo_id += 1; meta.ultimo_codigo += 1;
    const codigo = (c.codigo && String(c.codigo).trim().toUpperCase()) || `TRK-${meta.ultimo_codigo}`;
    if (await almacen.leer(claveViaje(codigo))) return error(`Ya existe un viaje con el código ${codigo}`, 409);
    const t = ahora();
    const viaje = {
      id: meta.ultimo_id, codigo, cliente: c.cliente.trim(), origen: c.origen.trim(), destino: c.destino.trim(), conductor: c.conductor.trim(),
      estado_actual: TRIP_STATES[0], creado_en: t, actualizado_en: t, lat: null, lng: null, ubicacion_en: null,
      eventos: [{ id: 1, estado: TRIP_STATES[0], nota: (c.nota || 'Viaje creado').trim(), creado_en: t }],
    };
    await almacen.escribir(claveViaje(codigo), viaje);
    await almacen.escribir('meta/contador', meta);
    return json({ ok: true, viaje: sinEventos(viaje), eventos: viaje.eventos }, 201);
  }

  if (metodo === 'GET' && ruta === '/panel') {
    const estadoFinal = TRIP_STATES[TRIP_STATES.length - 1];
    const viajes = (await todosLosViajes(almacen))
      .sort((a, b) => a.actualizado_en.localeCompare(b.actualizado_en))
      .map(v => {
        const minutos = Math.floor((Date.now() - Date.parse(v.actualizado_en)) / 60000);
        const finalizado = v.estado_actual === estadoFinal;
        return { ...sinEventos(v), minutos_inactivo: minutos, finalizado, alerta: !finalizado && minutos >= UMBRAL_ALERTA_MIN };
      });
    return json({
      umbral_min: UMBRAL_ALERTA_MIN,
      activos: viajes.filter(v => !v.finalizado).length,
      finalizados: viajes.filter(v => v.finalizado).length,
      en_alerta: viajes.filter(v => v.alerta).length,
      viajes,
    });
  }

  if (metodo === 'POST' && ruta === '/semilla') {
    if (!conClave(req)) return error('Clave incorrecta', 401);
    await sembrar(almacen);
    return json({ ok: true, mensaje: 'Datos de ejemplo cargados', viajes: EJEMPLOS.length });
  }

  if (partes[0] === 'viajes' && partes.length >= 2) {
    let codigoPedido = partes[1];
    try { codigoPedido = decodeURIComponent(partes[1]); } catch (e) { return error('Código inválido', 400); }
    const viaje = await obtenerViaje(almacen, codigoPedido);
    if (!viaje) return error('Viaje no encontrado', 404);

    if (metodo === 'GET' && partes.length === 2) return json({ viaje: sinEventos(viaje), eventos: viaje.eventos });

    if (metodo === 'POST' && partes[2] === 'eventos') {
      const { estado, nota } = await leerCuerpo(req);
      if (!estado || !TRIP_STATES.includes(estado)) return error('Estado invalido', 400);
      const posActual = TRIP_STATES.indexOf(viaje.estado_actual);
      const posNuevo = TRIP_STATES.indexOf(estado);
      if (posNuevo <= posActual) return error(`El viaje ya esta en "${viaje.estado_actual}" o mas avanzado.`, 400);
      const t = ahora();
      viaje.eventos.push({ id: viaje.eventos.length + 1, estado, nota: (nota || '').trim() || null, creado_en: t });
      viaje.estado_actual = estado;
      viaje.actualizado_en = t;
      await almacen.escribir(claveViaje(viaje.codigo), viaje);
      return json({ ok: true, viaje: sinEventos(viaje), eventos: viaje.eventos });
    }

    if (metodo === 'POST' && partes[2] === 'ubicacion') {
      const { lat, lng } = await leerCuerpo(req);
      if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return error('Coordenadas invalidas', 400);
      }
      viaje.lat = lat; viaje.lng = lng; viaje.ubicacion_en = ahora();
      await almacen.escribir(claveViaje(viaje.codigo), viaje);
      return json({ ok: true });
    }
  }

  return error('Ruta no encontrada', 404);
}
