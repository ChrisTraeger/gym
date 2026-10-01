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
            <input class="form-inp" value="${p.dias}"   id="plan-d-${i}" placeholder="Días"   type="text" inputmode="numeric" style="flex:1">
            <input class="form-inp" value="${p.precio}" id="plan-p-${i}" placeholder="Precio" type="text" inputmode="numeric" style="flex:1">
            <button onclick="eliminarPlan(${i})" style="padding:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:var(--red);cursor:pointer">🗑️</button>
          </div>`).join('')}
      </div>
      <button onclick="agregarPlan()"  style="width:100%;padding:12px;background:var(--dark4);border:1px solid var(--border);border-radius:10px;color:var(--gold);font-family:'Barlow',sans-serif;font-size:13px;font-weight:700;cursor:pointer;margin-top:10px">+ Agregar plan</button>
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
      ${gymConfig.plan==='free' ? '<button class="btn-gold" style="margin-top:12px;font-size:13px" onclick="mostrarModalPago()">⚡ Upgrade a Pro</button>' : ''}
    </div>`;
}

window.guardarConfigGym = function() {
  if (!currentGymId) return;
  const nombre   = document.getElementById('cfg-nombre').value.trim();
  const telefono = document.getElementById('cfg-tel').value.trim();
  const ciudad   = document.getElementById('cfg-ciudad').value.trim();
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
const MESES_LABEL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function renderCaja() {
  const arr    = Object.entries(pagos).map(([id,p]) => ({ id, ...p })).sort((a,b) => (b.ts||0)-(a.ts||0));
  const hoy    = new Date();
  const mesAct = hoy.getMonth(), anioAct = hoy.getFullYear();

  const resumenMeses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anioAct, mesAct-i, 1);
    const m = d.getMonth(), y = d.getFullYear();
    const del = arr.filter(p => { const pd = new Date(p.fecha+'T00:00:00'); return pd.getMonth()===m && pd.getFullYear()===y; });
    resumenMeses.push({ label: MESES_LABEL[m]+(y!==anioAct?' '+y:''), m, y, total: del.reduce((s,p)=>s+(p.valor||0),0), count: del.length });
  }

  const arrF      = cajaMesFiltro===null ? arr : arr.filter(p => { const pd = new Date(p.fecha+'T00:00:00'); return pd.getMonth()===cajaMesFiltro.m && pd.getFullYear()===cajaMesFiltro.y; });
  const totalF    = arrF.reduce((s,p)=>s+(p.valor||0),0);
  const labelFiltro = cajaMesFiltro ? resumenMeses.find(r=>r.m===cajaMesFiltro.m&&r.y===cajaMesFiltro.y)?.label||'Mes' : 'Total acumulado';

  document.getElementById('caja-content').innerHTML = `
    <div class="caja-header">
      <div class="mcard" style="margin-bottom:0;flex:1">
        <div class="m-lbl">${labelFiltro}</div>
        <div class="m-val" style="font-size:28px;color:var(--green)">${fmtCOP(totalF)}</div>
        <div class="m-sub">${arrF.length} pago${arrF.length!==1?'s':''}</div>
      </div>
    </div>
    <div class="section-title" style="margin:14px 0 8px">Resumen por mes</div>
    <div class="caja-meses">
      <button class="caja-mes-btn ${cajaMesFiltro===null?'active':''}" onclick="setCajaMes(null)">Todos</button>
      ${resumenMeses.map(r => `<button class="caja-mes-btn ${cajaMesFiltro&&cajaMesFiltro.m===r.m&&cajaMesFiltro.y===r.y?'active':''}" onclick="setCajaMes({m:${r.m},y:${r.y}})">${r.label}<br><span style="font-size:10px;opacity:0.7">${fmtCOP(r.total)}</span></button>`).join('')}
    </div>
    <div class="section-title" style="margin:16px 0 8px">Detalle de pagos</div>
    ${arrF.length===0
      ? `<div class="empty-state"><div class="empty-icon">💸</div>Sin pagos registrados${cajaMesFiltro?' en este mes':''}</div>`
      : arrF.map(p => `
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
  const arr = Object.entries(clientes).map(([,c]) => ({
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
  const pagosArr = Object.values(pagos).sort((a,b)=>(b.ts||0)-(a.ts||0)).map(p=>({
    'Cliente': p.nombre||'', 'Plan': p.plan||'', 'Valor (COP)': p.valor||0, 'Fecha': p.fecha||'', 'Tipo': p.tipo==='renovacion'?'Renovación':'Nuevo'
  }));
  if (pagosArr.length) {
    const ws2 = XLSX.utils.json_to_sheet(pagosArr);
    ws2['!cols'] = [22,14,14,12,12].map(w=>({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Historial pagos');
  }
  XLSX.writeFile(wb, `${(gymConfig.nombre||'GYM').replace(/\s+/g,'_')}_${getFechaHoy()}.xlsx`);
};

window.exportarPDF = function() {
  const arr = Object.entries(clientes).map(([id,c]) => ({ id, ...c }))
    .sort((a,b) => { const ord={vencido:0,'por-vencer':1,activo:2}; return ord[getEstado(a)]-ord[getEstado(b)]; });
  if (!arr.length) { alert('No hay clientes'); return; }
  const gymNombre = gymConfig.nombre || 'GYM';
  const ec = { activo:'#22c55e','por-vencer':'#eab308',vencido:'#ef4444' };
  const et = { activo:'Al día','por-vencer':'Por vencer',vencido:'Vencido' };
  const filas = arr.map(c => { const est=getEstado(c); return `<tr><td>${c.nombre||'—'}</td><td>${c.cedula||'—'}</td><td>${c.plan||'—'}</td><td>${fmtCOP(c.valor)}</td><td>${fmtFecha(c.fechaInicio)}</td><td>${fmtFecha(c.fechaPago)}</td><td><span style="background:${ec[est]}22;color:${ec[est]};padding:2px 8px;border-radius:12px;font-weight:700;font-size:11px">${et[est]}</span></td></tr>`; }).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${gymNombre}</title><style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}h1{font-size:22px;margin-bottom:2px}.sub{color:#666;font-size:11px;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#111;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:8px 10px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#f9f9f9}.total{margin-top:14px;font-weight:700;font-size:13px}</style></head><body><h1>🏋️ ${gymNombre}</h1><div class="sub">@${currentGymId} · Generado el ${new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'})}</div><table><thead><tr><th>Nombre</th><th>Cédula</th><th>Plan</th><th>Valor</th><th>Inicio</th><th>Vencimiento</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table><div class="total">Total: ${arr.length} | Al día: ${arr.filter(c=>getEstado(c)==='activo').length} | Vencidos: ${arr.filter(c=>getEstado(c)==='vencido').length}</div></body></html>`;
  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); win.onload = () => win.print(); }
};
