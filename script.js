/* MYA — Manage Your Activities | v2
   Arquitectura:
   1. Utilidades        4. Estado y acciones de datos   7. Diálogos
   2. Constantes        5. Vistas (render)              8. Paleta de comandos
   3. Datos de ejemplo  6. Registro de acciones (clics) 9. Arranque
   Nuevo: módulo de Equipo, jerarquía y rutinas (antes del arranque)
*/
"use strict";

/* ============================================================
   1. UTILIDADES
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clone = v => JSON.parse(JSON.stringify(v));
const uid = (p = "id") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const offsetDate = (n, from = new Date()) => ymd(new Date(from.getFullYear(), from.getMonth(), from.getDate() + n));
const ymdParts = s => { const [y, m, d] = String(s).split("-").map(Number); return [y, m - 1, d]; };
const parseYMD = s => new Date(...ymdParts(s));
const dayDiff = (a, b) => Math.round((Date.UTC(...ymdParts(a)) - Date.UTC(...ymdParts(b))) / 864e5);
const ic = (name, cls = "") => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function fmtDate(s, withYear = false) {
  if (!s) return "Sin fecha";
  const d = parseYMD(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("es-DO", { day: "numeric", month: "short", ...(withYear || !sameYear ? { year: "numeric" } : {}) });
}
function timeAgo(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "ahora mismo";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

/* ============================================================
   2. CONSTANTES
   ============================================================ */
const STORAGE_KEY = "mya-app-v2";
const LEGACY_KEY = "mya-app-pro-v1";
const PAGES = ["Inicio", "Chat", "Proyectos", "Tareas", "Calendario", "Archivos", "Reportes", "Rutinas", "Equipo", "Catálogo", "Configuración"];
const PAGE_ICONS = { Inicio: "home", Chat: "chat", Proyectos: "folder", Tareas: "check-circle", Calendario: "calendar", Archivos: "file", Reportes: "chart", Rutinas: "repeat", Equipo: "users", "Catálogo": "library", "Configuración": "sliders" };
const STATUSES = ["Pendiente", "En proceso", "Finalizado"];
const PRIORITIES = ["Alta", "Media", "Baja"];
const STATUS_META = {
  "Pendiente": { color: "var(--warn)", cls: "s-pend", tone: "warn" },
  "En proceso": { color: "var(--info)", cls: "s-prog", tone: "info" },
  "Finalizado": { color: "var(--ok)", cls: "s-done", tone: "ok" }
};
const PRIO_KEY = { Alta: "high", Media: "mid", Baja: "low" };
const PRIO_RANK = { Alta: 0, Media: 1, Baja: 2 };
const PRIO_COLOR = { Alta: "var(--danger)", Media: "var(--warn)", Baja: "var(--info)" };
const PROJECT_COLORS = { violet: "#8b7cff", blue: "#4f9dff", emerald: "#2dd4a3", amber: "#f5b542", rose: "#fb6f92", cyan: "#38d0e8" };
const ACCENTS = { violet: ["#7c6cf7", "#a79fff"], blue: ["#3b82f6", "#7db3ff"], emerald: ["#10b981", "#5fe3bd"], rose: ["#f43f5e", "#ff9bb0"], amber: ["#f59e0b", "#ffd166"] };
/* Los usuarios ahora viven en state.users (ver seedData) */
/** Formato válido de un ID de usuario. Debe definirse antes de cargar los datos guardados. */
const LOGIN_RE = /^[a-z0-9._-]{3,24}$/;
const CAT_TYPES = {
  Proyecto: { icon: "folder", color: "#8b7cff" }, KPI: { icon: "target", color: "#2dd4a3" }, Reporte: { icon: "chart", color: "#4f9dff" },
  Dashboard: { icon: "board", color: "#f5b542" }, Documento: { icon: "file", color: "#38d0e8" }, Otro: { icon: "link", color: "#8a94ab" }
};
/** Acepta solo enlaces http o https. Agrega https:// si falta. Devuelve "" si no es válido. */
function normalizeUrl(raw) {
  let v = String(raw || "").trim(); if (!v) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = "https://" + v;
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) && u.hostname ? u.href : ""; } catch { return ""; }
}
const AV_COLORS = ["#7c6cf7", "#3b82f6", "#10b981", "#f59e0b", "#f43f5e", "#06b6d4"];

/* ============================================================
   3. DATOS DE EJEMPLO
   ============================================================ */
function seedData() {
  const atDay = n => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(12, 0, 0, 0); return d.toISOString(); };
  const sub = (...items) => items.map(([text, done]) => ({ id: uid("s"), text, done }));
  const t = (id, name, description, priority, status, projectId, start, due, assignee, tags = [], subtasks = [], completedOffset = null) => ({
    id, name, description, priority, status, projectId, startDate: start === null ? "" : offsetDate(start), dueDate: due === null ? "" : offsetDate(due),
    assignee, tags, subtasks, createdAt: atDay(-8), completedAt: completedOffset === null ? null : atDay(completedOffset)
  });
  const now = Date.now();
  const rt = (id, name, projectId, assignee) => ({ id, name, description: "", priority: "Media", status: "Pendiente", projectId, startDate: "", dueDate: "", assignee, tags: [], subtasks: [], createdAt: atDay(-14), completedAt: null });
  const routineTasks = [
    rt("r1", "Abrir almacén y verificar seguridad", "p4", "juan"), rt("r2", "Registrar temperatura de cámaras", "p4", "juan"),
    rt("r3", "Revisión de montacargas", "p4", "pedro"), rt("r4", "Cuadre de despachos del día", "p4", "pedro"),
    rt("r5", "Conteo rápido de zona A", "p4", "carla"), rt("r6", "Respaldo de base de datos", "p4", "luis"),
    rt("r7", "Conteo cíclico clase A", "p5", "juan"), rt("r8", "Informe semanal de despachos", "p5", "pedro"),
    rt("r9", "Reunión de seguimiento del equipo", "p5", "ana")
  ];
  const rates = { juan: 9, pedro: 6, carla: 7, luis: 8 }, checks = {};
  const cat = (id, ownerId, type, title, description, url, tags, daysAgo) => ({ id, ownerId, type, title, description, url, tags, createdAt: atDay(-daysAgo - 3), updatedAt: atDay(-daysAgo) });
  routineTasks.forEach((r, ri) => {
    if (r.projectId === "p4") {
      for (let off = -13; off <= 0; off++) {
        const ds = offsetDate(off);
        if ((parseYMD(ds).getDay() + 6) % 7 >= 5) continue;
        const ok = off === 0 ? ri % 2 === 0 : ((-off * 7 + ri * 5) % 10) < rates[r.assignee];
        if (ok) checks[`${r.id}|${ds}`] = new Date(`${ds}T12:00:00`).toISOString();
      }
    } else if (r.assignee !== "ana") checks[`${r.id}|${ymd(mondayOf(new Date(Date.now() - 7 * 864e5)))}`] = new Date().toISOString();
  });
  return {
    version: 2,
    departments: [
      { id: "logistica", name: "Logística" }, { id: "almacen", name: "Almacén" }, { id: "ti", name: "Tecnología" }, { id: "compras", name: "Compras" }
    ],
    users: [
      { id: "me", departmentId: "logistica", admin: true, login: "manuel", name: "Manuel M.", role: "Gerente de Logística", supervisorId: null },
      { id: "ana", departmentId: "logistica", admin: false, login: "ana", name: "Ana Rodríguez", role: "Coordinadora de Operaciones", supervisorId: "me" },
      { id: "luis", departmentId: "ti", admin: false, login: "luis", name: "Luis Pérez", role: "Analista de Sistemas", supervisorId: "me" },
      { id: "juan", departmentId: "almacen", admin: false, login: "juan", name: "Juan Díaz", role: "Encargado de Almacén", supervisorId: "me" },
      { id: "pedro", departmentId: "logistica", admin: false, login: "pedro", name: "Pedro Gómez", role: "Despachador", supervisorId: "me" },
      { id: "carla", departmentId: "almacen", admin: false, login: "carla", name: "Carla Santos", role: "Auxiliar de Inventario", supervisorId: "ana" }
    ],
    checks,
    catalog: [
      cat("c1", "me", "Reporte", "Informe mensual de logística", "Consolidado de despachos, devoluciones y costos por ruta.", "https://example.com/reportes/logistica-mensual", ["mensual", "gerencia"], 2),
      cat("c2", "me", "KPI", "Nivel de servicio (OTIF)", "Entregas a tiempo y completas, por cliente.", "https://example.com/kpi/otif", ["kpi", "servicio"], 5),
      cat("c3", "ana", "Dashboard", "Tablero de compras y proveedores", "Órdenes abiertas, plazos de entrega y cumplimiento.", "https://example.com/dashboards/compras", ["compras"], 3),
      cat("c4", "luis", "Proyecto", "Proyecto ERP: plan maestro", "Cronograma, alcance y responsables de cada módulo.", "https://example.com/proyectos/erp", ["erp", "sistemas"], 1),
      cat("c5", "juan", "Reporte", "Inventario semanal de almacén", "Existencias, diferencias y ajustes por zona.", "https://example.com/reportes/inventario-semanal", ["inventario", "semanal"], 1),
      cat("c6", "juan", "KPI", "Exactitud de inventario", "Coincidencia entre el sistema y el conteo físico.", "https://example.com/kpi/exactitud-inventario", ["kpi", "almacén"], 4),
      cat("c7", "pedro", "KPI", "Despachos a tiempo", "Salidas programadas frente a salidas realizadas, por día.", "https://example.com/kpi/despachos-a-tiempo", ["kpi", "despacho"], 2),
      cat("c8", "carla", "Documento", "Procedimiento de conteo cíclico", "Guía paso a paso del conteo rotativo de productos clase A.", "https://example.com/documentos/conteo-ciclico", ["procedimiento"], 6)
    ],
    projects: [
      { id: "p1", departmentId: "ti", name: "Proyecto ERP", description: "Optimización de procesos y herramientas empresariales.", color: "violet" },
      { id: "p2", departmentId: "almacen", name: "Operaciones de almacén", description: "Seguimiento de inventario y operaciones logísticas.", color: "blue" },
      { id: "p3", departmentId: "compras", name: "Compras y proveedores", description: "Contratos, catálogos y relación con proveedores.", color: "emerald" },
      { id: "p4", departmentId: "almacen", name: "Rutina diaria de almacén", description: "Controles que se repiten cada día laborable.", color: "amber", routine: "daily" },
      { id: "p5", departmentId: "logistica", name: "Rutina semanal de logística", description: "Actividades que se cierran una vez por semana.", color: "cyan", routine: "weekly" }
    ],
    tasks: [
      t("t1", "Análisis de requerimientos", "Documentación aprobada por las áreas.", "Baja", "Pendiente", "p1", -2, 1, "ana", ["análisis"], sub(["Entrevistar a compras", true], ["Mapear procesos", false], ["Validar con gerencia", false])),
      t("t2", "Desarrollo de módulos", "Integración de vistas y formularios.", "Media", "En proceso", "p1", -1, 5, "luis", ["desarrollo"], sub(["Módulo de inventario", true], ["Módulo de compras", true], ["Reportes", false], ["Pruebas", false])),
      t("t3", "Revisar inventario de almacén", "Verificar stock físico contra el sistema.", "Alta", "En proceso", "p2", -3, 0, "me", ["inventario", "urgente"], sub(["Zona A", true], ["Zona B", false], ["Conciliar diferencias", false])),
      t("t4", "Diseñar base de datos", "Definir esquemas de tablas.", "Media", "Finalizado", "p1", -6, -1, "luis", ["desarrollo"], [], -1),
      t("t5", "Conteo cíclico semanal", "Conteo rotativo de productos clase A.", "Media", "Pendiente", "p2", 0, 3, "carla", ["inventario"]),
      t("t6", "Negociar contrato con proveedor", "Renovación anual con condiciones de entrega.", "Alta", "Pendiente", "p3", -5, -2, "me", ["contratos"], sub(["Comparar cotizaciones", true], ["Reunión final", false])),
      t("t7", "Actualizar catálogo de productos", "Precios y códigos vigentes.", "Baja", "Finalizado", "p3", -7, -3, "carla", [], [], -3),
      t("t8", "Reporte mensual de logística", "Indicadores de despacho y devoluciones.", "Media", "Pendiente", "p2", 4, 9, "me", ["reportes"]),
      t("t9", "Capacitar al equipo en el nuevo sistema", "Sesiones por turno.", "Baja", "Pendiente", "p1", 8, 12, "ana", ["capacitación"]),
      t("t10", "Auditoría de rutas de entrega", "Revisar tiempos y costos por ruta.", "Media", "Finalizado", "p2", -6, -2, "carla", [], [], -2),
      t("t11", "Conciliar facturas de proveedores", "Cierre de la semana.", "Alta", "Finalizado", "p3", -4, 0, "me", ["contratos"], [], 0),
      t("t12", "Etiquetado de ubicaciones", "Nuevas etiquetas en pasillos B y C.", "Baja", "Finalizado", "p2", -5, -1, "luis", ["inventario"], [], -1),
      ...routineTasks
    ],
    messages: [
      { id: "m1", author: "Ana Rodríguez", text: "Buenos días equipo, ya subí los requerimientos del ERP.", time: new Date(now - 50 * 60000).toISOString(), mine: false },
      { id: "m2", author: "Luis Pérez", text: "Perfecto. Hoy cierro el módulo de inventario.", time: new Date(now - 35 * 60000).toISOString(), mine: false },
      { id: "m3", author: "Carla Santos", text: "Recuerden el conteo cíclico del jueves.", time: new Date(now - 10 * 60000).toISOString(), mine: false }
    ],
    activity: [
      { id: "a1", text: "MYA está listo para comenzar", at: new Date().toISOString() }
    ],
    settings: { theme: "dark", accent: "violet", routineDays: 5 },
    ui: { taskView: "list", dashProject: "p1", chatSeen: new Date(now - 40 * 60000).toISOString() }
  };
}

/* ============================================================
   4. ESTADO Y ACCIONES DE DATOS
   ============================================================ */
/** Acepta datos de la versión anterior y los convierte al formato actual. */
function normalize(raw) {
  const base = seedData();
  if (!raw || !Array.isArray(raw.tasks) || !Array.isArray(raw.projects)) return base;
  const colorKeys = Object.keys(PROJECT_COLORS);
  const projects = raw.projects.map(p => ({
    id: String(p.id), name: String(p.name || "Sin nombre"), description: String(p.description || ""),
    color: colorKeys.includes(p.color) ? p.color : "violet",
    routine: ["daily", "weekly"].includes(p.routine) ? p.routine : "none",
    departmentId: p.departmentId != null ? String(p.departmentId) : (base.projects.find(b => b.id === String(p.id))?.departmentId || "")
  }));
  const ids = new Set(projects.map(p => p.id));
  const rs = raw.settings || {};
  const departments = Array.isArray(raw.departments)
    ? raw.departments.map(d => ({ id: String(d.id), name: String(d.name || "Sin nombre") })).filter(d => d.id) : clone(base.departments);
  const deptIds = new Set(departments.map(d => d.id));
  let users = Array.isArray(raw.users) && raw.users.length
    ? raw.users.map(u => ({ id: String(u.id), name: String(u.name || "Sin nombre"), role: String(u.role || ""), supervisorId: u.supervisorId ? String(u.supervisorId) : null, login: String(u.login || "").trim().toLowerCase(),
      departmentId: u.departmentId != null ? String(u.departmentId) : (base.users.find(b => b.id === String(u.id))?.departmentId || ""),
      admin: u.admin === true || u.admin === "SI" })) : null;
  if (!users) { users = clone(base.users); if (rs.name) users[0].name = rs.name; if (rs.role) users[0].role = rs.role; }
  const userIds = new Set(users.map(u => u.id));
  users.forEach(u => { u.admin = !!u.admin; if (!deptIds.has(u.departmentId)) u.departmentId = ""; });
  if (!users.some(u => u.admin)) users[0].admin = true;
  projects.forEach(p => { if (!deptIds.has(p.departmentId)) p.departmentId = ""; });
  users.forEach(u => { if (u.supervisorId && (u.supervisorId === u.id || !userIds.has(u.supervisorId))) u.supervisorId = null; });
  const taken = new Set();
  users.forEach(u => { if (!LOGIN_RE.test(u.login || "") || taken.has(u.login)) u.login = makeLogin(u.name, taken); taken.add(u.login); });
  const catalog = Array.isArray(raw.catalog) ? raw.catalog.map(c => ({
    id: String(c.id || uid("c")), type: CAT_TYPES[c.type] ? c.type : "Otro", title: String(c.title || "Sin título"), description: String(c.description || ""),
    url: normalizeUrl(c.url), ownerId: userIds.has(String(c.ownerId)) ? String(c.ownerId) : users[0].id, tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
    createdAt: c.createdAt || new Date().toISOString(), updatedAt: c.updatedAt || c.createdAt || new Date().toISOString()
  })).filter(c => c.url) : base.catalog;
  const tasks = raw.tasks.map(t => ({
    description: "", priority: "Media", status: "Pendiente", assignee: "me", tags: [], subtasks: [], startDate: "", dueDate: "",
    createdAt: new Date().toISOString(), completedAt: null, ...t, id: String(t.id), projectId: String(t.projectId)
  })).filter(t => ids.has(t.projectId));
  tasks.forEach(t => {
    t.name = String(t.name || "Sin nombre");
    if (!STATUSES.includes(t.status)) t.status = "Pendiente";
    if (!PRIORITIES.includes(t.priority)) t.priority = "Media";
    if (!userIds.has(t.assignee)) t.assignee = users[0].id;
    t.tags = Array.isArray(t.tags) ? t.tags.map(String) : [];
    t.subtasks = Array.isArray(t.subtasks) ? t.subtasks.map(s => ({ id: String(s.id || uid("s")), text: String(s.text || ""), done: !!s.done })) : [];
    if (t.status === "Finalizado" && !t.completedAt) t.completedAt = t.createdAt;
    if (t.status !== "Finalizado") t.completedAt = null;
  });
  const s = raw.settings || {};
  const messages = Array.isArray(raw.messages) ? raw.messages.map(m => ({ ...m, id: String(m.id) })) : base.messages;
  messages.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const activity = Array.isArray(raw.activity) ? raw.activity.map(a => ({ id: String(a.id), text: String(a.text || ""), at: a.at || new Date().toISOString() })) : [];
  activity.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return {
    version: 2, projects, tasks, messages, activity, users, catalog, departments,
    checks: raw.checks && typeof raw.checks === "object" && !Array.isArray(raw.checks) ? raw.checks : {},
    settings: { ...base.settings, ...s, theme: s.theme || (s.lightTheme ? "light" : "dark"), accent: ACCENTS[s.accent] ? s.accent : "violet", routineDays: [5, 6, 7].includes(Number(s.routineDays)) ? Number(s.routineDays) : 5 },
    ui: { ...base.ui, ...(raw.ui || {}) }
  };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    return raw ? normalize(JSON.parse(raw)) : seedData();
  } catch { return seedData(); }
}
let state = loadState();
let currentPage = "Inicio";
let flashId = null;
let calDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let tlStart = mondayOf(new Date());
let selectedFiles = [];
const filters = { q: "", status: "", priority: "", project: "", assignee: "", sort: "due", late: false, dept: "" };
const statPrev = {};

