// ══════════════════════════════════════════════
// ENTRAR AL APP
// ══════════════════════════════════════════════
function setupCurrentUser(userData) {
  const prefs = loadUserPrefs();
  currentUser = userData;
  if (prefs.displayName) currentUser.name  = prefs.displayName;
  if (prefs.photoData)   currentUser.photo = prefs.photoData;
}

function entrarAlApp() {
  if (!currentGymId) return;
  ocultarTodas();
  document.getElementById('app').style.display = 'flex';
  const prefs = loadUserPrefs();
  if (prefs.themeColor) applyThemeColor(prefs.themeColor, false);
  updateGymNameUI(gymConfig.nombre || currentGymId);
  updateTopbarAvatar();
  actualizarPlanIndicator();
  checkNotifPermission();
  suscribirseAlGym();
  setTimeout(checkSuscripcion, 1500);
}

// ══════════════════════════════════════════════
// LISTENERS FIREBASE
// ══════════════════════════════════════════════
function suscribirseAlGym() {
  limpiarListenersGym();

  const refConfig = db.ref(`gyms/${currentGymId}/config`);
  refConfig.on('value', snap => {
    if (snap.val()) gymConfig = { planes: [], ...snap.val() };
    updateGymNameUI(gymConfig.nombre || currentGymId);
    cargarPlanesEnSelect();
    if (document.getElementById('pane-config').classList.contains('active')) renderConfig();
  });
  gymDbListeners.push({ ref: refConfig, event: 'value' });

  const refClientes = db.ref(`gyms/${currentGymId}/clientes`);
  refClientes.on('value', snap => {
    clientes = snap.val() || {};
    renderClientes();
    renderStats();
    renderAlertas();
  });
  gymDbListeners.push({ ref: refClientes, event: 'value' });

  const refPagos = db.ref(`gyms/${currentGymId}/pagos`);
  refPagos.on('value', snap => {
    pagos = snap.val() || {};
    if (document.getElementById('pane-caja').classList.contains('active')) renderCaja();
  });
  gymDbListeners.push({ ref: refPagos, event: 'value' });
}

function limpiarListenersGym() {
  gymDbListeners.forEach(({ ref, event }) => ref.off(event));
  gymDbListeners = [];
  clientes = {}; pagos = {}; gymConfig = {};
}

// ══════════════════════════════════════════════
// TEMA Y PREFERENCIAS
// ══════════════════════════════════════════════
window.applyThemeColor = function(hex, preview) {
  document.documentElement.style.setProperty('--gold',  hex);
  document.documentElement.style.setProperty('--gold2', hex);
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const dk = v => Math.max(0,Math.min(255,Math.round(v*.75))).toString(16).padStart(2,'0');
  document.documentElement.style.setProperty('--gold-dark', `#${dk(r)}${dk(g)}${dk(b)}`);
  const picker  = document.getElementById('custom-color-picker');
  const hexDisp = document.getElementById('color-hex-display');
  if (picker)  picker.value = hex;
  if (hexDisp) hexDisp.textContent = hex.toUpperCase();
  document.querySelectorAll('.color-preset').forEach(b => b.classList.toggle('active', b.dataset.color === hex));
};

window.selectColorPreset = hex => applyThemeColor(hex, true);

function loadUserPrefs() {
  try { return JSON.parse(localStorage.getItem('gymUserPrefs') || '{}'); } catch(e) { return {}; }
}
function saveUserPrefs(prefs) { localStorage.setItem('gymUserPrefs', JSON.stringify(prefs)); }

function updateGymNameUI(nombre) {
  const n     = (nombre || 'GYM').toUpperCase();
  const short = n.length > 14 ? n.slice(0,14)+'…' : n;
  const el    = document.getElementById('login-emblem-text');
  const top   = document.getElementById('topbar-logo-text');
  const sub   = document.getElementById('login-sub-text');
  if (el)  el.textContent  = n;
  if (top) top.textContent = short;
  if (sub) sub.textContent = 'Panel de Control';
  document.title = n + ' — GymPanel';
}

function actualizarPlanIndicator() {
  const el = document.getElementById('plan-indicator');
  if (!el) return;
  const plan = gymConfig.plan || 'free';
  el.textContent = plan.toUpperCase();
  el.className = 'plan-indicator plan-' + plan;
}

// ══════════════════════════════════════════════
// TOPBAR AVATAR / MENÚ
// ══════════════════════════════════════════════
function updateTopbarAvatar() {
  if (!currentUser) return;
  const img      = document.getElementById('topbar-avatar-img');
  const initials = document.getElementById('topbar-avatar-initials');
  if (currentUser.photo) {
    img.src = currentUser.photo; img.style.display = 'block'; initials.style.display = 'none';
  } else {
    img.style.display = 'none';
    initials.textContent = (currentUser.name||'?').split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase();
    initials.style.display = 'flex';
  }
  const menuName  = document.getElementById('menu-user-name');
  const menuEmail = document.getElementById('menu-user-email');
  const menuGymId = document.getElementById('menu-gym-id');
  const menuAvt   = document.getElementById('menu-avatar-wrap');
  if (menuName)  menuName.textContent  = currentUser.name;
  if (menuEmail) menuEmail.textContent = currentUser.email || 'Acceso local';
  if (menuGymId) menuGymId.textContent = '🏋️ @' + currentGymId;
  if (menuAvt) {
    menuAvt.innerHTML = currentUser.photo
      ? `<img src="${currentUser.photo}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;">`
      : (currentUser.name||'?').split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase();
  }
  const pill = document.getElementById('topbar-gymid');
  if (pill) pill.textContent = '@' + currentGymId;
}

