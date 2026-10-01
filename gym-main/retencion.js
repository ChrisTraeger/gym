// ══════════════════════════════════════════════
// REPORTES DE RETENCIÓN — retencion.js
// ══════════════════════════════════════════════

// Sub-tab activo: 'top' | 'cancelados' | 'segmentos'
let retSubTab = 'top';

// ── Inyectar pestaña "📈 Retención" en la barra de tabs ──
function inyectarTabRetencion() {
  const tabs = document.querySelector('.tabs');
  if (!tabs || document.querySelector('[data-tab="retencion"]')) return;

  const tab = document.createElement('button');
  tab.className = 'tab tab-retencion';
  tab.dataset.tab = 'retencion';
  tab.textContent = '📈 Retención';
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
    tab.classList.add('active');
    const pane = document.getElementById('pane-retencion');
    if (pane) { pane.classList.add('active'); renderRetencion(); }
  });
  tabs.appendChild(tab);
}

// ── Crear el pane si no existe ──
function inyectarPaneRetencion() {
  if (document.getElementById('pane-retencion')) return;
  const body = document.querySelector('.body');
  if (!body) return;
  const pane = document.createElement('div');
  pane.className = 'pane';
  pane.id = 'pane-retencion';
  pane.innerHTML = '<div id="retencion-content"><div class="empty-state"><div class="empty-icon">📈</div>Cargando...</div></div>';
  body.appendChild(pane);
}

// ── Calcular meses desde fecha de registro ──
function mesesDesde(fechaISO) {
  if (!fechaISO) return 0;
  const desde = new Date(fechaISO + 'T00:00:00');
  const hoy   = new Date();
  const diff  = (hoy.getFullYear() - desde.getFullYear()) * 12 + (hoy.getMonth() - desde.getMonth());
  return Math.max(0, diff);
}

// ── Días desde que venció (para "cancelados") ──
function diasDesdeVencimiento(c) {
  if (!c.fechaPago) return null;
  const vence = new Date(c.fechaPago + 'T00:00:00');
  const hoy   = new Date(); hoy.setHours(0,0,0,0);
  return Math.round((hoy - vence) / 86400000);
}