function mondayOf(date) { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
function save() {
  let ok = true;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { ok = false; toast("No se pudieron guardar los datos en este navegador."); }
  queueDiff();   // con una hoja de Google conectada, envía solo lo que cambió
  return ok;
}
function commit() { save(); render(); }

const findTask = id => state.tasks.find(t => t.id === String(id));
const findProject = id => state.projects.find(p => p.id === String(id));
const projectName = id => findProject(id)?.name || "Sin proyecto";
const projectColor = id => PROJECT_COLORS[findProject(id)?.color] || PROJECT_COLORS.violet;
const firstName = () => currentUser().name.trim().split(/\s+/)[0] || "";
const isDone = t => t.status === "Finalizado";
const isLate = t => !isDone(t) && !!t.dueDate && t.dueDate < todayStr();
const subProgress = t => t.subtasks.length ? { done: t.subtasks.filter(s => s.done).length, total: t.subtasks.length } : null;

function memberName(id) { return state.users.find(u => u.id === id)?.name || "Sin asignar"; }
function initials(name) { return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?"; }
function avatar(id, size = "") {
  const name = memberName(id), i = Math.max(0, state.users.findIndex(u => u.id === id));
  return `<span class="avatar ${size}" style="--av:${AV_COLORS[i % AV_COLORS.length]}" title="${esc(name)}">${esc(initials(name))}</span>`;
}
function avatarByName(name) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AV_COLORS.length;
  return `<span class="avatar sm" style="--av:${AV_COLORS[h]}">${esc(initials(name))}</span>`;
}

function dueInfo(t) {
  if (!t.dueDate) return { label: "Sin fecha", tone: "none" };
  if (isDone(t)) return { label: fmtDate(t.dueDate), tone: "done" };
  const diff = dayDiff(t.dueDate, todayStr());
  if (diff < 0) return { label: diff === -1 ? "Venció ayer" : `Venció hace ${-diff} d`, tone: "late" };
  if (diff === 0) return { label: "Hoy", tone: "today" };
  if (diff === 1) return { label: "Mañana", tone: "soon" };
  if (diff <= 3) return { label: `En ${diff} d`, tone: "soon" };
  return { label: fmtDate(t.dueDate), tone: "later" };
}

function addActivity(text) {
  state.activity.unshift({ id: uid("a"), text, at: new Date().toISOString() });
  state.activity = state.activity.slice(0, 40);
}
function setStatus(task, status) {
  if (task.status === status || !STATUSES.includes(status)) return false;
  task.status = status;
  task.completedAt = status === "Finalizado" ? new Date().toISOString() : null;
  if (status === "Finalizado") flashId = task.id;
  addActivity(`${task.name} pasó a ${status.toLowerCase()}`);
  return true;
}
function toggleDone(id) {
  const t = findTask(id); if (!t) return;
  setStatus(t, isDone(t) ? "Pendiente" : "Finalizado");
  commit();
}
function deleteTask(id) {
  const idx = state.tasks.findIndex(t => t.id === String(id)); if (idx < 0) return;
  const [removed] = state.tasks.splice(idx, 1);
  addActivity(`Tarea eliminada: ${removed.name}`);
  commit();
  toast("Tarea eliminada.", { undo: () => { state.tasks.splice(Math.min(idx, state.tasks.length), 0, removed); addActivity(`Tarea restaurada: ${removed.name}`); commit(); toast("Tarea restaurada."); } });
}
function deleteProject(id) {
  const project = findProject(id); if (!project) return;
  const pIdx = state.projects.indexOf(project);
  const removedTasks = state.tasks.filter(t => t.projectId === project.id);
  state.projects.splice(pIdx, 1);
  state.tasks = state.tasks.filter(t => t.projectId !== project.id);
  if (filters.project === project.id) filters.project = "";
  if (state.ui.dashProject === project.id) state.ui.dashProject = "all";
  addActivity(`Proyecto eliminado: ${project.name}`);
  commit();
  toast(`Proyecto eliminado con ${plural(removedTasks.length, "tarea", "tareas")}.`, {
    undo: () => { state.projects.splice(pIdx, 0, project); state.tasks.push(...removedTasks); addActivity(`Proyecto restaurado: ${project.name}`); commit(); toast("Proyecto restaurado."); }
  });
}
function unreadCount() { return state.messages.filter(m => !isMine(m) && m.time > (state.ui.chatSeen || "")).length; }

/* ---------- Filtros y orden ---------- */
function filteredTasks() {
  const q = filters.q.trim().toLowerCase();
  const list = visibleTasks().filter(t =>
    (!q || `${t.name} ${t.description} ${t.tags.join(" ")} ${projectName(t.projectId)}`.toLowerCase().includes(q)) &&
    (!filters.status || t.status === filters.status) &&
    (!filters.priority || t.priority === filters.priority) &&
    (!filters.project || t.projectId === filters.project) &&
    (!filters.assignee || t.assignee === filters.assignee) &&
    (!filters.dept || taskDept(t) === filters.dept) &&
    (!filters.late || isLate(t)));
  const byDue = (a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
  const sorters = {
    due: (a, b) => byDue(a, b) || PRIO_RANK[a.priority] - PRIO_RANK[b.priority],
    priority: (a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority] || byDue(a, b),
    name: (a, b) => a.name.localeCompare(b.name, "es"),
    recent: (a, b) => b.createdAt.localeCompare(a.createdAt)
  };
  return list.sort(sorters[filters.sort] || sorters.due);
}
const hasFilters = () => !!(filters.q || filters.status || filters.priority || filters.project || filters.assignee || filters.late || filters.dept);
function clearFilters() { Object.assign(filters, { q: "", status: "", priority: "", project: "", assignee: "", late: false, dept: "" }); $("#taskSearch").value = ""; }

/* ============================================================
   5. VISTAS (RENDER)
   ============================================================ */
function render() {
  renderShell();
  const fn = pages[currentPage]; if (fn) fn();
}

/* ---------- Estructura común ---------- */
function applyTheme() {
  const pref = state.settings.theme;
  const dark = pref === "light" ? false : pref === "system" ? matchMedia("(prefers-color-scheme: dark)").matches : true;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $("#metaTheme").content = dark ? "#0b1020" : "#f5f6fa";
  $("#themeQuick").innerHTML = ic(dark ? "sun" : "moon");
}
function applyAccent() {
  const [a, b] = ACCENTS[state.settings.accent] || ACCENTS.violet;
  document.documentElement.style.setProperty("--accent", a);
  document.documentElement.style.setProperty("--accent-2", b);
}
function renderShell() {
  const cu = currentUser();
  $$(".user-name").forEach(e => e.textContent = cu.name);
  $$(".user-role").forEach(e => e.textContent = cu.role || "Sin cargo");
  $("#userAvatar").textContent = initials(cu.name);
  const rb = $("#routineBadge"), pend = pendingToday(cu.id); rb.hidden = !pend || currentPage === "Rutinas"; rb.textContent = pend;
  const unread = unreadCount(), late = visibleTasks().filter(isLate).length;
  const ub = $("#unreadBadge"), lb = $("#lateBadge");
  ub.hidden = !unread || currentPage === "Chat"; ub.textContent = unread;
  lb.hidden = !late; lb.textContent = late;
  lb.title = `${plural(late, "tarea vencida", "tareas vencidas")}`;
  applyTheme(); applyAccent(); renderSync(); renderDeptOptions();
}

/* ---------- Piezas reutilizables ---------- */
function checkBtn(t) {
  return `<button class="check${isDone(t) ? " on" : ""}" data-action="task:toggle" data-id="${t.id}" aria-pressed="${isDone(t)}" aria-label="${isDone(t) ? "Marcar como pendiente" : "Marcar como finalizada"}: ${esc(t.name)}">${ic("check")}</button>`;
}
function projChip(id) { return `<span class="proj-chip" style="--c:${projectColor(id)}"><i></i><span>${esc(projectName(id))}</span></span>`; }
function prioChip(p) { return `<span class="prio prio-${PRIO_KEY[p]}">${ic("flag")}${p}</span>`; }
function dueChip(t) { const d = dueInfo(t); return `<span class="due due-${d.tone}">${ic("clock")}${esc(d.label)}</span>`; }
function tagsHTML(t) { return t.tags.length ? `<div class="tags">${t.tags.slice(0, 4).map(g => `<span class="tag">${esc(g)}</span>`).join("")}</div>` : ""; }
function subBar(t) {
  const s = subProgress(t); if (!s) return "";
  return `<div class="sub-progress">${ic("subtask")}<span>${s.done}/${s.total}</span><span class="bar"><i style="width:${Math.round(s.done / s.total * 100)}%"></i></span></div>`;
}
function emptyState(icon, title, text, actionHTML = "") {
  return `<div class="empty">${ic(icon)}<strong>${esc(title)}</strong><span>${esc(text)}</span>${actionHTML}</div>`;
}

function taskCard(t, draggable = true) {
  return `<article class="task-card${isDone(t) ? " is-done" : ""}${flashId === t.id ? " pop" : ""}" ${draggable ? `draggable="true" data-drag-id="${t.id}"` : ""} data-action="task:edit" data-id="${t.id}" tabindex="0">
    <div class="tc-top">${projChip(t.projectId)}${prioChip(t.priority)}</div>
    <div class="tc-title">${checkBtn(t)}<h3>${esc(t.name)}</h3></div>
    ${t.description ? `<p>${esc(t.description)}</p>` : ""}
    ${tagsHTML(t)}${subBar(t)}
    <div class="tc-foot">${dueChip(t)}${avatar(t.assignee, "sm")}</div>
  </article>`;
}
function boardHTML(tasks, { add = false } = {}) {
  return STATUSES.map(status => {
    const list = tasks.filter(t => t.status === status), meta = STATUS_META[status];
    return `<section class="lane" data-drop-status="${status}" style="--c:${meta.color}">
      <div class="lane-head"><span>${status}</span><span class="count">${list.length}</span>${add ? `<button class="icon-btn sm" data-action="task:new" data-status="${status}" aria-label="Agregar tarea en ${status}">${ic("plus")}</button>` : ""}</div>
      <div class="lane-cards">${list.length ? list.map(t => taskCard(t)).join("") : `<div class="lane-empty">Suelta una tarea aquí</div>`}</div>
    </section>`;
  }).join("");
}
function taskRow(t) {
  return `<div class="row${isDone(t) ? " is-done" : ""}" data-action="task:edit" data-id="${t.id}" tabindex="0">
    ${checkBtn(t)}
    <div class="row-main"><strong>${esc(t.name)}</strong>${projChip(t.projectId)}</div>
    ${dueChip(t)}${avatar(t.assignee, "sm")}
  </div>`;
}
function donut(parts, total, centerValue, centerLabel) {
  const R = 60, C = 2 * Math.PI * R; let off = 0;
  const arcs = total ? parts.filter(p => p.value > 0).map(p => {
    const len = p.value / total * C, gap = parts.filter(x => x.value > 0).length > 1 ? 3 : 0, dash = Math.max(len - gap, 0.1);
    const el = `<circle class="donut-arc" cx="75" cy="75" r="${R}" stroke="${p.color}" stroke-dasharray="${dash} ${C - dash}" stroke-dashoffset="${-off}"/>`;
    off += len; return el;
  }).join("") : "";
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 150 150" role="img" aria-label="${esc(centerLabel)}: ${esc(centerValue)}"><circle class="donut-track" cx="75" cy="75" r="${R}"/>${arcs}</svg><div class="donut-center"><strong>${esc(centerValue)}</strong><span>${esc(centerLabel)}</span></div></div>`;
}
function legend(items) { return items.map(i => `<div style="--c:${i.color}"><i></i>${esc(i.label)}<b>${i.value}</b></div>`).join(""); }
function barRow(label, value, total, color, suffix = "%", dot = true) {
  const pct = total ? Math.round(value / total * 100) : 0;
  return `<div class="bar-row" style="--c:${color}"><span>${dot ? `<i class="proj-chip" style="--c:${color}"><i></i></i>` : ""}<em>${esc(label)}</em></span><div class="track"><i style="width:${pct}%"></i></div><strong>${suffix === "%" ? pct + "%" : value}</strong></div>`;
}
function countUp(el, to, key) {
  const from = statPrev[key] ?? 0; statPrev[key] = to;
  if (reduceMotion() || from === to) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 650;
  const step = now => { const p = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function statsHTML(cards, keyPrefix) {
  return cards.map(c => `<${c.action ? "button" : "div"} class="stat tone-${c.tone}" ${c.action ? `data-action="${c.action}" data-status="${c.status || ""}"` : ""}>
    <span class="stat-label">${ic(c.icon)}${c.label}</span>
    <span class="stat-value" data-count="${c.value}" data-key="${keyPrefix}${c.key}">0</span>
    <div class="stat-bar"><i style="width:${c.pct}%"></i></div>
    <div class="stat-foot">${c.foot}</div>
  </${c.action ? "button" : "div"}>`).join("");
}
function runCounters(root) { $$("[data-count]", root).forEach(el => countUp(el, Number(el.dataset.count), el.dataset.key)); }
function taskCounts() {
  const c = { pending: 0, progress: 0, done: 0, late: 0, total: visibleTasks().length };
  visibleTasks().forEach(t => { if (t.status === "Pendiente") c.pending++; else if (t.status === "En proceso") c.progress++; else c.done++; if (isLate(t)) c.late++; });
  return c;
}

/* ---------- Inicio ---------- */
function renderHome() {
  const h = new Date().getHours(), greet = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  $("#greeting").innerHTML = `${greet}, ${esc(firstName())} <span class="wave">👋</span>`;
  const c = taskCounts(), today = visibleTasks().filter(t => !isDone(t) && t.dueDate === todayStr()).length;
  $("#greetingSub").textContent = (today || c.late)
    ? `Tienes ${plural(today, "tarea", "tareas")} para hoy y ${plural(c.late, "vencida", "vencidas")}.`
    : c.total ? "Todo al día. Buen momento para planificar lo que viene." : "Crea tu primera tarea para comenzar.";

  const pct = n => c.total ? Math.round(n / c.total * 100) : 0;
  $("#statsGrid").innerHTML = statsHTML([
    { key: "pending", label: "Pendientes", icon: "list", tone: "warn", value: c.pending, pct: pct(c.pending), foot: "Por organizar y comenzar", action: "stat:filter", status: "Pendiente" },
    { key: "progress", label: "En proceso", icon: "clock", tone: "info", value: c.progress, pct: pct(c.progress), foot: "Trabajo actualmente activo", action: "stat:filter", status: "En proceso" },
    { key: "done", label: "Finalizadas", icon: "check-circle", tone: "ok", value: c.done, pct: pct(c.done), foot: `${pct(c.done)}% del total`, action: "stat:filter", status: "Finalizado" },
    { key: "late", label: "Vencidas", icon: "alert", tone: "danger", value: c.late, pct: pct(c.late), foot: c.late ? "Requieren atención" : "Sin retrasos", action: "stat:filter", status: "late" }
  ], "home-");
  runCounters($("#statsGrid"));

  /* Mi día */
  const prioritized = visibleTasks().filter(t => !isDone(t) && t.assignee === currentUser().id).sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || PRIO_RANK[a.priority] - PRIO_RANK[b.priority]);
  const focus = prioritized.slice(0, 6);
  $("#focusSub").textContent = prioritized.length ? `${plural(prioritized.length, "tarea activa", "tareas activas")}, las más urgentes primero` : "Sin tareas activas";
  $("#focusList").innerHTML = focus.length ? focus.map(taskRow).join("")
    : emptyState("target", "No tienes tareas activas", "Cuando crees una nueva, aparecerá aquí.", `<button class="btn btn-primary btn-sm" data-action="task:new">${ic("plus")}<span>Nueva tarea</span></button>`);

  /* Avance */
  $("#progressDonut").innerHTML = donut([
    { value: c.done, color: "var(--ok)" }, { value: c.progress, color: "var(--info)" }, { value: c.pending, color: "var(--warn)" }
  ], c.total, `${pct(c.done)}%`, "completado");
  $("#progressLegend").innerHTML = legend([
    { label: "Finalizadas", value: c.done, color: "var(--ok)" }, { label: "En proceso", value: c.progress, color: "var(--info)" }, { label: "Pendientes", value: c.pending, color: "var(--warn)" }
  ]);

  /* Tablero */
  if (state.ui.dashProject !== "all" && !findProject(state.ui.dashProject)) state.ui.dashProject = "all";
  $("#boardProject").innerHTML = `<option value="all">Todos los proyectos</option>` + normalProjects().map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  $("#boardProject").value = state.ui.dashProject;
  const boardTasks = state.ui.dashProject === "all" ? visibleTasks() : visibleTasks().filter(t => t.projectId === state.ui.dashProject);
  $("#dashboardBoard").innerHTML = boardHTML(boardTasks, { add: true });

  /* Semana */
  const days = [...Array(7)].map((_, i) => offsetDate(i - 6));
  const counts = days.map(d => visibleTasks().filter(t => t.completedAt && ymd(new Date(t.completedAt)) === d).length);
  const max = Math.max(1, ...counts), sum = counts.reduce((a, b) => a + b, 0);
  $("#weekTotal").textContent = sum ? `${plural(sum, "tarea completada", "tareas completadas")} en los últimos 7 días` : "Aún no hay tareas completadas esta semana";
  $("#weekChart").innerHTML = days.map((d, i) => `<div class="week-col${counts[i] ? " has" : ""}${d === todayStr() ? " today" : ""}"><div class="col" style="height:${Math.max(4, counts[i] / max * 100)}%">${counts[i] ? `<em>${counts[i]}</em>` : ""}</div><span>${parseYMD(d).toLocaleDateString("es-DO", { weekday: "short" }).replace(".", "")}</span></div>`).join("");

  /* Actividad */
  $("#recentActivity").innerHTML = state.activity.length
    ? state.activity.slice(0, 6).map(a => `<div class="activity-item"><span class="dot"></span><div><strong>${esc(a.text)}</strong><small>${timeAgo(a.at)}</small></div></div>`).join("")
    : `<p class="muted">Todavía no hay actividad.</p>`;
}

/* ---------- Proyectos ---------- */
function renderProjects() {
  const cards = state.projects.map(p => {
    const routine = isRoutineProject(p.id);
    const tasks = routine ? state.tasks.filter(t => t.projectId === p.id && inScope(t.assignee)) : visibleTasks().filter(t => t.projectId === p.id);
    const done = tasks.filter(isDone).length, late = tasks.filter(isLate).length, week = routine ? routineStats(tasks, mondayStr(todayStr())) : null;
    const pct = routine ? (week.pct ?? 0) : (tasks.length ? Math.round(done / tasks.length * 100) : 0), C = 2 * Math.PI * 21;
    const people = [...new Set(tasks.map(t => t.assignee))].slice(0, 4);
    const meta = routine
      ? `<span><b>${tasks.length}</b> actividades</span><span>${week.pct === null ? "Sin datos esta semana" : "Cumplimiento esta semana"}</span>`
      : `<span><b>${tasks.length}</b> tareas</span><span><b>${done}</b> finalizadas</span>${late ? `<span style="color:var(--danger)"><b style="color:inherit">${late}</b> vencidas</span>` : ""}`;
    const open = routine ? `<button class="btn btn-secondary btn-sm" data-action="nav" data-page="Rutinas"><span>Ver rutinas</span>${ic("chev-r")}</button>`
      : `<button class="btn btn-secondary btn-sm" data-action="project:tasks" data-id="${p.id}"><span>Ver tareas</span>${ic("chev-r")}</button>`;
    return `<article class="project-card" style="--c:${PROJECT_COLORS[p.color]}">
      <div class="pc-top"><div><h2>${esc(p.name)}</h2>${p.departmentId ? `<span class="badge-dept">${ic("users")}${esc(deptName(p.departmentId))}</span>` : ""}${routine ? `<span class="badge-routine">${ic("repeat")}${p.routine === "daily" ? "Rutina diaria" : "Rutina semanal"}</span>` : ""}</div>
        <div class="ring"><svg viewBox="0 0 52 52"><circle class="t" cx="26" cy="26" r="21"/><circle class="a" cx="26" cy="26" r="21" stroke-dasharray="${C * pct / 100} ${C}"/></svg><b>${pct}%</b></div></div>
      <p>${esc(p.description || "Sin descripción")}</p>
      <div class="pc-meta">${meta}</div>
      <div class="pc-foot"><div class="avatars">${people.map(id => avatar(id, "sm")).join("")}</div>
        <div class="row-actions" style="opacity:1">
          <button class="icon-btn sm" data-action="project:edit" data-id="${p.id}" aria-label="Editar ${esc(p.name)}">${ic("edit")}</button>
          <button class="icon-btn sm danger" data-action="project:delete" data-id="${p.id}" aria-label="Eliminar ${esc(p.name)}">${ic("trash")}</button>
          ${open}
        </div></div>
    </article>`;
  }).join("");
  $("#projectsGrid").innerHTML = cards + `<button class="project-new" data-action="project:new">${ic("plus")}<span>Nuevo proyecto</span></button>`;
}

/* ---------- Tareas ---------- */
function syncToolbar() {
  const opts = (first, items) => `<option value="">${first}</option>` + items.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("");
  $("#fStatus").innerHTML = opts("Todos los estados", STATUSES.map(s => [s, s]));
  $("#fPriority").innerHTML = opts("Todas las prioridades", PRIORITIES.map(s => [s, s]));
  $("#fProject").innerHTML = opts("Todos los proyectos", normalProjects().map(p => [p.id, p.name]));
  $("#fAssignee").innerHTML = opts("Todos los responsables", scopeUsers().map(m => [m.id, memberName(m.id)]));
  $("#fDept").innerHTML = opts("Todos los departamentos", state.departments.map(d => [d.id, d.name]));
  $("#fStatus").value = filters.status; $("#fPriority").value = filters.priority; $("#fProject").value = filters.project;
  $("#fAssignee").value = filters.assignee; $("#fDept").value = filters.dept; $("#fSort").value = filters.sort;
  $$("#taskViewSeg button").forEach(b => { const on = b.dataset.view === state.ui.taskView; b.classList.toggle("active", on); b.setAttribute("aria-selected", on); });
  const chips = [];
  if (filters.late) chips.push(["late", "Solo vencidas"]);
  if (filters.project) chips.push(["project", projectName(filters.project)]);
  $("#activeFilters").innerHTML = chips.map(([k, l]) => `<span class="filter-chip">${esc(l)}<button data-action="filter:remove" data-key="${k}" aria-label="Quitar filtro ${esc(l)}">${ic("x")}</button></span>`).join("");
}
function renderTasks() {
  syncToolbar();
  const list = filteredTasks(), view = state.ui.taskView;
  $("#taskListView").classList.toggle("hidden", view !== "list");
  $("#taskBoardView").classList.toggle("hidden", view !== "board");
  $("#taskTimelineView").classList.toggle("hidden", view !== "timeline");
  const empty = () => emptyState("inbox", hasFilters() ? "Ninguna tarea coincide con los filtros" : "Aún no hay tareas",
    hasFilters() ? "Prueba con otros términos o quita algún filtro." : "Crea la primera para empezar a organizar el trabajo.",
    hasFilters() ? `<button class="btn btn-secondary btn-sm" data-action="filters:clear">Limpiar filtros</button>` : `<button class="btn btn-primary btn-sm" data-action="task:new">${ic("plus")}<span>Nueva tarea</span></button>`);
  if (view === "list") {
    $("#taskListView").innerHTML = list.length ? `<div class="panel table-panel"><div class="table-wrap"><table class="task-table"><thead><tr><th>Tarea</th><th>Proyecto</th><th>Prioridad</th><th>Estado</th><th>Entrega</th><th>Resp.</th><th></th></tr></thead><tbody>${list.map(t => `
      <tr class="${isDone(t) ? "is-done" : ""}${flashId === t.id ? " pop" : ""}">
        <td><div class="cell-task">${checkBtn(t)}<div><strong>${esc(t.name)}</strong>${t.description ? `<span class="muted">${esc(t.description)}</span>` : ""}${tagsHTML(t)}${subBar(t)}</div></div></td>
        <td>${projChip(t.projectId)}</td><td>${prioChip(t.priority)}</td>
        <td><select class="pill-select ${STATUS_META[t.status].cls}" data-change="task:status" data-id="${t.id}" aria-label="Estado de ${esc(t.name)}">${STATUSES.map(s => `<option ${t.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></td>
        <td>${dueChip(t)}</td><td>${avatar(t.assignee, "sm")}</td>
        <td><div class="row-actions"><button class="icon-btn sm" data-action="task:edit" data-id="${t.id}" aria-label="Editar ${esc(t.name)}">${ic("edit")}</button><button class="icon-btn sm danger" data-action="task:delete" data-id="${t.id}" aria-label="Eliminar ${esc(t.name)}">${ic("trash")}</button></div></td>
      </tr>`).join("")}</tbody></table></div></div>` : `<div class="panel">${empty()}</div>`;
  } else if (view === "board") {
    $("#taskBoardView").innerHTML = boardHTML(list, { add: true });
  } else {
    $("#taskTimelineView").innerHTML = timelineHTML(list, empty);
  }
}
function timelineHTML(list, emptyFn) {
  const N = 28, today = todayStr(), startStr = ymd(tlStart), endStr = offsetDate(N - 1, tlStart);
  const span = t => { const end = t.dueDate; const start = t.startDate && t.startDate <= end ? t.startDate : end; return { start, end }; };
  const dated = list.filter(t => t.dueDate), undated = list.length - dated.length;
  const visible = dated.filter(t => { const s = span(t); return s.end >= startStr && s.start <= endStr; });
  const hidden = dated.length - visible.length;
  const days = [...Array(N)].map((_, i) => offsetDate(i, tlStart));
  const head = days.map(d => { const dt = parseYMD(d); return `<div class="tl-day${d === today ? " today" : ""}${dt.getDate() === 1 ? " month" : ""}" title="${fmtDate(d, true)}">${dt.toLocaleDateString("es-DO", { weekday: "narrow" })}<b>${dt.getDate()}</b></div>`; }).join("");
  const todayIdx = dayDiff(today, startStr);
  const rows = visible.map(t => {
    const s = span(t), cs = Math.max(dayDiff(s.start, startStr), 0), ce = Math.min(dayDiff(s.end, startStr), N - 1);
    const pct = isDone(t) ? 100 : subProgress(t) ? Math.round(subProgress(t).done / subProgress(t).total * 100) : t.status === "En proceso" ? 50 : 0;
    return `<div class="tl-row" data-action="task:edit" data-id="${t.id}" tabindex="0"><div class="tl-name">${checkBtn(t)}<span title="${esc(t.name)}">${esc(t.name)}</span></div>
      <div class="tl-track">${todayIdx >= 0 && todayIdx < N ? `<span class="tl-today" style="grid-column:${todayIdx + 1}"></span>` : ""}
      <div class="tl-bar${isLate(t) ? " late" : ""}" style="grid-column:${cs + 1} / ${ce + 2};--c:${projectColor(t.projectId)}" title="${esc(t.name)}: ${fmtDate(s.start)} a ${fmtDate(s.end)}"><i style="width:${pct}%"></i></div></div></div>`;
  }).join("");
  const notes = [hidden ? `${plural(hidden, "tarea fuera", "tareas fuera")} del rango visible` : "", undated ? `${plural(undated, "tarea sin fecha", "tareas sin fecha")} no se muestra${undated === 1 ? "" : "n"}` : ""].filter(Boolean).join(". ");
  return `<div class="panel timeline"><div class="tl-inner">
    <div class="tl-head"><div><span>${fmtDate(startStr)} a ${fmtDate(endStr)}</span><span><button class="icon-btn sm" data-action="tl:prev" aria-label="Semana anterior">${ic("chev-l")}</button><button class="btn btn-ghost btn-sm" data-action="tl:today">Hoy</button><button class="icon-btn sm" data-action="tl:next" aria-label="Semana siguiente">${ic("chev-r")}</button></span></div><div class="tl-days">${head}</div></div>
    ${rows || `<div style="padding:10px">${emptyFn()}</div>`}${notes ? `<div class="tl-note">${notes}.</div>` : ""}</div></div>`;
}

/* ---------- Calendario ---------- */
function renderCalendar() {
  const y = calDate.getFullYear(), m = calDate.getMonth(), offset = (new Date(y, m, 1).getDay() + 6) % 7, start = new Date(y, m, 1 - offset);
  $("#calTitle").textContent = calDate.toLocaleDateString("es-DO", { month: "long", year: "numeric" });
  const byDate = {}; visibleTasks().forEach(t => { if (t.dueDate) (byDate[t.dueDate] ||= []).push(t); });
  let html = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => `<div class="cal-wd">${d}</div>`).join("");
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const ds = ymd(d), items = byDate[ds] || [];
    html += `<div class="cal-day${d.getMonth() !== m ? " outside" : ""}${ds === todayStr() ? " today" : ""}" data-action="day:open" data-date="${ds}" data-drop-date="${ds}" tabindex="0" role="button" aria-label="${fmtDate(ds, true)}, ${plural(items.length, "tarea", "tareas")}">
      <b>${d.getDate()}</b>
      ${items.slice(0, 3).map(t => `<button class="chip${isDone(t) ? " is-done" : ""}" draggable="true" data-drag-id="${t.id}" data-action="task:edit" data-id="${t.id}" style="--c:${projectColor(t.projectId)}" title="${esc(t.name)}">${esc(t.name)}</button>`).join("")}
      ${items.length > 3 ? `<span class="more">+${items.length - 3} más</span>` : ""}</div>`;
  }
  $("#calendarGrid").innerHTML = html;
}

/* ---------- Archivos ---------- */
function renderFiles() {
  const q = $("#fileSearch").value.trim().toLowerCase(), items = selectedFiles.filter(f => f.name.toLowerCase().includes(q));
  $("#fileCount").textContent = selectedFiles.length ? `${plural(selectedFiles.length, "archivo", "archivos")} en esta sesión` : "Vista temporal de esta sesión";
  $("#fileList").innerHTML = items.length ? items.map(f => {
    const ext = (f.name.includes(".") ? f.name.split(".").pop() : "file").slice(0, 4).toUpperCase();
    let h = 0; for (const c of ext) h = (h * 7 + c.charCodeAt(0)) % AV_COLORS.length;
    return `<div class="file-item"><span class="file-ext" style="--c:${AV_COLORS[h]}">${esc(ext)}</span><div><strong>${esc(f.name)}</strong><small>${esc(f.sizeLabel)}</small></div><button class="icon-btn sm danger" data-action="file:remove" data-id="${f.id}" aria-label="Quitar ${esc(f.name)}">${ic("x")}</button></div>`;
  }).join("") : emptyState("file", selectedFiles.length ? "Sin resultados" : "Aún no hay archivos", selectedFiles.length ? "Prueba con otro nombre." : "Selecciona o suelta archivos para verlos aquí.");
}
function addFiles(fileList) {
  const added = [...fileList].map(f => ({ id: uid("f"), name: f.name, sizeLabel: formatSize(f.size) }));
  if (!added.length) return;
  selectedFiles = [...added, ...selectedFiles].slice(0, 100);
  renderFiles(); toast(`${plural(added.length, "archivo agregado", "archivos agregados")} a la vista temporal.`);
}

/* ---------- Reportes ---------- */
function renderReports() {
  const c = taskCounts(), pct = n => c.total ? Math.round(n / c.total * 100) : 0;
  $("#reportStats").innerHTML = statsHTML([
    { key: "total", label: "Total de tareas", icon: "list", tone: "accent", value: c.total, pct: 100, foot: `En ${plural(normalProjects().length, "proyecto", "proyectos")}` },
    { key: "pending", label: "Pendientes", icon: "clock", tone: "warn", value: c.pending, pct: pct(c.pending), foot: `${pct(c.pending)}% del total` },
    { key: "done", label: "Finalizadas", icon: "check-circle", tone: "ok", value: c.done, pct: pct(c.done), foot: `${pct(c.done)}% del total` },
    { key: "late", label: "Vencidas", icon: "alert", tone: "danger", value: c.late, pct: pct(c.late), foot: c.late ? "Requieren atención" : "Sin retrasos" }
  ], "rep-");
  runCounters($("#reportStats"));
  $("#reportDonut").innerHTML = donut([{ value: c.done, color: "var(--ok)" }, { value: c.progress, color: "var(--info)" }, { value: c.pending, color: "var(--warn)" }], c.total, `${pct(c.done)}%`, "completado");
  $("#reportLegend").innerHTML = legend([{ label: "Finalizadas", value: c.done, color: "var(--ok)" }, { label: "En proceso", value: c.progress, color: "var(--info)" }, { label: "Pendientes", value: c.pending, color: "var(--warn)" }]);
  const active = visibleTasks().filter(t => !isDone(t));
  $("#reportPriority").innerHTML = PRIORITIES.map(p => barRow(p, active.filter(t => t.priority === p).length, active.length, PRIO_COLOR[p], "n", false)).join("") || "";
  $("#reportProjects").innerHTML = normalProjects().length ? normalProjects().map(p => { const ts = visibleTasks().filter(t => t.projectId === p.id); return barRow(p.name, ts.filter(isDone).length, ts.length, PROJECT_COLORS[p.color]); }).join("") : `<p class="muted">Sin proyectos.</p>`;
  const byDept = state.departments.map(d => ({ d, ts: visibleTasks().filter(t => taskDept(t) === d.id) })).filter(x => x.ts.length);
  $("#reportDepts").innerHTML = byDept.length ? byDept.map((x, i) => barRow(x.d.name, x.ts.filter(isDone).length, x.ts.length, AV_COLORS[i % AV_COLORS.length])).join("") : `<p class="muted">Aún no hay tareas vinculadas a un departamento.</p>`;
  $("#reportWorkload").innerHTML = scopeUsers().map((m, i) => barRow(memberName(m.id), active.filter(t => t.assignee === m.id).length, active.length, AV_COLORS[i % AV_COLORS.length], "n", false)).join("");
  const late = visibleTasks().filter(isLate).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  $("#reportOverdue").innerHTML = late.length ? late.map(taskRow).join("") : emptyState("check-circle", "Sin tareas vencidas", "Todo está dentro de los plazos.");
}
function csvEscape(v) { return `"${String(v ?? "").replace(/"/g, '""')}"`; }
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCSV() {
  const rows = [["Tarea", "Proyecto", "Prioridad", "Estado", "Responsable", "Inicio", "Entrega", "Etiquetas", "Subtareas"],
    ...visibleTasks().map(t => [t.name, projectName(t.projectId), t.priority, t.status, memberName(t.assignee), t.startDate, t.dueDate, t.tags.join("; "), subProgress(t) ? `${subProgress(t).done}/${subProgress(t).total}` : ""])];
  download("mya-reporte-tareas.csv", "\uFEFF" + rows.map(r => r.map(csvEscape).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  toast("Reporte CSV exportado.");
}
function exportJSON() { download(`mya-respaldo-${todayStr()}.json`, JSON.stringify(state, null, 2), "application/json"); toast("Respaldo exportado."); }

/* ---------- Chat ---------- */
function renderChat() {
  const box = $("#chatMessages");
  box.innerHTML = state.messages.map(m => `<div class="msg${isMine(m) ? " mine" : ""}">${isMine(m) ? "" : avatarByName(m.author)}<div class="bubble"><b>${esc(m.author)}</b><p>${esc(m.text)}</p><time>${new Date(m.time).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}</time></div></div>`).join("");
  box.scrollTop = box.scrollHeight;
}

/* ---------- Configuración ---------- */
function renderSettings() {
  $("#userNameSetting").value = currentUser().name; $("#userRoleSetting").value = currentUser().role; $("#routineDaysSel").value = state.settings.routineDays; $("#userLoginSetting").value = currentUser().login; renderSheetsPanel();
  $$("#themeSeg button").forEach(b => b.classList.toggle("active", b.dataset.themeValue === state.settings.theme));
  $("#accentSwatches").innerHTML = Object.entries(ACCENTS).map(([k, [a]]) => `<button class="${state.settings.accent === k ? "sel" : ""}" style="--c:${a}" data-action="accent:set" data-accent="${k}" aria-label="Acento ${k}" aria-pressed="${state.settings.accent === k}"></button>`).join("");
}

const pages = { Inicio: renderHome, Proyectos: renderProjects, Tareas: renderTasks, Calendario: renderCalendar, Archivos: renderFiles, Reportes: renderReports, Chat: renderChat, "Configuración": renderSettings };

/* ---------- Navegación ---------- */
function navigate(page) {
  if (!isLoggedIn()) return showLogin();
  if (!PAGES.includes(page)) page = "Inicio";
  currentPage = page;
  $$(".page").forEach(p => p.classList.toggle("hidden", p.id !== "page-" + page));
  $$(".nav-item").forEach(b => { const on = b.dataset.page === page; b.classList.toggle("active", on); on ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"); });
  document.title = `${page} | MYA — Manage Your Activities`;
  if (page === "Chat") { state.ui.chatSeen = new Date().toISOString(); save(); }
  closeSidebar();
  try { history.replaceState(null, "", "#" + encodeURIComponent(page)); } catch { /* file:// restringido */ }
  render();
  window.scrollTo({ top: 0 });
}
function closeSidebar() { $("#sidebar").classList.remove("open"); document.body.classList.remove("nav-open"); }

/* ---------- Aviso con deshacer ---------- */
let toastTimer, undoFn = null;
function toast(message, { undo } = {}) {
  $("#toastMsg").textContent = message; undoFn = undo || null;
  $("#toastUndo").hidden = !undo;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $("#toast").classList.remove("show"), undo ? 6000 : 2800);
}

/* ============================================================
   6. REGISTRO DE ACCIONES (clics, cambios, teclado)
   ============================================================ */
const Actions = {
  nav: el => navigate(el.dataset.page),
  "sidebar:toggle": () => { const o = $("#sidebar").classList.toggle("open"); document.body.classList.toggle("nav-open", o); },
  "sidebar:close": closeSidebar,
  "palette:open": () => openPalette(),
  "theme:quick": () => toggleTheme(),
  "theme:set": el => { state.settings.theme = el.dataset.themeValue; commit(); },
  "accent:set": el => { state.settings.accent = el.dataset.accent; commit(); },
  "dialog:close": el => el.closest("dialog").close(),
  "task:new": el => { const d = el.closest("dialog"); if (d) d.close(); openTaskDialog(null, { status: el.dataset.status, dueDate: el.dataset.date }); },
  "task:edit": el => { const t = findTask(el.dataset.id); if (t) { const d = el.closest("dialog"); if (d) d.close(); openTaskDialog(t); } },
  "task:delete": el => deleteTask(el.dataset.id),
  "task:delete-from-dialog": () => { const id = $("#taskForm").dataset.editId; $("#taskDialog").close(); deleteTask(id); },
  "task:toggle": el => toggleDone(el.dataset.id),
  "project:new": () => openProjectDialog(),
  "project:edit": el => openProjectDialog(findProject(el.dataset.id)),
  "project:delete": el => { const p = findProject(el.dataset.id); if (p) deleteProject(p.id); },
  "project:tasks": el => { clearFilters(); filters.project = el.dataset.id; navigate("Tareas"); },
  "stat:filter": el => { clearFilters(); const s = el.dataset.status; if (s === "late") filters.late = true; else filters.status = s; navigate("Tareas"); },
  "filter:remove": el => { if (el.dataset.key === "late") filters.late = false; if (el.dataset.key === "project") filters.project = ""; renderTasks(); },
  "filters:clear": () => { clearFilters(); renderTasks(); },
  "view:set": el => { state.ui.taskView = el.dataset.view; save(); renderTasks(); },
  "cal:prev": () => { calDate = new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1); renderCalendar(); },
  "cal:next": () => { calDate = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1); renderCalendar(); },
  "cal:today": () => { const d = new Date(); calDate = new Date(d.getFullYear(), d.getMonth(), 1); renderCalendar(); },
  "day:open": el => openDayDialog(el.dataset.date),
  "tl:prev": () => { tlStart = new Date(tlStart.getFullYear(), tlStart.getMonth(), tlStart.getDate() - 7); renderTasks(); },
  "tl:next": () => { tlStart = new Date(tlStart.getFullYear(), tlStart.getMonth(), tlStart.getDate() + 7); renderTasks(); },
  "tl:today": () => { tlStart = mondayOf(new Date()); renderTasks(); },
  "subtask:add": () => { draftSubs.push({ id: uid("s"), text: "", done: false }); renderSubtaskDraft(true); },
  "subtask:remove": el => { draftSubs.splice(Number(el.dataset.i), 1); renderSubtaskDraft(); },
  "file:remove": el => { selectedFiles = selectedFiles.filter(f => f.id !== el.dataset.id); renderFiles(); },
  "profile:save": () => {
    const name = $("#userNameSetting").value.trim(), role = $("#userRoleSetting").value.trim();
    if (!name || !role) return toast("Completa el nombre y el cargo.");
    const cu = currentUser(); cu.name = name; cu.role = role; commit(); toast("Perfil guardado.");
  },
  "report:csv": exportCSV,
  "data:export-json": exportJSON,
  "data:reset": () => {
    if (sheetsOn()) return toast("Hay una hoja de Google conectada. Desconéctala antes de restablecer los datos de demostración.");
    if (!confirm("¿Restablecer tareas, proyectos y mensajes a los datos de demostración? Esta acción no se puede deshacer.")) return;
    state = seedData(); selectedFiles = []; clearFilters(); save(); navigate("Inicio"); toast("Datos de demostración restablecidos.");
  }
};
const Changes = {
  "task:status": el => { const t = findTask(el.dataset.id); if (t && setStatus(t, el.value)) commit(); },
  "dash:project": el => { state.ui.dashProject = el.value; commit(); }
};

document.addEventListener("click", e => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  if (el.tagName === "A") e.preventDefault();
  const fn = Actions[el.dataset.action];
  if (fn) { e.stopPropagation(); fn(el, e); }
});
document.addEventListener("change", e => { const el = e.target.closest("[data-change]"); if (el && Changes[el.dataset.change]) Changes[el.dataset.change](el); });

/* Teclado: Enter o Espacio activan elementos interactivos que no son botones */
document.addEventListener("keydown", e => {
  if (document.body.classList.contains("is-locked")) return;
  const t = e.target;
  if ((e.key === "Enter" || e.key === " ") && t.matches?.("[data-action][tabindex]") && t.tagName !== "BUTTON" && t.tagName !== "INPUT") { e.preventDefault(); t.click(); return; }
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
  if (e.key === "Escape") closeSidebar();
  if (typing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]")) return;
  if (e.key === "/") { e.preventDefault(); openPalette(); }
  else if (e.key.toLowerCase() === "n") { e.preventDefault(); openTaskDialog(); }
});

/* Botones dinámicos: ondas al pulsar y luz que sigue al cursor */
document.addEventListener("pointerdown", e => {
  const b = e.target.closest(".btn, .icon-btn"); if (!b || reduceMotion()) return;
  const r = b.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2, s = document.createElement("span");
  s.className = "ripple"; s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  b.appendChild(s); setTimeout(() => s.remove(), 650);
});
document.addEventListener("pointermove", e => {
  const b = e.target.closest?.(".btn"); if (!b) return;
  const r = b.getBoundingClientRect(); b.style.setProperty("--mx", `${e.clientX - r.left}px`); b.style.setProperty("--my", `${e.clientY - r.top}px`);
});

/* Arrastrar y soltar: tablero (cambia estado) y calendario (cambia fecha) */
let dragId = null;
document.addEventListener("dragstart", e => {
  const el = e.target.closest?.("[data-drag-id]"); if (!el) return;
  dragId = el.dataset.dragId; e.dataTransfer.setData("text/plain", dragId); e.dataTransfer.effectAllowed = "move";
  setTimeout(() => el.classList.add("dragging"), 0);
});
document.addEventListener("dragend", () => { dragId = null; $$(".dragging,.drag-over").forEach(el => el.classList.remove("dragging", "drag-over")); });
document.addEventListener("dragover", e => {
  if (!dragId) return;
  const zone = e.target.closest("[data-drop-status],[data-drop-date]");
  if (zone) { e.preventDefault(); zone.classList.add("drag-over"); }
});
document.addEventListener("dragleave", e => { const zone = e.target.closest?.("[data-drop-status],[data-drop-date]"); if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove("drag-over"); });
document.addEventListener("drop", e => {
  if (!dragId) return;
  const zone = e.target.closest("[data-drop-status],[data-drop-date]"); if (!zone) return;
  e.preventDefault(); zone.classList.remove("drag-over");
  const t = findTask(dragId); if (!t) return;
  if (zone.dataset.dropStatus) { if (setStatus(t, zone.dataset.dropStatus)) commit(); }
  else if (zone.dataset.dropDate && t.dueDate !== zone.dataset.dropDate) {
    t.dueDate = zone.dataset.dropDate; if (t.startDate && t.startDate > t.dueDate) t.startDate = t.dueDate;
    addActivity(`${t.name} reprogramada al ${fmtDate(t.dueDate)}`); commit(); toast(`Reprogramada para el ${fmtDate(t.dueDate)}.`);
  }
  dragId = null;
});

/* ============================================================
   7. DIÁLOGOS
   ============================================================ */
let draftSubs = [];
function renderSubtaskDraft(focusLast = false) {
  $("#subtaskList").innerHTML = draftSubs.map((s, i) => `<div class="subtask-row"><input type="checkbox" data-sub="done" data-i="${i}" ${s.done ? "checked" : ""} aria-label="Completada"><input type="text" data-sub="text" data-i="${i}" value="${esc(s.text)}" maxlength="120" placeholder="Describe la subtarea"><button type="button" class="icon-btn sm danger" data-action="subtask:remove" data-i="${i}" aria-label="Quitar subtarea">${ic("x")}</button></div>`).join("");
  if (focusLast) $$("#subtaskList input[type=text]").at(-1)?.focus();
}
function openTaskDialog(task = null, preset = {}) {
  const f = $("#taskForm"); f.reset();
  $("#taskDialogTitle").textContent = task ? "Editar tarea" : "Nueva tarea";
  $("#taskSaveBtn").textContent = task ? "Guardar cambios" : "Crear tarea";
  $("#taskDeleteBtn").hidden = !task;
  if (!state.projects.length) { toast("Crea un proyecto antes de agregar tareas."); return openProjectDialog(); }
  $("#tProject").innerHTML = state.projects.map(p => `<option value="${p.id}">${esc(p.name)}${p.routine === "daily" ? " (rutina diaria)" : p.routine === "weekly" ? " (rutina semanal)" : ""}</option>`).join("");
  $("#tAssignee").innerHTML = scopeUsers().map(m => `<option value="${m.id}">${esc(memberName(m.id))}</option>`).join("");
  $("#tStatus").innerHTML = STATUSES.map(s => `<option>${s}</option>`).join("");
  $("#tPriority").innerHTML = PRIORITIES.map(s => `<option>${s}</option>`).join("");
  $("#tName").value = task?.name || ""; $("#tDesc").value = task?.description || "";
  $("#tProject").value = task?.projectId || preset.projectId || (filters.project && findProject(filters.project) ? filters.project : (state.ui.dashProject !== "all" && findProject(state.ui.dashProject) ? state.ui.dashProject : state.projects[0].id));
  $("#tAssignee").value = task?.assignee || currentUser().id;
  $("#tStatus").value = task?.status || (STATUSES.includes(preset.status) ? preset.status : "Pendiente");
  $("#tPriority").value = task?.priority || "Media";
  $("#tStart").value = task ? task.startDate : ""; $("#tDue").value = task ? task.dueDate : (preset.dueDate || offsetDate(1));
  $("#tTags").value = task?.tags.join(", ") || "";
  draftSubs = task ? clone(task.subtasks) : []; renderSubtaskDraft();
  f.dataset.editId = task ? task.id : "";
  syncTaskFormMode(!!task);
  $("#taskDialog").showModal(); $("#tName").focus();
}
$("#subtaskList").addEventListener("input", e => {
  const i = Number(e.target.dataset.i); if (Number.isNaN(i) || !draftSubs[i]) return;
  if (e.target.dataset.sub === "text") draftSubs[i].text = e.target.value;
});
$("#subtaskList").addEventListener("change", e => { const i = Number(e.target.dataset.i); if (e.target.dataset.sub === "done" && draftSubs[i]) draftSubs[i].done = e.target.checked; });
$("#subtaskList").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.dataset.sub === "text") { e.preventDefault(); Actions["subtask:add"](); } });

