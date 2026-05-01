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
  const plan  = document.getElementById('f-plan')?.value;
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
  const plan   = document.getElementById('f-plan').value;
  const inicio = document.getElementById('f-inicio').value;
  if (!nombre || !plan || !inicio) {
    setSaveStatus('error', 'Faltan campos obligatorios');
    if (cerrar) alert('Nombre, plan y fecha son obligatorios');
    return;
  }
  const fechaPago  = calcFechaPago(inicio, plan);
  const valorRaw   = document.getElementById('f-valor').value.replace(/\D/g,'');
  const data = {
    nombre,
    cedula:      document.getElementById('f-cedula').value.trim(),
    telefono:    document.getElementById('f-tel').value.trim(),
    plan,
    valor:       parseInt(valorRaw) || 0,
    fechaInicio: inicio,
    fechaPago,
    notas:       document.getElementById('f-notas').value.trim(),
    registradoEn: Date.now()
  };
  if (clienteEditandoId && clientes[clienteEditandoId]?.registradoEn)
    data.registradoEn = clientes[clienteEditandoId].registradoEn;

  const id      = clienteEditandoId || ('c_' + Date.now() + '_' + Math.random().toString(36).substr(2,6));
  if (!clienteEditandoId) clienteEditandoId = id;
  const esNuevo = !clientes[id];

  db.ref(`gyms/${currentGymId}/clientes/${id}`).set(data).then(() => {
    if (esNuevo && data.valor) {
      db.ref(`gyms/${currentGymId}/pagos`).push({
        clienteId: id, nombre: data.nombre, plan: data.plan,
        valor: data.valor, fecha: data.fechaInicio, tipo: 'nuevo', ts: Date.now()
      });
    }
    setSaveStatus('saved', '✓ Guardado');
    if (cerrar) cerrarModalCliente();
  }).catch(e => {
    setSaveStatus('error', 'Error al guardar');
    if (cerrar) alert('Error: ' + e.message);
  });
}

// ══════════════════════════════════════════════
// MODAL CLIENTE (nuevo / editar)
// ══════════════════════════════════════════════
window.abrirModalNuevo = function() {
  clienteEditandoId = null;
  document.getElementById('modal-titulo').textContent = 'NUEVO CLIENTE';
  document.getElementById('f-nombre').value  = '';
  document.getElementById('f-cedula').value  = '';
  document.getElementById('f-tel').value     = '';
  document.getElementById('f-notas').value   = '';
  document.getElementById('f-inicio').value  = getFechaHoy();
  cargarPlanesEnSelect();
  // Autocompletar valor según plan seleccionado (sin disparar autoGuardar)
  const sel = document.getElementById('f-plan');
  if (sel && sel.value) {
    const plan = (gymConfig.planes||[]).find(p => p.nombre === sel.value);
    if (plan) document.getElementById('f-valor').value = plan.precio;
  }
  setSaveStatus('', 'Sin cambios');
  document.getElementById('modal-cliente').classList.add('open');
};

window.cerrarModalCliente = function() {
  clearTimeout(autoGuardarTimer);
  document.getElementById('modal-cliente').classList.remove('open');
};

window.editarCliente = function(id) {
  const c = clientes[id]; if (!c) return;
  clienteEditandoId = id;
  document.getElementById('modal-titulo').textContent = 'EDITAR CLIENTE';
  document.getElementById('f-nombre').value  = c.nombre||'';
  document.getElementById('f-cedula').value  = c.cedula||'';
  document.getElementById('f-tel').value     = c.telefono||'';
  document.getElementById('f-valor').value   = c.valor||'';
  document.getElementById('f-notas').value   = c.notas||'';
  document.getElementById('f-inicio').value  = c.fechaInicio||getFechaHoy();
  cargarPlanesEnSelect();
  document.getElementById('f-plan').value = c.plan||'';
  setSaveStatus('saved', '✓ Guardado anteriormente');
  document.getElementById('modal-detalle').classList.remove('open');
  document.getElementById('modal-cliente').classList.add('open');
};

window.eliminarCliente = function(id) {
  if (!confirm('¿Eliminar este cliente? No se puede deshacer.')) return;
  db.ref(`gyms/${currentGymId}/clientes/${id}`).remove().then(() => {
    document.getElementById('modal-detalle').classList.remove('open');
    showToast('🗑️ Cliente eliminado', 'red');
  });
};

