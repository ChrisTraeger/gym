// ══════════════════════════════════════════════
// MODO OSCURO / CLARO — theme-toggle.js
// ══════════════════════════════════════════════

(function() {
  // ── Leer preferencia guardada ──
  function getSavedTheme() {
    try { return localStorage.getItem('gymPanelTheme') || 'dark'; } catch(e) { return 'dark'; }
  }
  function saveTheme(theme) {
    try { localStorage.setItem('gymPanelTheme', theme); } catch(e) {}
  }

  // ── Aplicar tema al <body> ──
  window.applyTheme = function(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    // Actualizar icono del botón
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.title = theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
    if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
    saveTheme(theme);
  };

  // ── Toggle ──
  window.toggleTheme = function() {
    const current = getSavedTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    // Redibujar chart si está visible (Chart.js no se actualiza solo con CSS vars)
    if (typeof chartMesInst !== 'undefined' && chartMesInst) {
      setTimeout(() => {
        try { renderStats(); } catch(e) {}
      }, 50);
    }
  };

  // ── Inyectar botón en topbar ──
  function inyectarBotonToggle() {
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight || document.getElementById('btn-theme-toggle')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-theme-toggle';
    btn.className = 'btn-theme-toggle';
    btn.onclick = toggleTheme;

    // Insertar antes del avatar
    const avatar = document.getElementById('topbar-avatar');
    if (avatar) {
      topbarRight.insertBefore(btn, avatar);
    } else {
      topbarRight.prepend(btn);
    }
  }

  // ── Init: aplicar tema guardado en cuanto el DOM esté listo ──
  function init() {
    const saved = getSavedTheme();
    applyTheme(saved);
    inyectarBotonToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Asegurarse de que el botón existe cuando se entra al app
  const _entrarOriginal = window.entrarAlApp;
  if (typeof _entrarOriginal === 'function') {
    window.entrarAlApp = function() {
      _entrarOriginal();
      setTimeout(inyectarBotonToggle, 100);
    };
  }

  // También inyectar al mostrar landing / login
  document.addEventListener('DOMContentLoaded', () => {
    // Observar cuando el app aparece
    const observer = new MutationObserver(() => {
      if (document.getElementById('app')?.style.display === 'flex') {
        inyectarBotonToggle();
      }
    });
    const app = document.getElementById('app');
    if (app) observer.observe(app, { attributes: true, attributeFilter: ['style'] });
  });
})();