$("#taskForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("#tName").value.trim(); if (!name) { $("#tName").focus(); return toast("Escribe un nombre para la tarea."); }
  const routine = isRoutineProject($("#tProject").value);
  const start = routine ? "" : $("#tStart").value, due = routine ? "" : $("#tDue").value;
  if (start && due && start > due) return toast("La fecha de inicio no puede ser posterior a la entrega.");
  const tags = [...new Set($("#tTags").value.split(",").map(s => s.trim().replace(/^#/, "").trim()).filter(Boolean))].slice(0, 6);
  const data = {
    name, description: $("#tDesc").value.trim(), projectId: $("#tProject").value, assignee: $("#tAssignee").value,
    priority: $("#tPriority").value, startDate: start, dueDate: due, tags,
    subtasks: routine ? [] : draftSubs.map(s => ({ ...s, text: s.text.trim() })).filter(s => s.text)
  };
  const status = routine ? "Pendiente" : $("#tStatus").value, existing = findTask($("#taskForm").dataset.editId);
  if (existing) {
    Object.assign(existing, data); setStatus(existing, status); addActivity(`Tarea actualizada: ${name}`);
  } else {
    if (routine) {
      const targets = selectedAssignees(); if (!targets.length) return toast("Selecciona al menos una persona.");
      targets.forEach(who => state.tasks.push({ id: uid("t"), createdAt: new Date().toISOString(), completedAt: null, status: "Pendiente", ...data, assignee: who }));
      addActivity(`Rutina creada: ${name} para ${plural(targets.length, "persona", "personas")}`);
    } else {
      const t = { id: uid("t"), createdAt: new Date().toISOString(), completedAt: null, status: "Pendiente", ...data };
      state.tasks.push(t); setStatus(t, status); addActivity(`Tarea creada: ${name}`);
    }
  }
  $("#taskDialog").close(); commit(); toast(existing ? "Tarea actualizada." : "Tarea creada.");
});

let projectColor_ = "violet";
function openProjectDialog(project = null, presetRoutine = "none") {
  $("#projectForm").reset();
  $("#projectDialogTitle").textContent = project ? "Editar proyecto" : "Nuevo proyecto";
  $("#projectSaveBtn").textContent = project ? "Guardar cambios" : "Crear proyecto";
  $("#pName").value = project?.name || ""; $("#pDesc").value = project?.description || "";
  projectColor_ = project?.color || "violet";
  $("#pDept").value = deptName(project ? project.departmentId : currentUser().departmentId);
  setProjRoutine(project?.routine || presetRoutine);
  $("#pColors").innerHTML = Object.entries(PROJECT_COLORS).map(([k, c]) => `<label style="--c:${c}" title="${k}"><input type="radio" name="pcolor" value="${k}" ${k === projectColor_ ? "checked" : ""} aria-label="Color ${k}"></label>`).join("");
  $("#projectForm").dataset.editId = project ? project.id : "";
  $("#projectDialog").showModal(); $("#pName").focus();
}
$("#projectForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("#pName").value.trim(); if (!name) { $("#pName").focus(); return toast("Escribe un nombre para el proyecto."); }
  const color = $("input[name=pcolor]:checked")?.value || "violet", description = $("#pDesc").value.trim();
  const existing = findProject($("#projectForm").dataset.editId);
  if (existing) { Object.assign(existing, { name, description, color, routine: projRoutine, departmentId: ensureDept($("#pDept").value) }); addActivity(`Proyecto actualizado: ${name}`); }
  else { state.projects.push({ id: uid("p"), name, description, color, routine: projRoutine, departmentId: ensureDept($("#pDept").value) }); addActivity(`Proyecto creado: ${name}`); }
  $("#projectDialog").close(); commit(); toast(existing ? "Proyecto actualizado." : "Proyecto creado.");
});

function openDayDialog(ds) {
  const items = visibleTasks().filter(t => t.dueDate === ds);
  $("#dayTitle").textContent = parseYMD(ds).toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long" });
  $("#dayList").innerHTML = items.length ? items.map(taskRow).join("") : emptyState("calendar", "Sin tareas este día", "Agrega una con el botón de abajo.");
  $("#dayNew").dataset.date = ds;
  $("#dayDialog").showModal();
}

/* Cerrar al hacer clic fuera del diálogo */
$$("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));

/* ============================================================
   8. PALETA DE COMANDOS
   ============================================================ */
let palItems = [], palIndex = 0;
function toggleTheme() {
  const dark = document.documentElement.dataset.theme === "dark";
  state.settings.theme = dark ? "light" : "dark"; commit();
}
function buildPalette(q) {
  q = q.trim().toLowerCase();
  const match = s => !q || s.toLowerCase().includes(q);
  const items = [];
  if (q) {
    visibleTasks().filter(t => match(`${t.name} ${t.description} ${t.tags.join(" ")}`)).slice(0, 6)
      .forEach(t => items.push({ g: "Tareas", icon: "check-circle", label: t.name, sub: `${projectName(t.projectId)}, ${t.status.toLowerCase()}`, run: () => openTaskDialog(t) }));
    state.projects.filter(p => match(`${p.name} ${p.description}`)).slice(0, 4)
      .forEach(p => items.push({ g: "Proyectos", icon: "folder", label: p.name, sub: plural(visibleTasks().filter(t => t.projectId === p.id).length, "tarea", "tareas"), run: () => { clearFilters(); filters.project = p.id; navigate("Tareas"); } }));
    state.catalog.filter(c => match(`${c.title} ${c.description} ${c.tags.join(" ")}`)).slice(0, 4)
      .forEach(c => items.push({ g: "Catálogo", icon: CAT_TYPES[c.type].icon, label: c.title, sub: `${c.type}, ${memberName(c.ownerId)}`, run: () => window.open(c.url, "_blank", "noopener,noreferrer") }));
  }
  [
    { g: "Acciones", icon: "plus", label: "Nueva tarea", sub: "Atajo: N", run: () => openTaskDialog() },
    { g: "Acciones", icon: "folder", label: "Nuevo proyecto", run: () => openProjectDialog() },
    { g: "Acciones", icon: document.documentElement.dataset.theme === "dark" ? "sun" : "moon", label: "Cambiar tema claro u oscuro", run: toggleTheme },
    { g: "Acciones", icon: "download", label: "Exportar reporte CSV", run: exportCSV },
    { g: "Acciones", icon: "download", label: "Exportar respaldo JSON", run: exportJSON },
    ...PAGES.map(p => ({ g: "Ir a", icon: PAGE_ICONS[p], label: p, run: () => navigate(p) }))
  ].filter(c => match(c.label)).forEach(c => items.push(c));
  return items;
}
function renderPalette() {
  const q = $("#paletteInput").value; palItems = buildPalette(q); palIndex = Math.min(palIndex, Math.max(palItems.length - 1, 0));
  let last = "", html = "";
  palItems.forEach((it, i) => {
    if (it.g !== last) { html += `<div class="pal-group">${it.g}</div>`; last = it.g; }
    html += `<button class="pal-item${i === palIndex ? " sel" : ""}" data-pal="${i}" role="option" aria-selected="${i === palIndex}">${ic(it.icon)}<span class="grow"><span>${esc(it.label)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</span></button>`;
  });
  $("#paletteList").innerHTML = html || `<div class="pal-empty">No encontramos coincidencias para "${esc(q)}".</div>`;
  $("#paletteList .sel")?.scrollIntoView({ block: "nearest" });
}
function openPalette() {
  const d = $("#paletteDialog"); if (d.open) return;
  $("#paletteInput").value = ""; palIndex = 0; renderPalette(); d.showModal(); $("#paletteInput").focus();
}
function runPalette(i) { const it = palItems[i]; if (!it) return; $("#paletteDialog").close(); setTimeout(it.run, 0); }
$("#paletteInput").addEventListener("input", () => { palIndex = 0; renderPalette(); });
$("#paletteInput").addEventListener("keydown", e => {
  if (e.key === "ArrowDown") { e.preventDefault(); palIndex = (palIndex + 1) % Math.max(palItems.length, 1); renderPalette(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); palIndex = (palIndex - 1 + palItems.length) % Math.max(palItems.length, 1); renderPalette(); }
  else if (e.key === "Enter") { e.preventDefault(); runPalette(palIndex); }
});
$("#paletteList").addEventListener("click", e => { const b = e.target.closest("[data-pal]"); if (b) runPalette(Number(b.dataset.pal)); });
$("#paletteList").addEventListener("mousemove", e => { const b = e.target.closest("[data-pal]"); if (b && Number(b.dataset.pal) !== palIndex) { palIndex = Number(b.dataset.pal); $$("#paletteList .pal-item").forEach((x, i) => x.classList.toggle("sel", i === palIndex)); } });

/* ============================================================
   EQUIPO, JERARQUÍA Y RUTINAS
   Cada persona tiene cargo y supervisor. Quien supervisa ve las tareas y las
   rutinas de toda su rama. Las rutinas se marcan por día (diarias) o por semana.
   ============================================================ */
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
let rtWeek = ymd(mondayOf(new Date()));   // lunes de la semana que se está viendo
let projRoutine = "none";
let flashKey = null;

/* ---------- Usuarios y jerarquía ---------- */
function currentUser() { return userById(sessionId) || state.users[0]; }
function userById(id) { return state.users.find(u => u.id === id); }
function directReports(id) { return state.users.filter(u => u.supervisorId === id); }
/** Toda la rama bajo una persona, en orden de árbol y con su nivel de profundidad. */
function teamTree(id, depth = 0, seen = new Set([id])) {
  const out = [];
  directReports(id).forEach(u => { if (seen.has(u.id)) return; seen.add(u.id); out.push({ user: u, depth }, ...teamTree(u.id, depth + 1, seen)); });
  return out;
}
const descendants = id => teamTree(id).map(n => n.user);
const scopeUsers = () => { const cu = currentUser(); return cu.admin ? [cu, ...state.users.filter(u => u.id !== cu.id)] : [cu, ...descendants(cu.id)]; };
const inScope = id => scopeUsers().some(u => u.id === id);
const isRoutineProject = id => (findProject(id)?.routine || "none") !== "none";
const projectRoutine = id => findProject(id)?.routine || "none";
const normalProjects = () => state.projects.filter(p => !p.routine || p.routine === "none");
/** Tareas normales (no rutinas) de la persona actual y de su equipo. */
function visibleTasks() { const ids = new Set(scopeUsers().map(u => u.id)); return state.tasks.filter(t => ids.has(t.assignee) && !isRoutineProject(t.projectId)); }
const routineTasksOf = userId => state.tasks.filter(t => t.assignee === userId && isRoutineProject(t.projectId));
const isMine = m => m.authorId ? m.authorId === currentUser().id : (!!m.mine && currentUser().id === state.users[0].id);

/* ---------- Cumplimiento de rutinas ---------- */
const mondayStr = ds => ymd(mondayOf(parseYMD(ds)));
const checkKey = (t, period) => `${t.id}|${period}`;   // periodo = fecha (diaria) o lunes de la semana (semanal)
const createdDay = t => ymd(new Date(t.createdAt));
const heat = p => p === null ? "none" : p >= 90 ? "good" : p >= 60 ? "mid" : "low";

/** Calcula lo esperado y lo cumplido de una lista de rutinas en la semana que empieza en `ws`.
    No se espera nada de días futuros, días no laborables ni fechas anteriores a la creación de la actividad. */
function routineStats(tasks, ws) {
  const N = state.settings.routineDays, today = todayStr(), end = offsetDate(6, parseYMD(ws));
  const days = [...Array(7)].map((_, i) => ({ date: offsetDate(i, parseYMD(ws)), work: i < N, expected: 0, done: 0 }));
  const weekly = { expected: 0, done: 0 };
  tasks.forEach(t => {
    const mode = projectRoutine(t.projectId), created = createdDay(t);
    if (mode === "daily") days.forEach(d => { if (d.work && d.date <= today && d.date >= created) { d.expected++; if (state.checks[checkKey(t, d.date)]) d.done++; } });
    else if (mode === "weekly" && ws <= today && end >= created) { weekly.expected++; if (state.checks[checkKey(t, ws)]) weekly.done++; }
  });
  const expected = days.reduce((a, d) => a + d.expected, 0) + weekly.expected, done = days.reduce((a, d) => a + d.done, 0) + weekly.done;
  return { days, weekly, expected, done, pct: expected ? Math.round(done / expected * 100) : null, today: days.find(d => d.date === today) || null };
}
function pendingToday(userId) {
  const s = routineStats(routineTasksOf(userId), mondayStr(todayStr()));
  return (s.today ? s.today.expected - s.today.done : 0) + (s.weekly.expected - s.weekly.done);
}
function kpiPill(s) {
  return `<div class="kpi-pill heat-${heat(s.pct)}"><b>${s.pct === null ? "—" : s.pct + "%"}</b><span>${s.expected ? `${s.done} de ${s.expected} cumplidas` : "Sin actividades esperadas"}</span></div>`;
}

/** Tabla de rutinas de una persona. `editable` permite marcar (solo la propia persona). */
function routineTableHTML(userId, ws, editable) {
  const tasks = routineTasksOf(userId), today = todayStr(), N = state.settings.routineDays;
  if (!tasks.length) return emptyState("repeat", "Sin actividades de rutina", editable ? "Cuando te asignen rutinas aparecerán aquí para que las marques." : "Esta persona aún no tiene rutinas asignadas.");
  const dates = [...Array(7)].map((_, i) => offsetDate(i, parseYMD(ws)));
  const daily = tasks.filter(t => projectRoutine(t.projectId) === "daily"), weekly = tasks.filter(t => projectRoutine(t.projectId) === "weekly");
  const nameCell = t => `<td><div class="rt-name"><strong>${esc(t.name)}</strong>${projChip(t.projectId)}${editable ? "" : `<button class="icon-btn sm" data-action="task:edit" data-id="${t.id}" aria-label="Editar ${esc(t.name)}">${ic("edit")}</button>`}</div></td>`;
  const mark = (t, date, cls, on, canClick) => {
    const label = `${t.name}, ${fmtDate(date)}: ${on ? "completada" : "pendiente"}`, pop = flashKey === checkKey(t, date) ? " pop" : "";
    return canClick
      ? `<button class="rt-cell ${cls}${pop}" data-action="routine:toggle" data-id="${t.id}" data-date="${date}" aria-pressed="${on}" aria-label="${esc(label)}">${on ? ic("check") : ""}</button>`
      : `<span class="rt-cell ${cls}" title="${esc(label)}">${on ? ic("check") : ""}</span>`;
  };
  const dailyCell = (t, date, i) => {
    if (i >= N || date < createdDay(t)) return `<td><span class="rt-cell off"></span></td>`;
    const on = !!state.checks[checkKey(t, date)], future = date > today;
    return `<td>${mark(t, date, on ? "done" : future ? "future" : date === today ? "today" : "miss", on, editable && !future)}</td>`;
  };
  let html = "";
  if (daily.length) html += `<div class="table-wrap rt-block"><table class="rt"><thead><tr><th>Actividades diarias</th>${dates.map((d, i) => `<th class="${d === today ? "today" : ""}">${WEEKDAYS[i]}<b>${parseYMD(d).getDate()}</b></th>`).join("")}</tr></thead><tbody>${daily.map(t => `<tr>${nameCell(t)}${dates.map((d, i) => dailyCell(t, d, i)).join("")}</tr>`).join("")}</tbody></table></div>`;
  if (weekly.length) {
    const started = ws <= today, over = offsetDate(6, parseYMD(ws)) < today;
    html += `<div class="table-wrap rt-block"><table class="rt rt-weekly"><thead><tr><th>Actividades semanales</th><th>Esta semana</th></tr></thead><tbody>${weekly.map(t => { const on = !!state.checks[checkKey(t, ws)]; return `<tr>${nameCell(t)}<td>${mark(t, ws, on ? "done" : !started ? "future" : over ? "miss" : "today", on, editable && started)}</td></tr>`; }).join("")}</tbody></table></div>`;
  }
  return html;
}

/* ---------- Página: Rutinas ---------- */
function renderRoutines() {
  const cu = currentUser(), thisWeek = rtWeek === mondayStr(todayStr());
  $("#rtWeekLabel").textContent = `${fmtDate(rtWeek)} al ${fmtDate(offsetDate(6, parseYMD(rtWeek)))}${thisWeek ? " (esta semana)" : ""}`;
  const mine = routineStats(routineTasksOf(cu.id), rtWeek);
  $("#routineMine").innerHTML = `<section class="panel"><div class="panel-head"><div><h2>Mi rutina</h2><p>${esc(cu.name)}${cu.role ? ", " + esc(cu.role) : ""}</p></div>${kpiPill(mine)}</div>${routineTableHTML(cu.id, rtWeek, true)}</section>`;

  const tree = teamView();
  if (!tree.length) { $("#routineTeam").innerHTML = ""; return; }
  const rows = tree.map(({ user, depth }) => ({ user, depth, s: routineStats(routineTasksOf(user.id), rtWeek) }));
  const scored = rows.filter(r => r.s.pct !== null), n = scored.length || 1;
  const avg = scored.length ? Math.round(scored.reduce((a, r) => a + r.s.pct, 0) / scored.length) : 0;
  const perfect = scored.filter(r => r.s.pct === 100).length, low = scored.filter(r => r.s.pct < 60).length;
  const cards = [
    { key: "avg", label: "Cumplimiento promedio (%)", icon: "target", tone: "accent", value: avg, pct: avg, foot: scored.length ? `Promedio de ${plural(scored.length, "persona", "personas")}` : "Aún sin datos esta semana" },
    { key: "people", label: "Personas en tu equipo", icon: "users", tone: "info", value: rows.length, pct: 100, foot: `${scored.length} con rutinas asignadas` },
    { key: "perfect", label: "Al 100%", icon: "check-circle", tone: "ok", value: perfect, pct: Math.round(perfect / n * 100), foot: "Cumplieron todo lo esperado" },
    { key: "low", label: "Por debajo de 60%", icon: "alert", tone: "danger", value: low, pct: Math.round(low / n * 100), foot: low ? "Conviene darles seguimiento" : "Nadie en riesgo" }
  ];
  const dayCell = d => `<td class="c"><span class="heat heat-${!d.work ? "off" : heat(d.expected ? Math.round(d.done / d.expected * 100) : null)}" title="${d.done} de ${d.expected}">${d.expected ? `${d.done}/${d.expected}` : ""}</span></td>`;
  $("#routineTeam").innerHTML = `<div class="section-head"><div><h2>Mi equipo</h2><p>Cumplimiento de rutinas de la semana. Toca una persona para ver el detalle.</p></div></div>
    <div class="stats" id="rtStats">${statsHTML(cards, "rt-")}</div>
    <section class="panel table-panel" style="margin-top:16px"><div class="table-wrap"><table class="task-table kpi-table"><thead><tr><th>Persona</th><th>Cumplimiento</th>${WEEKDAYS.map(d => `<th class="c">${d}</th>`).join("")}<th class="c">Semanal</th><th class="c">Hoy</th></tr></thead><tbody>
    ${rows.map(({ user, depth, s }) => `<tr class="clickable" data-action="member:open" data-id="${user.id}" tabindex="0">
      <td style="padding-left:${16 + depth * 20}px"><div class="cell-task">${avatar(user.id, "sm")}<div><strong>${esc(user.name)}</strong><span class="muted">${esc(user.role || "Sin cargo")}${user.departmentId ? ", " + esc(deptName(user.departmentId)) : ""}</span></div></div></td>
      <td><div class="kpi-bar heat-${heat(s.pct)}"><div class="track"><i style="width:${s.pct || 0}%"></i></div><strong>${s.pct === null ? "—" : s.pct + "%"}</strong></div></td>
      ${s.days.map(dayCell).join("")}
      <td class="c">${s.weekly.expected ? `${s.weekly.done}/${s.weekly.expected}` : "—"}</td>
      <td class="c">${s.today && s.today.expected ? `${s.today.done}/${s.today.expected}` : "—"}</td></tr>`).join("")}
    </tbody></table></div></section>`;
  runCounters($("#rtStats"));
}

/* ---------- Página: Equipo (organigrama) ---------- */
function orgNode(u, seen) {
  const kids = directReports(u.id).filter(k => !seen.has(k.id)); kids.forEach(k => seen.add(k.id));
  const total = descendants(u.id).length, me = u.id === currentUser().id;
  return `<li><div class="org-card${me ? " is-me" : ""}">${avatar(u.id)}
    <div class="org-info"><strong>${esc(u.name)}${me ? " <em>(tú)</em>" : ""}</strong><span>${esc(u.role || "Sin cargo")}</span>${u.departmentId ? `<span class="dept-tag">${esc(deptName(u.departmentId))}</span>` : ""}<small>ID: ${esc(u.login)}${total ? `. Supervisa a ${plural(total, "persona", "personas")}` : ""}</small></div>
    <div class="org-actions">
      <button class="btn btn-ghost btn-sm" data-action="member:open" data-id="${u.id}"><span>Seguimiento</span></button>
      <button class="btn btn-ghost btn-sm" data-action="member:open" data-id="${u.id}" data-tab="catalogo"><span>Catálogo (${catalogOf(u.id).length})</span></button>
      <button class="icon-btn sm" data-action="user:new" data-sup="${u.id}" aria-label="Agregar persona a cargo de ${esc(u.name)}">${ic("plus")}</button>
      ${me ? "" : `<button class="icon-btn sm" data-action="user:edit" data-id="${u.id}" aria-label="Editar ${esc(u.name)}">${ic("edit")}</button><button class="icon-btn sm danger" data-action="user:delete" data-id="${u.id}" aria-label="Eliminar ${esc(u.name)}">${ic("trash")}</button>`}
    </div></div>${kids.length ? `<ul>${kids.map(k => orgNode(k, seen)).join("")}</ul>` : ""}</li>`;
}

/* ---------- Formulario de tarea en modo rutina ---------- */
function syncTaskFormMode(editing = false) {
  const routine = isRoutineProject($("#tProject").value), multi = routine && !editing;
  const dn = deptName(findProject($("#tProject").value)?.departmentId); $("#tDeptHint").textContent = dn ? `Departamento: ${dn}` : "Este proyecto no tiene departamento.";
  ["#rowStatus", "#rowDates", "#subtaskField"].forEach(sel => $(sel).hidden = routine);
  $("#multiAssignField").hidden = !multi; $("#assigneeField").hidden = multi;
  if (multi) {
    const pre = descendants(currentUser().id).length ? null : currentUser().id;
    $("#multiAssign").innerHTML = scopeUsers().map(u => `<label class="check-opt"><input type="checkbox" value="${u.id}" ${u.id === pre ? "checked" : ""}><span>${avatar(u.id, "sm")}${esc(u.name)}</span></label>`).join("");
  }
}
const selectedAssignees = () => $$("#multiAssign input:checked").map(i => i.value);
$("#tProject").addEventListener("change", () => syncTaskFormMode(!!$("#taskForm").dataset.editId));
function setProjRoutine(v) {
  projRoutine = ["daily", "weekly"].includes(v) ? v : "none";
  $$("#pRoutine button").forEach(b => b.classList.toggle("active", b.dataset.routine === projRoutine));
  $("#pRoutineHint").textContent = { none: "Tiene fechas de entrega y estados: pendiente, en proceso y finalizado.", daily: "Las actividades se marcan cada día laborable. Verás el cumplimiento por día y por semana.", weekly: "Las actividades se marcan una vez por semana." }[projRoutine];
}

/* ---------- Acciones nuevas ---------- */
Object.assign(Actions, {
  "rt:prev": () => { rtWeek = offsetDate(-7, parseYMD(rtWeek)); renderRoutines(); },
  "rt:next": () => { rtWeek = offsetDate(7, parseYMD(rtWeek)); renderRoutines(); },
  "rt:today": () => { rtWeek = mondayStr(todayStr()); renderRoutines(); },
  "routine:toggle": el => {
    const t = findTask(el.dataset.id), date = el.dataset.date;
    if (!t || t.assignee !== currentUser().id || date > todayStr()) return;
    const key = checkKey(t, date);
    if (state.checks[key]) delete state.checks[key]; else { state.checks[key] = new Date().toISOString(); flashKey = key; setTimeout(() => { flashKey = null; }, 700); }
    commit();
  },
  "routine:new": () => {
    const rp = state.projects.find(p => isRoutineProject(p.id));
    if (!rp) { toast("Primero crea un proyecto de tipo rutina."); return openProjectDialog(null, "daily"); }
    openTaskDialog(null, { projectId: rp.id });
  },
  "proj:routine": el => setProjRoutine(el.dataset.routine),
  "member:open": el => openMember(el.dataset.id, el.dataset.tab),
  "user:new": el => openUserDialog(null, el.dataset.sup),
  "user:edit": el => openUserDialog(userById(el.dataset.id)),
  "user:delete": el => {
    const u = userById(el.dataset.id); if (!u || u.id === currentUser().id) return;
    const heir = u.supervisorId || currentUser().id, normal = state.tasks.filter(t => t.assignee === u.id && !isRoutineProject(t.projectId)).length;
    if (!confirm(`¿Eliminar a ${u.name}? Sus ${plural(normal, "tarea", "tareas")} y su equipo pasarán a ${userById(heir)?.name}. Sus rutinas y su historial se eliminan, y sus recursos del catálogo pasan al mismo supervisor.`)) return;
    const gone = new Set(state.tasks.filter(t => t.assignee === u.id && isRoutineProject(t.projectId)).map(t => t.id));
    state.tasks = state.tasks.filter(t => !gone.has(t.id));
    Object.keys(state.checks).forEach(k => { if (gone.has(k.split("|")[0])) delete state.checks[k]; });
    state.tasks.forEach(t => { if (t.assignee === u.id) t.assignee = heir; });
    state.users.forEach(x => { if (x.supervisorId === u.id) x.supervisorId = u.supervisorId || null; });
    state.catalog.forEach(c => { if (c.ownerId === u.id) c.ownerId = heir; });
    state.users = state.users.filter(x => x.id !== u.id);
    addActivity(`Integrante eliminado: ${u.name}`); commit(); toast("Integrante eliminado.");
  }
});
Object.assign(Changes, {
  "settings:routineDays": el => { state.settings.routineDays = Number(el.value); commit(); }
});
Object.assign(pages, { Rutinas: renderRoutines, Equipo: renderTeam });

/* ============================================================
   DEPARTAMENTOS, SUPERVISIÓN OPCIONAL Y ADMINISTRADORES
   ============================================================ */
const slug = name => String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "depto";
function uniqueSlug(name) { let b = slug(name), c = b, n = 1; while (state.departments.some(d => d.id === c)) c = b + "-" + (++n); return c; }
const deptName = id => state.departments.find(d => d.id === id)?.name || "";
const taskDept = t => findProject(t.projectId)?.departmentId || "";
/** Devuelve el ID del departamento con ese nombre; si no existe, lo crea. */
function ensureDept(name) {
  const n = String(name || "").trim().replace(/\s+/g, " "); if (!n) return "";
  let d = state.departments.find(x => x.name.toLowerCase() === n.toLowerCase());
  if (!d) { d = { id: uniqueSlug(n), name: n }; state.departments.push(d); addActivity(`Departamento creado: ${n}`); }
  return d.id;
}
function renderDeptOptions() { $("#deptOptions").innerHTML = state.departments.map(d => `<option value="${esc(d.name)}"></option>`).join(""); }
function renderDepartments() {
  const admin = !!currentUser().admin;
  $("#deptList").innerHTML = state.departments.length ? state.departments.map(d => {
    const people = state.users.filter(u => u.departmentId === d.id).length, projects = state.projects.filter(p => p.departmentId === d.id).length;
    return `<div class="row dept-row"><span class="cat-ico" style="--c:var(--accent)">${ic("users")}</span>
      <div class="row-main"><strong>${esc(d.name)}</strong><small class="muted">${plural(people, "persona", "personas")}, ${plural(projects, "proyecto", "proyectos")}</small></div>
      ${admin ? `<button class="icon-btn sm" data-action="dept:edit" data-id="${d.id}" aria-label="Renombrar ${esc(d.name)}">${ic("edit")}</button><button class="icon-btn sm danger" data-action="dept:delete" data-id="${d.id}" aria-label="Eliminar ${esc(d.name)}">${ic("trash")}</button>` : ""}</div>`;
  }).join("") : emptyState("users", "Aún no hay departamentos", "Se crean al escribirlos en el formulario de una persona o de un proyecto, o con el botón de arriba.");
}
function openDeptDialog(d = null) {
  $("#deptForm").reset(); $("#deptDialogTitle").textContent = d ? "Renombrar departamento" : "Nuevo departamento";
  $("#dName").value = d?.name || ""; $("#deptForm").dataset.editId = d ? d.id : "";
  $("#deptDialog").showModal(); $("#dName").focus();
}
$("#deptForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("#dName").value.trim().replace(/\s+/g, " "), existing = state.departments.find(d => d.id === $("#deptForm").dataset.editId);
  if (!name) { $("#dName").focus(); return toast("Escribe el nombre del departamento."); }
  if (state.departments.some(d => d.name.toLowerCase() === name.toLowerCase() && d !== existing)) return toast("Ya existe un departamento con ese nombre.");
  if (existing) { existing.name = name; addActivity(`Departamento renombrado: ${name}`); } else { state.departments.push({ id: uniqueSlug(name), name }); addActivity(`Departamento creado: ${name}`); }
  $("#deptDialog").close(); commit(); toast(existing ? "Departamento actualizado." : "Departamento creado.");
});

/* ---------- Alcance: el administrador ve a todos; los demás, su propia rama ---------- */
function teamView() {
  const cu = currentUser(); if (!cu.admin) return teamTree(cu.id);
  const seen = new Set(), out = [];
  state.users.filter(u => !u.supervisorId || !userById(u.supervisorId)).forEach(r => { seen.add(r.id); out.push({ user: r, depth: 0 }, ...teamTree(r.id, 1, seen)); });
  return out.filter(n => n.user.id !== cu.id);
}
function renderTeam() {
  const cu = currentUser(), sup = userById(cu.supervisorId), seen = new Set();
  $("#orgTree").innerHTML = cu.admin
    ? state.users.filter(u => !u.supervisorId || !userById(u.supervisorId)).map(r => { seen.add(r.id); return orgNode(r, seen); }).join("")
    : (sup ? `<li class="org-above"><span class="muted">Reportas a</span>${avatar(sup.id, "sm")}<strong>${esc(sup.name)}</strong><span class="muted">${esc(sup.role || "")}</span></li>` : "") + orgNode(cu, new Set([cu.id]));
  renderDepartments();
}

/* ---------- Formulario de integrante ---------- */
let uSupMode = "with";
function setUSupMode(mode) {
  uSupMode = mode === "none" && currentUser().admin ? "none" : "with";
  $$("#uSupToggle button").forEach(b => b.classList.toggle("active", b.dataset.mode === uSupMode));
  $("#uSupervisor").hidden = uSupMode === "none";
  $("#uSupHint").textContent = uSupMode === "none"
    ? "Quedará en el nivel superior del organigrama. Solo los administradores podrán verlo y gestionarlo."
    : "Quien lo supervise podrá ver su seguimiento y su catálogo.";
}
function openUserDialog(user = null, supId = null) {
  $("#userForm").reset();
  const admin = !!currentUser().admin;
  $("#userDialogTitle").textContent = user ? "Editar integrante" : "Nuevo integrante";
  $("#userSaveBtn").textContent = user ? "Guardar cambios" : "Crear integrante";
  $("#uName").value = user?.name || ""; $("#uRole").value = user?.role || ""; $("#uLogin").value = user?.login || ""; delete $("#uLogin").dataset.touched;
  $("#uDept").value = deptName(user ? user.departmentId : currentUser().departmentId);
  $("#uSupToggle").hidden = !admin; $("#uAdminField").hidden = !admin; $("#uAdmin").checked = !!user?.admin;
  const blocked = new Set(user ? [user.id, ...descendants(user.id).map(d => d.id)] : []);   // evita ciclos jerárquicos
  $("#uSupervisor").innerHTML = scopeUsers().filter(u => !blocked.has(u.id)).map(u => `<option value="${u.id}">${esc(u.name)}${u.role ? ", " + esc(u.role) : ""}</option>`).join("");
  $("#uSupervisor").value = user?.supervisorId || supId || currentUser().id;
  setUSupMode(user && !user.supervisorId ? "none" : "with");
  $("#userForm").dataset.editId = user ? user.id : "";
  $("#userDialog").showModal(); $("#uName").focus();
}
$("#userForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("#uName").value.trim(); if (!name) { $("#uName").focus(); return toast("Escribe el nombre de la persona."); }
  const role = $("#uRole").value.trim(), existing = userById($("#userForm").dataset.editId);
  const supervisorId = uSupMode === "none" ? null : ($("#uSupervisor").value || null);
  if (uSupMode === "with" && !supervisorId) return toast("Elige quién supervisará a esta persona, o marca «Sin supervisor».");
  if (existing && supervisorId && (supervisorId === existing.id || descendants(existing.id).some(d => d.id === supervisorId))) return toast("Una persona no puede reportarle a su propio equipo.");
  const login = $("#uLogin").value.trim().toLowerCase().replace(/^@/, "");
  if (!LOGIN_RE.test(login)) { $("#uLogin").focus(); return toast("El ID debe tener de 3 a 24 caracteres: letras, números, punto, guion o guion bajo."); }
  if (state.users.some(u => u.login === login && u.id !== existing?.id)) { $("#uLogin").focus(); return toast("Ese ID ya está en uso. Elige otro."); }
  const admin = currentUser().admin ? $("#uAdmin").checked : !!existing?.admin;
  if (existing?.admin && !admin && !state.users.some(u => u.admin && u.id !== existing.id)) return toast("Debe haber al menos un administrador.");
  const departmentId = ensureDept($("#uDept").value);
  if (existing) { Object.assign(existing, { name, role, supervisorId, login, departmentId, admin }); addActivity(`Integrante actualizado: ${name}`); }
  else { state.users.push({ id: state.users.some(u => u.id === login) ? uid("u") : login, login, name, role, departmentId, supervisorId, admin }); addActivity(`Integrante agregado: ${name}`); }
  $("#userDialog").close(); commit(); toast(existing ? "Integrante actualizado." : `Integrante agregado. Su ID de acceso es ${login}.`);
});

Object.assign(Actions, {
  "usup:set": el => setUSupMode(el.dataset.mode),
  "dept:new": () => openDeptDialog(),
  "dept:edit": el => openDeptDialog(state.departments.find(d => d.id === el.dataset.id)),
  "dept:delete": el => {
    const d = state.departments.find(x => x.id === el.dataset.id); if (!d || !currentUser().admin) return;
    const n = state.users.filter(u => u.departmentId === d.id).length + state.projects.filter(p => p.departmentId === d.id).length;
    if (!confirm(`¿Eliminar el departamento ${d.name}? ${n ? `Las ${n} personas y proyectos vinculados quedarán sin departamento.` : ""}`)) return;
    state.users.forEach(u => { if (u.departmentId === d.id) u.departmentId = ""; });
    state.projects.forEach(p => { if (p.departmentId === d.id) p.departmentId = ""; });
    state.departments = state.departments.filter(x => x.id !== d.id);
    if (filters.dept === d.id) filters.dept = "";
    addActivity(`Departamento eliminado: ${d.name}`); commit(); toast("Departamento eliminado.");
  }
});

/* ============================================================
   ACCESO (inicio de sesión por ID) Y CATÁLOGO
   ============================================================ */
const DEMO_HINT = true;   // Muestra los IDs de ejemplo en la pantalla de inicio. Poner en false al publicar.
let sessionId = (() => { try { return localStorage.getItem("mya-session"); } catch { return null; } })();
const isLoggedIn = () => !!userById(sessionId);

/** Convierte un nombre en un ID de usuario válido y único (ej. "Juan Díaz" pasa a "juan"). */
function makeLogin(name, taken = new Set()) {
  let b = String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9._-]/g, "").slice(0, 16);
  if (b.length < 3) b = (b + "user").slice(0, 8);
  let c = b, n = 1; while (taken.has(c)) c = b + (++n);
  return c;
}
const suggestLogin = name => makeLogin(name, new Set(state.users.map(u => u.login)));

