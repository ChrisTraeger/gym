// Registro / acceso con código: celular (SMS, Firebase Auth) o correo (Cloud Functions).
let otpTelUsado = '', otpModo = 'registro', otpMet = 'tel', otpConf = null, otpRecaptcha = null, otpEmail = '';

window.lpTab = n => {
  document.getElementById('lp-p1').style.display = n === 1 ? 'block' : 'none';
  document.getElementById('lp-p2').style.display = n === 2 ? 'block' : 'none';
  document.getElementById('lp-t1').classList.toggle('on', n === 1);
  document.getElementById('lp-t2').classList.toggle('on', n === 2);
};
const otpErr = m => { const e = document.getElementById('reg-err'); e.textContent = m; e.style.display = m ? 'block' : 'none'; };
window.otpPaso = n => { [1,2,3].forEach(i => document.getElementById('otp-s'+i).style.display = i === n ? 'block' : 'none'); otpErr(''); };

// Sobrescribe el registro: ahora arranca en el paso del nombre/ID
window.mostrarRegistro = () => {
  otpModo = 'registro'; ocultarTodas();
  document.getElementById('registro-screen').style.display = 'flex';
  document.getElementById('otp-title').textContent = 'Crea tu gimnasio'; otpPaso(1);
};
window.abrirOtpLogin = () => {
  otpModo = 'login'; ocultarTodas();
  document.getElementById('registro-screen').style.display = 'flex';
  document.getElementById('otp-title').textContent = 'Entrar con código'; otpPaso(2);
};
window.otpPaso1 = () => {
  const n = document.getElementById('reg-nombre').value.trim(), g = document.getElementById('reg-gymid').value.trim();
  if (!n || g.length < 3) return otpErr('Escribe el nombre y un ID de al menos 3 letras');
  if (!gymIdDisponible) return otpErr('Ese ID ya está en uso. Prueba con otro');
  otpPaso(2);
};
// País por defecto según el idioma del navegador (si no, Colombia)
(() => { const r = ((navigator.language || '').split('-')[1] || '').toUpperCase(), sel = document.getElementById('otp-pais');
  sel.value = [...sel.options].some(o => o.value === r) ? r : 'CO'; })();

window.otpMetodo = m => {
  otpMet = m;
  document.getElementById('otp-mt').classList.toggle('on', m === 'tel');
  document.getElementById('otp-mm').classList.toggle('on', m === 'mail');
  const d = document.getElementById('otp-dest');
  d.type = m === 'tel' ? 'tel' : 'email'; d.value = '';
  document.getElementById('otp-pais').style.display = m === 'tel' ? 'block' : 'none';
  d.placeholder = m === 'tel' ? '300 123 4567' : 'tu@correo.com';
  document.getElementById('otp-lbl').textContent = m === 'tel' ? 'Número de celular' : 'Correo electrónico';
  document.getElementById('otp-send').textContent = m === 'tel' ? 'Enviar código' : 'Enviar enlace';
};
// Limpia el reCAPTCHA anterior y deja un contenedor nuevo y vacío
function otpResetRecaptcha() {
  try { if (otpRecaptcha) otpRecaptcha.clear(); } catch (_) {}
  otpRecaptcha = null;
  const old = document.getElementById('otp-recaptcha'), nuevo = document.createElement('div');
  nuevo.id = 'otp-recaptcha'; old.replaceWith(nuevo);
}
window.otpEnviar = async () => {
  const btn = document.getElementById('otp-send'), v = document.getElementById('otp-dest').value.trim();
  otpErr(''); btn.disabled = true;
  try {
    if (otpMet === 'tel') {
      const cc = document.getElementById('otp-pais').selectedOptions[0].dataset.cc;
      let tel = v.replace(/[\s()-]/g, '');
      if (!tel.startsWith('+')) tel = '+' + cc + tel.replace(/^0+/, '');
      otpTelUsado = tel;
      if (!/^\+\d{10,15}$/.test(tel)) throw { message: 'Revisa el número de celular' };
      otpResetRecaptcha();
      otpRecaptcha = new firebase.auth.RecaptchaVerifier('otp-recaptcha', { size: 'invisible' });
      otpConf = await auth.signInWithPhoneNumber(tel, otpRecaptcha);
      document.getElementById('otp-info').textContent = 'Enviamos un código por SMS a ' + tel;
    } else {
      if (!/^\S+@\S+\.\S+$/.test(v)) throw { message: 'Revisa el correo' };
      otpEmail = v.toLowerCase();
      localStorage.setItem('otpPending', JSON.stringify({
        email: otpEmail, modo: otpModo,
        gymId: otpModo === 'registro' ? document.getElementById('reg-gymid').value.trim() : (currentGymId || getGymIdFromURL()),
        nombre: document.getElementById('reg-nombre').value.trim() }));
      await auth.sendSignInLinkToEmail(otpEmail, { url: location.origin + location.pathname, handleCodeInApp: true });
      document.getElementById('otp-info').textContent = 'Te enviamos un enlace a ' + otpEmail + '. Ábrelo en este mismo navegador para continuar. Revisa también spam.';
    }
    const esMail = otpMet === 'mail';
    document.getElementById('otp-code').style.display = esMail ? 'none' : 'block';
    document.querySelector('#otp-s3 .lp-btn').style.display = esMail ? 'none' : 'block';
    otpPaso(3); if (otpMet === 'tel') document.getElementById('otp-code').focus();
  } catch (e) { otpResetRecaptcha(); otpErr('No se pudo enviar' + (otpMet === 'tel' && otpTelUsado ? ' a ' + otpTelUsado : '') + ': ' + (e.message || 'intenta de nuevo')); }
  btn.disabled = false;
};
window.otpVerificar = async () => {
  const code = document.getElementById('otp-code').value.trim();
  if (code.length !== 6) return otpErr('El código tiene 6 dígitos');
  try {
    const user = (await otpConf.confirm(code)).user;
    await otpFinalizar(user, otpModo, document.getElementById('reg-gymid').value.trim(), document.getElementById('reg-nombre').value.trim());
  } catch (e) { otpErr('Código incorrecto o vencido'); }
};

async function otpFinalizar(user, modo, gymId, nombre) {
  if (modo === 'registro') return crearGymConGoogleUser(user, gymId, nombre);
  const gid = gymId || currentGymId || getGymIdFromURL();
  const snap = gid && await db.ref(`gyms/${gid}/usuarios/${user.uid}`).once('value');
  if (snap && snap.val()) {
    currentGymId = gid;
    setupCurrentUser({ name: snap.val().nombre || 'Admin', email: user.email || '', photo: '', uid: user.uid, loginType: 'otp' });
    entrarAlApp();
  } else { await auth.signOut(); otpErr('Esta cuenta no tiene acceso a ese gimnasio. Primero escribe su ID en el inicio.'); }
}

// Al volver desde el enlace del correo
if (auth.isSignInWithEmailLink(location.href)) {
  const p = JSON.parse(localStorage.getItem('otpPending') || 'null');
  const email = (p && p.email) || prompt('Confirma tu correo para continuar');
  auth.signInWithEmailLink(email, location.href).then(async r => {
    localStorage.removeItem('otpPending');
    history.replaceState({}, '', location.pathname);
    if (!p) return;
    if (p.modo === 'login') { otpModo = 'login'; ocultarTodas(); document.getElementById('registro-screen').style.display = 'flex'; otpPaso(2); }
    await otpFinalizar(r.user, p.modo, p.gymId, p.nombre);
  }).catch(() => alert('El enlace venció o ya se usó. Pide uno nuevo.'));
}
