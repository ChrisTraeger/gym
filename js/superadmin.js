// ══════════════════════════════════════════════
// SUPER ADMIN
// ══════════════════════════════════════════════
window.loginSuperAdmin = function() {
  const user  = document.getElementById('sa-user').value.trim();
  const pass  = document.getElementById('sa-pass').value;
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
  ['estadisticas','gyms','riesgo','pagos'].forEach(t => {
    const el = document.getElementById('sa-tab-' + t); if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.sa-tab').forEach(b => b.classList.remove('sa-tab-active'));
  btn.classList.add('sa-tab-active');
  if (tab === 'pagos') cargarSolicitudesPago();
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
    const config      = g.config||{};
    const numClientes = Object.keys(g.clientes||{}).length;
    const creadoEn    = config.creadoEn ? new Date(config.creadoEn).toLocaleDateString('es-CO') : '—';
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
    const gymsList = Object.entries(snap.val() || {}).map(([id, data]) => ({ id, ...data }));
    _saGymsCache = gymsList;

    const totalClientes = gymsList.reduce((s,g) => s+Object.keys(g.clientes||{}).length, 0);
    const suspendidos   = gymsList.filter(g => g.config?.activo === false).length;
    const activos       = gymsList.length - suspendidos;

    document.getElementById('sa-stats-txt').textContent = `${gymsList.length} gimnasio${gymsList.length!==1?'s':''} registrado${gymsList.length!==1?'s':''}`;
    document.getElementById('kpi-gyms').textContent          = activos;
    document.getElementById('kpi-gyms-sub').textContent      = gymsList.length + ' registrados en total';
    document.getElementById('kpi-clientes').textContent      = totalClientes.toLocaleString('es-CO');
    document.getElementById('kpi-clientes-sub').textContent  = 'En todos los gyms';
    document.getElementById('kpi-promedio').textContent      = gymsList.length ? Math.round(totalClientes / gymsList.length) : 0;
    document.getElementById('kpi-inactivos').textContent     = suspendidos;

    // Planes
    const planes = { free: 0, pro: 0, enterprise: 0 };
    gymsList.forEach(g => { const p = g.config?.plan||'free'; planes[p] = (planes[p]||0)+1; });
    const planColors = { free: '#888', pro: '#4a9eff', enterprise: '#d4af37' };
    const total = gymsList.length || 1;
    document.getElementById('sa-planes-grid').innerHTML = Object.entries(planes).map(([plan, count]) => `
      <div class="sa-plan-card">
        <div class="sa-plan-name" style="color:${planColors[plan]}">${plan.toUpperCase()}</div>
        <div class="sa-plan-val">${count}</div>
        <div class="sa-plan-pct">${Math.round(count/total*100)}% del total</div>
        <div class="sa-bar"><div class="sa-bar-fill" style="width:${Math.round(count/total*100)}%;background:${planColors[plan]}"></div></div>
      </div>`).join('');

    // Top 5 gyms
    const top5       = [...gymsList].sort((a,b) => Object.keys(b.clientes||{}).length - Object.keys(a.clientes||{}).length).slice(0,5);
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

    // Ciudades
    const ciudades = {};
    gymsList.forEach(g => { const c = g.config?.ciudad||'Sin ciudad'; ciudades[c] = (ciudades[c]||0)+1; });
    const ciudadArr = Object.entries(ciudades).sort((a,b)=>b[1]-a[1]);
    document.getElementById('sa-ciudades').innerHTML = ciudadArr.map(([ciudad, count]) =>
      `<div class="sa-ciudad-row">
        <div class="sa-ciudad-name">📍 ${ciudad}</div>
        <div class="sa-bar" style="flex:1;max-width:200px"><div class="sa-bar-fill" style="width:${Math.round(count/ciudadArr[0][1]*100)}%;background:var(--gold)"></div></div>
        <div class="sa-ciudad-count">${count} gym${count!==1?'s':''}</div>
      </div>`).join('');

    document.getElementById('sa-gyms-list').innerHTML = renderGymsList(gymsList);

    // En riesgo
    const ahora   = Date.now();
    const DIAS30  = 30 * 24 * 60 * 60 * 1000;
    const enRiesgo = gymsList.filter(g => g.config?.activo === false || (g.config?.ultimaActividad && (ahora - g.config.ultimaActividad) > DIAS30));
    document.getElementById('sa-riesgo-list').innerHTML = enRiesgo.length
      ? enRiesgo.map(g => {
          const inactivo = g.config?.activo === false;
          const dias     = g.config?.ultimaActividad ? Math.floor((ahora - g.config.ultimaActividad) / 86400000) : null;
          const motivo   = inactivo ? 'Cuenta suspendida' : `Sin actividad hace ${dias} días`;
          const color    = inactivo ? 'var(--red)' : '#f59e0b';
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
  if (!confirm(activo ? `¿Suspender el gym @${gymId}?` : `¿Reactivar el gym @${gymId}?`)) return;
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
    const arr = Object.entries(snap.val() || {}).map(([id, data]) => ({
      'ID': id, 'Nombre': data.config?.nombre||'', 'Ciudad': data.config?.ciudad||'',
      'Teléfono': data.config?.telefono||'', 'Plan': data.config?.plan||'free',
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

// ══════════════════════════════════════════════
// SOLICITUDES DE PAGO (SA)
// ══════════════════════════════════════════════
window.cargarSolicitudesPago = function() {
  const cont = document.getElementById('sa-pagos-pendientes');
  if (!cont) return;
  cont.innerHTML = '<div style="color:var(--muted);font-size:13px">Cargando...</div>';
  db.ref('_solicitudesPago').orderByChild('estado').equalTo('pendiente').once('value').then(snap => {
    const arr = Object.entries(snap.val() || {}).sort((a,b) => b[1].ts - a[1].ts);
    if (!arr.length) { cont.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:12px">✅ Sin solicitudes pendientes</div>'; return; }
    cont.innerHTML = arr.map(([key, s]) => `
      <div style="border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
        <div style="margin-bottom:8px">
          <div style="font-weight:800;font-size:14px;color:var(--text)">${s.gymNombre} <span style="color:var(--gold);font-size:12px">@${s.gymId}</span></div>
          <div style="font-size:12px;color:var(--muted)">Plan <strong>${s.plan.toUpperCase()}</strong> ${s.periodo} — $${(s.precio||0).toLocaleString('es-CO')} COP</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px">Comprobante: <code style="color:var(--gold)">${s.comprobante}</code> · Ref: ${s.ref}</div>
          <div style="font-size:11px;color:var(--muted)">${new Date(s.ts).toLocaleString('es-CO')}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="aprobarPago('${key}','${s.gymId}','${s.plan}','${s.periodo}')"
            style="flex:1;padding:9px;background:#22c55e22;border:1px solid #22c55e55;border-radius:8px;color:#22c55e;font-family:'Barlow',sans-serif;font-weight:700;font-size:12px;cursor:pointer">
            ✅ Aprobar y activar
          </button>
          <button onclick="rechazarPago('${key}','${s.gymId}')"
            style="flex:1;padding:9px;background:#ef444422;border:1px solid #ef444455;border-radius:8px;color:#ef4444;font-family:'Barlow',sans-serif;font-weight:700;font-size:12px;cursor:pointer">
            ❌ Rechazar
          </button>
        </div>
      </div>`).join('');
  });
};

window.aprobarPago = function(key, gymId, planKey, periodo) {
  if (!confirm(`¿Activar plan ${planKey.toUpperCase()} para @${gymId}?`)) return;
  const vence = Date.now() + (periodo === 'anual' ? 365 : 30) * 86400000;
  db.ref(`gyms/${gymId}/config`).update({ plan: planKey, activo: true, planVence: vence, planPeriodo: periodo })
    .then(() => db.ref(`_solicitudesPago/${key}`).update({ estado: 'aprobado', aprobadoEn: Date.now() }))
    .then(() => { showToast('✅ Plan activado para @' + gymId, 'green'); cargarSolicitudesPago(); cargarPanelSA(); });
};

window.rechazarPago = function(key, gymId) {
  if (!confirm(`¿Rechazar solicitud de @${gymId}?`)) return;
  db.ref(`_solicitudesPago/${key}`).update({ estado: 'rechazado', rechazadoEn: Date.now() })
    .then(() => { showToast('Solicitud rechazada', 'red'); cargarSolicitudesPago(); });
};