function renderDemoIds() {
  const el = $("#demoIds"); el.hidden = !DEMO_HINT || sheetsOn(); if (el.hidden) return;
  el.innerHTML = `<span>Cuentas de demostración. Toca una para entrar.</span><div>${state.users.slice(0, 6).map(u => `<button type="button" class="chip-btn" data-action="login:fill" data-login="${esc(u.login)}">${esc(u.login)}</button>`).join("")}</div>`;
}
function showLogin() {
  $$("dialog[open]").forEach(d => d.close()); closeSidebar();
  document.body.classList.add("is-locked"); document.title = "Iniciar sesión | MYA";
  $("#loginError").hidden = true; renderDemoIds();
  $("#loginScreen").hidden = false; renderLoginConn();
  if (sheetsOn() && sync.empty) showInit(); else { hideInit(); $("#loginId").focus(); }
}
async function login(raw) {
  const id = String(raw || "").trim().toLowerCase().replace(/^@/, "");
  if (sheetsOn()) { await pollOnce(true); if (sync.empty) return false; }
  const user = state.users.find(u => u.login === id);
  if (!user) {
    const err = $("#loginError"), card = $("#loginForm");
    err.textContent = id ? "No encontramos ese ID. Revísalo o pídele a tu supervisor que te registre." : "Escribe tu ID de usuario.";
    err.hidden = false; card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake"); $("#loginId").focus();
    return false;
  }
  sessionId = user.id; try { localStorage.setItem("mya-session", user.id); } catch { /* sin almacenamiento */ }
  $("#loginScreen").hidden = true; document.body.classList.remove("is-locked"); $("#loginId").value = "";
  navigate(decodeURIComponent(location.hash.slice(1)) || "Inicio"); toast(`Bienvenido, ${firstName()}.`);
  return true;
}
function logout() { sessionId = null; try { localStorage.removeItem("mya-session"); } catch { /* sin almacenamiento */ } showLogin(); }
$("#loginForm").addEventListener("submit", e => { e.preventDefault(); login($("#loginId").value); });
$("#loginId").addEventListener("input", () => { $("#loginError").hidden = true; });