// ── Render principal ──
window.renderRetencion = function() {
  const el = document.getElementById('retencion-content');
  if (!el) return;

  const arr = Object.entries(clientes).map(([id, c]) => ({ id, ...c }));
  if (!arr.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📈</div>Aún no hay clientes registrados</div>';
    return;
  }

  // ── Clasificar clientes ──
  const activos     = arr.filter(c => getEstado(c) === 'activo');
  const porVencer   = arr.filter(c => getEstado(c) === 'por-vencer');
  const cancelados  = arr.filter(c => {
    const dias = diasDesdeVencimiento(c);
    return getEstado(c) === 'vencido' && dias !== null && dias >= 7;
  }).sort((a,b) => diasDesdeVencimiento(b) - diasDesdeVencimiento(a));

  // Top por meses
  const conMeses = arr
    .filter(c => c.registradoEn || c.fechaInicio)
    .map(c => ({ ...c, meses: mesesDesde(c.fechaInicio || new Date(c.registradoEn).toISOString().split('T')[0]) }))
    .sort((a,b) => b.meses - a.meses);

  const maxMeses = conMeses.length ? conMeses[0].meses : 1;

  // Segmentos
  const seg1 = conMeses.filter(c => c.meses < 1).length;   // < 1 mes
  const seg2 = conMeses.filter(c => c.meses >= 1 && c.meses < 3).length;  // 1-3 meses
  const seg3 = conMeses.filter(c => c.meses >= 3 && c.meses < 6).length;  // 3-6 meses
  const seg4 = conMeses.filter(c => c.meses >= 6 && c.meses < 12).length; // 6-12 meses
  const seg5 = conMeses.filter(c => c.meses >= 12).length;  // 1+ año

  // Tasa de retención (activos / total)
  const tasaRetencion = arr.length > 0 ? Math.round((activos.length + porVencer.length) / arr.length * 100) : 0;

  // Promedio de antigüedad
  const promedioMeses = conMeses.length ? Math.round(conMeses.reduce((s,c) => s+c.meses, 0) / conMeses.length) : 0;

  // Podio top 3
  const top3 = conMeses.slice(0, 3);
  const podioHtml = top3.length ? `
    <div class="chart-card" style="margin-bottom:14px">
      <div class="section-title">🏆 Clientes más fieles</div>
      <div class="ret-podio">
        ${top3.length > 1 ? `
        <div class="ret-podio-item">
          <div class="ret-podio-medalla">🥈</div>
          <div class="ret-podio-avatar" style="width:46px;height:46px;font-size:18px">${iniciales(top3[1].nombre)}</div>
          <div class="ret-podio-nombre">${(top3[1].nombre||'').split(' ')[0]}</div>
          <div class="ret-podio-meses">${top3[1].meses}m</div>
        </div>` : ''}
        <div class="ret-podio-item">
          <div class="ret-podio-corona">👑</div>
          <div class="ret-podio-avatar" style="width:58px;height:58px;font-size:22px;border:2px solid var(--gold)">${iniciales(top3[0].nombre)}</div>
          <div class="ret-podio-nombre" style="font-size:13px;font-weight:900">${(top3[0].nombre||'').split(' ')[0]}</div>
          <div class="ret-podio-meses" style="color:var(--gold);font-weight:700">${top3[0].meses} mes${top3[0].meses!==1?'es':''}</div>
        </div>
        ${top3.length > 2 ? `
        <div class="ret-podio-item">
          <div class="ret-podio-medalla">🥉</div>
          <div class="ret-podio-avatar" style="width:46px;height:46px;font-size:18px">${iniciales(top3[2].nombre)}</div>
          <div class="ret-podio-nombre">${(top3[2].nombre||'').split(' ')[0]}</div>
          <div class="ret-podio-meses">${top3[2].meses}m</div>
        </div>` : ''}
      </div>
    </div>` : '';

  el.innerHTML = `
    <!-- KPIs -->
    <div class="ret-header">
      <div class="mcard">
        <div class="m-lbl">Tasa de retención</div>
        <div class="m-val" style="color:${tasaRetencion>=70?'var(--green)':tasaRetencion>=50?'var(--yellow)':'var(--red)'}">${tasaRetencion}%</div>
        <div class="m-sub">activos + por vencer</div>
      </div>
      <div class="mcard">
        <div class="m-lbl">Antigüedad media</div>
        <div class="m-val">${promedioMeses}</div>
        <div class="m-sub">mes${promedioMeses!==1?'es':''} promedio</div>
      </div>
      <div class="mcard">
        <div class="m-lbl">Clientes activos</div>
        <div class="m-val green" style="color:var(--green)">${activos.length + porVencer.length}</div>
        <div class="m-sub">de ${arr.length} totales</div>
      </div>
      <div class="mcard">
        <div class="m-lbl">Sin renovar (+7d)</div>
        <div class="m-val" style="color:var(--red)">${cancelados.length}</div>
        <div class="m-sub">posibles bajas</div>
      </div>
    </div>

    <!-- Sub-tabs -->
    <div class="ret-subtabs">
      <button class="ret-subtab ${retSubTab==='top'?'active':''}" onclick="setRetSubTab('top')">🏅 Top clientes</button>
      <button class="ret-subtab ${retSubTab==='segmentos'?'active':''}" onclick="setRetSubTab('segmentos')">📊 Segmentos</button>
      <button class="ret-subtab ${retSubTab==='cancelados'?'active':''}" onclick="setRetSubTab('cancelados')">⚠️ Sin renovar (${cancelados.length})</button>
    </div>

    <!-- Contenido sub-tab -->
    <div id="ret-subtab-content">
      ${retSubTab === 'top' ? renderRetTop(conMeses, maxMeses, podioHtml) : ''}
      ${retSubTab === 'segmentos' ? renderRetSegmentos(seg1,seg2,seg3,seg4,seg5,conMeses) : ''}
      ${retSubTab === 'cancelados' ? renderRetCancelados(cancelados) : ''}
    </div>
  `;
};

function renderRetTop(conMeses, maxMeses, podioHtml) {
  if (!conMeses.length) return '<div class="empty-state"><div class="empty-icon">👤</div>Sin datos aún</div>';
  const lista = conMeses.map((c, i) => `
    <div class="ret-row" onclick="verDetalle('${c.id}')">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:var(--muted);width:20px;text-align:center;flex-shrink:0">${i+1}</div>
      <div class="ret-row-avatar">${iniciales(c.nombre)}</div>
      <div class="ret-row-info">
        <div class="ret-row-nombre">${c.nombre||'—'}</div>
        <div class="ret-row-desde">${c.plan||'—'} · desde ${fmtFecha(c.fechaInicio)}</div>
      </div>
      <div class="ret-row-bar-wrap">
        <div class="ret-row-bar" style="width:${maxMeses>0?Math.round(c.meses/maxMeses*100):0}%"></div>
      </div>
      <div class="ret-row-meses">${c.meses}<span style="font-size:11px;color:var(--muted);font-family:'Barlow',sans-serif"> m</span></div>
    </div>`).join('');
  return podioHtml + '<div class="ret-lista">' + lista + '</div>';
}

