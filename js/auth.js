// ══════════════════════════════════════════════
// NAVEGACIÓN ENTRE PANTALLAS
// ══════════════════════════════════════════════
function ocultarTodas() {
  ['landing-screen','registro-screen','login-screen','superadmin-screen'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  document.getElementById('app').style.display = 'none';
}

function mostrarLanding() {
  ocultarTodas();
  document.getElementById('landing-screen').style.display = 'flex';
}

window.mostrarRegistro  = () => { ocultarTodas(); document.getElementById('registro-screen').style.display = 'flex'; };
window.mostrarSuperAdmin = () => { ocultarTodas(); document.getElementById('superadmin-screen').style.display = 'flex'; };

window.volverLanding = function() {
  limpiarListenersGym();
  currentGymId = null;
  setGymIdInURL(null);
  ocultarTodas();
  document.getElementById('app').style.display = 'none';
  mostrarLanding();
};

// ══════════════════════════════════════════════
// INICIALIZACIÓN
// ══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  loadUserPrefs();
  const gymIdFromURL = getGymIdFromURL();
  if (gymIdFromURL) cargarGymYMostrarLogin(gymIdFromURL);
  else              mostrarLanding();
});

// ══════════════════════════════════════════════
// LANDING → GYM
// ══════════════════════════════════════════════
window.irAlGym = function() {
  const gymId = document.getElementById('inp-gym-id').value.trim().toLowerCase();
  if (gymId) cargarGymYMostrarLogin(gymId);
};
document.getElementById('inp-gym-id').addEventListener('keydown', e => { if (e.key === 'Enter') irAlGym(); });