/* ---------- Catálogo ---------- */
const catFilters = { q: "", type: "", owner: "", sort: "recent" };
const catalogOf = id => state.catalog.filter(c => c.ownerId === id);
const canEditCat = c => c.ownerId === currentUser().id || inScope(c.ownerId);   // el dueño o quien lo supervisa
const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

function catCard(c) {
  const t = CAT_TYPES[c.type], owner = userById(c.ownerId), edit = canEditCat(c);
  return `<article class="cat-card" style="--c:${t.color}">
    <div class="cat-top"><span class="cat-type">${ic(t.icon)}${esc(c.type)}</span><div class="cat-actions">
      <button class="icon-btn sm" data-action="cat:copy" data-id="${c.id}" aria-label="Copiar enlace de ${esc(c.title)}" title="Copiar enlace">${ic("copy")}</button>
      ${edit ? `<button class="icon-btn sm" data-action="cat:edit" data-id="${c.id}" aria-label="Editar ${esc(c.title)}">${ic("edit")}</button><button class="icon-btn sm danger" data-action="cat:delete" data-id="${c.id}" aria-label="Eliminar ${esc(c.title)}">${ic("trash")}</button>` : ""}
    </div></div>
    <h3>${esc(c.title)}</h3>${c.description ? `<p>${esc(c.description)}</p>` : ""}${tagsHTML(c)}
    <div class="cat-owner">${avatar(c.ownerId, "sm")}<div><strong>${esc(owner?.name || "Sin propietario")}</strong><span>${esc(owner?.role || "")}${owner?.departmentId ? ", " + esc(deptName(owner.departmentId)) : ""}</span></div></div>
    <div class="cat-foot"><span class="cat-host" title="${esc(c.url)}">${ic("link")}${esc(hostOf(c.url))}</span>
      <a class="btn btn-primary btn-sm" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir ${esc(c.title)} en una pestaña nueva"><span>Abrir</span>${ic("arrow-up-right")}</a></div>
  </article>`;
}
function catRow(c) {
  const t = CAT_TYPES[c.type];
  return `<div class="cat-row" style="--c:${t.color}"><span class="cat-ico">${ic(t.icon)}</span>
    <div><strong title="${esc(c.title)}">${esc(c.title)}</strong><small>${esc(c.type)}, ${esc(hostOf(c.url))}</small></div>
    <a class="btn btn-secondary btn-sm" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir ${esc(c.title)} en una pestaña nueva"><span>Abrir</span>${ic("arrow-up-right")}</a></div>`;
}
function renderCatalog() {
  const q = catFilters.q.trim().toLowerCase(), me = currentUser().id;
  const owners = [...new Set(state.catalog.map(c => c.ownerId))].map(userById).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, "es"));
  $("#catOwner").innerHTML = `<option value="">Todos los propietarios</option><option value="mine">Mis recursos</option>` + owners.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join("");
  $("#catOwner").value = catFilters.owner; $("#catSort").value = catFilters.sort;
  const base = state.catalog.filter(c =>
    (!q || `${c.title} ${c.description} ${c.tags.join(" ")} ${memberName(c.ownerId)} ${hostOf(c.url)}`.toLowerCase().includes(q)) &&
    (!catFilters.owner || (catFilters.owner === "mine" ? c.ownerId === me : c.ownerId === catFilters.owner)));
  $("#catChips").innerHTML = [["", "Todos"], ...Object.keys(CAT_TYPES).map(t => [t, t])]
    .map(([t, l]) => `<button class="chip-btn${catFilters.type === t ? " active" : ""}" data-action="cat:type" data-type="${t}">${l}<b>${base.filter(c => !t || c.type === t).length}</b></button>`).join("");
  const sorters = { recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt), name: (a, b) => a.title.localeCompare(b.title, "es"), type: (a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title, "es") };
  const list = base.filter(c => !catFilters.type || c.type === catFilters.type).sort(sorters[catFilters.sort] || sorters.recent);
  const filtered = q || catFilters.type || catFilters.owner;
  $("#catalogGrid").innerHTML = list.length ? list.map(catCard).join("")
    : `<div class="panel" style="grid-column:1/-1">${emptyState("library", filtered ? "Ningún recurso coincide" : "El catálogo está vacío", filtered ? "Prueba con otra búsqueda o quita algún filtro." : "Publica el primer proyecto, KPI o reporte para que tu equipo lo encuentre.",
      filtered ? "" : `<button class="btn btn-primary btn-sm" data-action="cat:new">${ic("plus")}<span>Nuevo recurso</span></button>`)}</div>`;
}
$("#catSearch").addEventListener("input", e => { catFilters.q = e.target.value; renderCatalog(); });
$("#catOwner").addEventListener("change", e => { catFilters.owner = e.target.value; renderCatalog(); });
$("#catSort").addEventListener("change", e => { catFilters.sort = e.target.value; renderCatalog(); });