function renderRetSegmentos(s1,s2,s3,s4,s5,conMeses) {
  const total = conMeses.length || 1;
  const segs = [
    { label: '< 1 mes',   val: s1, color: 'var(--muted)',   icon: '🌱' },
    { label: '1–3 meses', val: s2, color: 'var(--yellow)',  icon: '📈' },
    { label: '3–6 meses', val: s3, color: 'var(--gold)',    icon: '💪' },
    { label: '6–12 m',    val: s4, color: 'var(--green)',   icon: '🏆' },
    { label: '1+ año',    val: s5, color: '#a78bfa',        icon: '👑' },
  ];
  const cards = segs.map(s => `
    <div class="mcard" style="border-top:2px solid ${s.color};margin-bottom:0">
      <div class="m-lbl">${s.icon} ${s.label}</div>
      <div class="m-val" style="font-size:36px;color:${s.color}">${s.val}</div>
      <div class="m-sub">${Math.round(s.val/total*100)}% del total</div>
    </div>`).join('');

  // Gráfica de barras horizontal por segmento
  const barras = segs.map(s => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:12px;color:var(--text);min-width:72px">${s.icon} ${s.label}</span>
      <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
        <div style="width:${Math.round(s.val/total*100)}%;height:100%;background:${s.color};border-radius:4px;transition:width 0.6s ease"></div>
      </div>
      <span style="font-size:12px;font-weight:700;color:${s.color};min-width:30px;text-align:right">${s.val}</span>
    </div>`).join('');

  return `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px">${cards}</div>
    <div class="chart-card">
      <div class="section-title">Distribución por antigüedad</div>
      ${barras}
    </div>`;
}

function renderRetCancelados(cancelados) {
  if (!cancelados.length) return `
    <div class="empty-state">
      <div class="empty-icon">✅</div>
      ¡Sin bajas detectadas! Todos tus clientes vencidos llevan menos de 7 días.
    </div>`;

  const notificarTodosHtml = `
    <div style="margin-bottom:14px">
      <button class="btn-gold" onclick="notificarCancelados()" style="font-size:13px;padding:13px">
        📱 Enviar WhatsApp a todos (${cancelados.length})
      </button>
    </div>`;

  const filas = cancelados.map(c => {
    const dias = diasDesdeVencimiento(c);
    const riesgo = dias > 30 ? 'Alto' : dias > 14 ? 'Medio' : 'Bajo';
    const riesgoColor = dias > 30 ? 'var(--red)' : dias > 14 ? 'var(--yellow)' : 'var(--gold)';
    return `
      <div class="ret-cancel-row">
        <div class="ret-cancel-avatar">${iniciales(c.nombre)}</div>
        <div class="ret-cancel-info">
          <div class="ret-cancel-nombre">${c.nombre||'—'}</div>
          <div class="ret-cancel-meta">${c.plan||'—'} · venció ${fmtFecha(c.fechaPago)}</div>
        </div>
        ${c.telefono ? `<button class="btn-notif-wa" onclick="waCliente('${c.id}')" style="font-size:11px;padding:6px 10px">💬 WA</button>` : ''}
        <div class="ret-cancel-dias" style="color:${riesgoColor};border-color:${riesgoColor}40;background:${riesgoColor}15">
          ${dias}d · ${riesgo}
        </div>
      </div>`;
  }).join('');

  return notificarTodosHtml + '<div class="ret-cancelados">' + filas + '</div>';
}

// ── Cambiar sub-tab ──
window.setRetSubTab = function(tab) {
  retSubTab = tab;
  renderRetencion();
};

// ── Notificar a todos los cancelados por WA ──
window.notificarCancelados = function() {
  const cancelados = Object.entries(clientes)
    .map(([id,c]) => ({ id, ...c }))
    .filter(c => {
      const dias = diasDesdeVencimiento(c);
      return getEstado(c) === 'vencido' && dias !== null && dias >= 7 && c.telefono;
    });
  if (!cancelados.length) { alert('Ninguno tiene teléfono registrado'); return; }
  cancelados.forEach(c => waCliente(c.id));
};

// ── Inicializar cuando el app esté listo ──
document.addEventListener('DOMContentLoaded', () => {
  // Esperar a que el app se muestre
  const app = document.getElementById('app');
  if (!app) return;
  const observer = new MutationObserver(() => {
    if (app.style.display === 'flex') {
      inyectarTabRetencion();
      inyectarPaneRetencion();
    }
  });
  observer.observe(app, { attributes: true, attributeFilter: ['style'] });
});

// También intentar inyectar si entrarAlApp ya se llamó
const _origEntrar = window.entrarAlApp;
if (typeof _origEntrar === 'function') {
  window.entrarAlApp = function() {
    _origEntrar();
    setTimeout(() => {
      inyectarTabRetencion();
      inyectarPaneRetencion();
    }, 200);
  };
}
