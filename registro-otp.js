// Registro / acceso con código: celular (SMS, Firebase Auth) o correo (Cloud Functions).
let otpModo = 'registro', otpMet = 'tel', otpConf = null, otpRecaptcha = null, otpEmail = '';

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
window.otpMetodo = m => {
  otpMet = m;
  document.getElementById('otp-mt').classList.toggle('on', m === 'tel');
  document.getElementById('otp-mm').classList.toggle('on', m === 'mail');
  const d = document.getElementById('otp-dest');
  d.type = m === 'tel' ? 'tel' : 'email'; d.value = '';
  d.placeholder = m === 'tel' ? '+57 300 123 4567' : 'tu@correo.com';
  document.getElementById('otp-lbl').textContent = m === 'tel' ? 'Número de celular' : 'Correo electrónico';
};
window.otpEnviar = async () => {
  const btn = document.getElementById('otp-send'), v = document.getElementById('otp-dest').value.trim();
  otpErr(''); btn.disabled = true;
  try {
    if (otpMet === 'tel') {
      let tel = v.replace(/[\s()-]/g, ''); if (!tel.startsWith('+')) tel = '+57' + tel;
      if (!/^\+\d{10,15}$/.test(tel)) throw { message: 'Revisa el número de celular' };
      if (!otpRecaptcha) otpRecaptcha = new firebase.auth.RecaptchaVerifier('otp-recaptcha', { size: 'invisible' });
      otpConf = await auth.signInWithPhoneNumber(tel, otpRecaptcha);
      document.getElementById('otp-info').textContent = 'Enviamos un código por SMS a ' + tel;
    } else {
      if (!/^\S+@\S+\.\S+$/.test(v)) throw { message: 'Revisa el correo' };
      otpEmail = v.toLowerCase();
      await firebase.functions().httpsCallable('enviarCodigoEmail')({ email: otpEmail });
      document.getElementById('otp-info').textContent = 'Enviamos un código a ' + otpEmail + '. Revisa también spam.';
    }
    otpPaso(3); document.getElementById('otp-code').focus();
  } catch (e) { otpErr('No se pudo enviar: ' + (e.message || 'intenta de nuevo')); if (otpRecaptcha) { otpRecaptcha.clear(); otpRecaptcha = null; } }
  btn.disabled = false;
};
window.otpVerificar = async () => {
  const code = document.getElementById('otp-code').value.trim();
  if (code.length !== 6) return otpErr('El código tiene 6 dígitos');
  try {
    let user;
    if (otpMet === 'tel') user = (await otpConf.confirm(code)).user;
    else {
      const r = await firebase.functions().httpsCallable('verificarCodigoEmail')({ email: otpEmail, code });
      user = (await auth.signInWithCustomToken(r.data.token)).user;
    }
    if (otpModo === 'registro')
      return crearGymConGoogleUser(user, document.getElementById('reg-gymid').value.trim(), document.getElementById('reg-nombre').value.trim());
    // modo login: buscar el gym donde este usuario es admin
    const gid = currentGymId || getGymIdFromURL();
    const snap = gid && await db.ref(`gyms/${gid}/usuarios/${user.uid}`).once('value');
    if (snap && snap.val()) {
      setupCurrentUser({ name: snap.val().nombre || 'Admin', email: user.email || '', photo: '', uid: user.uid, loginType: 'otp' });
      entrarAlApp();
    } else { await auth.signOut(); otpErr('Esta cuenta no tiene acceso a ese gimnasio. Primero escribe su ID en el inicio.'); }
  } catch (e) { otpErr('Código incorrecto o vencido'); }
};