function openCatDialog(item = null) {
  $("#catForm").reset();
  $("#catDialogTitle").textContent = item ? "Editar recurso" : "Nuevo recurso";
  $("#catSaveBtn").textContent = item ? "Guardar cambios" : "Publicar recurso";
  $("#cType").innerHTML = Object.keys(CAT_TYPES).map(t => `<option>${t}</option>`).join("");
  $("#cType").value = item?.type || "Reporte"; $("#cTitle").value = item?.title || ""; $("#cUrl").value = item?.url || "";
  $("#cDesc").value = item?.description || ""; $("#cTags").value = item?.tags.join(", ") || "";
  $("#catForm").dataset.editId = item ? item.id : "";
  $("#catDialog").showModal(); $("#cTitle").focus();
}
$("#catForm").addEventListener("submit", e => {
  e.preventDefault();
  const title = $("#cTitle").value.trim(); if (!title) { $("#cTitle").focus(); return toast("Escribe un título para el recurso."); }
  const url = normalizeUrl($("#cUrl").value); if (!url) { $("#cUrl").focus(); return toast("Escribe un enlace válido, por ejemplo https://misitio.com/reporte."); }
  const data = { type: $("#cType").value, title, url, description: $("#cDesc").value.trim(), tags: [...new Set($("#cTags").value.split(",").map(s => s.trim().replace(/^#/, "").trim()).filter(Boolean))].slice(0, 6), updatedAt: new Date().toISOString() };
  const existing = state.catalog.find(c => c.id === $("#catForm").dataset.editId);
  if (existing) { Object.assign(existing, data); addActivity(`Recurso actualizado: ${title}`); }
  else { state.catalog.push({ id: uid("c"), ownerId: currentUser().id, createdAt: data.updatedAt, ...data }); addActivity(`Recurso publicado en el catálogo: ${title}`); }
  $("#catDialog").close(); commit(); toast(existing ? "Recurso actualizado." : "Recurso publicado en el catálogo.");
});
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch { /* sin permiso */ } ta.remove(); return ok; }
}

/* ---------- Perfil de una persona (seguimiento y catálogo) ---------- */
let memberId = null, memberTab = "rutina";
function renderMember() {
  const u = userById(memberId); if (!u) return;
  const sup = userById(u.supervisorId), team = descendants(u.id), s = routineStats(routineTasksOf(u.id), rtWeek), items = catalogOf(u.id);
  const mine = state.tasks.filter(t => t.assignee === u.id && !isRoutineProject(t.projectId) && !isDone(t));
  $("#memberTitle").textContent = "Perfil de usuario";
  $("#memberBody").innerHTML = `<div class="profile-head">${avatar(u.id)}<div><strong>${esc(u.name)}</strong><span>${esc(u.role || "Sin cargo")}${u.departmentId ? ", " + esc(deptName(u.departmentId)) : ""}</span>
    <small>ID de usuario: ${esc(u.login)}. ${sup ? "Reporta a " + esc(sup.name) : "Nivel superior, sin supervisor"}${team.length ? `. Supervisa a ${plural(team.length, "persona", "personas")}` : ""}.</small></div>${kpiPill(s)}</div>
    <div class="seg seg-full" style="margin-bottom:16px">
      <button class="${memberTab === "rutina" ? "active" : ""}" data-action="member:tab" data-tab="rutina"><i data-i="repeat"></i><span>Seguimiento semanal</span></button>
      <button class="${memberTab === "catalogo" ? "active" : ""}" data-action="member:tab" data-tab="catalogo"><i data-i="library"></i><span>Catálogo (${items.length})</span></button>
    </div>` + (memberTab === "catalogo"
      ? (items.length ? `<div>${items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(catRow).join("")}</div>` : emptyState("library", "Sin recursos publicados", "Esta persona aún no ha agregado proyectos, KPI o reportes al catálogo."))
      : `<p class="muted" style="margin-bottom:12px">Semana del ${fmtDate(rtWeek)} al ${fmtDate(offsetDate(6, parseYMD(rtWeek)))}. Tareas activas: <b>${mine.length}</b>${mine.filter(isLate).length ? `, vencidas: <b style="color:var(--danger)">${mine.filter(isLate).length}</b>` : ""}.</p>${routineTableHTML(u.id, rtWeek, false)}`);
  hydrateIcons($("#memberBody"));
}
function openMember(id, tab = "rutina") { memberId = id; memberTab = tab === "catalogo" ? "catalogo" : "rutina"; renderMember(); $("#memberDialog").showModal(); }

/* ---------- Acciones nuevas ---------- */
Object.assign(Actions, {
  "auth:logout": logout,
  "login:fill": el => login(el.dataset.login),
  "member:tab": el => { memberTab = el.dataset.tab; renderMember(); },
  "cat:new": () => openCatDialog(),
  "cat:edit": el => { const c = state.catalog.find(x => x.id === el.dataset.id); if (c && canEditCat(c)) openCatDialog(c); },
  "cat:type": el => { catFilters.type = el.dataset.type; renderCatalog(); },
  "cat:copy": async el => { const c = state.catalog.find(x => x.id === el.dataset.id); if (c) toast((await copyText(c.url)) ? "Enlace copiado al portapapeles." : "No se pudo copiar. Usa el botón Abrir y copia la dirección."); },
  "cat:delete": el => {
    const idx = state.catalog.findIndex(c => c.id === el.dataset.id), c = state.catalog[idx];
    if (!c || !canEditCat(c)) return;
    state.catalog.splice(idx, 1); addActivity(`Recurso eliminado: ${c.title}`); commit();
    toast("Recurso eliminado.", { undo: () => { state.catalog.splice(Math.min(idx, state.catalog.length), 0, c); commit(); toast("Recurso restaurado."); } });
  }
});
Object.assign(pages, { "Catálogo": renderCatalog });

$("#uName").addEventListener("input", () => { const l = $("#uLogin"); if (!$("#userForm").dataset.editId && !l.dataset.touched) l.value = suggestLogin($("#uName").value); });
$("#uLogin").addEventListener("input", e => { e.target.dataset.touched = "1"; });

/* ============================================================
   GOOGLE SHEETS COMO BASE DE DATOS
   La app guarda siempre una copia en el navegador. Cuando hay una hoja conectada,
   cada cambio se convierte en una operación (insertar, actualizar o borrar una fila)
   que se envía al servidor. Si no hay internet, las operaciones quedan en cola y se
   envían al volver la conexión. Cada 30 segundos se consulta si otra persona hizo cambios.
   ============================================================ */
const MYA_CONFIG = { url: "", token: "" };   // Opcional: escribe aquí la URL y la clave para que todos se conecten solos.
const SHEETS_KEY = "mya-sheets", QUEUE_KEY = "mya-sync-queue";
const URL_RE = /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+\/|macros\/)s\/[^/]+\/exec$/;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isNetErr = e => e?.name === "TypeError" || /Failed to fetch|NetworkError|Load failed|Tiempo de espera/i.test(e?.message || "");

function sheetsConf() {
  try { const c = JSON.parse(localStorage.getItem(SHEETS_KEY) || "null"); if (c?.url && c?.token) return c; } catch { /* sin datos */ }
  return MYA_CONFIG.url && MYA_CONFIG.token ? MYA_CONFIG : null;
}
function sheetsOn() { return !!sheetsConf(); }
function loadQueue() { try { const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); return Array.isArray(q) ? q : []; } catch { return []; } }
const sync = { status: "off", error: "", last: null, version: null, baseline: null, pending: loadQueue(), seq: 0, busy: false, applying: false, empty: false, deferred: null };
sync.seq = sync.pending.reduce((m, o) => Math.max(m, o.seq || 0), 0);
function persistQueue() { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(sync.pending)); } catch { /* sin almacenamiento */ } }

