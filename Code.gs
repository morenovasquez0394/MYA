/**
 * MYA — Servidor de datos sobre Google Sheets (Google Apps Script)
 * =====================================================================
 * INSTALACIÓN (una sola vez)
 *  1. Crea una hoja de cálculo nueva en Google Sheets. Será tu base de datos.
 *  2. Menú Extensiones > Apps Script. Borra el código de ejemplo y pega este archivo completo.
 *  3. Cambia la constante CLAVE (abajo) por una contraseña larga que solo conozca tu equipo.
 *  4. Selecciona la función configurar() y pulsa Ejecutar. Acepta los permisos.
 *     Esto crea las pestañas y sus encabezados.
 *  5. Implementar > Nueva implementación > Tipo: Aplicación web.
 *       Ejecutar como: Yo
 *       Quién tiene acceso: Cualquier persona
 *     Copia la URL que termina en /exec.
 *  6. En MYA, en la pantalla de inicio abre "Conexión con Google Sheets" y pega la URL y la clave.
 *
 * Si cambias este código más adelante: Implementar > Administrar implementaciones >
 * Editar (lápiz) > Versión: Nueva versión > Implementar. La URL no cambia.
 *
 * SEGURIDAD: la clave viaja con cada petición y solo evita el acceso de personas ajenas.
 * Quien tenga la clave puede leer y modificar los datos. No la compartas fuera del equipo.
 */
const CLAVE = "CAMBIA-ESTA-CLAVE";
const CLAVE_POR_DEFECTO = "CAMBIA-ESTA-CLAVE";

/* Cada colección es una pestaña. Columna: [campo, encabezado visible, tipo].
   Tipos: texto (por omisión), "b" sí/no, "l" lista separada por comas, "j" JSON. */
const ESQUEMA = {
  users: { hoja: "Usuarios", cols: [["id", "ID"], ["login", "ID de usuario"], ["name", "Nombre"], ["role", "Cargo o rol"], ["departmentId", "Departamento (ID)"], ["supervisorId", "Supervisor (ID)"], ["admin", "Administrador", "b"]] },
  departments: { hoja: "Departamentos", cols: [["id", "ID"], ["name", "Nombre"]] },
  projects: { hoja: "Proyectos", cols: [["id", "ID"], ["name", "Nombre"], ["description", "Descripción"], ["color", "Color"], ["routine", "Tipo (none, daily, weekly)"], ["departmentId", "Departamento (ID)"]] },
  tasks: { hoja: "Tareas", cols: [["id", "ID"], ["name", "Nombre"], ["description", "Descripción"], ["priority", "Prioridad"], ["status", "Estado"], ["projectId", "Proyecto (ID)"], ["startDate", "Inicio"], ["dueDate", "Entrega"], ["assignee", "Responsable (ID)"], ["tags", "Etiquetas", "l"], ["subtasks", "Subtareas", "j"], ["createdAt", "Creada"], ["completedAt", "Completada"]] },
  checks: { hoja: "Marcas de rutina", cols: [["id", "Clave"], ["taskId", "Actividad (ID)"], ["period", "Día o semana"], ["at", "Marcada el"]] },
  catalog: { hoja: "Catálogo", cols: [["id", "ID"], ["type", "Tipo"], ["title", "Título"], ["description", "Descripción"], ["url", "Enlace"], ["ownerId", "Propietario (ID)"], ["tags", "Etiquetas", "l"], ["createdAt", "Creado"], ["updatedAt", "Actualizado"]] },
  messages: { hoja: "Mensajes", cols: [["id", "ID"], ["author", "Autor"], ["authorId", "Autor (ID)"], ["text", "Mensaje"], ["time", "Fecha"]] },
  activity: { hoja: "Actividad", cols: [["id", "ID"], ["text", "Detalle"], ["at", "Fecha"]] },
  config: { hoja: "Configuración", cols: [["id", "Clave"], ["value", "Valor"]] }
};
const CAMPOS_FECHA = ["startDate", "dueDate", "period"];

/* ---------- Entradas del servicio web ---------- */
function doGet() {
  return json_({ ok: true, servicio: "MYA", configurado: CLAVE !== CLAVE_POR_DEFECTO });
}

function doPost(e) {
  let res;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (CLAVE === CLAVE_POR_DEFECTO) throw new Error("Cambia la constante CLAVE en el código del servidor antes de usarlo.");
    if (req.token !== CLAVE) throw new Error("Clave incorrecta.");
    switch (req.action) {
      case "ping": res = { ok: true, version: version_() }; break;
      case "load": res = conBloqueo_(function () { const data = leerTodo_(); return { ok: true, version: version_(), empty: data.users.length === 0, data: data }; }); break;
      case "sync": res = sincronizar_(Array.isArray(req.ops) ? req.ops.slice(0, 500) : []); break;
      default: throw new Error("Acción desconocida.");
    }
  } catch (err) {
    res = { ok: false, error: String((err && err.message) || err) };
  }
  return json_(res);
}

