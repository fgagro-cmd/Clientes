/* Lógica pura de la app Clientes (sin DOM) — también se usa en las pruebas. */
(function (root) {
  'use strict';

  var MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var MC = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  var ESTADOS = ['E', 'N', 'A']; // Enviado, No enviado, No aplica
  var ESTADO_TXT = { E: 'Enviado', N: 'No enviado', A: 'No aplica' };

  function ym(y, m) { return y + '-' + String(m + 1).padStart(2, '0'); }

  // ¿El cliente está de alta en ese mes? (alta y baja inclusive)
  function enRango(c, y, m) {
    var k = ym(y, m);
    return (!c.alta || k >= c.alta) && (!c.baja || k <= c.baja);
  }

  function cmp(a, b) { return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }); }

  // Filas del año (cliente + datos del año) ordenadas alfabéticamente
  function filas(db, y) {
    var t = (db.años || {})[y] || {};
    return db.clientes.filter(function (c) { return t[c.id]; })
      .sort(cmp)
      .map(function (c) { return { c: c, r: t[c.id] }; });
  }

  // Pestaña Planes: solo clientes con planes y de alta ese mes
  function filasPlanes(db, y, m) {
    return filas(db, y).filter(function (x) { return x.r.planes > 0 && enRango(x.c, y, m); });
  }

  function statsPlanes(db, y, m) {
    var L = filasPlanes(db, y, m), planes = 0, env = 0, den = 0;
    L.forEach(function (x) {
      planes += x.r.planes;
      var s = x.r.env[m];
      if (s === 'E') { env += x.r.planes; den += x.r.planes; }
      else if (s === 'N') { den += x.r.planes; }
    });
    return { clientes: L.length, planes: planes, enviados: env, base: den, pct: den ? env / den : null };
  }

  // Meses transcurridos del año (para la media): año pasado = 12, año actual = mes en curso, futuro = 0
  function transcurridos(y, hoy) {
    if (y < hoy.y) return 12;
    if (y > hoy.y) return 0;
    return hoy.m + 1;
  }

  function statsCobros(db, y, m, hoy) {
    var cobradoAnio = 0, pendiente = 0, cobradoMes = 0, pendienteMes = 0;
    filas(db, y).forEach(function (x) {
      for (var i = 0; i < 12; i++) {
        var imp = Number(x.r.imp[i]) || 0;
        if (x.r.cob[i]) {
          cobradoAnio += imp;
          if (i === m) cobradoMes += imp;
        } else if (enRango(x.c, y, i)) {
          pendiente += imp;
          if (i === m) pendienteMes += imp;
        }
      }
    });
    var n = transcurridos(y, hoy);
    return {
      cobradoAnio: cobradoAnio,
      media: n ? cobradoAnio / n : 0,
      cobradoMes: cobradoMes,
      pendienteMes: pendienteMes,
      pendiente: pendiente
    };
  }

  // Cambio de precio/mes: solo toca los meses desde el actual en adelante que no estén cobrados ni editados a mano
  function cambiarPrecio(db, id, y, nuevo, hoy) {
    var r = (db.años[y] || {})[id];
    if (!r) return;
    var desde = y < hoy.y ? 12 : (y > hoy.y ? 0 : hoy.m);
    r.precio = nuevo;
    for (var i = desde; i < 12; i++) {
      if (!r.cob[i] && !r.man[i]) r.imp[i] = nuevo;
    }
  }

  function nuevaFila(planes, precio) {
    var imp = [], cob = [], man = [], env = [];
    for (var i = 0; i < 12; i++) { imp.push(precio); cob.push(false); man.push(false); env.push('N'); }
    return { planes: planes, precio: precio, env: env, imp: imp, cob: cob, man: man };
  }

  // Crea la tabla de un año nuevo con los clientes que siguen de alta, tomando planes y precio del último año
  function crearAnio(db, y) {
    if (db.años[y]) return false;
    var prev = Object.keys(db.años).map(Number).filter(function (a) { return a < y; }).sort().pop();
    if (prev == null) { db.años[y] = {}; return true; }
    var t = {};
    db.clientes.forEach(function (c) {
      var r = db.años[prev][c.id];
      if (!r) return;
      if (c.baja && c.baja < ym(y, 0)) return; // ya dado de baja antes de este año
      t[c.id] = nuevaFila(r.planes, r.precio);
    });
    db.años[y] = t;
    return true;
  }

  function slug(s) {
    return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cliente';
  }

  function idUnico(db, nombre) {
    var base = slug(nombre), id = base, n = 2;
    var usados = {};
    db.clientes.forEach(function (c) { usados[c.id] = 1; });
    while (usados[id]) id = base + '-' + (n++);
    return id;
  }

  var api = {
    MES: MES, MC: MC, ESTADOS: ESTADOS, ESTADO_TXT: ESTADO_TXT,
    ym: ym, enRango: enRango, filas: filas, filasPlanes: filasPlanes, statsPlanes: statsPlanes,
    statsCobros: statsCobros, transcurridos: transcurridos, cambiarPrecio: cambiarPrecio,
    nuevaFila: nuevaFila, crearAnio: crearAnio, idUnico: idUnico
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(this);