window.toggleUserMenu = function() {
  const menu = document.getElementById('user-menu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
};

document.addEventListener('click', e => {
  const menu   = document.getElementById('user-menu');
  const avatar = document.getElementById('topbar-avatar');
  if (menu && !menu.contains(e.target) && avatar && !avatar.contains(e.target)) menu.style.display = 'none';
});

window.irAConfigUsuario = function() { document.getElementById('user-menu').style.display = 'none'; abrirModalUserConfig(); };

window.copiarLinkGym = function() {
  const url = `${window.location.origin}${window.location.pathname}?gym=${currentGymId}`;
  navigator.clipboard.writeText(url)
    .then(() => showToast('🔗 Link copiado al portapapeles', 'green'))
    .catch(() => prompt('Copia este link:', url));
  document.getElementById('user-menu').style.display = 'none';
};

// ══════════════════════════════════════════════
// MODAL CONFIG USUARIO
// ══════════════════════════════════════════════
window.abrirModalUserConfig = function() {
  const prefs = loadUserPrefs();
  document.getElementById('user-display-name').value = currentUser ? currentUser.name : '';
  updateAvatarPreview();
  applyThemeColor(prefs.themeColor || '#D4AF37', false);
  document.getElementById('modal-user-config').classList.add('open');
};

function updateAvatarPreview() {
  const preview = document.getElementById('avatar-preview');
  if (!preview) return;
  if (currentUser && currentUser.photo) {
    preview.innerHTML = `<img src="${currentUser.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    preview.textContent = currentUser ? (currentUser.name||'?').split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase() : '?';
  }
}

window.handleAvatarChange = function(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { if (currentUser) currentUser.photo = e.target.result; updateAvatarPreview(); };
  reader.readAsDataURL(file);
};

window.cerrarModalUserConfig = () => document.getElementById('modal-user-config').classList.remove('open');

window.guardarConfigUsuario = function() {
  const name       = document.getElementById('user-display-name').value.trim();
  const themeColor = document.getElementById('custom-color-picker').value;
  const prefs = loadUserPrefs();
  if (name) { prefs.displayName = name; if (currentUser) currentUser.name = name; }
  prefs.themeColor = themeColor;
  if (currentUser && currentUser.photo) prefs.photoData = currentUser.photo;
  saveUserPrefs(prefs);
  applyThemeColor(themeColor, false);
  updateTopbarAvatar();
  cerrarModalUserConfig();
  showToast('✅ Perfil guardado', 'green');
};

// ══════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const pane = document.getElementById('pane-' + t.dataset.tab);
    if (pane) pane.classList.add('active');
    if (t.dataset.tab === 'stats')   renderStats();
    if (t.dataset.tab === 'alertas') renderAlertas();
    if (t.dataset.tab === 'config')  renderConfig();
    if (t.dataset.tab === 'caja')    renderCaja();
  });
});

// ══════════════════════════════════════════════
// PLANES EN SELECT
// ══════════════════════════════════════════════
function cargarPlanesEnSelect() {
  const sel = document.getElementById('f-plan');
  if (!sel) return;
  const planes = gymConfig.planes || [];
  if (!planes.length) {
    sel.innerHTML = '<option value="">Cargando planes…</option>';
    setTimeout(() => {
      if ((gymConfig.planes || []).length) {
        cargarPlanesEnSelect();
      } else if (currentGymId) {
        db.ref(`gyms/${currentGymId}/config/planes`).once('value').then(snap => {
          const p = snap.val();
          if (p && p.length) { gymConfig.planes = p; cargarPlanesEnSelect(); }
          else sel.innerHTML = '<option value="">Sin planes — ve a Configuración</option>';
        });
      }
    }, 600);
    return;
  }
  const currentVal = sel.value;
  sel.innerHTML = planes.map(p =>
    `<option value="${p.nombre}">${p.nombre} — ${fmtCOP(p.precio)}</option>`
  ).join('');
  if (currentVal && planes.find(p => p.nombre === currentVal)) sel.value = currentVal;
}

window.onPlanChange = function() {
  const planNombre = document.getElementById('f-plan').value;
  const plan = (gymConfig.planes||[]).find(p => p.nombre === planNombre);
  if (plan) document.getElementById('f-valor').value = plan.precio;
  autoGuardar();
};

// ══════════════════════════════════════════════
// NOTIFICACIONES WEB
// ══════════════════════════════════════════════
function checkNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') document.getElementById('btn-notif-perm').style.display = 'block';
}
document.getElementById('btn-notif-perm').addEventListener('click', () => {
  Notification.requestPermission().then(p => {
    if (p === 'granted') {
      document.getElementById('btn-notif-perm').style.display = 'none';
      new Notification('GymPanel 🏋️', { body: '¡Notificaciones activadas!' });
    }
  });
});
window.pedirNotifPermiso = function() {
  if (!('Notification' in window)) { alert('Tu navegador no soporta notificaciones'); return; }
  Notification.requestPermission().then(p => alert(p === 'granted' ? '✅ ¡Notificaciones activadas!' : '❌ Permiso denegado'));
};

// Cerrar modales al hacer click fuera
document.getElementById('modal-detalle').addEventListener('click',     function(e) { if(e.target===this) this.classList.remove('open'); });
document.getElementById('modal-cliente').addEventListener('click',     function(e) { if(e.target===this) cerrarModalCliente(); });
document.getElementById('modal-user-config').addEventListener('click', function(e) { if(e.target===this) cerrarModalUserConfig(); });
document.getElementById('modal-renovar').addEventListener('click',     function(e) { if(e.target===this) cerrarModalRenovar(); });
