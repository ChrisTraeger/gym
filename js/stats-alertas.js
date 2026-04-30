// ══════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════
function renderStats() {
  const arr         = Object.values(clientes);
  const total       = arr.length;
  const activos     = arr.filter(c => getEstado(c)==='activo').length;
  const porVencer   = arr.filter(c => getEstado(c)==='por-vencer').length;
  const vencidos    = arr.filter(c => getEstado(c)==='vencido').length;
  const hoy         = new Date();
  const mesActual   = hoy.getMonth();
  const anioActual  = hoy.getFullYear();
  const ingresosMes = arr
    .filter(c => { if (!c.fechaInicio) return false; const d = new Date(c.fechaInicio+'T00:00:00'); return d.getMonth()===mesActual && d.getFullYear()===anioActual; })
    .reduce((s,c) => s+(parseInt(c.valor)||0), 0);

  const mesesLabels = [], mesesVals = [];
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anioActual, mesActual-i, 1);
    const m = d.getMonth(), y = d.getFullYear();
    mesesLabels.push(MESES[m]);
    mesesVals.push(arr.filter(c => { if (!c.fechaInicio) return false; const cd = new Date(c.fechaInicio+'T00:00:00'); return cd.getMonth()===m && cd.getFullYear()===y; }).length);
  }

  const planCount = {};
  arr.forEach(c => { if (c.plan) planCount[c.plan] = (planCount[c.plan]||0)+1; });
  const topPlanes = Object.entries(planCount).sort((a,b) => b[1]-a[1]);
  const maxPlan   = topPlanes.length ? topPlanes[0][1] : 1;

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
      data: {
        labels: mesesLabels,
        datasets: [{ data: mesesVals, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()||'#D4AF37', borderRadius: 6, borderSkipped: false }]
      },
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
    const est  = getEstado(c);
    const dias = diasRestantes(c);
    const msg  = est==='vencido' ? `Venció hace ${Math.abs(dias)} días` : `Vence en ${dias} días`;
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
