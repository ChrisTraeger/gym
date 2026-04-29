(function () {

  // ── FIREBASE CONFIG ──
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
  const db = firebase.database();
  const auth = firebase.auth();

  // ── ESTADO ──
  let CREDS = { user: 'admin', pass: '1234' };
  let gymConfig = {
    nombre: 'MI GYM',
    telefono: '3001234567',
    planes: [
      { nombre: 'Mensual', dias: 30, precio: 80000 },
      { nombre: 'Quincenal', dias: 15, precio: 50000 },
      { nombre: 'Trimestral', dias: 90, precio: 220000 }
    ]
  };
  let clientes = {};
  let filtroActual = 'todos';
  let clienteEditandoId = null;
  let clienteRenovandoId = null;
  let autoGuardarTimer = null;
  let chartMesInst = null;
  let currentUser = null; // { name, email, photo, uid, loginType }

  // ── TEMA / COLOR ──
  function applyThemeColor(hex, preview) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    // Generar variante más oscura
    const darken = (v, f) => Math.max(0, Math.min(255, Math.round(v * f)));
    const dark = `#${darken(r,.75).toString(16).padStart(2,'0')}${darken(g,.75).toString(16).padStart(2,'0')}${darken(b,.75).toString(16).padStart(2,'0')}`;
    const light = `rgba(${r},${g},${b},0.15)`;
    document.documentElement.style.setProperty('--gold', hex);
    document.documentElement.style.setProperty('--gold2', hex);
    document.documentElement.style.setProperty('--gold-dark', dark);
    // Actualiza picker y hex display si existen
    const picker = document.getElementById('custom-color-picker');
    const hexDisp = document.getElementById('color-hex-display');
    if (picker) picker.value = hex;
    if (hexDisp) hexDisp.textContent = hex.toUpperCase();
    // Marca preset activo
    document.querySelectorAll('.color-preset').forEach(b => {
      b.classList.toggle('active', b.dataset.color === hex);
    });
  }
  window.applyThemeColor = applyThemeColor;

  window.selectColorPreset = function(hex, btn) {
    applyThemeColor(hex, true);
  };

  function loadUserPrefs() {
    try {
      const prefs = JSON.parse(localStorage.getItem('gymUserPrefs') || '{}');
      if (prefs.themeColor) applyThemeColor(prefs.themeColor, false);
      return prefs;
    } catch(e) { return {}; }
  }

  function saveUserPrefs(prefs) {
    localStorage.setItem('gymUserPrefs', JSON.stringify(prefs));
  }

  // Cargar prefs al inicio
  loadUserPrefs();

  // ── LOGIN TABS ──
  window.switchLoginTab = function(tab) {
    document.querySelectorAll('.login-tab').forEach((t,i) => t.classList.toggle('active', (i===0&&tab==='manual')||(i===1&&tab==='google')));
    document.getElementById('tab-manual').style.display = tab === 'manual' ? 'block' : 'none';
    document.getElementById('tab-google').style.display = tab === 'google' ? 'block' : 'none';
  };

  // ── ACTUALIZAR NOMBRE GYM EN TODA LA UI ──
  function updateGymNameUI(nombre) {
    const n = (nombre || 'GYM').toUpperCase();
    const short = n.length > 12 ? n.slice(0, 12) + '…' : n;
    const el = document.getElementById('login-emblem-text');
    const topbar = document.getElementById('topbar-logo-text');
    const sub = document.getElementById('login-sub-text');
    if (el) el.textContent = n;
    if (topbar) topbar.textContent = short;
    if (sub) sub.textContent = 'Panel de Control — ' + n;
    document.title = n + ' — Panel de Control';
  }

  // Preview en tiempo real desde el input de setup
  window.previewGymName = function(val) {
    updateGymNameUI(val || 'GYM');
    // Guardar en localStorage inmediatamente para persistir
    try {
      const prefs = JSON.parse(localStorage.getItem('gymUserPrefs') || '{}');
      prefs.gymNombreLocal = val;
      localStorage.setItem('gymUserPrefs', JSON.stringify(prefs));
    } catch(e) {}
  };

  // Selección de color desde setup del login
  window.selectSetupColor = function(hex, btn, isCustom) {
    applyThemeColor(hex, true);
    // Marcar activo
    document.querySelectorAll('.pal-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    // Guardar en prefs locales para persistir en la sesión
    try {
      const prefs = JSON.parse(localStorage.getItem('gymUserPrefs') || '{}');
      prefs.themeColor = hex;
      localStorage.setItem('gymUserPrefs', JSON.stringify(prefs));
    } catch(e) {}
  };

  // Inicializar el setup card con valores guardados
  (function initSetupCard() {
    try {
      const prefs = JSON.parse(localStorage.getItem('gymUserPrefs') || '{}');
      if (prefs.gymNombreLocal) {
        const inp = document.getElementById('setup-gym-name');
        if (inp) inp.value = prefs.gymNombreLocal;
        updateGymNameUI(prefs.gymNombreLocal);
      }
      if (prefs.themeColor) {
        // Marcar preset activo en setup palette
        document.querySelectorAll('.pal-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.color === prefs.themeColor);
        });
      }
    } catch(e) {}
  })();

  // ── FIREBASE LISTENERS ──
  db.ref('gymConfig').on('value', snap => {
    const v = snap.val();
    if (v) gymConfig = { ...gymConfig, ...v };
    // Si el gym tiene nombre en Firebase, actualizamos la UI (pero respetando lo del input de setup si está activo)
    const setupInput = document.getElementById('setup-gym-name');
    const localName = setupInput && setupInput.value.trim();
    updateGymNameUI(localName || gymConfig.nombre || 'GYM');
    cargarPlanesEnSelect();
    if (document.getElementById('pane-config').classList.contains('active')) renderConfig();
  });

  db.ref('clientes').on('value', snap => {
    clientes = snap.val() || {};
    renderClientes();
    renderStats();
    renderAlertas();
  });

  db.ref('gymCreds').once('value', snap => {
    const v = snap.val();
    if (v) CREDS = v;
  });

  // ── AUTH STATE ──
  auth.onAuthStateChanged(user => {
    if (user) {
      // Viene de Google Sign-In
      currentUser = {
        name: user.displayName || 'Usuario',
        email: user.email || '',
        photo: user.photoURL || '',
        uid: user.uid,
        loginType: 'google'
      };
      // Mezcla con prefs guardadas localmente
      const prefs = loadUserPrefs();
      if (prefs.displayName) currentUser.name = prefs.displayName;
      if (prefs.photoData) currentUser.photo = prefs.photoData;
      entrarAlApp();
    }
  });

  // ── LOGIN MANUAL ──
  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('inp-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  function doLogin() {
    const u = document.getElementById('inp-user').value.trim();
    const p = document.getElementById('inp-pass').value;
    if (u === CREDS.user && p === CREDS.pass) {
      const prefs = loadUserPrefs();
      currentUser = {
        name: prefs.displayName || u,
        email: '',
        photo: prefs.photoData || '',
        uid: 'manual_' + u,
        loginType: 'manual'
      };
      entrarAlApp();
    } else {
      const err = document.getElementById('login-err');
      err.classList.add('show');
      setTimeout(() => err.classList.remove('show'), 3000);
    }
  }

  // ── LOGIN GOOGLE ──
  document.getElementById('btn-google-login').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
      alert('Error al iniciar sesión con Google: ' + err.message);
    });
  });

  // ── ENTRAR AL APP ──
  function entrarAlApp() {
    // Si el usuario escribió un nombre en el setup, guardarlo en Firebase
    const setupInput = document.getElementById('setup-gym-name');
    const localName = setupInput && setupInput.value.trim();
    if (localName && localName !== gymConfig.nombre) {
      gymConfig.nombre = localName;
      db.ref('gymConfig').update({ nombre: localName });
    }
    updateGymNameUI(localName || gymConfig.nombre || 'GYM');
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.add('visible');
    updateTopbarAvatar();
    checkNotifPermission();
    renderStats();
  }

  function updateTopbarAvatar() {
    if (!currentUser) return;
    const img = document.getElementById('topbar-avatar-img');
    const initials = document.getElementById('topbar-avatar-initials');
    if (currentUser.photo) {
      img.src = currentUser.photo;
      img.style.display = 'block';
      initials.style.display = 'none';
    } else {
      img.style.display = 'none';
      initials.textContent = (currentUser.name || '?').split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase();
      initials.style.display = 'flex';
    }
    // Menú
    const menuName = document.getElementById('menu-user-name');
    const menuEmail = document.getElementById('menu-user-email');
    const menuAvatar = document.getElementById('menu-avatar-wrap');
    if (menuName) menuName.textContent = currentUser.name;
    if (menuEmail) menuEmail.textContent = currentUser.email || (currentUser.loginType === 'manual' ? 'Acceso local' : '');
    if (menuAvatar) {
      if (currentUser.photo) {
        menuAvatar.innerHTML = `<img src="${currentUser.photo}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;">`;
      } else {
        menuAvatar.textContent = (currentUser.name||'?').split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase();
      }
    }
  }

  // ── MENÚ USUARIO ──
  window.toggleUserMenu = function() {
    const menu = document.getElementById('user-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  };

  document.addEventListener('click', e => {
    const menu = document.getElementById('user-menu');
    const avatar = document.getElementById('topbar-avatar');
    if (menu && !menu.contains(e.target) && !avatar.contains(e.target)) {
      menu.style.display = 'none';
    }
  });

  window.irAConfigUsuario = function() {
    document.getElementById('user-menu').style.display = 'none';
    abrirModalUserConfig();
  };

  // ── MODAL CONFIG USUARIO ──
  window.abrirModalUserConfig = function() {
    const prefs = loadUserPrefs();
    const themeColor = prefs.themeColor || '#D4AF37';

    // Nombre
    document.getElementById('user-display-name').value = currentUser ? currentUser.name : '';

    // Avatar preview
    updateAvatarPreview();

    // Color
    applyThemeColor(themeColor, false);

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
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const data = e.target.result;
      if (currentUser) currentUser.photo = data;
      updateAvatarPreview();
    };
    reader.readAsDataURL(file);
  };

  window.cerrarModalUserConfig = function() {
    document.getElementById('modal-user-config').classList.remove('open');
  };

  window.guardarConfigUsuario = function() {
    const name = document.getElementById('user-display-name').value.trim();
    const themeColor = document.getElementById('custom-color-picker').value;

    const prefs = loadUserPrefs();
    if (name) { prefs.displayName = name; if (currentUser) currentUser.name = name; }
    prefs.themeColor = themeColor;
    if (currentUser && currentUser.photo) prefs.photoData = currentUser.photo;

    saveUserPrefs(prefs);
    applyThemeColor(themeColor, false);
    // Sincronizar paleta del setup card en login
    document.querySelectorAll('.pal-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.color === themeColor);
    });
    const setupPicker = document.getElementById('setup-color-picker');
    if (setupPicker) setupPicker.value = themeColor;
    updateTopbarAvatar();
    cerrarModalUserConfig();
  };

  // ── LOGOUT ──
  window.doLogout = function() {
    auth.signOut().catch(()=>{});
    document.getElementById('app').classList.remove('visible');
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('inp-pass').value = '';
    document.getElementById('user-menu').style.display = 'none';
    currentUser = null;
  };

  document.getElementById('btn-logout').addEventListener('click', doLogout);

  // ── TABS ──
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const pane = document.getElementById('pane-' + t.dataset.tab);
      if (pane) pane.classList.add('active');
      if (t.dataset.tab === 'stats') renderStats();
      if (t.dataset.tab === 'alertas') renderAlertas();
      if (t.dataset.tab === 'config') renderConfig();
    });
  });

  // ── HELPERS ──
  function getFechaHoy() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }

  function getEstado(c) {
    if (!c.fechaPago) return 'activo';
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const vence = new Date(c.fechaPago + 'T00:00:00');
    const diff = Math.round((vence - hoy) / 86400000);
    if (diff < 0) return 'vencido';
    if (diff <= 3) return 'por-vencer';
    return 'activo';
  }

  function diasRestantes(c) {
    if (!c.fechaPago) return null;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const vence = new Date(c.fechaPago + 'T00:00:00');
    return Math.round((vence - hoy) / 86400000);
  }

  function calcFechaPago(inicio, plan) {
    const p = gymConfig.planes.find(x => x.nombre === plan);
    if (!p || !inicio) return '';
    const d = new Date(inicio + 'T00:00:00');
    d.setDate(d.getDate() + p.dias);
    return d.toISOString().split('T')[0];
  }

  function fmtCOP(v) {
    if (!v) return '—';
    if (v >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return '$' + Math.round(v / 1000) + 'K';
    return '$' + Math.round(v);
  }

  function fmtFecha(f) {
    if (!f) return '—';
    const [y, m, d] = f.split('-');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
  }

  function iniciales(nombre) {
    return (nombre || '?').split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  // ── PLANES EN SELECT ──
  function cargarPlanesEnSelect() {
    const sel = document.getElementById('f-plan');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = gymConfig.planes.map(p =>
      `<option value="${p.nombre}">${p.nombre} — ${fmtCOP(p.precio)}</option>`
    ).join('');
    if (currentVal) sel.value = currentVal;
  }

  window.onPlanChange = function () {
    const planNombre = document.getElementById('f-plan').value;
    const plan = gymConfig.planes.find(p => p.nombre === planNombre);
    if (plan) document.getElementById('f-valor').value = plan.precio;
    autoGuardar();
  };

  // ── GUARDADO EN TIEMPO REAL ──
  function setSaveStatus(estado, texto) {
    const ind = document.getElementById('save-indicator');
    const txt = document.getElementById('save-text');
    if (!ind || !txt) return;
    ind.className = 'save-indicator ' + estado;
    txt.textContent = texto;
  }

  window.autoGuardar = function () {
    const nombre = document.getElementById('f-nombre')?.value.trim();
    if (!nombre) { setSaveStatus('', 'Escribe el nombre para guardar'); return; }
    const plan = document.getElementById('f-plan')?.value;
    const inicio = document.getElementById('f-inicio')?.value;
    if (!plan || !inicio) { setSaveStatus('', 'Completa plan y fecha'); return; }
    setSaveStatus('saving', 'Guardando…');
    clearTimeout(autoGuardarTimer);
    autoGuardarTimer = setTimeout(() => { _ejecutarGuardado(false); }, 800);
  };

  window.guardarClienteManual = function () {
    clearTimeout(autoGuardarTimer);
    _ejecutarGuardado(true);
  };

  function _ejecutarGuardado(cerrar) {
    const nombre = document.getElementById('f-nombre').value.trim();
    const plan = document.getElementById('f-plan').value;
    const inicio = document.getElementById('f-inicio').value;
    if (!nombre || !plan || !inicio) {
      setSaveStatus('error', 'Faltan campos obligatorios');
      if (cerrar) alert('Nombre, plan y fecha son obligatorios');
      return;
    }
    const fechaPago = calcFechaPago(inicio, plan);
    const valorRaw = document.getElementById('f-valor').value.replace(/\D/g, '');
    const data = {
      nombre,
      cedula: document.getElementById('f-cedula').value.trim(),
      telefono: document.getElementById('f-tel').value.trim(),
      plan,
      valor: parseInt(valorRaw) || 0,
      fechaInicio: inicio,
      fechaPago,
      notas: document.getElementById('f-notas').value.trim(),
      registradoEn: Date.now()
    };
    if (clienteEditandoId && clientes[clienteEditandoId]?.registradoEn) {
      data.registradoEn = clientes[clienteEditandoId].registradoEn;
    }
    const id = clienteEditandoId || ('c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
    if (!clienteEditandoId) clienteEditandoId = id;
    db.ref('clientes/' + id).set(data)
      .then(() => {
        setSaveStatus('saved', '✓ Guardado');
        if (cerrar) cerrarModalCliente();
      })
      .catch(e => {
        setSaveStatus('error', 'Error al guardar');
        if (cerrar) alert('Error: ' + e.message);
      });
  }

  // ── MODAL CLIENTE ──
  window.abrirModalNuevo = function () {
    clienteEditandoId = null;
    document.getElementById('modal-titulo').textContent = 'NUEVO CLIENTE';
    document.getElementById('f-nombre').value = '';
    document.getElementById('f-cedula').value = '';
    document.getElementById('f-tel').value = '';
    document.getElementById('f-notas').value = '';
    document.getElementById('f-inicio').value = getFechaHoy();
    cargarPlanesEnSelect();
    const primerPlan = gymConfig.planes[0];
    if (primerPlan) document.getElementById('f-valor').value = primerPlan.precio;
    setSaveStatus('', 'Sin cambios');
    document.getElementById('modal-cliente').classList.add('open');
  };

  window.cerrarModalCliente = function () {
    clearTimeout(autoGuardarTimer);
    document.getElementById('modal-cliente').classList.remove('open');
  };

  // ── DETALLE CLIENTE ──
  window.verDetalle = function (id) {
    const c = clientes[id];
    if (!c) return;
    const est = getEstado(c);
    const dias = diasRestantes(c);
    const badgeClass = est === 'activo' ? 'badge-activo' : est === 'por-vencer' ? 'badge-vence' : 'badge-vencido';
    const badgeTxt = est === 'activo' ? '✅ Al día' : est === 'por-vencer' ? `⚠️ Vence en ${dias} días` : `❌ Venció hace ${Math.abs(dias)} días`;
    document.getElementById('detalle-content').innerHTML = `
      <div class="detalle-header">
        <div class="detalle-avatar">${iniciales(c.nombre)}</div>
        <div>
          <div class="detalle-nombre">${c.nombre}</div>
          <div class="detalle-plan"><span class="estado-badge ${badgeClass}">${badgeTxt}</span></div>
        </div>
      </div>
      <div class="detalle-row"><span class="detalle-key">Plan</span><span class="detalle-val">${c.plan || '—'}</span></div>
      <div class="detalle-row"><span class="detalle-key">Cédula</span><span class="detalle-val">${c.cedula || '—'}</span></div>
      <div class="detalle-row"><span class="detalle-key">Teléfono</span><span class="detalle-val">${c.telefono || '—'}</span></div>
      <div class="detalle-row"><span class="detalle-key">Inicio</span><span class="detalle-val">${fmtFecha(c.fechaInicio)}</span></div>
      <div class="detalle-row"><span class="detalle-key">Vence</span><span class="detalle-val">${fmtFecha(c.fechaPago)}</span></div>
      <div class="detalle-row"><span class="detalle-key">Valor pagado</span><span class="detalle-val">${fmtCOP(c.valor)}</span></div>
      ${c.notas ? `<div class="detalle-row"><span class="detalle-key">Notas</span><span class="detalle-val">${c.notas}</span></div>` : ''}
      <div class="detalle-actions">
        <button class="btn-accion btn-renovar" onclick="abrirModalRenovar('${id}')">🔄 Renovar</button>
        ${c.telefono ? `<button class="btn-accion btn-whatsapp" onclick="waCliente('${id}')">💬 WhatsApp</button>` : ''}
        <button class="btn-accion btn-editar" onclick="editarCliente('${id}')">✏️ Editar</button>
        <button class="btn-accion btn-eliminar" onclick="eliminarCliente('${id}')">🗑️ Eliminar</button>
      </div>`;
    document.getElementById('modal-detalle').classList.add('open');
  };

  document.getElementById('modal-detalle').addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('open');
  });
  document.getElementById('modal-cliente').addEventListener('click', function (e) {
    if (e.target === this) cerrarModalCliente();
  });
  document.getElementById('modal-user-config').addEventListener('click', function (e) {
    if (e.target === this) cerrarModalUserConfig();
  });

  // ── MODAL RENOVAR ──
  window.abrirModalRenovar = function (id) {
    const c = clientes[id];
    if (!c) return;
    clienteRenovandoId = id;
    const plan = gymConfig.planes.find(p => p.nombre === c.plan);
    document.getElementById('renovar-nombre-label').textContent = `Cliente: ${c.nombre} — Plan: ${c.plan || '—'}`;
    document.getElementById('renovar-valor').value = plan ? plan.precio : (c.valor || '');
    document.getElementById('modal-detalle').classList.remove('open');
    document.getElementById('modal-renovar').classList.add('open');
  };

  window.cerrarModalRenovar = function () {
    document.getElementById('modal-renovar').classList.remove('open');
    clienteRenovandoId = null;
  };

  window.confirmarRenovar = function () {
    const id = clienteRenovandoId;
    if (!id) return;
    const c = clientes[id];
    if (!c) return;
    const hoy = getFechaHoy();
    const fechaPago = calcFechaPago(hoy, c.plan);
    const valorRaw = document.getElementById('renovar-valor').value.replace(/\D/g, '');
    const valor = parseInt(valorRaw) || 0;
    db.ref('clientes/' + id).update({ fechaInicio: hoy, fechaPago, valor })
      .then(() => {
        document.getElementById('modal-renovar').classList.remove('open');
        clienteRenovandoId = null;
      });
  };

  document.getElementById('modal-renovar').addEventListener('click', function (e) {
    if (e.target === this) cerrarModalRenovar();
  });

  // ── EDITAR CLIENTE ──
  window.editarCliente = function (id) {
    const c = clientes[id];
    if (!c) return;
    clienteEditandoId = id;
    document.getElementById('modal-titulo').textContent = 'EDITAR CLIENTE';
    document.getElementById('f-nombre').value = c.nombre || '';
    document.getElementById('f-cedula').value = c.cedula || '';
    document.getElementById('f-tel').value = c.telefono || '';
    document.getElementById('f-valor').value = c.valor || '';
    document.getElementById('f-notas').value = c.notas || '';
    document.getElementById('f-inicio').value = c.fechaInicio || getFechaHoy();
    cargarPlanesEnSelect();
    document.getElementById('f-plan').value = c.plan || '';
    setSaveStatus('saved', '✓ Guardado anteriormente');
    document.getElementById('modal-detalle').classList.remove('open');
    document.getElementById('modal-cliente').classList.add('open');
  };

  // ── ELIMINAR CLIENTE ──
  window.eliminarCliente = function (id) {
    if (!confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return;
    db.ref('clientes/' + id).remove()
      .then(() => document.getElementById('modal-detalle').classList.remove('open'));
  };

  // ── WHATSAPP ──
  window.waCliente = function (id) {
    const c = clientes[id];
    if (!c || !c.telefono) return;
    const est = getEstado(c);
    const dias = diasRestantes(c);
    let msg = `Hola ${c.nombre.split(' ')[0]} 👋, te escribimos desde *${gymConfig.nombre}*.\n`;
    if (est === 'vencido') msg += `⚠️ Tu membresía *venció hace ${Math.abs(dias)} días*. ¡Renueva y sigue entrenando! 💪`;
    else if (est === 'por-vencer') msg += `⏰ Tu membresía *vence en ${dias} días* (${fmtFecha(c.fechaPago)}). ¡Renueva a tiempo! 💪`;
    else msg += `✅ Tu membresía está al día hasta el *${fmtFecha(c.fechaPago)}*. ¡Sigue así! 🔥`;
    const phone = c.telefono.replace(/\D/g, '');
    window.open(`https://wa.me/57${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ── CLIENTES LIST ──
  window.setFiltro = function (btn, filtro) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filtroActual = filtro;
    renderClientes();
  };

  window.renderClientes = function() {
    const q = (document.getElementById('search-inp')?.value || '').toLowerCase();
    let arr = Object.entries(clientes).map(([id, c]) => ({ id, ...c }));
    if (q) arr = arr.filter(c =>
      (c.nombre || '').toLowerCase().includes(q) ||
      (c.cedula || '').toString().includes(q) ||
      (c.telefono || '').includes(q)
    );
    if (filtroActual !== 'todos') arr = arr.filter(c => getEstado(c) === filtroActual);
    arr.sort((a, b) => {
      const ord = { vencido: 0, 'por-vencer': 1, activo: 2 };
      return ord[getEstado(a)] - ord[getEstado(b)];
    });
    const el = document.getElementById('lista-clientes');
    if (!arr.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div>${q ? 'Sin resultados para "' + q + '"' : 'No hay clientes aún'}</div>`;
      return;
    }
    el.innerHTML = arr.map(c => {
      const est = getEstado(c);
      const dias = diasRestantes(c);
      const badgeClass = est === 'activo' ? 'badge-activo' : est === 'por-vencer' ? 'badge-vence' : 'badge-vencido';
      const badgeTxt = est === 'activo' ? '✅ Al día' : est === 'por-vencer' ? `⚠️ Vence en ${dias}d` : '❌ Vencido';
      return `<div class="cliente-card ${est}" onclick="verDetalle('${c.id}')">
        <div class="cliente-avatar">${iniciales(c.nombre)}</div>
        <div class="cliente-info">
          <div class="cliente-nombre">${c.nombre || '—'}</div>
          <div class="cliente-plan">${c.plan || '—'}${c.cedula ? ' · CC ' + c.cedula : ''}</div>
        </div>
        <div class="cliente-right">
          <div class="estado-badge ${badgeClass}">${badgeTxt}</div>
          <div class="cliente-fecha">${fmtFecha(c.fechaPago)}</div>
        </div>
      </div>`;
    }).join('');
  };

  // ── STATS ──
  function renderStats() {
    const arr = Object.values(clientes);
    const total = arr.length;
    const activos = arr.filter(c => getEstado(c) === 'activo').length;
    const porVencer = arr.filter(c => getEstado(c) === 'por-vencer').length;
    const vencidos = arr.filter(c => getEstado(c) === 'vencido').length;
    const hoy = new Date();
    const mesActual = hoy.getMonth(); const anioActual = hoy.getFullYear();
    const ingresosMes = arr
      .filter(c => { if (!c.fechaInicio) return false; const d = new Date(c.fechaInicio + 'T00:00:00'); return d.getMonth() === mesActual && d.getFullYear() === anioActual; })
      .reduce((s, c) => s + (parseInt(c.valor) || 0), 0);
    const mesesLabels = [];
    const mesesVals = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anioActual, mesActual - i, 1);
      const m = d.getMonth(); const y = d.getFullYear();
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      mesesLabels.push(meses[m]);
      mesesVals.push(arr.filter(c => {
        if (!c.fechaInicio) return false;
        const cd = new Date(c.fechaInicio + 'T00:00:00');
        return cd.getMonth() === m && cd.getFullYear() === y;
      }).length);
    }
    const planCount = {};
    arr.forEach(c => { if (c.plan) planCount[c.plan] = (planCount[c.plan] || 0) + 1; });
    const topPlanes = Object.entries(planCount).sort((a, b) => b[1] - a[1]);
    const maxPlan = topPlanes.length ? topPlanes[0][1] : 1;
    document.getElementById('stats-content').innerHTML = `
      <div class="metrics">
        <div class="mcard"><div class="m-lbl">Total clientes</div><div class="m-val">${total}</div><div class="m-sub">registrados</div></div>
        <div class="mcard green"><div class="m-lbl">Al día</div><div class="m-val">${activos}</div><div class="m-sub">membresías activas</div></div>
        <div class="mcard yellow"><div class="m-lbl">Por vencer</div><div class="m-val">${porVencer}</div><div class="m-sub">en 3 días o menos</div></div>
        <div class="mcard red"><div class="m-lbl">Vencidos</div><div class="m-val">${vencidos}</div><div class="m-sub">sin renovar</div></div>
      </div>
      <div class="mcard" style="margin-bottom:16px">
        <div class="m-lbl">Ingresos este mes</div>
        <div class="m-val" style="font-size:32px">${fmtCOP(ingresosMes)}</div>
        <div class="m-sub">basado en registros del mes</div>
      </div>
      <div class="chart-card">
        <div class="section-title">Nuevos clientes por mes</div>
        <div style="position:relative;height:180px"><canvas id="chartMes"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="section-title">Planes más populares</div>
        ${topPlanes.length ? topPlanes.map(([n, c]) => `
          <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:12px;font-weight:700;color:var(--text);min-width:90px">${n}</span>
            <div style="flex:1;height:7px;background:var(--border);border-radius:4px;overflow:hidden">
              <div style="width:${Math.round(c / maxPlan * 100)}%;height:100%;background:var(--gold);border-radius:4px"></div>
            </div>
            <span style="font-size:12px;font-weight:700;color:var(--gold);min-width:24px;text-align:right">${c}</span>
          </div>`).join('') : '<div class="empty-state" style="padding:20px 0">Sin datos aún</div>'}
      </div>`;
    if (chartMesInst) { chartMesInst.destroy(); chartMesInst = null; }
    const ctx = document.getElementById('chartMes');
    if (ctx) {
      chartMesInst = new Chart(ctx, {
        type: 'bar',
        data: { labels: mesesLabels, datasets: [{ data: mesesVals, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#D4AF37', borderRadius: 6, borderSkipped: false }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#666', font: { size: 11 } }, grid: { display: false } },
            y: { ticks: { color: '#666', font: { size: 11 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true }
          }
        }
      });
    }
  }

  // ── ALERTAS ──
  function renderAlertas() {
    const arr = Object.entries(clientes)
      .map(([id, c]) => ({ id, ...c }))
      .filter(c => getEstado(c) !== 'activo')
      .sort((a, b) => getEstado(a) === 'vencido' && getEstado(b) !== 'vencido' ? -1 : 1);
    const el = document.getElementById('alertas-content');
    if (!arr.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div>¡Todo al día! No hay alertas pendientes</div>`;
      return;
    }
    el.innerHTML = `<div style="margin-bottom:14px">
      <button class="btn-gold" onclick="notificarTodos()" style="width:100%;padding:13px;font-size:13px">
        📱 Enviar WhatsApp a todos (${arr.length})
      </button>
    </div>` +
      arr.map(c => {
        const est = getEstado(c);
        const dias = diasRestantes(c);
        const msg = est === 'vencido' ? `Venció hace ${Math.abs(dias)} días` : `Vence en ${dias} días`;
        return `<div class="notif-card">
          <div class="notif-dot ${est === 'vencido' ? 'red' : 'yellow'}"></div>
          <div class="notif-info">
            <div class="notif-nombre">${c.nombre}</div>
            <div class="notif-msg">${msg} — ${c.plan || '—'}</div>
          </div>
          ${c.telefono ? `<button class="btn-notif-wa" onclick="waCliente('${c.id}')">💬 WA</button>` : ''}
        </div>`;
      }).join('');
  }

  window.notificarTodos = function () {
    const arr = Object.entries(clientes)
      .map(([id, c]) => ({ id, ...c }))
      .filter(c => getEstado(c) !== 'activo' && c.telefono);
    if (!arr.length) { alert('No hay clientes con teléfono para notificar'); return; }
    arr.forEach(c => waCliente(c.id));
  };

  // ── NOTIFICACIONES WEB ──
  function checkNotifPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      document.getElementById('btn-notif-perm').style.display = 'block';
    }
  }

  document.getElementById('btn-notif-perm').addEventListener('click', () => {
    Notification.requestPermission().then(p => {
      if (p === 'granted') {
        document.getElementById('btn-notif-perm').style.display = 'none';
        programarNotificaciones();
        new Notification('GYM 🏋️', { body: '¡Notificaciones activadas!' });
      }
    });
  });

  function programarNotificaciones() {
    if (Notification.permission !== 'granted') return;
    Object.values(clientes).filter(c => getEstado(c) !== 'activo').forEach(c => {
      const dias = diasRestantes(c);
      const msg = dias < 0
        ? `${c.nombre} — membresía vencida hace ${Math.abs(dias)} días`
        : `${c.nombre} — vence en ${dias} días`;
      new Notification('⚠️ GYM — Vencimiento', { body: msg });
    });
  }

  window.pedirNotifPermiso = function () {
    if (!('Notification' in window)) { alert('Tu navegador no soporta notificaciones'); return; }
    Notification.requestPermission().then(p => {
      if (p === 'granted') { programarNotificaciones(); alert('✅ ¡Notificaciones activadas!'); }
      else alert('❌ Permiso denegado');
    });
  };

  // ── CONFIG ──
  function renderConfig() {
    document.getElementById('config-content').innerHTML = `
      <div class="config-card">
        <h3>🏋️ Datos del Gym</h3>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Nombre del Gym</label>
          <input class="form-inp" id="cfg-nombre" value="${gymConfig.nombre || ''}" placeholder="Mi Gym">
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Teléfono / WhatsApp</label>
          <input class="form-inp" id="cfg-tel" value="${gymConfig.telefono || ''}" type="tel" placeholder="3001234567">
        </div>
        <button class="btn-gold" onclick="guardarConfigGym()">💾 Guardar datos</button>
      </div>

      <div class="config-card">
        <h3>📋 Planes disponibles</h3>
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">El precio es solo referencia — al registrar un cliente puedes cambiarlo.</p>
        <div id="planes-lista">
          ${gymConfig.planes.map((p, i) => `
            <div class="plan-row">
              <input class="form-inp" value="${p.nombre}" placeholder="Nombre" id="plan-n-${i}" style="flex:2">
              <input class="form-inp" value="${p.dias}" placeholder="Días" id="plan-d-${i}" type="text" inputmode="numeric" style="flex:1">
              <input class="form-inp" value="${p.precio}" placeholder="Precio" id="plan-p-${i}" type="text" inputmode="numeric" style="flex:1">
              <button onclick="eliminarPlan(${i})" style="padding:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:var(--red);cursor:pointer;font-size:14px">🗑️</button>
            </div>`).join('')}
        </div>
        <button onclick="agregarPlan()" style="width:100%;padding:12px;background:var(--dark4);border:1px solid var(--border);border-radius:10px;color:var(--gold);font-family:'Barlow',sans-serif;font-size:13px;font-weight:700;cursor:pointer;margin-top:10px">+ Agregar plan</button>
        <button class="btn-gold" style="margin-top:10px" onclick="guardarPlanes()">💾 Guardar planes</button>
      </div>

      <div class="config-card">
        <h3>👤 Mi perfil y apariencia</h3>
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Cambia tu nombre de usuario, foto y color de la app.</p>
        <button class="btn-gold" onclick="abrirModalUserConfig()">🎨 Abrir configuración de usuario</button>
      </div>

      <div class="config-card">
        <h3>🔐 Cambiar contraseña</h3>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Nueva contraseña</label>
          <input class="form-inp" id="cfg-newpass" type="password" placeholder="••••">
        </div>
        <button class="btn-gold" onclick="cambiarPass()">💾 Guardar contraseña</button>
      </div>

      <div class="config-card">
        <h3>🔔 Notificaciones</h3>
        <p style="font-size:13px;color:var(--muted);margin-bottom:12px">Activa las notificaciones del navegador para recibir alertas de vencimientos.</p>
        <button class="notif-perm-btn" onclick="pedirNotifPermiso()">🔔 Activar notificaciones</button>
      </div>`;
  }

  window.guardarConfigGym = function () {
    const nombre = document.getElementById('cfg-nombre').value.trim();
    const telefono = document.getElementById('cfg-tel').value.trim();
    db.ref('gymConfig').update({ nombre, telefono })
      .then(() => {
        updateGymNameUI(nombre);
        // Sincronizar con el setup input del login
        try {
          const prefs = JSON.parse(localStorage.getItem('gymUserPrefs') || '{}');
          prefs.gymNombreLocal = nombre;
          localStorage.setItem('gymUserPrefs', JSON.stringify(prefs));
        } catch(e) {}
        alert('✅ Datos guardados');
      });
  };

  window.agregarPlan = function () {
    gymConfig.planes.push({ nombre: 'Nuevo plan', dias: 30, precio: 0 });
    renderConfig();
  };

  window.eliminarPlan = function (i) {
    if (!confirm('¿Eliminar este plan?')) return;
    gymConfig.planes.splice(i, 1);
    renderConfig();
  };

  window.guardarPlanes = function () {
    const count = gymConfig.planes.length;
    const planes = [];
    for (let i = 0; i < count; i++) {
      const n = document.getElementById('plan-n-' + i)?.value.trim();
      const d = parseInt(document.getElementById('plan-d-' + i)?.value);
      const p = parseInt(document.getElementById('plan-p-' + i)?.value);
      if (n) planes.push({ nombre: n, dias: d || 30, precio: p || 0 });
    }
    gymConfig.planes = planes;
    db.ref('gymConfig/planes').set(planes)
      .then(() => alert('✅ Planes guardados'));
  };

  window.cambiarPass = function () {
    const np = document.getElementById('cfg-newpass').value;
    if (!np || np.length < 4) { alert('La contraseña debe tener al menos 4 caracteres'); return; }
    CREDS.pass = np;
    db.ref('gymCreds').set(CREDS)
      .then(() => { alert('✅ Contraseña actualizada'); document.getElementById('cfg-newpass').value = ''; });
  };

})();
