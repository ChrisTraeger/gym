// firebase deploy --only functions   (requiere plan Blaze)
// firebase functions:config:set mail.user="tucorreo@gmail.com" mail.pass="CLAVE_DE_APLICACION_GMAIL"
const functions = require('firebase-functions'), admin = require('firebase-admin'), nodemailer = require('nodemailer'), crypto = require('crypto');
admin.initializeApp();
const tx = nodemailer.createTransport({ service: 'gmail', auth: { user: functions.config().mail.user, pass: functions.config().mail.pass } });
const key = e => Buffer.from(e).toString('hex');
const hash = (e, c) => crypto.createHash('sha256').update(e + c).digest('hex');

exports.enviarCodigoEmail = functions.https.onCall(async ({ email }) => {
  if (!/^\S+@\S+\.\S+$/.test(email || '')) throw new functions.https.HttpsError('invalid-argument', 'Correo inválido');
  const ref = admin.database().ref('_otp/' + key(email)), prev = (await ref.once('value')).val();
  if (prev && Date.now() - prev.ts < 30000) throw new functions.https.HttpsError('resource-exhausted', 'Espera 30 segundos');
  const code = String(crypto.randomInt(100000, 1000000));
  await ref.set({ h: hash(email, code), ts: Date.now(), n: 0 });
  await tx.sendMail({ from: 'GymPanel <' + functions.config().mail.user + '>', to: email, subject: 'Tu código GymPanel: ' + code, text: `Tu código es ${code}. Vence en 10 minutos.` });
  return { ok: true };
});

exports.verificarCodigoEmail = functions.https.onCall(async ({ email, code }) => {
  const ref = admin.database().ref('_otp/' + key(email)), d = (await ref.once('value')).val();
  if (!d || Date.now() - d.ts > 600000 || d.n >= 5 || d.h !== hash(email, code)) {
    if (d) await ref.update({ n: d.n + 1 });
    throw new functions.https.HttpsError('permission-denied', 'Código inválido');
  }
  await ref.remove();
  let u; try { u = await admin.auth().getUserByEmail(email); } catch { u = await admin.auth().createUser({ email, emailVerified: true }); }
  return { token: await admin.auth().createCustomToken(u.uid) };
});