/* Ejecuta esta función una vez desde el editor para crear las pestañas. */
function configurar() {
  Object.keys(ESQUEMA).forEach(function (c) { hoja_(c); });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ["Hoja 1", "Sheet1"].forEach(function (n) {
    const sh = ss.getSheetByName(n);
    if (sh && ss.getSheets().length > 1 && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });
  if (!PropertiesService.getScriptProperties().getProperty("version")) PropertiesService.getScriptProperties().setProperty("version", "0");
  Logger.log("Listo. Ahora implementa como aplicación web.");
}

/* ---------- Utilidades ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function version_() { return Number(PropertiesService.getScriptProperties().getProperty("version") || 0); }
function conBloqueo_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function hoja_(c) {
  const e = ESQUEMA[c];
  if (!e) throw new Error("Colección desconocida: " + c);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(e.hoja);
  if (!sh) sh = ss.insertSheet(e.hoja);
  if (sh.getRange(1, 1).getValue() === "") {
    const n = e.cols.length;
    sh.getRange(1, 1, 1, n).setValues([e.cols.map(function (x) { return x[1]; })]).setFontWeight("bold").setBackground("#ede9fe");
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), n).setNumberFormat("@");   // texto plano: evita que Sheets convierta fechas y números
  }
  return sh;
}
function cod_(v, t) {
  if (t === "b") return v ? "SI" : "NO";
  if (t === "l") return (Array.isArray(v) ? v : []).map(function (x) { return String(x).replace(/,/g, " "); }).join(", ");
  if (t === "j") return JSON.stringify(v === undefined || v === null ? [] : v);
  return v === undefined || v === null ? "" : String(v);
}
function dec_(v, t, campo) {
  if (v instanceof Date) {
    v = CAMPOS_FECHA.indexOf(campo) >= 0 ? Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd") : v.toISOString();
  }
  if (t === "b") return String(v).toUpperCase() === "SI";
  if (t === "l") return String(v).split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  if (t === "j") { try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch (e) { return []; } }
  return v === undefined || v === null ? "" : String(v);
}

/* ---------- Lectura y escritura ---------- */
function leerTodo_() {
  const out = {};
  Object.keys(ESQUEMA).forEach(function (c) {
    const e = ESQUEMA[c], sh = hoja_(c), last = sh.getLastRow();
    out[c] = last < 2 ? [] : sh.getRange(2, 1, last - 1, e.cols.length).getValues()
      .filter(function (r) { return String(r[0]).trim() !== ""; })
      .map(function (r) {
        const o = {};
        e.cols.forEach(function (col, i) { o[col[0]] = dec_(r[i], col[2], col[0]); });
        return o;
      });
  });
  return out;
}

function aplicarOps_(ops) {
  const porColeccion = {};
  ops.forEach(function (o) { (porColeccion[o.c] = porColeccion[o.c] || []).push(o); });
  Object.keys(porColeccion).forEach(function (c) {
    const e = ESQUEMA[c];
    if (!e) return;
    const sh = hoja_(c), n = e.cols.length, last = sh.getLastRow();
    const ids = last < 2 ? [] : sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); });
    const fila = {};
    ids.forEach(function (id, i) { if (id) fila[id] = i + 2; });
    const nuevas = [], nuevaPos = {}, borrar = [];
    porColeccion[c].forEach(function (o) {
      if (o.op === "delete") { if (fila[o.id]) borrar.push(fila[o.id]); return; }
      if (!o.row || !o.row.id) return;
      const id = String(o.row.id), valores = e.cols.map(function (col) { return cod_(o.row[col[0]], col[2]); });
      if (fila[id]) {
        const r = sh.getRange(fila[id], 1, 1, n);
        r.setNumberFormat("@");
        r.setValues([valores]);
      } else if (nuevaPos[id] !== undefined) {
        nuevas[nuevaPos[id]] = valores;
      } else {
        nuevaPos[id] = nuevas.length;
        nuevas.push(valores);
      }
    });
    if (nuevas.length) {
      const inicio = Math.max(sh.getLastRow(), 1) + 1, fin = inicio + nuevas.length - 1;
      if (fin > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), fin - sh.getMaxRows());
      const r = sh.getRange(inicio, 1, nuevas.length, n);
      r.setNumberFormat("@");
      r.setValues(nuevas);
    }
    borrar.sort(function (a, b) { return b - a; }).forEach(function (f) { sh.deleteRow(f); });
  });
}

/* Aplica los cambios en bloque y sube el número de versión. Quien consulta compara la versión
   para saber si hay datos nuevos. */
function sincronizar_(ops) {
  return conBloqueo_(function () {
    const props = PropertiesService.getScriptProperties();
    const prev = version_();
    let version = prev;
    if (ops.length) {
      aplicarOps_(ops);
      version = prev + 1;
      props.setProperty("version", String(version));
    }
    return { ok: true, prev: prev, version: version };
  });
}
