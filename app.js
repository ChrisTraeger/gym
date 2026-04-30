(function () {

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
  const db = firebase.database();
  const auth = firebase.auth();

  // ══════════════════════════════════════════════
  // SUPERADMIN CONFIG — cambia estos datos de acceso
  // ══════════════════════════════════════════════
  const SA_USER = 'superadmin';
  const SA_PASS = 'superadmin2024';

  // ══════════════════════════════════════════════
  // ESTADO GLOBAL
  // ══════════════════════════════════════════════
  let currentGymId = null;   // ID del gym activo ej: "powerfit-gym"
  let gymConfig = {};
  let clientes = {};
  let pagos = {};
  let filtroActual = 'todos';
  let clienteEditandoId = null;
  let clienteRenovandoId = null;
  let autoGuardarTimer = null;
  let chartMesInst = null;
  let currentUser = null;
  let gymDbListeners = [];   // Para limpiar listeners al cambiar de gym

  // ══════════════════════════════════════════════
  // HELPERS URL — soporte para ?gym=id
  // ══════════════════════════════════════════════
  function getGymIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('gym') || null;
  }

  function setGymIdInURL(gymId) {
    const url = new URL(window.location);
    if (gymId) url.searchParams.set('gym', gymId);
    else url.searchParams.delete('gym');
    window.history.replaceState({}, '', url);
  }

  // ══════════════════════════════════════════════
  // INICIALIZACIÓN
  // ══════════════════════════════════════════════
  window.addEventListener('DOMContentLoaded', () => {
    loadUserPrefs();
    const gymIdFromURL = getGymIdFromURL();
    if (gymIdFromURL) {
      // Ir directo al login de ese gym
      cargarGymYMostrarLogin(gymIdFromURL);
    } else {
      mostrarLanding();
    }
  });

  // ══════════════════════════════════════════════
  // NAVEGACIÓN ENTRE PANTALLAS
  // ══════════════════════════════════════════════
  function mostrarLanding() {
    ocultarTodas();
    document.getElementById('landing-screen').style.display = 'flex';
  }

  window.mostrarRegistro = function() {
    ocultarTodas();
    document.getElementById('registro-screen').style.display = 'flex';
  };

  window.mostrarSuperAdmin = function() {
    ocultarTodas();
    document.getElementById('superadmin-screen').style.display = 'flex';
  };

  window.volverLanding = function() {
    // Limpiar gym actual
    limpiarListenersGym();
    currentGymId = null;
    setGymIdInURL(null);
    ocultarTodas();
    document.getElementById('app').style.display = 'none';
    mostrarLanding();
  };

  function ocultarTodas() {
    ['landing-screen','registro-screen','login-screen','superadmin-screen'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });
    document.getElementById('app').style.display = 'none';
  }

  // ══════════════════════════════════════════════
  // LANDING — IR A GYM
  // ══════════════════════════════════════════════
  window.irAlGym = function() {
    const gymId = document.getElementById('inp-gym-id').value.trim().toLowerCase();
    if (!gymId) return;
    cargarGymYMostrarLogin(gymId);
  };

  // Enter en input de gym id
  document.getElementById('inp-gym-id').addEventListener('keydown', e => {
    if (e.key === 'Enter') irAlGym();
  });

  function cargarGymYMostrarLogin(gymId) {
    const errEl = document.getElementById('gym-not-found-err');
    if (errEl) errEl.style.display = 'none';

    db.ref(`gyms/${gymId}/config`).once('value').then(snap => {
      const config = snap.val();
      if (!config) {
        // Gym no existe
        if (errEl) errEl.style.display = 'block';
        setTimeout(() => { if (errEl) errEl.style.display = 'none'; }, 3000);
        return;
      }
      currentGymId = gymId;
      gymConfig = { planes: [], ...config };
      setGymIdInURL(gymId);
      mostrarLoginGym();
    });
  }

  function mostrarLoginGym() {
    ocultarTodas();
    document.getElementById('login-screen').style.display = 'flex';
    // Actualizar UI del login con datos del gym
    updateGymNameUI(gymConfig.nombre || currentGymId);
    document.getElementById('gymid-badge').textContent = currentGymId ? '@' + currentGymId : '';
    // Mostrar campo ID gym solo si no hay gym cargado aún (acceso directo a login)
    const gymLoginWrap = document.getElementById('gym-login-wrap');
    if (gymLoginWrap) gymLoginWrap.style.display = currentGymId ? 'none' : 'block';
    // Escuchar estado auth de Firebase para login con Google
    auth.onAuthStateChanged(user => {
      if (user && currentGymId) {
        // Verificar que este usuario tiene acceso a este gym
        db.ref(`gyms/${currentGymId}/usuarios/${user.uid}`).once('value').then(snap => {
          if (snap.val()) {
            setupCurrentUser({ name: user.displayName||'Admin', email: user.email||'', photo: user.photoURL||'', uid: user.uid, loginType: 'google' });
            entrarAlApp();
          }
          // Si no tiene acceso, no entra (esperará login manual o que el gym le dé acceso)
        });
      }
    });
  }

  // ══════════════════════════════════════════════
  // REGISTRO DE NUEVO GYM
  // ══════════════════════════════════════════════
  let gymIdDisponible = false;

  window.generarGymId = function() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const generado = nombre.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim().replace(/\s+/g, '-')
      .slice(0, 30);
    document.getElementById('reg-gymid').value = generado;
    if (generado) verificarGymId();
  };

  window.verificarGymId = function() {
    const gymId = document.getElementById('reg-gymid').value.trim();
    const check = document.getElementById('gymid-check');
    const preview = document.getElementById('gymid-preview');
    gymIdDisponible = false;

    if (!gymId || gymId.length < 3) {
      check.textContent = '';
      preview.innerHTML = 'gympanel.app/<b>tu-id</b>';
      return;
    }

    preview.innerHTML = `gympanel.app/<b>${gymId}</b>`;
    check.textContent = '⏳';

    db.ref(`gyms/${gymId}/config`).once('value').then(snap => {
      if (snap.val()) {
        check.textContent = '❌';
        gymIdDisponible = false;
      } else {
        check.textContent = '✅';
        gymIdDisponible = true;
      }
    });
  };

  window.registrarGym = function() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const gymId = document.getElementById('reg-gymid').value.trim();
    const tel = document.getElementById('reg-tel').value.trim();
    const ciudad = document.getElementById('reg-ciudad').value.trim();
    const usuario = document.getElementById('reg-user').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const errEl = document.getElementById('reg-err');

    errEl.style.display = 'none';

    if (!nombre || !gymId || !usuario || !pass) {
      errEl.textContent = '❌ Completa todos los campos obligatorios (*)';
      errEl.style.display = 'block';
      return;
    }
    if (gymId.length < 3) {
      errEl.textContent = '❌ El ID del gym debe tener al menos 3 caracteres';
      errEl.style.display = 'block';
      return;
    }
    if (pass.length < 4) {
      errEl.textContent = '❌ La contraseña debe tener al menos 4 caracteres';
      errEl.style.display = 'block';
      return;
    }
    if (!gymIdDisponible) {
      errEl.textContent = '❌ Ese ID ya está en uso. Elige otro.';
      errEl.style.display = 'block';
      return;
    }

    const btn = document.getElementById('btn-registrar');
    btn.disabled = true;
    btn.textContent = '⏳ Creando...';

    const nuevaConfig = {
      nombre,
      telefono: tel,
      ciudad,
      planes: [
        { nombre: 'Mensual', dias: 30, precio: 80000 },
        { nombre: 'Quincenal', dias: 15, precio: 50000 },
        { nombre: 'Trimestral', dias: 90, precio: 220000 }
      ],
      plan: 'free',  // plan de suscripción al servicio
      creadoEn: Date.now(),
      activo: true
    };

    // Doble chequeo de disponibilidad antes de escribir
    db.ref(`gyms/${gymId}/config`).once('value').then(snap => {
      if (snap.val()) {
        errEl.textContent = '❌ Ese ID ya fue tomado. Elige otro.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'CREAR MI GYM →';
        return;
      }
      return db.ref(`gyms/${gymId}`).set({
        config: nuevaConfig,
        creds: { user: usuario, pass },
        clientes: {},
        pagos: {}
      });
    }).then(() => {
      showToast('✅ ¡Gym creado exitosamente!', 'green');
      // Redirigir al login del gym creado
      currentGymId = gymId;
      gymConfig = nuevaConfig;
      setGymIdInURL(gymId);
      setTimeout(() => mostrarLoginGym(), 1200);
    }).catch(e => {
      errEl.textContent = '❌ Error: ' + e.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'CREAR MI GYM →';
    });
  };

  // Google registro
  document.getElementById('btn-google-reg').addEventListener('click', () => {
    const gymId = document.getElementById('reg-gymid').value.trim();
    const nombre = document.getElementById('reg-nombre').value.trim();
    const errEl = document.getElementById('reg-err');

    if (!nombre || !gymId) {
      errEl.textContent = '❌ Primero completa el nombre y el ID del gym';
      errEl.style.display = 'block';
      return;
    }
    if (!gymIdDisponible) {
      errEl.textContent = '❌ Verifica que el ID esté disponible';
      errEl.style.display = 'block';
      return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      // Guardar en Firebase (no sessionStorage, que se pierde con el redirect en móvil)
      const tempKey = 'pendingReg_' + gymId;
      db.ref('_pendingRegs/' + tempKey).set({ gymId, nombre, ts: Date.now() })
        .then(() => auth.signInWithRedirect(provider));
    } else {
      auth.signInWithPopup(provider).then(result => {
        crearGymConGoogleUser(result.user, gymId, nombre);
      }).catch(e => {
        if (e.code !== 'auth/popup-closed-by-user') {
          errEl.textContent = '❌ Error Google: ' + e.message;
          errEl.style.display = 'block';
        }
      });
    }
  });

  function crearGymConGoogleUser(user, gymId, nombre) {
    const config = {
      nombre,
      telefono: '',
      ciudad: '',
      planes: [
        { nombre: 'Mensual', dias: 30, precio: 80000 },
        { nombre: 'Quincenal', dias: 15, precio: 50000 },
        { nombre: 'Trimestral', dias: 90, precio: 220000 }
      ],
      plan: 'free',
      creadoEn: Date.now(),
      activo: true
    };
    db.ref(`gyms/${gymId}`).set({
      config,
      creds: { user: user.email, pass: '' },
      usuarios: { [user.uid]: { nombre: user.displayName, email: user.email, rol: 'admin' } },
      clientes: {},
      pagos: {}
    }).then(() => {
      currentGymId = gymId;
      gymConfig = config;
      setGymIdInURL(gymId);
      setupCurrentUser({ name: user.displayName||'Admin', email: user.email, photo: user.photoURL||'', uid: user.uid, loginType: 'google' });
      entrarAlApp();
    });
  }

  // ══════════════════════════════════════════════
  // LOGIN MANUAL (gym específico)
  // ══════════════════════════════════════════════
  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('inp-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('inp-user').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('inp-pass').focus(); });
  // Si el campo gym-id-login existe (login directo), Enter en gym pasa al usuario
  const inpGymLogin = document.getElementById('inp-gym-login');
  if (inpGymLogin) {
    inpGymLogin.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('inp-user').focus(); });
  }

  function doLogin() {
    // Soporte para ingreso directo por ID de gym desde la pantalla de login
    const gymLoginInput = document.getElementById('inp-gym-login');
    if (gymLoginInput && gymLoginInput.value.trim() && !currentGymId) {
      const gymIdDirecto = gymLoginInput.value.trim().toLowerCase();
      db.ref(`gyms/${gymIdDirecto}/config`).once('value').then(snap => {
        if (!snap.exists()) {
          const err = document.getElementById('login-err');
          err.textContent = '❌ Gimnasio no encontrado';
          err.style.display = 'block';
          setTimeout(() => { err.style.display = 'none'; err.textContent = '❌ Usuario o contraseña incorrectos'; }, 3000);
          return;
        }
        currentGymId = gymIdDirecto;
        doLoginConGymId();
      });
    } else {
      if (!currentGymId) return;
      doLoginConGymId();
    }
  }

  function doLoginConGymId() {
    const u = document.getElementById('inp-user').value.trim();
    const p = document.getElementById('inp-pass').value;
    db.ref(`gyms/${currentGymId}/creds`).once('value').then(snap => {
      const creds = snap.val() || {};
      if (u === creds.user && p === creds.pass) {
        const prefs = loadUserPrefs();
        setupCurrentUser({ name: prefs.displayName || u, email: '', photo: prefs.photoData || '', uid: 'manual_' + u, loginType: 'manual' });
        entrarAlApp();
      } else {
        const err = document.getElementById('login-err');
        err.textContent = '❌ Usuario o contraseña incorrectos';
        err.style.display = 'block';
        setTimeout(() => err.style.display = 'none', 3000);
      }
    });
  }

  // Google login (gym existente)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  auth.getRedirectResult().then(result => {
    if (!result || !result.user) return;

    // Buscar registro pendiente en Firebase (fix para móvil donde sessionStorage se pierde)
    db.ref('_pendingRegs').orderByChild('ts').limitToLast(10).once('value').then(snap => {
      const regs = snap.val() || {};
      const uid = result.user.uid;
      // Buscar si hay un pending para este usuario (guardado justo antes del redirect)
      const pendingEntry = Object.entries(regs).find(([key]) => key.startsWith('pendingReg_'));

      if (pendingEntry) {
        const [key, { gymId, nombre }] = pendingEntry;
        // Borrar el pending
        db.ref('_pendingRegs/' + key).remove();
        crearGymConGoogleUser(result.user, gymId, nombre);
        return;
      }

      // Fallback: sessionStorage (escritorio)
      const pending = sessionStorage.getItem('pendingGymReg');
      if (pending) {
        sessionStorage.removeItem('pendingGymReg');
        const { gymId, nombre } = JSON.parse(pending);
        crearGymConGoogleUser(result.user, gymId, nombre);
        return;
      }

      // Login normal a gym existente
      if (currentGymId) {
        db.ref(`gyms/${currentGymId}/usuarios/${uid}`).once('value').then(snap => {
          if (snap.val()) {
            setupCurrentUser({ name: result.user.displayName||'Admin', email: result.user.email||'', photo: result.user.photoURL||'', uid, loginType: 'google' });
            entrarAlApp();
          }
        });
      }
    });
  }).catch(() => {});

  document.getElementById('btn-google-login').addEventListener('click', () => {
    const btn = document.getElementById('btn-google-login');
    btn.disabled = true;
    btn.textContent = '⏳ Conectando…';
    const provider = new firebase.auth.GoogleAuthProvider();
    if (isMobile) {
      auth.signInWithRedirect(provider).catch(() => {
        btn.disabled = false;
        btn.textContent = 'Continuar con Google';
      });
    } else {
      auth.signInWithPopup(provider).then(result => {
        if (!currentGymId) return;
        db.ref(`gyms/${currentGymId}/usuarios/${result.user.uid}`).once('value').then(snap => {
          if (snap.val()) {
            setupCurrentUser({ name: result.user.displayName||'Admin', email: result.user.email||'', photo: result.user.photoURL||'', uid: result.user.uid, loginType: 'google' });
            entrarAlApp();
          } else {
            alert('Tu cuenta Google no tiene acceso a este gym. Usa usuario/contraseña.');
            btn.disabled = false;
            btn.innerHTML = '<svg>...</svg> Continuar con Google';
          }
        });
      }).catch(e => {
        btn.disabled = false;
        btn.textContent = 'Continuar con Google';
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
          alert('Error Google: ' + e.message);
        }
      });
    }
  });

  // ══════════════════════════════════════════════
  // ENTRAR AL APP
  // ══════════════════════════════════════════════
  function setupCurrentUser(userData) {
    const prefs = loadUserPrefs();
    currentUser = userData;
    if (prefs.displayName) currentUser.name = prefs.displayName;
    if (prefs.photoData) currentUser.photo = prefs.photoData;
  }

  function entrarAlApp() {
    if (!currentGymId) return;
    ocultarTodas();
    document.getElementById('app').style.display = 'flex';

    // Cargar prefs de usuario
    const prefs = loadUserPrefs();
    if (prefs.themeColor) applyThemeColor(prefs.themeColor, false);

    updateGymNameUI(gymConfig.nombre || currentGymId);
    updateTopbarAvatar();
    actualizarPlanIndicator();
    checkNotifPermission();
    suscribirseAlGym();
  }

  // ══════════════════════════════════════════════
  // LISTENERS FIREBASE (aislados por gymId)
  // ══════════════════════════════════════════════
  function suscribirseAlGym() {
    limpiarListenersGym(); // Limpiar anteriores

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
    clientes = {};
    pagos = {};
    gymConfig = {};
  }

  // ══════════════════════════════════════════════
  // TEMA Y PREFERENCIAS DE USUARIO
  // ══════════════════════════════════════════════
  window.applyThemeColor = function(hex, preview) {
    document.documentElement.style.setProperty('--gold', hex);
    document.documentElement.style.setProperty('--gold2', hex);
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    const darken = (v,f) => Math.max(0,Math.min(255,Math.round(v*f)));
    const dark = `#${darken(r,.75).toString(16).padStart(2,'0')}${darken(g,.75).toString(16).padStart(2,'0')}${darken(b,.75).toString(16).padStart(2,'0')}`;
    document.documentElement.style.setProperty('--gold-dark', dark);
    const picker = document.getElementById('custom-color-picker');
    const hexDisp = document.getElementById('color-hex-display');
    if (picker) picker.value = hex;
    if (hexDisp) hexDisp.textContent = hex.toUpperCase();
    document.querySelectorAll('.color-preset').forEach(b => {
      b.classList.toggle('active', b.dataset.color === hex);
    });
  };

  window.selectColorPreset = function(hex) { applyThemeColor(hex, true); };

  function loadUserPrefs() {
    try { return JSON.parse(localStorage.getItem('gymUserPrefs') || '{}'); } catch(e) { return {}; }
  }
  function saveUserPrefs(prefs) {
    localStorage.setItem('gymUserPrefs', JSON.stringify(prefs));
  }

  function updateGymNameUI(nombre) {
    const n = (nombre || 'GYM').toUpperCase();
    const short = n.length > 14 ? n.slice(0,14)+'…' : n;
    const el = document.getElementById('login-emblem-text');
    const topbar = document.getElementById('topbar-logo-text');
    const sub = document.getElementById('login-sub-text');
    if (el) el.textContent = n;
    if (topbar) topbar.textContent = short;
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
    const img = document.getElementById('topbar-avatar-img');
    const initials = document.getElementById('topbar-avatar-initials');
    if (currentUser.photo) {
      img.src = currentUser.photo; img.style.display = 'block'; initials.style.display = 'none';
    } else {
      img.style.display = 'none';
      initials.textContent = (currentUser.name||'?').split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase();
      initials.style.display = 'flex';
    }
    const menuName = document.getElementById('menu-user-name');
    const menuEmail = document.getElementById('menu-user-email');
    const menuGymId = document.getElementById('menu-gym-id');
    const menuAvatar = document.getElementById('menu-avatar-wrap');
    if (menuName) menuName.textContent = currentUser.name;
    if (menuEmail) menuEmail.textContent = currentUser.email || 'Acceso local';
    if (menuGymId) menuGymId.textContent = '🏋️ @' + currentGymId;
    if (menuAvatar) {
      if (currentUser.photo) {
        menuAvatar.innerHTML = `<img src="${currentUser.photo}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;">`;
      } else {
        menuAvatar.textContent = (currentUser.name||'?').split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase();
      }
    }
    // topbar gym id pill
    const pill = document.getElementById('topbar-gymid');
    if (pill) pill.textContent = '@' + currentGymId;
  }

  window.toggleUserMenu = function() {
    const menu = document.getElementById('user-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  };

  document.addEventListener('click', e => {
    const menu = document.getElementById('user-menu');
    const avatar = document.getElementById('topbar-avatar');
    if (menu && !menu.contains(e.target) && avatar && !avatar.contains(e.target)) {
      menu.style.display = 'none';
    }
  });

  window.irAConfigUsuario = function() {
    document.getElementById('user-menu').style.display = 'none';
    abrirModalUserConfig();
  };

  window.copiarLinkGym = function() {
    const url = `${window.location.origin}${window.location.pathname}?gym=${currentGymId}`;
    navigator.clipboard.writeText(url).then(() => showToast('🔗 Link copiado al portapapeles', 'green')).catch(() => {
      prompt('Copia este link:', url);
    });
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
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { if (currentUser) currentUser.photo = e.target.result; updateAvatarPreview(); };
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
    updateTopbarAvatar();
    cerrarModalUserConfig();
    showToast('✅ Perfil guardado', 'green');
  };

  // ══════════════════════════════════════════════
  // LOGOUT
  // ══════════════════════════════════════════════
  window.doLogout = function() {
    auth.signOut().catch(()=>{});
    limpiarListenersGym();
    currentGymId = null;
    currentUser = null;
    document.getElementById('user-menu').style.display = 'none';
    setGymIdInURL(null);
    ocultarTodas();
    mostrarLanding();
  };
  document.getElementById('btn-logout').addEventListener('click', doLogout);

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
      if (t.dataset.tab === 'stats') renderStats();
      if (t.dataset.tab === 'alertas') renderAlertas();
      if (t.dataset.tab === 'config') renderConfig();
      if (t.dataset.tab === 'caja') renderCaja();
    });
  });

  // ══════════════════════════════════════════════
  // HELPERS
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
    if (v >= 1000) return '$' + Math.round(v/1000) + 'K';
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

  // ══════════════════════════════════════════════
  // PLANES EN SELECT
  // ══════════════════════════════════════════════
  function cargarPlanesEnSelect() {
    const sel = document.getElementById('f-plan');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = (gymConfig.planes || []).map(p =>
      `<option value="${p.nombre}">${p.nombre} — ${fmtCOP(p.precio)}</option>`
    ).join('');
    if (currentVal) sel.value = currentVal;
  }

  window.onPlanChange = function() {
    const planNombre = document.getElementById('f-plan').value;
    const plan = (gymConfig.planes||[]).find(p => p.nombre === planNombre);
    if (plan) document.getElementById('f-valor').value = plan.precio;
    autoGuardar();
  };

  // ══════════════════════════════════════════════
  // GUARDADO EN TIEMPO REAL
  // ══════════════════════════════════════════════
  function setSaveStatus(estado, texto) {
    const ind = document.getElementById('save-indicator');
    const txt = document.getElementById('save-text');
    if (!ind || !txt) return;
    ind.className = 'save-indicator ' + estado;
    txt.textContent = texto;
  }

  window.autoGuardar = function() {
    const nombre = document.getElementById('f-nombre')?.value.trim();
    if (!nombre) { setSaveStatus('', 'Escribe el nombre'); return; }
    const plan = document.getElementById('f-plan')?.value;
    const inicio = document.getElementById('f-inicio')?.value;
    if (!plan || !inicio) { setSaveStatus('', 'Completa plan y fecha'); return; }
    setSaveStatus('saving', 'Guardando…');
    clearTimeout(autoGuardarTimer);
    autoGuardarTimer = setTimeout(() => _ejecutarGuardado(false), 800);
  };

  window.guardarClienteManual = function() {
    clearTimeout(autoGuardarTimer);
    _ejecutarGuardado(true);
  };

  function _ejecutarGuardado(cerrar) {
    if (!currentGymId) return;
    const nombre = document.getElementById('f-nombre').value.trim();
    const plan = document.getElementById('f-plan').value;
    const inicio = document.getElementById('f-inicio').value;
    if (!nombre || !plan || !inicio) {
      setSaveStatus('error', 'Faltan campos obligatorios');
      if (cerrar) alert('Nombre, plan y fecha son obligatorios');
      return;
    }
    const fechaPago = calcFechaPago(inicio, plan);
    const valorRaw = document.getElementById('f-valor').value.replace(/\D/g,'');
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
    const id = clienteEditandoId || ('c_' + Date.now() + '_' + Math.random().toString(36).substr(2,6));
    if (!clienteEditandoId) clienteEditandoId = id;
    const esNuevo = !clientes[id];

    db.ref(`gyms/${currentGymId}/clientes/${id}`).set(data)
      .then(() => {
        if (esNuevo && data.valor) {
          db.ref(`gyms/${currentGymId}/pagos`).push({
            clienteId: id, nombre: data.nombre, plan: data.plan,
            valor: data.valor, fecha: data.fechaInicio, tipo: 'nuevo', ts: Date.now()
          });
        }
        setSaveStatus('saved', '✓ Guardado');
        if (cerrar) cerrarModalCliente();
      })
      .catch(e => {
        setSaveStatus('error', 'Error al guardar');
        if (cerrar) alert('Error: ' + e.message);
      });
  }

  // ══════════════════════════════════════════════
  // MODAL CLIENTE
  // ══════════════════════════════════════════════
  window.abrirModalNuevo = function() {
    clienteEditandoId = null;
    document.getElementById('modal-titulo').textContent = 'NUEVO CLIENTE';
    document.getElementById('f-nombre').value = '';
    document.getElementById('f-cedula').value = '';
    document.getElementById('f-tel').value = '';
    document.getElementById('f-notas').value = '';
    document.getElementById('f-inicio').value = getFechaHoy();
    cargarPlanesEnSelect();
    const primerPlan = (gymConfig.planes||[])[0];
    if (primerPlan) document.getElementById('f-valor').value = primerPlan.precio;
    setSaveStatus('', 'Sin cambios');
    document.getElementById('modal-cliente').classList.add('open');
  };

  window.cerrarModalCliente = function() {
    clearTimeout(autoGuardarTimer);
    document.getElementById('modal-cliente').classList.remove('open');
  };

  // ══════════════════════════════════════════════
  // DETALLE CLIENTE
  // ══════════════════════════════════════════════
  window.verDetalle = function(id) {
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
      <div class="detalle-row"><span class="detalle-key">Plan</span><span class="detalle-val">${c.plan||'—'}</span></div>
      <div class="detalle-row"><span class="detalle-key">Cédula</span><span class="detalle-val">${c.cedula||'—'}</span></div>
      <div class="detalle-row"><span class="detalle-key">Teléfono</span><span class="detalle-val">${c.telefono||'—'}</span></div>
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

  document.getElementById('modal-detalle').addEventListener('click', function(e) { if(e.target===this) this.classList.remove('open'); });
  document.getElementById('modal-cliente').addEventListener('click', function(e) { if(e.target===this) cerrarModalCliente(); });
  document.getElementById('modal-user-config').addEventListener('click', function(e) { if(e.target===this) cerrarModalUserConfig(); });

  // ══════════════════════════════════════════════
  // RENOVAR
  // ══════════════════════════════════════════════
  window.abrirModalRenovar = function(id) {
    const c = clientes[id];
    if (!c) return;
    clienteRenovandoId = id;
    const plan = (gymConfig.planes||[]).find(p => p.nombre === c.plan);
    document.getElementById('renovar-nombre-label').textContent = `${c.nombre} — ${c.plan||'—'}`;
    document.getElementById('renovar-valor').value = plan ? plan.precio : (c.valor||'');
    document.getElementById('modal-detalle').classList.remove('open');
    document.getElementById('modal-renovar').classList.add('open');
  };

  window.cerrarModalRenovar = function() {
    document.getElementById('modal-renovar').classList.remove('open');
    clienteRenovandoId = null;
  };

  window.confirmarRenovar = function() {
    const id = clienteRenovandoId;
    if (!id || !currentGymId) return;
    const c = clientes[id];
    if (!c) return;
    const hoy = getFechaHoy();
    const fechaPago = calcFechaPago(hoy, c.plan);
    const valorRaw = document.getElementById('renovar-valor').value.replace(/\D/g,'');
    const valor = parseInt(valorRaw) || 0;
    db.ref(`gyms/${currentGymId}/clientes/${id}`).update({ fechaInicio: hoy, fechaPago, valor })
      .then(() => {
        db.ref(`gyms/${currentGymId}/pagos`).push({
          clienteId: id, nombre: c.nombre, plan: c.plan,
          valor, fecha: hoy, tipo: 'renovacion', ts: Date.now()
        });
        document.getElementById('modal-renovar').classList.remove('open');
        clienteRenovandoId = null;
        showToast('✅ Membresía renovada', 'green');
      });
  };

  document.getElementById('modal-renovar').addEventListener('click', function(e) { if(e.target===this) cerrarModalRenovar(); });

  // ══════════════════════════════════════════════
  // EDITAR / ELIMINAR CLIENTE
  // ══════════════════════════════════════════════
  window.editarCliente = function(id) {
    const c = clientes[id];
    if (!c) return;
    clienteEditandoId = id;
    document.getElementById('modal-titulo').textContent = 'EDITAR CLIENTE';
    document.getElementById('f-nombre').value = c.nombre||'';
    document.getElementById('f-cedula').value = c.cedula||'';
    document.getElementById('f-tel').value = c.telefono||'';
    document.getElementById('f-valor').value = c.valor||'';
    document.getElementById('f-notas').value = c.notas||'';
    document.getElementById('f-inicio').value = c.fechaInicio||getFechaHoy();
    cargarPlanesEnSelect();
    document.getElementById('f-plan').value = c.plan||'';
    setSaveStatus('saved', '✓ Guardado anteriormente');
    document.getElementById('modal-detalle').classList.remove('open');
    document.getElementById('modal-cliente').classList.add('open');
  };

  window.eliminarCliente = function(id) {
    if (!confirm('¿Eliminar este cliente? No se puede deshacer.')) return;
    db.ref(`gyms/${currentGymId}/clientes/${id}`).remove()
      .then(() => {
        document.getElementById('modal-detalle').classList.remove('open');
        showToast('🗑️ Cliente eliminado', 'red');
      });
  };

  // ══════════════════════════════════════════════
  // WHATSAPP
  // ══════════════════════════════════════════════
  window.waCliente = function(id) {
    const c = clientes[id];
    if (!c || !c.telefono) return;
    const est = getEstado(c);
    const dias = diasRestantes(c);
    let msg = `Hola ${c.nombre.split(' ')[0]} 👋, te escribimos desde *${gymConfig.nombre}*.\n`;
    if (est === 'vencido') msg += `⚠️ Tu membresía *venció hace ${Math.abs(dias)} días*. ¡Renueva y sigue entrenando! 💪`;
    else if (est === 'por-vencer') msg += `⏰ Tu membresía *vence en ${dias} días* (${fmtFecha(c.fechaPago)}). ¡Renueva a tiempo! 💪`;
    else msg += `✅ Tu membresía está al día hasta el *${fmtFecha(c.fechaPago)}*. ¡Sigue así! 🔥`;
    const phone = c.telefono.replace(/\D/g,'');
    window.open(`https://wa.me/57${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ══════════════════════════════════════════════
  // LISTA CLIENTES
  // ══════════════════════════════════════════════
  window.setFiltro = function(btn, filtro) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filtroActual = filtro;
    renderClientes();
  };

  window.renderClientes = function() {
    const q = (document.getElementById('search-inp')?.value || '').toLowerCase();
    let arr = Object.entries(clientes).map(([id,c]) => ({ id, ...c }));
    if (q) arr = arr.filter(c =>
      (c.nombre||'').toLowerCase().includes(q) ||
      (c.cedula||'').toString().includes(q) ||
      (c.telefono||'').includes(q)
    );
    if (filtroActual !== 'todos') arr = arr.filter(c => getEstado(c) === filtroActual);
    arr.sort((a,b) => {
      const ord = { vencido:0, 'por-vencer':1, activo:2 };
      return ord[getEstado(a)] - ord[getEstado(b)];
    });
    const el = document.getElementById('lista-clientes');
    if (!arr.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div>${q ? 'Sin resultados para "'+q+'"' : 'No hay clientes aún'}</div>`;
      return;
    }
    el.innerHTML = arr.map(c => {
      const est = getEstado(c);
      const dias = diasRestantes(c);
      const badgeClass = est==='activo' ? 'badge-activo' : est==='por-vencer' ? 'badge-vence' : 'badge-vencido';
      const badgeTxt = est==='activo' ? '✅ Al día' : est==='por-vencer' ? `⚠️ Vence en ${dias}d` : '❌ Vencido';
      return `<div class="cliente-card ${est}" onclick="verDetalle('${c.id}')">
        <div class="cliente-avatar">${iniciales(c.nombre)}</div>
        <div class="cliente-info">
          <div class="cliente-nombre">${c.nombre||'—'}</div>
          <div class="cliente-plan">${c.plan||'—'}${c.cedula ? ' · CC '+c.cedula : ''}</div>
        </div>
        <div class="cliente-right">
          <div class="estado-badge ${badgeClass}">${badgeTxt}</div>
          <div class="cliente-fecha">${fmtFecha(c.fechaPago)}</div>
        </div>
      </div>`;
    }).join('');
  };

  // ══════════════════════════════════════════════
  // STATS
  // ══════════════════════════════════════════════
  function renderStats() {
    const arr = Object.values(clientes);
    const total = arr.length;
    const activos = arr.filter(c => getEstado(c)==='activo').length;
    const porVencer = arr.filter(c => getEstado(c)==='por-vencer').length;
    const vencidos = arr.filter(c => getEstado(c)==='vencido').length;
    const hoy = new Date();
    const mesActual = hoy.getMonth(), anioActual = hoy.getFullYear();
    const ingresosMes = arr
      .filter(c => { if (!c.fechaInicio) return false; const d = new Date(c.fechaInicio+'T00:00:00'); return d.getMonth()===mesActual && d.getFullYear()===anioActual; })
      .reduce((s,c) => s+(parseInt(c.valor)||0), 0);

    const mesesLabels = [], mesesVals = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anioActual, mesActual-i, 1);
      const m = d.getMonth(), y = d.getFullYear();
      const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      mesesLabels.push(meses[m]);
      mesesVals.push(arr.filter(c => { if (!c.fechaInicio) return false; const cd = new Date(c.fechaInicio+'T00:00:00'); return cd.getMonth()===m && cd.getFullYear()===y; }).length);
    }
    const planCount = {};
    arr.forEach(c => { if (c.plan) planCount[c.plan] = (planCount[c.plan]||0)+1; });
    const topPlanes = Object.entries(planCount).sort((a,b) => b[1]-a[1]);
    const maxPlan = topPlanes.length ? topPlanes[0][1] : 1;

    document.getElementById('stats-content').innerHTML = `
      <div class="metrics">
        <div class="mcard"><div class="m-lbl">Total clientes</div><div class="m-val">${total}</div><div class="m-sub">registrados</div></div>
        <div class="mcard green"><div class="m-lbl">Al día</div><div class="m-val">${activos}</div><div class="m-sub">activos</div></div>
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
        ${topPlanes.length ? topPlanes.map(([n,c]) => `
          <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:12px;font-weight:700;color:var(--text);min-width:90px">${n}</span>
            <div style="flex:1;height:7px;background:var(--border);border-radius:4px;overflow:hidden">
              <div style="width:${Math.round(c/maxPlan*100)}%;height:100%;background:var(--gold);border-radius:4px"></div>
            </div>
            <span style="font-size:12px;font-weight:700;color:var(--gold);min-width:24px;text-align:right">${c}</span>
          </div>`).join('') : '<div class="empty-state" style="padding:20px 0">Sin datos aún</div>'}
      </div>`;

    if (chartMesInst) { chartMesInst.destroy(); chartMesInst = null; }
    const ctx = document.getElementById('chartMes');
    if (ctx) {
      chartMesInst = new Chart(ctx, {
        type: 'bar',
        data: { labels: mesesLabels, datasets: [{ data: mesesVals, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()||'#D4AF37', borderRadius: 6, borderSkipped: false }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#666', font: { size: 11 } }, grid: { display: false } }, y: { ticks: { color: '#666', font: { size: 11 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true } } }
      });
    }
  }

  // ══════════════════════════════════════════════
  // ALERTAS
  // ══════════════════════════════════════════════
  function renderAlertas() {
    const arr = Object.entries(clientes).map(([id,c]) => ({ id, ...c }))
      .filter(c => getEstado(c) !== 'activo')
      .sort((a,b) => getEstado(a)==='vencido' && getEstado(b)!=='vencido' ? -1 : 1);
    const el = document.getElementById('alertas-content');
    if (!arr.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div>¡Todo al día! No hay alertas</div>`;
      return;
    }
    el.innerHTML = `<div style="margin-bottom:14px">
      <button class="btn-gold" onclick="notificarTodos()" style="width:100%;padding:13px;font-size:13px">
        📱 Enviar WhatsApp a todos (${arr.length})
      </button>
    </div>` + arr.map(c => {
      const est = getEstado(c);
      const dias = diasRestantes(c);
      const msg = est==='vencido' ? `Venció hace ${Math.abs(dias)} días` : `Vence en ${dias} días`;
      return `<div class="notif-card">
        <div class="notif-dot ${est==='vencido'?'red':'yellow'}"></div>
        <div class="notif-info">
          <div class="notif-nombre">${c.nombre}</div>
          <div class="notif-msg">${msg} — ${c.plan||'—'}</div>
        </div>
        ${c.telefono ? `<button class="btn-notif-wa" onclick="waCliente('${c.id}')">💬 WA</button>` : ''}
      </div>`;
    }).join('');
  }

  window.notificarTodos = function() {
    const arr = Object.entries(clientes).map(([id,c]) => ({ id, ...c })).filter(c => getEstado(c)!=='activo' && c.telefono);
    if (!arr.length) { alert('No hay clientes con teléfono'); return; }
    arr.forEach(c => waCliente(c.id));
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
    Notification.requestPermission().then(p => {
      if (p==='granted') { alert('✅ ¡Notificaciones activadas!'); }
      else alert('❌ Permiso denegado');
    });
  };

  // ══════════════════════════════════════════════
  // CONFIG
  // ══════════════════════════════════════════════
  function renderConfig() {
    document.getElementById('config-content').innerHTML = `
      <div class="config-card">
        <h3>🏋️ Datos del Gym</h3>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Nombre del Gym</label>
          <input class="form-inp" id="cfg-nombre" value="${gymConfig.nombre||''}" placeholder="Mi Gym">
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Teléfono / WhatsApp</label>
          <input class="form-inp" id="cfg-tel" value="${gymConfig.telefono||''}" type="tel" placeholder="3001234567">
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Ciudad</label>
          <input class="form-inp" id="cfg-ciudad" value="${gymConfig.ciudad||''}" placeholder="Medellín">
        </div>
        <div class="gym-id-info">
          <span>🔗 Tu ID de acceso:</span>
          <strong style="color:var(--gold)">@${currentGymId}</strong>
          <button onclick="copiarLinkGym()" style="padding:4px 10px;background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--muted);font-size:11px;cursor:pointer">Copiar link</button>
        </div>
        <button class="btn-gold" onclick="guardarConfigGym()">💾 Guardar datos</button>
      </div>

      <div class="config-card">
        <h3>📋 Planes disponibles</h3>
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">El precio es referencia — al registrar un cliente puedes cambiarlo.</p>
        <div id="planes-lista">
          ${(gymConfig.planes||[]).map((p,i) => `
            <div class="plan-row">
              <input class="form-inp" value="${p.nombre}" id="plan-n-${i}" placeholder="Nombre" style="flex:2">
              <input class="form-inp" value="${p.dias}" id="plan-d-${i}" placeholder="Días" type="text" inputmode="numeric" style="flex:1">
              <input class="form-inp" value="${p.precio}" id="plan-p-${i}" placeholder="Precio" type="text" inputmode="numeric" style="flex:1">
              <button onclick="eliminarPlan(${i})" style="padding:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:var(--red);cursor:pointer">🗑️</button>
            </div>`).join('')}
        </div>
        <button onclick="agregarPlan()" style="width:100%;padding:12px;background:var(--dark4);border:1px solid var(--border);border-radius:10px;color:var(--gold);font-family:'Barlow',sans-serif;font-size:13px;font-weight:700;cursor:pointer;margin-top:10px">+ Agregar plan</button>
        <button class="btn-gold" style="margin-top:10px" onclick="guardarPlanes()">💾 Guardar planes</button>
      </div>

      <div class="config-card">
        <h3>👤 Mi perfil y apariencia</h3>
        <button class="btn-gold" onclick="abrirModalUserConfig()">🎨 Configuración de usuario</button>
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
        <p style="font-size:13px;color:var(--muted);margin-bottom:12px">Activa notificaciones del navegador para alertas de vencimientos.</p>
        <button class="notif-perm-btn" onclick="pedirNotifPermiso()">🔔 Activar notificaciones</button>
      </div>

      <div class="config-card" style="border-color:rgba(212,175,55,0.3)">
        <h3>📦 Mi plan — <span style="color:var(--gold);text-transform:uppercase">${gymConfig.plan||'FREE'}</span></h3>
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Plan actual de tu suscripción a GymPanel.</p>
        <div class="plan-features">
          <div class="plan-feat">✅ Clientes ilimitados</div>
          <div class="plan-feat">✅ Historial de pagos</div>
          <div class="plan-feat">✅ Exportar Excel/PDF</div>
          <div class="plan-feat ${gymConfig.plan==='free'?'disabled':''}">
            ${gymConfig.plan==='free'?'🔒':'✅'} Múltiples usuarios admin
          </div>
        </div>
        ${gymConfig.plan==='free' ? '<button class="btn-gold" style="margin-top:12px;font-size:13px" onclick="alert(\'Contacta al proveedor para upgrade\')">⚡ Upgrade a Pro</button>' : ''}
      </div>`;
  }

  window.guardarConfigGym = function() {
    if (!currentGymId) return;
    const nombre = document.getElementById('cfg-nombre').value.trim();
    const telefono = document.getElementById('cfg-tel').value.trim();
    const ciudad = document.getElementById('cfg-ciudad').value.trim();
    db.ref(`gyms/${currentGymId}/config`).update({ nombre, telefono, ciudad })
      .then(() => { updateGymNameUI(nombre); showToast('✅ Datos guardados', 'green'); });
  };

  window.agregarPlan = function() {
    gymConfig.planes = [...(gymConfig.planes||[]), { nombre: 'Nuevo plan', dias: 30, precio: 0 }];
    renderConfig();
  };

  window.eliminarPlan = function(i) {
    if (!confirm('¿Eliminar este plan?')) return;
    gymConfig.planes.splice(i, 1);
    renderConfig();
  };

  window.guardarPlanes = function() {
    const count = (gymConfig.planes||[]).length;
    const planes = [];
    for (let i = 0; i < count; i++) {
      const n = document.getElementById('plan-n-'+i)?.value.trim();
      const d = parseInt(document.getElementById('plan-d-'+i)?.value);
      const p = parseInt(document.getElementById('plan-p-'+i)?.value);
      if (n) planes.push({ nombre: n, dias: d||30, precio: p||0 });
    }
    gymConfig.planes = planes;
    db.ref(`gyms/${currentGymId}/config/planes`).set(planes)
      .then(() => showToast('✅ Planes guardados', 'green'));
  };

  window.cambiarPass = function() {
    const np = document.getElementById('cfg-newpass').value;
    if (!np || np.length < 4) { alert('Mínimo 4 caracteres'); return; }
    db.ref(`gyms/${currentGymId}/creds`).update({ pass: np })
      .then(() => { showToast('✅ Contraseña actualizada', 'green'); document.getElementById('cfg-newpass').value = ''; });
  };

  // ══════════════════════════════════════════════
  // CAJA
  // ══════════════════════════════════════════════
  let cajaMesFiltro = null;

  function renderCaja() {
    const arr = Object.entries(pagos).map(([id,p]) => ({ id, ...p })).sort((a,b) => (b.ts||0)-(a.ts||0));
    const hoy = new Date();
    const mesActual = hoy.getMonth(), anioActual = hoy.getFullYear();
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const resumenMeses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anioActual, mesActual-i, 1);
      const m = d.getMonth(), y = d.getFullYear();
      const pagosDelMes = arr.filter(p => { const pd = new Date(p.fecha+'T00:00:00'); return pd.getMonth()===m && pd.getFullYear()===y; });
      resumenMeses.push({ label: meses[m]+(y!==anioActual?' '+y:''), m, y, total: pagosDelMes.reduce((s,p)=>s+(p.valor||0),0), count: pagosDelMes.length });
    }
    const arrFiltrado = cajaMesFiltro===null ? arr : arr.filter(p => { const pd = new Date(p.fecha+'T00:00:00'); return pd.getMonth()===cajaMesFiltro.m && pd.getFullYear()===cajaMesFiltro.y; });
    const totalFiltrado = arrFiltrado.reduce((s,p)=>s+(p.valor||0),0);

    document.getElementById('caja-content').innerHTML = `
      <div class="caja-header">
        <div class="mcard" style="margin-bottom:0;flex:1">
          <div class="m-lbl">${cajaMesFiltro ? resumenMeses.find(r=>r.m===cajaMesFiltro.m&&r.y===cajaMesFiltro.y)?.label||'Mes' : 'Total acumulado'}</div>
          <div class="m-val" style="font-size:28px;color:var(--green)">${fmtCOP(totalFiltrado)}</div>
          <div class="m-sub">${arrFiltrado.length} pago${arrFiltrado.length!==1?'s':''}</div>
        </div>
      </div>
      <div class="section-title" style="margin:14px 0 8px">Resumen por mes</div>
      <div class="caja-meses">
        <button class="caja-mes-btn ${cajaMesFiltro===null?'active':''}" onclick="setCajaMes(null)">Todos</button>
        ${resumenMeses.map(r => `<button class="caja-mes-btn ${cajaMesFiltro&&cajaMesFiltro.m===r.m&&cajaMesFiltro.y===r.y?'active':''}" onclick="setCajaMes({m:${r.m},y:${r.y}})">${r.label}<br><span style="font-size:10px;opacity:0.7">${fmtCOP(r.total)}</span></button>`).join('')}
      </div>
      <div class="section-title" style="margin:16px 0 8px">Detalle de pagos</div>
      ${arrFiltrado.length===0
        ? `<div class="empty-state"><div class="empty-icon">💸</div>Sin pagos registrados${cajaMesFiltro?' en este mes':''}</div>`
        : arrFiltrado.map(p => `
          <div class="pago-card">
            <div class="pago-avatar">${(p.nombre||'?').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase()}</div>
            <div class="pago-info">
              <div class="pago-nombre">${p.nombre||'—'}</div>
              <div class="pago-meta">${p.plan||'—'} · ${fmtFecha(p.fecha)} · <span class="pago-tipo-${p.tipo||'nuevo'}">${p.tipo==='renovacion'?'🔄 Renovación':'🆕 Nuevo'}</span></div>
            </div>
            <div class="pago-valor">${fmtCOP(p.valor)}</div>
          </div>`).join('')}
      <div style="height:20px"></div>`;
  }

  window.setCajaMes = function(mes) { cajaMesFiltro = mes; renderCaja(); };

  // ══════════════════════════════════════════════
  // EXPORTAR
  // ══════════════════════════════════════════════
  window.exportarExcel = function() {
    const arr = Object.entries(clientes).map(([id,c]) => ({
      'Nombre': c.nombre||'', 'Cédula': c.cedula||'', 'Teléfono': c.telefono||'',
      'Plan': c.plan||'', 'Valor (COP)': c.valor||0,
      'Inicio': c.fechaInicio||'', 'Vencimiento': c.fechaPago||'',
      'Estado': getEstado(c)==='activo'?'Al día':getEstado(c)==='por-vencer'?'Por vencer':'Vencido',
      'Notas': c.notas||''
    }));
    if (!arr.length) { alert('No hay clientes para exportar'); return; }
    const ws = XLSX.utils.json_to_sheet(arr);
    ws['!cols'] = [22,14,14,14,14,12,12,12,24].map(w=>({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    const pagosArr = Object.values(pagos).sort((a,b)=>(b.ts||0)-(a.ts||0)).map(p => ({
      'Cliente': p.nombre||'', 'Plan': p.plan||'', 'Valor (COP)': p.valor||0, 'Fecha': p.fecha||'', 'Tipo': p.tipo==='renovacion'?'Renovación':'Nuevo'
    }));
    if (pagosArr.length) {
      const ws2 = XLSX.utils.json_to_sheet(pagosArr);
      ws2['!cols'] = [22,14,14,12,12].map(w=>({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws2, 'Historial pagos');
    }
    const nombre = (gymConfig.nombre||'GYM').replace(/\s+/g,'_');
    XLSX.writeFile(wb, `${nombre}_${getFechaHoy()}.xlsx`);
  };

  window.exportarPDF = function() {
    const arr = Object.entries(clientes).map(([id,c]) => ({ id, ...c })).sort((a,b) => { const ord={vencido:0,'por-vencer':1,activo:2}; return ord[getEstado(a)]-ord[getEstado(b)]; });
    if (!arr.length) { alert('No hay clientes'); return; }
    const gymNombre = gymConfig.nombre || 'GYM';
    const estadoColor = { activo:'#22c55e', 'por-vencer':'#eab308', vencido:'#ef4444' };
    const estadoTxt = { activo:'Al día', 'por-vencer':'Por vencer', vencido:'Vencido' };
    const filas = arr.map(c => { const est=getEstado(c); return `<tr><td>${c.nombre||'—'}</td><td>${c.cedula||'—'}</td><td>${c.plan||'—'}</td><td>${fmtCOP(c.valor)}</td><td>${fmtFecha(c.fechaInicio)}</td><td>${fmtFecha(c.fechaPago)}</td><td><span style="background:${estadoColor[est]}22;color:${estadoColor[est]};padding:2px 8px;border-radius:12px;font-weight:700;font-size:11px">${estadoTxt[est]}</span></td></tr>`; }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${gymNombre}</title><style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}h1{font-size:22px;margin-bottom:2px}.sub{color:#666;font-size:11px;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#111;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:8px 10px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#f9f9f9}.total{margin-top:14px;font-weight:700;font-size:13px}</style></head><body><h1>🏋️ ${gymNombre}</h1><div class="sub">@${currentGymId} · Generado el ${new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'})}</div><table><thead><tr><th>Nombre</th><th>Cédula</th><th>Plan</th><th>Valor</th><th>Inicio</th><th>Vencimiento</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table><div class="total">Total: ${arr.length} | Al día: ${arr.filter(c=>getEstado(c)==='activo').length} | Vencidos: ${arr.filter(c=>getEstado(c)==='vencido').length}</div></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.onload = () => win.print(); }
  };

  // ══════════════════════════════════════════════
  // SUPER ADMIN
  // ══════════════════════════════════════════════
  window.loginSuperAdmin = function() {
    const user = document.getElementById('sa-user').value.trim();
    const pass = document.getElementById('sa-pass').value;
    const errEl = document.getElementById('sa-err');
    if (user !== SA_USER || pass !== SA_PASS) {
      errEl.style.display = 'block';
      setTimeout(() => errEl.style.display = 'none', 3000);
      return;
    }
    document.getElementById('sa-login-wrap').style.display = 'none';
    document.getElementById('sa-panel').style.display = 'block';
    cargarPanelSA();
  };

  let _saGymsCache = [];

  window.saTab = function(tab, btn) {
    ['estadisticas','gyms','riesgo'].forEach(t => {
      document.getElementById('sa-tab-' + t).style.display = t === tab ? 'block' : 'none';
    });
    document.querySelectorAll('.sa-tab').forEach(b => b.classList.remove('sa-tab-active'));
    btn.classList.add('sa-tab-active');
  };

  window.filtrarGyms = function() {
    const q = (document.getElementById('sa-search')?.value || '').toLowerCase().trim();
    const lista = q ? _saGymsCache.filter(g =>
      (g.config?.nombre||'').toLowerCase().includes(q) ||
      g.id.toLowerCase().includes(q) ||
      (g.config?.ciudad||'').toLowerCase().includes(q)
    ) : _saGymsCache;
    document.getElementById('sa-gyms-list').innerHTML = renderGymsList(lista);
  };

  function renderGymsList(gymsList) {
    if (!gymsList.length) return '<div style="text-align:center;color:var(--muted);padding:32px;font-size:14px">No se encontraron gyms</div>';
    return gymsList.sort((a,b) => (b.config?.creadoEn||0)-(a.config?.creadoEn||0)).map(g => {
      const config = g.config||{};
      const numClientes = Object.keys(g.clientes||{}).length;
      const creadoEn = config.creadoEn ? new Date(config.creadoEn).toLocaleDateString('es-CO') : '—';
      return `<div class="sa-gym-card">
        <div class="sa-gym-header">
          <div>
            <div class="sa-gym-nombre">${config.nombre||g.id}</div>
            <div class="sa-gym-id">@${g.id}</div>
          </div>
          <span class="plan-badge plan-badge-${config.plan||'free'}">${(config.plan||'free').toUpperCase()}</span>
        </div>
        <div class="sa-gym-meta">
          <span>👥 ${numClientes} clientes</span>
          <span>📅 ${creadoEn}</span>
          <span>📍 ${config.ciudad||'—'}</span>
          <span>📞 ${config.telefono||'—'}</span>
        </div>
        <div class="sa-gym-actions">
          <button onclick="toggleGymActivo('${g.id}', ${config.activo!==false})" class="sa-btn ${config.activo!==false?'sa-btn-red':'sa-btn-green'}">
            ${config.activo!==false?'⏸ Suspender':'▶ Activar'}
          </button>
          <button onclick="cambiarPlanGym('${g.id}')" class="sa-btn sa-btn-gold">⚡ Cambiar plan</button>
        </div>
      </div>`;
    }).join('');
  }

  function cargarPanelSA() {
    db.ref('gyms').once('value').then(snap => {
      const gyms = snap.val() || {};
      const gymsList = Object.entries(gyms).map(([id, data]) => ({ id, ...data }));
      _saGymsCache = gymsList;

      const totalClientes = gymsList.reduce((s,g) => s+Object.keys(g.clientes||{}).length, 0);
      const suspendidos = gymsList.filter(g => g.config?.activo === false).length;
      const activos = gymsList.length - suspendidos;

      document.getElementById('sa-stats-txt').textContent = `${gymsList.length} gimnasio${gymsList.length!==1?'s':''} registrado${gymsList.length!==1?'s':''}`;

      // ── KPIs ──
      document.getElementById('kpi-gyms').textContent = activos;
      document.getElementById('kpi-gyms-sub').textContent = gymsList.length + ' registrados en total';
      document.getElementById('kpi-clientes').textContent = totalClientes.toLocaleString('es-CO');
      document.getElementById('kpi-clientes-sub').textContent = 'En todos los gyms';
      document.getElementById('kpi-promedio').textContent = gymsList.length ? Math.round(totalClientes / gymsList.length) : 0;
      document.getElementById('kpi-inactivos').textContent = suspendidos;

      // ── Planes ──
      const planes = { free: 0, pro: 0, enterprise: 0 };
      gymsList.forEach(g => { const p = g.config?.plan||'free'; planes[p] = (planes[p]||0) + 1; });
      const planColors = { free: '#888', pro: '#4a9eff', enterprise: '#d4af37' };
      const total = gymsList.length || 1;
      document.getElementById('sa-planes-grid').innerHTML = Object.entries(planes).map(([plan, count]) => `
        <div class="sa-plan-card">
          <div class="sa-plan-name" style="color:${planColors[plan]}">${plan.toUpperCase()}</div>
          <div class="sa-plan-val">${count}</div>
          <div class="sa-plan-pct">${Math.round(count/total*100)}% del total</div>
          <div class="sa-bar"><div class="sa-bar-fill" style="width:${Math.round(count/total*100)}%;background:${planColors[plan]}"></div></div>
        </div>`).join('');

      // ── Top 5 gyms ──
      const top5 = [...gymsList].sort((a,b) => Object.keys(b.clientes||{}).length - Object.keys(a.clientes||{}).length).slice(0,5);
      const maxClientes = Object.keys(top5[0]?.clientes||{}).length || 1;
      document.getElementById('sa-top-gyms').innerHTML = top5.map((g,i) => {
        const n = Object.keys(g.clientes||{}).length;
        return `<div class="sa-top-row">
          <div class="sa-top-rank">${i+1}</div>
          <div class="sa-top-info">
            <div class="sa-top-nombre">${g.config?.nombre||g.id}</div>
            <div class="sa-top-id">@${g.id} · ${g.config?.ciudad||'Sin ciudad'}</div>
            <div class="sa-bar" style="margin-top:5px"><div class="sa-bar-fill" style="width:${Math.round(n/maxClientes*100)}%;background:var(--gold)"></div></div>
          </div>
          <div class="sa-top-count">${n}</div>
        </div>`;
      }).join('');

      // ── Ciudades ──
      const ciudades = {};
      gymsList.forEach(g => { const c = g.config?.ciudad||'Sin ciudad'; ciudades[c] = (ciudades[c]||0) + 1; });
      const ciudadArr = Object.entries(ciudades).sort((a,b)=>b[1]-a[1]);
      document.getElementById('sa-ciudades').innerHTML = ciudadArr.map(([ciudad, count]) =>
        `<div class="sa-ciudad-row">
          <div class="sa-ciudad-name">📍 ${ciudad}</div>
          <div class="sa-bar" style="flex:1;max-width:200px"><div class="sa-bar-fill" style="width:${Math.round(count/ciudadArr[0][1]*100)}%;background:var(--gold)"></div></div>
          <div class="sa-ciudad-count">${count} gym${count!==1?'s':''}</div>
        </div>`).join('');

      // ── Lista de gyms (tab gyms) ──
      document.getElementById('sa-gyms-list').innerHTML = renderGymsList(gymsList);

      // ── En riesgo ──
      const ahora = Date.now();
      const DIAS30 = 30 * 24 * 60 * 60 * 1000;
      const enRiesgo = gymsList.filter(g => {
        const inactivo = g.config?.activo === false;
        const sinActividad = g.config?.ultimaActividad && (ahora - g.config.ultimaActividad) > DIAS30;
        return inactivo || sinActividad;
      });
      document.getElementById('sa-riesgo-list').innerHTML = enRiesgo.length
        ? enRiesgo.map(g => {
            const inactivo = g.config?.activo === false;
            const dias = g.config?.ultimaActividad ? Math.floor((ahora - g.config.ultimaActividad) / 86400000) : null;
            const motivo = inactivo ? 'Cuenta suspendida' : `Sin actividad hace ${dias} días`;
            const color = inactivo ? 'var(--red)' : '#f59e0b';
            return `<div class="sa-riesgo-card">
              <div class="sa-riesgo-dot" style="background:${color}"></div>
              <div class="sa-riesgo-info">
                <div class="sa-riesgo-nombre">${g.config?.nombre||g.id} <span style="color:var(--gold);font-size:12px">@${g.id}</span></div>
                <div class="sa-riesgo-motivo">${motivo} · ${g.config?.ciudad||'Sin ciudad'}</div>
              </div>
              <button onclick="toggleGymActivo('${g.id}', ${g.config?.activo!==false})" class="sa-btn ${g.config?.activo!==false?'sa-btn-red':'sa-btn-green'}" style="font-size:11px">
                ${g.config?.activo!==false?'Suspender':'Activar'}
              </button>
            </div>`;
          }).join('')
        : '<div class="sa-riesgo-empty">✅ Ningún gym en riesgo detectado</div>';
    });
  }

  window.toggleGymActivo = function(gymId, activo) {
    const msg = activo ? `¿Suspender el gym @${gymId}? No podrá acceder.` : `¿Reactivar el gym @${gymId}?`;
    if (!confirm(msg)) return;
    db.ref(`gyms/${gymId}/config/activo`).set(!activo).then(() => {
      showToast(activo ? '⏸ Gym suspendido' : '✅ Gym reactivado', activo ? 'red' : 'green');
      cargarPanelSA();
    });
  };

  window.cambiarPlanGym = function(gymId) {
    const plan = prompt('Plan para @' + gymId + ':\nOpciones: free, pro, enterprise', 'pro');
    if (!plan) return;
    db.ref(`gyms/${gymId}/config/plan`).set(plan.toLowerCase()).then(() => {
      showToast('✅ Plan actualizado a ' + plan, 'green');
      cargarPanelSA();
    });
  };

  window.exportarSAExcel = function() {
    db.ref('gyms').once('value').then(snap => {
      const gyms = snap.val() || {};
      const arr = Object.entries(gyms).map(([id, data]) => ({
        'ID': id,
        'Nombre': data.config?.nombre||'',
        'Ciudad': data.config?.ciudad||'',
        'Teléfono': data.config?.telefono||'',
        'Plan': data.config?.plan||'free',
        'Clientes': Object.keys(data.clientes||{}).length,
        'Creado': data.config?.creadoEn ? new Date(data.config.creadoEn).toLocaleDateString('es-CO') : '',
        'Activo': data.config?.activo!==false ? 'Sí' : 'No'
      }));
      const ws = XLSX.utils.json_to_sheet(arr);
      ws['!cols'] = [20,24,16,16,12,10,14,8].map(w=>({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Gimnasios');
      XLSX.writeFile(wb, `GymPanel_gyms_${getFechaHoy()}.xlsx`);
    });
  };

})();