// ══════════════════════════════════════════════
// DETALLE CLIENTE
// ══════════════════════════════════════════════
window.verDetalle = function(id) {
  const c = clientes[id]; if (!c) return;
  const est  = getEstado(c);
  const dias = diasRestantes(c);
  const badgeClass = est==='activo' ? 'badge-activo' : est==='por-vencer' ? 'badge-vence' : 'badge-vencido';
  const badgeTxt   = est==='activo' ? '✅ Al día'
    : est==='por-vencer' ? `⚠️ Vence en ${dias} días`
    : `❌ Venció hace ${Math.abs(dias)} días`;
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
      <button class="btn-accion btn-renovar"  onclick="abrirModalRenovar('${id}')">🔄 Renovar</button>
      ${c.telefono ? `<button class="btn-accion btn-whatsapp" onclick="waCliente('${id}')">💬 WhatsApp</button>` : ''}
      <button class="btn-accion btn-editar"   onclick="editarCliente('${id}')">✏️ Editar</button>
      <button class="btn-accion btn-eliminar" onclick="eliminarCliente('${id}')">🗑️ Eliminar</button>
    </div>`;
  document.getElementById('modal-detalle').classList.add('open');
};

// ══════════════════════════════════════════════
// RENOVAR
// ══════════════════════════════════════════════
window.abrirModalRenovar = function(id) {
  const c = clientes[id]; if (!c) return;
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
  const id = clienteRenovandoId; if (!id || !currentGymId) return;
  const c  = clientes[id]; if (!c) return;
  const hoy      = getFechaHoy();
  const fechaPago = calcFechaPago(hoy, c.plan);
  const valor    = parseInt(document.getElementById('renovar-valor').value.replace(/\D/g,'')) || 0;
  db.ref(`gyms/${currentGymId}/clientes/${id}`).update({ fechaInicio: hoy, fechaPago, valor }).then(() => {
    db.ref(`gyms/${currentGymId}/pagos`).push({
      clienteId: id, nombre: c.nombre, plan: c.plan, valor, fecha: hoy, tipo: 'renovacion', ts: Date.now()
    });
    document.getElementById('modal-renovar').classList.remove('open');
    clienteRenovandoId = null;
    showToast('✅ Membresía renovada', 'green');
  });
};

// ══════════════════════════════════════════════
// WHATSAPP
// ══════════════════════════════════════════════
window.waCliente = function(id) {
  const c = clientes[id]; if (!c || !c.telefono) return;
  const est  = getEstado(c);
  const dias = diasRestantes(c);
  let msg = `Hola ${c.nombre.split(' ')[0]} 👋, te escribimos desde *${gymConfig.nombre}*.\n`;
  if (est === 'vencido')    msg += `⚠️ Tu membresía *venció hace ${Math.abs(dias)} días*. ¡Renueva y sigue entrenando! 💪`;
  else if (est === 'por-vencer') msg += `⏰ Tu membresía *vence en ${dias} días* (${fmtFecha(c.fechaPago)}). ¡Renueva a tiempo! 💪`;
  else msg += `✅ Tu membresía está al día hasta el *${fmtFecha(c.fechaPago)}*. ¡Sigue así! 🔥`;
  window.open(`https://wa.me/57${c.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
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
  arr.sort((a,b) => { const ord={vencido:0,'por-vencer':1,activo:2}; return ord[getEstado(a)]-ord[getEstado(b)]; });
  const el = document.getElementById('lista-clientes');
  if (!arr.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div>${q?'Sin resultados para "'+q+'"':'No hay clientes aún'}</div>`;
    return;
  }
  el.innerHTML = arr.map(c => {
    const est  = getEstado(c);
    const dias = diasRestantes(c);
    const badgeClass = est==='activo'?'badge-activo':est==='por-vencer'?'badge-vence':'badge-vencido';
    const badgeTxt   = est==='activo'?'✅ Al día':est==='por-vencer'?`⚠️ Vence en ${dias}d`:'❌ Vencido';
    return `<div class="cliente-card ${est}" onclick="verDetalle('${c.id}')">
      <div class="cliente-avatar">${iniciales(c.nombre)}</div>
      <div class="cliente-info">
        <div class="cliente-nombre">${c.nombre||'—'}</div>
        <div class="cliente-plan">${c.plan||'—'}${c.cedula?' · CC '+c.cedula:''}</div>
      </div>
      <div class="cliente-right">
        <div class="estado-badge ${badgeClass}">${badgeTxt}</div>
        <div class="cliente-fecha">${fmtFecha(c.fechaPago)}</div>
      </div>
    </div>`;
  }).join('');
};
