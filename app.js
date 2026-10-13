/* App Clientes — planes de abonado enviados y cobros por mes. Datos solo en el móvil (+ copia a Google Sheets). */
(function () {
  'use strict';
  var L = window.Logic;
  var KEY = 'clientes_v1';
  var now = new Date();
  var HOY = { y: now.getFullYear(), m: now.getMonth() };
  var eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, useGrouping: 'always' });
  var eur0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' });
  var $ = function (id) { return document.getElementById(id); };

  var db = load();
  var tab = 'planes', filtro = 'todos';
  var year = HOY.y, month = HOY.m;
  var syncTimer = null, syncing = false;

  /* ---------- datos ---------- */
  function vacio() { return { v: 1, clientes: [], años: {}, ajustes: { url: '' }, dirty: false }; }
  function load() {
    try {
      var s = localStorage.getItem(KEY);
      if (s) { var d = JSON.parse(s); d.ajustes = d.ajustes || { url: '' }; return d; }
    } catch (e) { }
    return vacio();
  }
  function save() {
    db.dirty = true;
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { alert('No se ha podido guardar en el móvil (almacenamiento lleno o bloqueado).'); }
    scheduleSync();
  }
  function aniosDisponibles() {
    var ys = Object.keys(db.años).map(Number);
    if (!ys.length) ys = [HOY.y];
    return ys.sort(function (a, b) { return a - b; });
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mesPorDefecto(y) { return y === HOY.y ? HOY.m : (y < HOY.y ? 11 : 0); }

  /* ---------- sincronización con Google Sheets (un solo sentido) ---------- */
  function setSyncLabel() {
    var el = $('sync');
    if (!db.ajustes.url) { el.textContent = 'Sin copia a Sheets'; el.className = 'sync'; return; }
    if (db.dirty) { el.textContent = navigator.onLine ? '● copiando…' : '● pendiente (sin conexión)'; el.className = 'sync pend'; }
    else { el.textContent = '✓ copiado en Sheets'; el.className = 'sync'; }
  }
  function scheduleSync() {
    setSyncLabel();
    if (!db.ajustes.url) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, 2500);
  }
  function syncNow() {
    if (!db.ajustes.url || syncing || !navigator.onLine || !db.dirty) { setSyncLabel(); return Promise.resolve(); }
    syncing = true;
    var payload = JSON.stringify({ clientes: db.clientes, años: db.años });
    return fetch(db.ajustes.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: payload })
      .then(function () {
        db.dirty = false;
        try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { }
      })
      .catch(function () { /* se reintenta al volver la conexión */ })
      .then(function () { syncing = false; setSyncLabel(); });
  }
  window.addEventListener('online', function () { syncNow(); });

  /* ---------- pintado ---------- */
  function render() {
    var ys = aniosDisponibles();
    if (ys.indexOf(year) < 0) year = ys[ys.length - 1];
    $('year').innerHTML = ys.map(function (y) { return '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + '</option>'; }).join('') +
      '<option value="nuevo">+ Año nuevo…</option>';
    document.querySelectorAll('nav.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === tab); });
    $('months').innerHTML = L.MC.map(function (n, i) {
      return '<button class="chip' + (i === month ? ' on' : '') + (year === HOY.y && i === HOY.m ? ' now' : '') + '" data-m="' + i + '">' + n + '</button>';
    }).join('');
    var sel = $('months').querySelector('.on');
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ inline: 'center', block: 'nearest' });
    if (tab === 'planes') renderPlanes(); else renderCobros();
    setSyncLabel();
  }

  function renderPlanes() {
    var s = L.statsPlanes(db, year, month);
    $('cards').className = 'cards';
    $('cards').innerHTML =
      '<div class="card"><b>' + s.clientes + '</b><span>Clientes</span></div>' +
      '<div class="card"><b>' + s.planes + '</b><span>Planes de abonado</span></div>' +
      '<div class="card hl"><b>' + (s.pct == null ? '—' : Math.round(s.pct * 100) + '%') + '</b><span>Planes enviados · ' + L.MES[month] + '</span></div>';
    $('tools').innerHTML = '<span class="hint" style="margin:0;flex:1">Toca el estado para cambiarlo · toca el nombre para editar</span><button class="add" id="fab">+ Cliente</button>';
    var rows = L.filasPlanes(db, year, month);
    $('list').innerHTML = rows.length ? rows.map(function (x) {
      var st = x.r.env[month] || 'N';
      return '<div class="row"><button class="who" data-ficha="' + x.c.id + '"><strong>' + esc(x.c.nombre) + '</strong><small>' +
        x.r.planes + (x.r.planes === 1 ? ' plan' : ' planes') + '</small></button>' +
        '<button class="pill ' + st + '" data-estado="' + x.c.id + '">' + L.ESTADO_TXT[st] + '</button></div>';
    }).join('') : '<div class="empty">No hay clientes con planes este mes.<br>Pulsa “+ Cliente” para añadir uno.</div>';
  }

  function renderCobros() {
    var s = L.statsCobros(db, year, month, HOY);
    $('cards').className = 'cards c4';
    $('cards').innerHTML =
      '<div class="card hl"><b>' + eur0.format(s.cobradoAnio) + '</b><span>Cobrado ' + year + '</span></div>' +
      '<div class="card"><b>' + eur0.format(s.media) + '</b><span>Media al mes</span></div>' +
      '<div class="card"><b>' + eur0.format(s.cobradoMes) + '</b><span>Cobrado en ' + L.MES[month].toLowerCase() + '</span></div>' +
      '<div class="card"><b>' + eur0.format(s.pendiente) + '</b><span>Pendiente anual</span></div>';
    $('tools').innerHTML = '<div class="seg"><button data-f="todos" class="' + (filtro === 'todos' ? 'on' : '') + '">Todos</button>' +
      '<button data-f="pend" class="' + (filtro === 'pend' ? 'on' : '') + '">Pendientes</button></div><span class="sp"></span><button class="add" id="fab">+ Cliente</button>';
    var rows = L.filas(db, year).filter(function (x) {
      return filtro === 'todos' || (!x.r.cob[month] && L.enRango(x.c, year, month) && Number(x.r.imp[month]) > 0);
    });
    $('list').innerHTML = rows.length ? rows.map(function (x) {
      var fuera = !L.enRango(x.c, year, month);
      return '<div class="row' + (fuera ? ' off' : '') + '"><button class="who" data-ficha="' + x.c.id + '"><strong>' + esc(x.c.nombre) +
        (x.c.baja ? '<span class="tag">baja ' + esc(x.c.baja) + '</span>' : '') + '</strong><small>' +
        eur.format(x.r.precio) + '/mes · ' + x.r.planes + (x.r.planes === 1 ? ' plan' : ' planes') + '</small></button>' +
        '<input class="amt' + (x.r.man[month] ? ' man' : '') + '" type="number" inputmode="decimal" step="0.01" value="' + (Number(x.r.imp[month]) || 0) +
        '" data-imp="' + x.c.id + '" aria-label="Importe">' +
        '<label class="sw"><input type="checkbox" data-cob="' + x.c.id + '"' + (x.r.cob[month] ? ' checked' : '') + ' aria-label="Cobrado"><i></i></label></div>';
    }).join('') : '<div class="empty">' + (filtro === 'pend' ? 'Nada pendiente este mes 🎉' : 'Todavía no hay clientes.') + '</div>';
  }

  /* ---------- ficha de cliente ---------- */
  function abrirFicha(id) {
    var c = db.clientes.find(function (x) { return x.id === id; });
    var r = db.años[year][id];
    if (!c || !r) return;
    var dlg = $('dlg');
    var grid = L.MC.map(function (n, i) {
      return '<span>' + n + '</span><input class="amt' + (r.man[i] ? ' man' : '') + '" type="number" inputmode="decimal" step="0.01" data-yimp="' + i + '" value="' + (Number(r.imp[i]) || 0) +
        '"><label class="sw"><input type="checkbox" data-ycob="' + i + '"' + (r.cob[i] ? ' checked' : '') + '><i></i></label>';
    }).join('');
    dlg.innerHTML = '<form method="dialog" class="sheet" id="ficha">' +
      '<h2>' + esc(c.nombre) + ' · ' + year + '</h2>' +
      '<label class="f"><span>Nombre</span><input type="text" id="f-nombre" value="' + esc(c.nombre) + '"></label>' +
      '<div class="f2"><label class="f"><span>Planes de abonado</span><input type="number" inputmode="numeric" min="0" step="1" id="f-planes" value="' + r.planes + '"></label>' +
      '<label class="f"><span>Precio/mes (€)</span><input type="number" inputmode="decimal" min="0" step="0.01" id="f-precio" value="' + r.precio + '"></label></div>' +
      '<div class="hint">Al cambiar el precio solo se actualizan los meses desde ' + L.MES[Math.min(HOY.m, 11)].toLowerCase() + ' que no estén cobrados ni editados a mano.</div>' +
      '<div class="line"><b>Dado de baja</b><label class="sw"><input type="checkbox" id="f-baja"' + (c.baja ? ' checked' : '') + '><i></i></label></div>' +
      '<label class="f" id="f-baja-box"' + (c.baja ? '' : ' hidden') + '><span>Último mes con asesoramiento (sigue contando en los importes del año)</span><input type="month" id="f-bajames" value="' + (c.baja || L.ym(HOY.y, HOY.m)) + '"></label>' +
      '<h2 style="font-size:15px;margin:6px 0 4px">Cobros ' + year + '</h2><div class="year-grid">' + grid + '</div>' +
      '<div class="btns"><button type="button" class="btn" id="f-cerrar">Cerrar</button><button type="button" class="btn pri" id="f-guardar">Guardar</button></div>' +
      '<div class="btns"><button type="button" class="btn danger" id="f-borrar">Eliminar cliente de ' + year + '</button></div></form>';
    dlg.showModal();
    $('f-baja').onchange = function () { $('f-baja-box').hidden = !this.checked; };
    $('f-cerrar').onclick = function () { dlg.close(); };
    $('f-guardar').onclick = function () {
      var nombre = $('f-nombre').value.trim();
      if (!nombre) { alert('Falta el nombre.'); return; }
      c.nombre = nombre;
      r.planes = Math.max(0, parseInt($('f-planes').value, 10) || 0);
      var precio = Math.max(0, parseFloat($('f-precio').value) || 0);
      if (precio !== r.precio) L.cambiarPrecio(db, id, year, precio, HOY);
      c.baja = $('f-baja').checked ? ($('f-bajames').value || L.ym(HOY.y, HOY.m)) : null;
      dlg.querySelectorAll('[data-yimp]').forEach(function (inp) {
        var i = +inp.dataset.yimp, v = parseFloat(inp.value) || 0;
        if (v !== (Number(r.imp[i]) || 0)) { r.imp[i] = v; r.man[i] = true; }
      });
      dlg.querySelectorAll('[data-ycob]').forEach(function (inp) { r.cob[+inp.dataset.ycob] = inp.checked; });
      save(); dlg.close(); render();
    };
    $('f-borrar').onclick = function () {
      if (!confirm('¿Quitar a ' + c.nombre + ' de la tabla ' + year + '? Se pierden sus planes y cobros de ese año.')) return;
      delete db.años[year][id];
      var enOtros = Object.keys(db.años).some(function (y) { return db.años[y][id]; });
      if (!enOtros) db.clientes = db.clientes.filter(function (x) { return x.id !== id; });
      save(); dlg.close(); render();
    };
  }

  function abrirNuevo() {
    var dlg = $('dlg');
    dlg.innerHTML = '<form method="dialog" class="sheet"><h2>Cliente nuevo · ' + year + '</h2>' +
      '<label class="f"><span>Nombre</span><input type="text" id="n-nombre" autocomplete="off"></label>' +
      '<div class="f2"><label class="f"><span>Planes de abonado</span><input type="number" inputmode="numeric" min="0" step="1" id="n-planes" value="1"></label>' +
      '<label class="f"><span>Precio/mes (€)</span><input type="number" inputmode="decimal" min="0" step="0.01" id="n-precio" value="0"></label></div>' +
      '<label class="f"><span>Primer mes de asesoramiento</span><input type="month" id="n-alta" value="' + L.ym(year, year === HOY.y ? HOY.m : 0) + '"></label>' +
      '<div class="btns"><button type="button" class="btn" id="n-cerrar">Cancelar</button><button type="button" class="btn pri" id="n-guardar">Añadir</button></div></form>';
    dlg.showModal();
    $('n-cerrar').onclick = function () { dlg.close(); };
    $('n-guardar').onclick = function () {
      var nombre = $('n-nombre').value.trim();
      if (!nombre) { alert('Falta el nombre.'); return; }
      var existente = db.clientes.find(function (c) { return c.nombre.toLowerCase() === nombre.toLowerCase(); });
      var c = existente;
      if (!c) { c = { id: L.idUnico(db, nombre), nombre: nombre, alta: $('n-alta').value || null, baja: null }; db.clientes.push(c); }
      if (!db.años[year]) db.años[year] = {};
      if (db.años[year][c.id]) { alert('Ese cliente ya está en ' + year + '.'); return; }
      db.años[year][c.id] = L.nuevaFila(Math.max(0, parseInt($('n-planes').value, 10) || 0), Math.max(0, parseFloat($('n-precio').value) || 0));
      save(); dlg.close(); render();
    };
  }

  /* ---------- ajustes ---------- */
  function abrirAjustes() {
    var dlg = $('dlg');
    dlg.innerHTML = '<form method="dialog" class="sheet"><h2>Ajustes y copia de seguridad</h2>' +
      '<label class="f"><span>Dirección de la copia a Google Sheets (Apps Script)</span><input type="url" id="a-url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(db.ajustes.url || '') + '"></label>' +
      '<div class="hint">Copia de un solo sentido: la app es la fuente de datos y la hoja se reescribe con cada cambio. Si no hay conexión, queda en cola y se envía al volver.</div>' +
      '<div class="btns"><button type="button" class="btn" id="a-copiar">Copiar a Sheets ahora</button></div>' +
      '<div class="btns"><button type="button" class="btn" id="a-exp">Exportar copia (.json)</button><button type="button" class="btn" id="a-imp">Importar (.json)</button></div>' +
      '<input type="file" id="a-file" accept=".json,application/json" hidden>' +
      '<div class="hint" style="margin-top:12px">Importar sustituye todos los datos de la app por los del archivo.</div>' +
      '<div class="btns"><button type="button" class="btn" id="a-cerrar">Cerrar</button><button type="button" class="btn pri" id="a-guardar">Guardar</button></div></form>';
    dlg.showModal();
    $('a-cerrar').onclick = function () { dlg.close(); };
    $('a-guardar').onclick = function () {
      db.ajustes.url = $('a-url').value.trim();
      db.dirty = true; save(); dlg.close(); render();
    };
    $('a-copiar').onclick = function () {
      db.ajustes.url = $('a-url').value.trim();
      if (!db.ajustes.url) { alert('Pega primero la dirección de la copia.'); return; }
      db.dirty = true; save();
      syncNow().then(function () { alert(db.dirty ? 'No se pudo enviar ahora. Se reintentará al haber conexión.' : 'Enviado. Revisa la hoja de Google Sheets.'); });
    };
    $('a-exp').onclick = function () {
      var blob = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'clientes-' + HOY.y + '-' + String(HOY.m + 1).padStart(2, '0') + '.json';
      document.body.appendChild(a); a.click(); a.remove();
    };
    $('a-imp').onclick = function () { $('a-file').click(); };
    $('a-file').onchange = function () {
      var f = this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var d = JSON.parse(rd.result);
          if (!d || !Array.isArray(d.clientes) || typeof d.años !== 'object') throw new Error('formato');
          if (!confirm('Esto sustituye todos los datos actuales (' + db.clientes.length + ' clientes) por los del archivo (' + d.clientes.length + ' clientes). ¿Continuar?')) return;
          var url = db.ajustes.url;
          db = d; db.ajustes = db.ajustes || {}; if (!db.ajustes.url) db.ajustes.url = url;
          year = HOY.y; month = HOY.m;
          if (!db.años[year]) year = aniosDisponibles().pop();
          save(); dlg.close(); render();
        } catch (e) { alert('El archivo no es una copia válida de la app Clientes.'); }
      };
      rd.readAsText(f);
    };
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.dataset.t) { tab = t.dataset.t; render(); window.scrollTo(0, 0); }
    else if (t.dataset.m != null) { month = +t.dataset.m; render(); }
    else if (t.dataset.f) { filtro = t.dataset.f; render(); }
    else if (t.dataset.ficha) { abrirFicha(t.dataset.ficha); }
    else if (t.dataset.estado) {
      var r = db.años[year][t.dataset.estado];
      var cur = r.env[month] || 'N';
      r.env[month] = L.ESTADOS[(L.ESTADOS.indexOf(cur) + 1) % 3];
      save(); render();
    }
    else if (t.id === 'gear') abrirAjustes();
    else if (t.id === 'fab') abrirNuevo();
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'year') {
      if (t.value === 'nuevo') {
        var ys = aniosDisponibles(), ny = ys[ys.length - 1] + 1;
        if (confirm('¿Crear la tabla de ' + ny + '? Pasan los clientes que siguen de alta, con sus planes y precio actuales; todo queda en “No enviado” y pendiente de cobro.')) {
          L.crearAnio(db, ny); year = ny; month = mesPorDefecto(ny); save();
        }
      } else { year = +t.value; month = mesPorDefecto(year); }
      render(); return;
    }
    if (t.dataset && t.dataset.imp) {
      var r = db.años[year][t.dataset.imp], v = parseFloat(t.value);
      r.imp[month] = isNaN(v) ? 0 : v; r.man[month] = true; save(); render();
    } else if (t.dataset && t.dataset.cob) {
      db.años[year][t.dataset.cob].cob[month] = t.checked; save(); render();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('amt') && !e.target.dataset.yimp) e.target.blur();
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () { });
  if (!db.años[year] && Object.keys(db.años).length) { var ys0 = aniosDisponibles(); year = ys0[ys0.length - 1]; month = mesPorDefecto(year); }
  render();
  if (db.dirty) syncNow();
})();