/* ---------- Conversión entre el estado de la app y las filas de la hoja ---------- */
function toRows(st) {
  const first = st.users[0]?.id || "";
  return {
    users: st.users.map(u => ({ id: u.id, login: u.login, name: u.name, role: u.role || "", departmentId: u.departmentId || "", supervisorId: u.supervisorId || "", admin: !!u.admin })),
    departments: st.departments.map(d => ({ id: d.id, name: d.name })),
    projects: st.projects.map(p => ({ id: p.id, name: p.name, description: p.description || "", color: p.color, routine: p.routine || "none", departmentId: p.departmentId || "" })),
    tasks: st.tasks.map(t => ({ id: t.id, name: t.name, description: t.description || "", priority: t.priority, status: t.status, projectId: t.projectId, startDate: t.startDate || "", dueDate: t.dueDate || "", assignee: t.assignee, tags: t.tags || [], subtasks: t.subtasks || [], createdAt: t.createdAt || "", completedAt: t.completedAt || "" })),
    checks: Object.entries(st.checks).map(([k, at]) => { const [taskId, period] = k.split("|"); return { id: k, taskId, period, at }; }),
    catalog: st.catalog.map(c => ({ id: c.id, type: c.type, title: c.title, description: c.description || "", url: c.url, ownerId: c.ownerId, tags: c.tags || [], createdAt: c.createdAt || "", updatedAt: c.updatedAt || "" })),
    messages: st.messages.map(m => ({ id: m.id, author: m.author || "", authorId: m.authorId || (m.mine ? first : ""), text: m.text || "", time: m.time || "" })),
    activity: st.activity.slice(0, 100).map(a => ({ id: a.id, text: a.text, at: a.at })),
    config: [{ id: "routineDays", value: String(st.settings.routineDays) }]
  };
}
function fromSheets(d) {
  const checks = {}; (d.checks || []).forEach(c => { if (c.id) checks[c.id] = c.at || new Date().toISOString(); });
  const days = Number((d.config || []).find(c => c.id === "routineDays")?.value);
  return { users: d.users, departments: d.departments, projects: d.projects, tasks: d.tasks, checks, catalog: d.catalog, messages: d.messages, activity: d.activity, settings: { routineDays: [5, 6, 7].includes(days) ? days : 5 } };
}
const canon = row => JSON.stringify(Object.keys(row).sort().map(k => [k, row[k]]));
function rowsToMap(rows) { const m = {}; Object.keys(rows).forEach(c => { m[c] = {}; rows[c].forEach(r => { if (r.id) m[c][r.id] = canon(r); }); }); return m; }