function cargarGymYMostrarLogin(gymId) {
  const errEl = document.getElementById('gym-not-found-err');
  if (errEl) errEl.style.display = 'none';
  db.ref(`gyms/${gymId}/config`).once('value').then(snap => {
    const config = snap.val();
    if (!config) {
      if (errEl) { errEl.style.display = 'block'; setTimeout(() => errEl.style.display = 'none', 3000); }
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
  updateGymNameUI(gymConfig.nombre || currentGymId);
  document.getElementById('gymid-badge').textContent = currentGymId ? '@' + currentGymId : '';
  const gymLoginWrap = document.getElementById('gym-login-wrap');
  if (gymLoginWrap) gymLoginWrap.style.display = currentGymId ? 'none' : 'block';
  auth.onAuthStateChanged(user => {
    if (user && currentGymId) {
      db.ref(`gyms/${currentGymId}/usuarios/${user.uid}`).once('value').then(snap => {
        if (snap.val()) {
          setupCurrentUser({ name: user.displayName||'Admin', email: user.email||'', photo: user.photoURL||'', uid: user.uid, loginType: 'google' });
          entrarAlApp();
        }
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
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 30);
  document.getElementById('reg-gymid').value = generado;
  if (generado) verificarGymId();
};

window.verificarGymId = function() {
  const gymId  = document.getElementById('reg-gymid').value.trim();
  const check   = document.getElementById('gymid-check');
  const preview = document.getElementById('gymid-preview');
  gymIdDisponible = false;
  if (!gymId || gymId.length < 3) { check.textContent = ''; preview.innerHTML = 'gympanel.app/<b>tu-id</b>'; return; }
  preview.innerHTML = `gympanel.app/<b>${gymId}</b>`;
  check.textContent = '⏳';
  db.ref(`gyms/${gymId}/config`).once('value').then(snap => {
    gymIdDisponible = !snap.val();
    check.textContent = gymIdDisponible ? '✅' : '❌';
  });
};

const PLANES_DEFAULT = [
  { nombre: 'Mensual',    dias: 30,  precio: 80000  },
  { nombre: 'Quincenal', dias: 15,  precio: 50000  },
  { nombre: 'Trimestral',dias: 90,  precio: 220000 }
];

window.registrarGym = function() {
  const nombre  = document.getElementById('reg-nombre').value.trim();
  const gymId   = document.getElementById('reg-gymid').value.trim();
  const tel     = document.getElementById('reg-tel').value.trim();
  const ciudad  = document.getElementById('reg-ciudad').value.trim();
  const usuario = document.getElementById('reg-user').value.trim();
  const pass    = document.getElementById('reg-pass').value;
  const errEl   = document.getElementById('reg-err');
  errEl.style.display = 'none';

  if (!nombre || !gymId || !usuario || !pass) { errEl.textContent = '❌ Completa todos los campos obligatorios (*)'; errEl.style.display = 'block'; return; }
  if (gymId.length < 3) { errEl.textContent = '❌ El ID del gym debe tener al menos 3 caracteres'; errEl.style.display = 'block'; return; }
  if (pass.length < 4)  { errEl.textContent = '❌ La contraseña debe tener al menos 4 caracteres'; errEl.style.display = 'block'; return; }
  if (!gymIdDisponible) { errEl.textContent = '❌ Ese ID ya está en uso. Elige otro.'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('btn-registrar');
  btn.disabled = true; btn.textContent = '⏳ Creando...';

  const nuevaConfig = { nombre, telefono: tel, ciudad, planes: PLANES_DEFAULT, plan: 'free', creadoEn: Date.now(), activo: true };

  db.ref(`gyms/${gymId}/config`).once('value').then(snap => {
    if (snap.val()) { errEl.textContent = '❌ Ese ID ya fue tomado. Elige otro.'; errEl.style.display = 'block'; btn.disabled = false; btn.textContent = 'CREAR MI GYM →'; return; }
    return db.ref(`gyms/${gymId}`).set({ config: nuevaConfig, creds: { user: usuario, pass }, clientes: {}, pagos: {} });
  }).then(() => {
    showToast('✅ ¡Gym creado exitosamente!', 'green');
    currentGymId = gymId; gymConfig = nuevaConfig;
    setGymIdInURL(gymId);
    setTimeout(() => mostrarLoginGym(), 1200);
  }).catch(e => { errEl.textContent = '❌ Error: ' + e.message; errEl.style.display = 'block'; btn.disabled = false; btn.textContent = 'CREAR MI GYM →'; });
};

document.getElementById('btn-google-reg').addEventListener('click', () => {
  const gymId  = document.getElementById('reg-gymid').value.trim();
  const nombre = document.getElementById('reg-nombre').value.trim();
  const errEl  = document.getElementById('reg-err');
  if (!nombre || !gymId) { errEl.textContent = '❌ Primero completa el nombre y el ID del gym'; errEl.style.display = 'block'; return; }
  if (!gymIdDisponible)  { errEl.textContent = '❌ Verifica que el ID esté disponible'; errEl.style.display = 'block'; return; }
  const provider = new firebase.auth.GoogleAuthProvider();
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    db.ref('_pendingRegs/pendingReg_' + gymId).set({ gymId, nombre, ts: Date.now() })
      .then(() => auth.signInWithRedirect(provider));
  } else {
    auth.signInWithPopup(provider).then(r => crearGymConGoogleUser(r.user, gymId, nombre))
      .catch(e => { if (e.code !== 'auth/popup-closed-by-user') { errEl.textContent = '❌ Error Google: ' + e.message; errEl.style.display = 'block'; } });
  }
});

function crearGymConGoogleUser(user, gymId, nombre) {
  const config = { nombre, telefono: '', ciudad: '', planes: PLANES_DEFAULT, plan: 'free', creadoEn: Date.now(), activo: true };
  db.ref(`gyms/${gymId}`).set({
    config,
    creds: { user: user.email, pass: '' },
    usuarios: { [user.uid]: { nombre: user.displayName, email: user.email, rol: 'admin' } },
    clientes: {}, pagos: {}
  }).then(() => {
    currentGymId = gymId; gymConfig = config;
    setGymIdInURL(gymId);
    setupCurrentUser({ name: user.displayName||'Admin', email: user.email, photo: user.photoURL||'', uid: user.uid, loginType: 'google' });
    entrarAlApp();
  });
}

// ══════════════════════════════════════════════
// LOGIN MANUAL
// ══════════════════════════════════════════════
document.getElementById('btn-login').addEventListener('click', doLogin);
document.getElementById('inp-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('inp-user').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('inp-pass').focus(); });
const inpGymLogin = document.getElementById('inp-gym-login');
if (inpGymLogin) inpGymLogin.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('inp-user').focus(); });

function doLogin() {
  const gymLoginInput = document.getElementById('inp-gym-login');
  if (gymLoginInput && gymLoginInput.value.trim() && !currentGymId) {
    const gymIdDirecto = gymLoginInput.value.trim().toLowerCase();
    db.ref(`gyms/${gymIdDirecto}/config`).once('value').then(snap => {
      if (!snap.exists()) { _loginErr('❌ Gimnasio no encontrado', 3000); return; }
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
      _loginErr('❌ Usuario o contraseña incorrectos', 3000);
    }
  });
}

function _loginErr(msg, ms) {
  const err = document.getElementById('login-err');
  err.textContent = msg; err.style.display = 'block';
  setTimeout(() => err.style.display = 'none', ms);
}

// ══════════════════════════════════════════════
// GOOGLE LOGIN (gym existente + redirect móvil)
// ══════════════════════════════════════════════
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

auth.getRedirectResult().then(result => {
  if (!result || !result.user) return;
  db.ref('_pendingRegs').orderByChild('ts').limitToLast(10).once('value').then(snap => {
    const regs = snap.val() || {};
    const pendingEntry = Object.entries(regs).find(([key]) => key.startsWith('pendingReg_'));
    if (pendingEntry) {
      const [key, { gymId, nombre }] = pendingEntry;
      db.ref('_pendingRegs/' + key).remove();
      crearGymConGoogleUser(result.user, gymId, nombre);
      return;
    }
    const pending = sessionStorage.getItem('pendingGymReg');
    if (pending) {
      sessionStorage.removeItem('pendingGymReg');
      const { gymId, nombre } = JSON.parse(pending);
      crearGymConGoogleUser(result.user, gymId, nombre);
      return;
    }
    if (currentGymId) {
      db.ref(`gyms/${currentGymId}/usuarios/${result.user.uid}`).once('value').then(snap => {
        if (snap.val()) {
          setupCurrentUser({ name: result.user.displayName||'Admin', email: result.user.email||'', photo: result.user.photoURL||'', uid: result.user.uid, loginType: 'google' });
          entrarAlApp();
        }
      });
    }
  });
}).catch(() => {});

document.getElementById('btn-google-login').addEventListener('click', () => {
  const btn = document.getElementById('btn-google-login');
  btn.disabled = true; btn.textContent = '⏳ Conectando…';
  const provider = new firebase.auth.GoogleAuthProvider();
  if (isMobile) {
    auth.signInWithRedirect(provider).catch(() => { btn.disabled = false; btn.textContent = 'Continuar con Google'; });
  } else {
    auth.signInWithPopup(provider).then(result => {
      if (!currentGymId) return;
      db.ref(`gyms/${currentGymId}/usuarios/${result.user.uid}`).once('value').then(snap => {
        if (snap.val()) {
          setupCurrentUser({ name: result.user.displayName||'Admin', email: result.user.email||'', photo: result.user.photoURL||'', uid: result.user.uid, loginType: 'google' });
          entrarAlApp();
        } else {
          alert('Tu cuenta Google no tiene acceso a este gym. Usa usuario/contraseña.');
          btn.disabled = false; btn.innerHTML = '<svg>...</svg> Continuar con Google';
        }
      });
    }).catch(e => {
      btn.disabled = false; btn.textContent = 'Continuar con Google';
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') alert('Error Google: ' + e.message);
    });
  }
});

// ══════════════════════════════════════════════
// LOGOUT
// ══════════════════════════════════════════════
window.doLogout = function() {
  auth.signOut().catch(()=>{});
  limpiarListenersGym();
  currentGymId = null; currentUser = null;
  document.getElementById('user-menu').style.display = 'none';
  setGymIdInURL(null);
  ocultarTodas();
  mostrarLanding();
};
document.getElementById('btn-logout').addEventListener('click', doLogout);
