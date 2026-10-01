// ══════════════════════════════════════════════
// FIREBASE CONFIG
// ══════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyAtcKvb3NVnEOFWYb9IA9jUwIaBM7k1UnI",
  authDomain: "gimnasio-63b33.firebaseapp.com",
  databaseURL: "https://gimnasio-63b33-default-rtdb.firebaseio.com",
  projectId: "gimnasio-63b33",
  storageBucket: "gimnasio-63b33.firebasestorage.app",
  messagingSenderId: "766168910207",
  appId: "1:766168910207:web:2bf804443273e38cd1724a",
  measurementId: "G-LVGLFEBE9W"
};
firebase.initializeApp(firebaseConfig);
const db  = firebase.database();
const auth = firebase.auth();

// ══════════════════════════════════════════════
// SUPERADMIN CONFIG
// Solo las cuentas de Google en esta lista pueden entrar al Panel
// SuperAdmin. Reemplaza el correo de ejemplo por tu(s) Gmail real(es).
// IMPORTANTE: esto solo oculta/filtra el acceso desde la interfaz.
// Para una seguridad real, configura también las Reglas de seguridad
// de Firebase Realtime Database para que solo estos UID/emails puedan
// leer y escribir en el nodo raíz "gyms".
// ══════════════════════════════════════════════
const SUPERADMIN_EMAILS = [
  'tu-correo@gmail.com'
];

// ══════════════════════════════════════════════
// ESTADO GLOBAL
// ══════════════════════════════════════════════
let currentGymId        = null;
let gymConfig           = {};
let clientes            = {};
let pagos               = {};
let filtroActual        = 'todos';
let clienteEditandoId   = null;
let clienteRenovandoId  = null;
let autoGuardarTimer    = null;
let chartMesInst        = null;
let currentUser         = null;
let gymDbListeners      = [];

// ══════════════════════════════════════════════
// HELPERS URL
// ══════════════════════════════════════════════
function getGymIdFromURL() {
  return new URLSearchParams(window.location.search).get('gym') || null;
}

function setGymIdInURL(gymId) {
  const url = new URL(window.location);
  if (gymId) url.searchParams.set('gym', gymId);
  else        url.searchParams.delete('gym');
  window.history.replaceState({}, '', url);
}

// ══════════════════════════════════════════════
// HELPERS GENERALES
// ══════════════════════════════════════════════
function getFechaHoy() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

function getEstado(c) {
  if (!c.fechaPago) return 'activo';
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const vence = new Date(c.fechaPago + 'T00:00:00');
  const diff = Math.round((vence - hoy) / 86400000);
  if (diff < 0) return 'vencido';
  if (diff <= 3) return 'por-vencer';
  return 'activo';
}

function diasRestantes(c) {
  if (!c.fechaPago) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const vence = new Date(c.fechaPago + 'T00:00:00');
  return Math.round((vence - hoy) / 86400000);
}

function calcFechaPago(inicio, plan) {
  const p = (gymConfig.planes || []).find(x => x.nombre === plan);
  if (!p || !inicio) return '';
  const d = new Date(inicio + 'T00:00:00');
  d.setDate(d.getDate() + p.dias);
  return d.toISOString().split('T')[0];
}

function fmtCOP(v) {
  if (!v) return '—';
  if (v >= 1000000) return '$' + (v/1000000).toFixed(1) + 'M';
  if (v >= 1000)    return '$' + Math.round(v/1000) + 'K';
  return '$' + Math.round(v);
}

function fmtFecha(f) {
  if (!f) return '—';
  const [y,m,d] = f.split('-');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`;
}

function iniciales(nombre) {
  return (nombre||'?').split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase();
}

function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show toast-' + (type||'info');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}