/* ---------- Cola de cambios ---------- */
const opId = o => o.row ? o.row.id : o.id;
function enqueue(op) {
  const i = sync.pending.findIndex(o => o.c === op.c && opId(o) === opId(op)); if (i >= 0) sync.pending.splice(i, 1);
  op.seq = ++sync.seq; sync.pending.push(op);
}
/** Compara el estado actual con lo último conocido y encola solo lo que cambió. Lo llama save(). */
function queueDiff() {
  if (!sheetsOn() || sync.applying) return;
  const rows = toRows(state), now = rowsToMap(rows);
  if (!sync.baseline) { sync.baseline = now; return; }
  Object.keys(now).forEach(c => {
    const prev = sync.baseline[c] || {};
    rows[c].forEach(r => { if (r.id && prev[r.id] !== now[c][r.id]) enqueue({ c, op: "upsert", row: r }); });
    Object.keys(prev).forEach(id => { if (!(id in now[c])) enqueue({ c, op: "delete", id }); });
  });
  sync.baseline = now; persistQueue(); renderSync(); scheduleFlush();
}
let flushTimer = null;
function scheduleFlush(ms = 700) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, ms); }
function setSync(status, detail) { sync.status = status; sync.error = status === "ok" ? "" : (detail || sync.error); renderSync(); }

async function api(action, payload = {}) {
  const conf = sheetsConf(); if (!conf) throw new Error("No hay una conexión configurada.");
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(conf.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ token: conf.token, action, ...payload }), signal: ctrl.signal });
    let json; try { json = await res.json(); } catch { throw new Error("El servidor no devolvió datos. Verifica que la aplicación web esté publicada con acceso para «Cualquier persona»."); }
    if (!json || !json.ok) throw new Error((json && json.error) || "Respuesta inesperada del servidor.");
    return json;
  } catch (e) { throw e.name === "AbortError" ? new Error("Tiempo de espera agotado.") : e; }
  finally { clearTimeout(timer); }
}
async function flush() {
  if (!sheetsOn() || sync.busy || !sync.pending.length) return;
  sync.busy = true; setSync("syncing");
  const batch = sync.pending.slice(0, 250);
  try {
    const r = await api("sync", { ops: batch.map(({ c, op, row, id }) => ({ c, op, row, id })), actor: sessionId });
    const sent = new Set(batch.map(o => o.seq)); sync.pending = sync.pending.filter(o => !sent.has(o.seq)); persistQueue();
    if (r.prev === sync.version) sync.version = r.version;   // si otra persona escribió en medio, se conserva la versión vieja para recargar luego
    sync.last = new Date(); sync.busy = false; setSync("ok");
    if (sync.pending.length) scheduleFlush(50);
  } catch (e) { sync.busy = false; setSync(isNetErr(e) ? "offline" : "error", e.message); scheduleFlush(15000); }
}
async function flushAll() {
  while (sheetsOn() && sync.pending.length) {
    if (sync.busy) { await sleep(100); continue; }
    await flush(); if (sync.status !== "ok") throw new Error(sync.error || "No se pudo enviar los datos.");
  }
}

/* ---------- Lectura desde la hoja ---------- */
async function pollOnce(force = false) {
  if (!sheetsOn() || sync.busy) return;
  if (sync.pending.length) return flush();
  try {
    const r = await api("ping");
    if (force || r.version !== sync.version) await loadRemote(); else { sync.last = new Date(); setSync("ok"); }
  } catch (e) { setSync(isNetErr(e) ? "offline" : "error", e.message); }
}
async function loadRemote() {
  const r = await api("load");
  if (sync.pending.length) return;   // mientras tanto hubo cambios locales: se envían primero
  if (r.empty) { sync.empty = true; sync.version = r.version; sync.last = new Date(); setSync("ok"); onEmpty(); return; }
  sync.empty = false;
  if (document.querySelector("dialog[open]")) { sync.deferred = r; return; }   // no interrumpir mientras alguien edita
  applyRemote(r);
}
function applyRemote(r) {
  sync.applying = true;
  const rs = fromSheets(r.data);
  state = normalize({ ...rs, settings: { ...state.settings, routineDays: rs.settings.routineDays }, ui: state.ui });
  sync.baseline = rowsToMap(toRows(state)); sync.version = r.version; sync.last = new Date(); sync.applying = false;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ }
  setSync("ok");
  if (isLoggedIn()) render(); else if (!userById(sessionId) && sessionId) logout(); else renderDemoIds();
}
document.addEventListener("close", () => {
  if (sync.deferred && !document.querySelector("dialog[open]")) { const r = sync.deferred; sync.deferred = null; if (!sync.pending.length) applyRemote(r); }
}, true);

let pollTimer = null;
function startSync() {
  if (!sheetsOn()) return Promise.resolve();
  sync.baseline = rowsToMap(toRows(state)); renderSync();
  clearInterval(pollTimer); pollTimer = setInterval(() => { if (document.visibilityState === "visible") pollOnce(); }, 30000);
  return pollOnce(true);
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pollOnce(); });
window.addEventListener("online", () => pollOnce());

/* ---------- Conexión y carga inicial ---------- */
async function connectSheets(url, token) {
  url = String(url || "").trim(); token = String(token || "").trim();
  if (!URL_RE.test(url)) throw new Error("La URL debe ser la de la aplicación web: empieza con https://script.google.com/macros/s/ y termina en /exec.");
  if (!token) throw new Error("Escribe la clave de acceso.");
  const prev = localStorage.getItem(SHEETS_KEY);
  localStorage.setItem(SHEETS_KEY, JSON.stringify({ url, token }));
  try { await api("ping"); } catch (e) { prev ? localStorage.setItem(SHEETS_KEY, prev) : localStorage.removeItem(SHEETS_KEY); throw e; }
  sync.pending = []; sync.version = null; persistQueue();
  await startSync();
  return { empty: sync.empty };
}
async function uploadAll() {
  const rows = toRows(state); sync.baseline = rowsToMap(rows);
  Object.keys(rows).forEach(c => rows[c].forEach(r => enqueue({ c, op: "upsert", row: r })));
  persistQueue(); renderSync(); await flushAll();
  sync.version = (await api("ping")).version;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ }
}
function emptyData({ name, id, dept, role }) {
  const departmentId = dept ? slug(dept) : "";
  return normalize({ users: [{ id, login: id, name, role, departmentId, supervisorId: null, admin: true }], departments: dept ? [{ id: departmentId, name: dept }] : [], projects: [], tasks: [], checks: {}, catalog: [], messages: [], activity: [], settings: { ...state.settings }, ui: state.ui });
}
function showInit() { $("#loginForm").hidden = true; $("#initCard").hidden = false; $("#inName").focus(); }
function hideInit() { $("#initCard").hidden = true; $("#loginForm").hidden = false; }
function onEmpty() {
  if (!isLoggedIn()) showInit(); else toast("La hoja de Google está vacía. Usa «Subir datos de este navegador» para llenarla.");
}

/* ---------- Estado visible ---------- */
function renderSync() {
  const pill = $("#syncPill"), on = sheetsOn(), n = sync.pending.length, st = on ? sync.status : "off";
  pill.hidden = !on; pill.dataset.state = st;
  const text = st === "syncing" ? "Sincronizando…" : st === "offline" ? (n ? `Sin conexión, ${plural(n, "cambio pendiente", "cambios pendientes")}` : "Sin conexión") : st === "error" ? "Error de sincronización" : n ? `Guardando ${n}…` : "Sincronizado";
  $("#syncText").textContent = text;
  pill.title = sync.error || (sync.last ? `Última sincronización: ${sync.last.toLocaleTimeString("es-DO")}` : "Toca para sincronizar");
  const b = $("#sheetsBadge"); if (b) { b.dataset.state = st; b.textContent = !on ? "Solo local" : st === "ok" ? "Conectado" : st === "syncing" ? "Sincronizando…" : st === "offline" ? "Sin conexión" : st === "error" ? "Con errores" : "Conectando…"; }
}
function renderSheetsPanel() {
  const c = sheetsConf(); if (!$("#shUrl")) return;
  $("#shUrl").value = c?.url || ""; $("#shToken").value = c?.token || "";
  $('[data-action="sheets:upload"]').hidden = !currentUser().admin || !c;
  $('[data-action="sheets:disconnect"]').hidden = !c; $('#sheetsPanel [data-action="sync:now"]').hidden = !c;
  $("#shInfo").textContent = c ? (sync.error ? `Último error: ${sync.error}` : "Los cambios se guardan en tu hoja de Google y se actualizan solos cada 30 segundos.") : "Sin conexión: los datos se guardan solo en este navegador. Pega la URL y la clave de tu servidor de Google Apps Script.";
  renderSync();
}
function renderLoginConn() {
  const c = sheetsConf(); $("#lcUrl").value = c?.url || ""; $("#lcToken").value = c?.token || ""; $("#loginConn").open = !c;
  $("#lcInfo").textContent = c ? "Conectado a Google Sheets." : "Sin conexión: los datos se guardan solo en este navegador.";
}

/* ---------- Acciones ---------- */
Object.assign(Actions, {
  "sync:now": async () => {
    if (!sheetsOn()) return toast("No hay una hoja de Google conectada.");
    await pollOnce(true); toast(sync.status === "ok" ? "Datos sincronizados con Google Sheets." : `No se pudo sincronizar: ${sync.error || "sin conexión"}.`);
  },
  "sheets:connect": async el => {
    el.classList.add("is-loading");
    try { const r = await connectSheets($("#shUrl").value, $("#shToken").value); renderSheetsPanel(); render(); toast(r.empty ? "Conectado. La hoja está vacía: usa «Subir datos de este navegador»." : "Conectado. Datos cargados desde Google Sheets."); }
    catch (e) { toast(e.message); } finally { el.classList.remove("is-loading"); }
  },
  "sheets:connect-login": async el => {
    el.classList.add("is-loading"); const info = $("#lcInfo");
    try { const r = await connectSheets($("#lcUrl").value, $("#lcToken").value); info.textContent = r.empty ? "Conectado. La hoja está vacía." : "Conectado a Google Sheets."; if (!r.empty) { hideInit(); renderDemoIds(); } }
    catch (e) { info.textContent = e.message; } finally { el.classList.remove("is-loading"); }
  },
  "sheets:disconnect": () => {
    const n = sync.pending.length;
    if (!confirm(`¿Desconectar la hoja de Google? Los datos seguirán guardados en este navegador.${n ? ` Hay ${plural(n, "cambio sin enviar", "cambios sin enviar")} que se perderán.` : ""}`)) return;
    localStorage.removeItem(SHEETS_KEY); sync.pending = []; sync.baseline = null; sync.status = "off"; clearInterval(pollTimer); persistQueue(); renderSheetsPanel(); toast("Hoja de Google desconectada.");
  },
  "sheets:upload": async el => {
    if (!currentUser().admin) return;
    if (!confirm("Se enviarán a Google Sheets todos los datos de este navegador. Los registros con el mismo ID se sobrescriben en la hoja. ¿Continuar?")) return;
    el.classList.add("is-loading");
    try { await uploadAll(); sync.empty = false; toast("Datos subidos a Google Sheets."); } catch (e) { toast(`No se pudieron subir los datos: ${e.message}`); } finally { el.classList.remove("is-loading"); }
  },
  "init:demo": async () => {
    try { state = seedData(); await uploadAll(); sync.empty = false; hideInit(); renderDemoIds(); toast("Datos de demostración cargados. Entra con el ID manuel."); }
    catch (e) { const err = $("#inError"); err.textContent = e.message; err.hidden = false; }
  },
  "init:admin": async () => {
    const name = $("#inName").value.trim(), id = $("#inLogin").value.trim().toLowerCase().replace(/^@/, ""), err = $("#inError");
    const fail = m => { err.textContent = m; err.hidden = false; };
    if (!name) return fail("Escribe tu nombre completo.");
    if (!LOGIN_RE.test(id)) return fail("El ID debe tener de 3 a 24 caracteres: letras, números, punto, guion o guion bajo.");
    err.hidden = true;
    try { state = emptyData({ name, id, dept: $("#inDept").value.trim().replace(/\s+/g, " "), role: $("#inRole").value.trim() }); await uploadAll(); sync.empty = false; hideInit(); await login(id); }
    catch (e) { fail(e.message); }
  }
});
["#lcUrl", "#lcToken"].forEach(s => $(s).addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $('[data-action="sheets:connect-login"]').click(); } }));

/* ============================================================
   9. ARRANQUE
   ============================================================ */
function hydrateIcons(root = document) { $$("i[data-i]", root).forEach(el => { if (!el.firstElementChild) el.innerHTML = ic(el.dataset.i); }); }

/* Filtros de la página de tareas */
$("#taskSearch").addEventListener("input", e => { filters.q = e.target.value; renderTasks(); });
[["fStatus", "status"], ["fPriority", "priority"], ["fProject", "project"], ["fAssignee", "assignee"], ["fDept", "dept"], ["fSort", "sort"]].forEach(([id, key]) => $("#" + id).addEventListener("change", e => { filters[key] = e.target.value; renderTasks(); }));

/* Chat */
$("#chatForm").addEventListener("submit", e => {
  e.preventDefault(); const input = $("#chatInput"), text = input.value.trim(); if (!text) return;
  state.messages.push({ id: uid("m"), author: currentUser().name, authorId: currentUser().id, text, time: new Date().toISOString(), mine: true });
  state.messages = state.messages.slice(-300); state.ui.chatSeen = new Date().toISOString(); save(); renderChat(); input.value = "";
});

/* Archivos */
$("#fileInput").addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; });
$("#fileSearch").addEventListener("input", renderFiles);
const drop = $("#fileDrop");
["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); drop.classList.add("over"); } }));
["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove("over")));
drop.addEventListener("drop", e => { if (e.dataTransfer?.files?.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } });
/* Evita que soltar un archivo fuera de la zona abra el archivo en el navegador */
["dragover", "drop"].forEach(ev => window.addEventListener(ev, e => { if (e.dataTransfer?.types?.includes("Files") && !drop.contains(e.target)) e.preventDefault(); }));

/* Importar respaldo */
$("#importFile").addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value = ""; if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    if (!Array.isArray(raw.tasks) || !Array.isArray(raw.projects)) throw new Error("formato");
    if (!confirm(`Se reemplazarán los datos actuales por el respaldo (${plural(raw.tasks.length, "tarea", "tareas")}, ${plural(raw.projects.length, "proyecto", "proyectos")}).${sheetsOn() ? " La hoja de Google conectada también se actualizará y se borrará lo que no esté en el respaldo." : ""} ¿Continuar?`)) return;
    state = normalize(raw); save(); navigate("Inicio"); toast("Respaldo importado correctamente.");
  } catch { toast("El archivo no es un respaldo válido de MYA."); }
});

/* Deshacer desde el aviso */
$("#toastUndo").addEventListener("click", () => { const fn = undoFn; undoFn = null; $("#toast").classList.remove("show"); if (fn) fn(); });

/* Tema del sistema en vivo */
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (state.settings.theme === "system") applyTheme(); });

$("#todayDate").textContent = new Date().toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long" });
hydrateIcons();
if (isLoggedIn()) navigate(decodeURIComponent(location.hash.slice(1)) || "Inicio"); else showLogin();
startSync();
