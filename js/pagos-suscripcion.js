// ══════════════════════════════════════════════
// SISTEMA DE PAGOS — SUSCRIPCIÓN DE GYMS
// ══════════════════════════════════════════════
const PLANES_CONFIG = {
  free:       { nombre: 'Free',       precio_mes: 0,      precio_anual: 0,      clientes_max: 30,   features: ['Hasta 30 clientes', 'Panel básico', 'Exportar Excel'] },
  pro:        { nombre: 'Pro',        precio_mes: 49900,  precio_anual: 499000, clientes_max: 999,  features: ['Clientes ilimitados', 'Historial de pagos', 'WhatsApp masivo', 'Múltiples admins', 'Soporte prioritario'] },
  enterprise: { nombre: 'Enterprise', precio_mes: 129900, precio_anual: 1299000,clientes_max: 9999, features: ['Todo Pro', 'Múltiples sedes', 'API acceso', 'Onboarding personalizado'] }
};

const NEQUI_NUM       = '3001234567';
const BANCOLOMBIA_NUM = '123-456789-12';

window._periodoPago = 'mes';

// Chequear suscripción al entrar al app
function checkSuscripcion() {
  if (!currentGymId) return;
  const plan  = gymConfig.plan || 'free';
  if (plan === 'free') return;
  const vence = gymConfig.planVence;
  if (!vence) return;
  const diasLeft = Math.ceil((vence - Date.now()) / 86400000);
  if (diasLeft <= 0) {
    db.ref(`gyms/${currentGymId}/config/activo`).set(false);
    db.ref(`gyms/${currentGymId}/config/plan`).set('free');
    showToast('⚠️ Tu plan venció. Ahora estás en Free.', 'red');
    gymConfig.plan = 'free'; gymConfig.activo = false;
    actualizarPlanIndicator();
    mostrarModalPago();
  } else if (diasLeft <= 5) {
    _mostrarBannerPago(`⚠️ Tu plan ${plan.toUpperCase()} vence en ${diasLeft} día${diasLeft!==1?'s':''}. ¡Renueva para no perder acceso!`);
  }
}

function _mostrarBannerPago(txt) {
  const banner = document.getElementById('banner-pago');
  if (!banner) return;
  banner.style.display = 'flex';
  banner.querySelector('.banner-txt').textContent = txt;
}

// ── Inyectar banner si no existe ──
window.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('banner-pago')) {
    const banner = document.createElement('div');
    banner.id = 'banner-pago';
    banner.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;z-index:999;background:#92400e;color:#fef3c7;padding:10px 16px;font-size:13px;font-weight:700;align-items:center;justify-content:space-between;gap:10px';
    banner.innerHTML = `<span class="banner-txt"></span>
      <button onclick="mostrarModalPago()" style="padding:6px 14px;background:#fef3c7;color:#92400e;border:none;border-radius:6px;font-weight:800;font-size:12px;cursor:pointer">Renovar ahora</button>`;
    document.body.prepend(banner);
  }
});

// ── Modal pago ──
window.mostrarModalPago = function(planObjetivo) {
  if (!document.getElementById('modal-pago')) _inyectarModalPago();
  _renderModalPago(planObjetivo || null);
  document.getElementById('modal-pago').classList.add('open');
};

function _inyectarModalPago() {
  const div = document.createElement('div');
  div.id = 'modal-pago';
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-box" style="max-width:520px;max-height:90vh;overflow-y:auto"><div id="modal-pago-content"></div></div>`;
  div.addEventListener('click', e => { if (e.target === div) div.classList.remove('open'); });
  document.body.appendChild(div);
}

function _renderModalPago() {
  const planActual = gymConfig.plan || 'free';
  const content    = document.getElementById('modal-pago-content');
  if (!content) return;
  const periodo    = window._periodoPago;
  content.innerHTML = `
    <div style="padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h2 style="font-size:18px;font-weight:800;color:var(--gold);margin:0">⚡ Planes GymPanel</h2>
        <button onclick="document.getElementById('modal-pago').classList.remove('open')" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer">✕</button>
      </div>
      <div style="display:flex;background:var(--dark4);border-radius:10px;padding:4px;margin-bottom:20px;gap:4px">
        <button id="btn-periodo-mes"   onclick="setPeriodoPago('mes')"   style="flex:1;padding:8px;border-radius:8px;border:none;font-family:'Barlow',sans-serif;font-weight:700;font-size:13px;cursor:pointer;background:${periodo==='mes'?'var(--gold)':'transparent'};color:${periodo==='mes'?'#000':'var(--muted)'}">Mensual</button>
        <button id="btn-periodo-anual" onclick="setPeriodoPago('anual')" style="flex:1;padding:8px;border-radius:8px;border:none;font-family:'Barlow',sans-serif;font-weight:700;font-size:13px;cursor:pointer;background:${periodo==='anual'?'var(--gold)':'transparent'};color:${periodo==='anual'?'#000':'var(--muted)'}">Anual <span style="font-size:10px;color:#22c55e">−17%</span></button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${Object.entries(PLANES_CONFIG).map(([key, p]) => {
          const esActual    = key === planActual;
          const precio      = periodo === 'anual' ? p.precio_anual : p.precio_mes;
          const precioLabel = precio === 0 ? 'Gratis' : '$' + precio.toLocaleString('es-CO') + (periodo === 'anual' ? '/año' : '/mes');
          return `<div style="border:2px solid ${esActual?'var(--gold)':'var(--border)'};border-radius:14px;padding:16px;position:relative">
            ${esActual ? '<div style="position:absolute;top:-10px;right:12px;background:var(--gold);color:#000;font-size:10px;font-weight:800;padding:2px 10px;border-radius:20px">PLAN ACTUAL</div>' : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <span style="font-weight:800;font-size:15px;color:var(--text)">${p.nombre}</span>
              <span style="font-weight:800;font-size:17px;color:var(--gold)">${precioLabel}</span>
            </div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:12px">${p.features.join(' · ')}</div>
            ${!esActual && precio > 0 ? `<button onclick="iniciarPago('${key}')" style="width:100%;padding:10px;background:var(--gold);color:#000;border:none;border-radius:8px;font-family:'Barlow',sans-serif;font-weight:800;font-size:13px;cursor:pointer">Obtener ${p.nombre}</button>` : ''}
            ${esActual && precio > 0  ? `<button onclick="iniciarPago('${key}')" style="width:100%;padding:10px;background:transparent;border:1px solid var(--gold);color:var(--gold);border-radius:8px;font-family:'Barlow',sans-serif;font-weight:800;font-size:13px;cursor:pointer">🔄 Renovar plan</button>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

window.setPeriodoPago = function(periodo) {
  window._periodoPago = periodo;
  _renderModalPago();
};

window.iniciarPago = function(planKey) {
  const p       = PLANES_CONFIG[planKey];
  const periodo = window._periodoPago || 'mes';
  const precio  = periodo === 'anual' ? p.precio_anual : p.precio_mes;
  const ref     = `GYM-${currentGymId}-${planKey}-${Date.now()}`;
  const content = document.getElementById('modal-pago-content');
  if (!content) return;

  content.innerHTML = `
    <div style="padding:24px">
      <button onclick="mostrarModalPago()" style="background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;margin-bottom:16px">← Volver</button>
      <h2 style="font-size:17px;font-weight:800;color:var(--gold);margin-bottom:4px">Plan ${p.nombre} — ${periodo==='anual'?'Anual':'Mensual'}</h2>
      <div style="font-size:24px;font-weight:800;color:var(--text);margin-bottom:20px">$${precio.toLocaleString('es-CO')} COP</div>
      <div style="background:var(--dark4);border-radius:12px;padding:16px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:12px;text-transform:uppercase">Elige cómo pagar</div>
        <div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
          <div style="font-weight:800;font-size:14px;color:#8B5CF6;margin-bottom:6px">💜 Nequi</div>
          <div style="font-size:13px;color:var(--text)">Envía <strong>$${precio.toLocaleString('es-CO')}</strong> al número:</div>
          <div style="font-size:20px;font-weight:800;color:var(--text);margin:6px 0;letter-spacing:2px">${NEQUI_NUM}</div>
          <div style="font-size:11px;color:var(--muted)">Concepto: <code style="background:var(--dark3);padding:2px 6px;border-radius:4px">${ref}</code></div>
        </div>
        <div style="border:1px solid var(--border);border-radius:10px;padding:14px">
          <div style="font-weight:800;font-size:14px;color:#FBBF24;margin-bottom:6px">🏦 Bancolombia</div>
          <div style="font-size:13px;color:var(--text)">Transfiere <strong>$${precio.toLocaleString('es-CO')}</strong> a:</div>
          <div style="font-size:16px;font-weight:800;color:var(--text);margin:6px 0">${BANCOLOMBIA_NUM}</div>
          <div style="font-size:11px;color:var(--muted)">Concepto: <code style="background:var(--dark3);padding:2px 6px;border-radius:4px">${ref}</code></div>
        </div>
      </div>
      <div style="background:var(--dark4);border-radius:12px;padding:16px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px;text-transform:uppercase">¿Ya pagaste? Notifícanos</div>
        <input id="pago-comprobante" class="form-inp" placeholder="Número de comprobante o últimos 4 dígitos" style="margin-bottom:8px">
        <button onclick="enviarNotificacionPago('${planKey}','${periodo}','${ref}',${precio})"
          style="width:100%;padding:12px;background:var(--gold);color:#000;border:none;border-radius:8px;font-family:'Barlow',sans-serif;font-weight:800;font-size:14px;cursor:pointer">
          ✅ Ya pagué — Notificar
        </button>
      </div>
      <div style="font-size:11px;color:var(--muted);text-align:center">Activamos tu plan en menos de 24 horas hábiles después de verificar el pago.</div>
    </div>`;
};

window.enviarNotificacionPago = function(planKey, periodo, ref, precio) {
  const comprobante = document.getElementById('pago-comprobante')?.value.trim();
  if (!comprobante) { showToast('❌ Ingresa el número de comprobante', 'red'); return; }
  db.ref(`_solicitudesPago/${currentGymId}_${Date.now()}`).set({
    gymId: currentGymId, gymNombre: gymConfig.nombre || currentGymId,
    plan: planKey, periodo, precio, ref, comprobante, ts: Date.now(), estado: 'pendiente'
  }).then(() => {
    const content = document.getElementById('modal-pago-content');
    if (content) content.innerHTML = `
      <div style="padding:40px;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">✅</div>
        <h2 style="color:var(--gold);margin-bottom:8px">¡Notificación enviada!</h2>
        <p style="color:var(--muted);font-size:14px">Verificaremos tu pago y activaremos el plan <strong>${planKey.toUpperCase()}</strong> en menos de 24 horas.</p>
        <p style="color:var(--muted);font-size:12px;margin-top:8px">Referencia: <code style="color:var(--gold)">${ref}</code></p>
        <button onclick="document.getElementById('modal-pago').classList.remove('open')"
          style="margin-top:20px;padding:12px 28px;background:var(--gold);color:#000;border:none;border-radius:8px;font-family:'Barlow',sans-serif;font-weight:800;font-size:14px;cursor:pointer">
          Cerrar
        </button>
      </div>`;
  }).catch(() => showToast('❌ Error al enviar. Intenta de nuevo.', 'red'));
};
