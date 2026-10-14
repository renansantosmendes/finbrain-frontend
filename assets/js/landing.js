/* Landing page interactions: scroll reveal, chart tooltips, chart/table
 * toggle and smooth anchor scrolling. */
(function () {
var root = document.getElementById('fbRoot');
var reduce = false;
try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
function $(s, c) { return (c || root).querySelector(s); }
function $$(s, c) { return Array.prototype.slice.call((c || root).querySelectorAll(s)); }

if ('IntersectionObserver' in window && !reduce) {
  root.classList.add('anim');
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (!e.isIntersecting) return; e.target.classList.add('in'); io.unobserve(e.target); });
  }, { threshold: 0.18 });
  $$('.rv,.chart').forEach(function (n) { io.observe(n); });
  setTimeout(function () { $$('.chart').forEach(function (c) { if (c.getBoundingClientRect().top < window.innerHeight) c.classList.add('in'); }); }, 60);
}

var tip = $('#tip');
function place(x, y) {
  var w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(x + 16, window.innerWidth - w - 8)) + 'px'; tip.style.top = Math.max(8, y - h - 12) + 'px';
}
function showCandle(g, x, y) {
  var d = g.dataset, up = parseFloat(d.chg) >= 0;
  tip.innerHTML = '<b>' + d.d + '</b>Abertura ' + d.o + '<br>Máxima ' + d.h + '<br>Mínima ' + d.l + '<br>Fechamento ' + d.c + '<br><span class="' + (up ? 'u' : 'd') + '">' + (up ? '▲ ' : '▼ ') + d.chgt + '</span>';
  tip.hidden = false; place(x, y);
}
function showTip(g, x, y) { tip.innerHTML = g.getAttribute('data-tip'); tip.hidden = false; place(x, y); }
$$('.cd,[data-tip]').forEach(function (g) {
  var c = g.classList.contains('cd');
  g.addEventListener('mousemove', function (e) { c ? showCandle(g, e.clientX, e.clientY) : showTip(g, e.clientX, e.clientY); });
  g.addEventListener('mouseleave', function () { tip.hidden = true; });
  g.addEventListener('focus', function () { var r = g.getBoundingClientRect(); c ? showCandle(g, r.left + r.width / 2, r.top) : showTip(g, r.left + r.width / 2, r.top); });
  g.addEventListener('blur', function () { tip.hidden = true; });
});

$$('[data-tbl]').forEach(function (b) {
  b.addEventListener('click', function () {
    var k = b.getAttribute('data-tbl'), t = $('[data-tblwrap="' + k + '"]'), c = $('[data-chart="' + k + '"]'), show = t.hidden;
    t.hidden = !show; c.hidden = show; b.setAttribute('aria-expanded', show ? 'true' : 'false'); b.textContent = show ? 'Ver como gráfico' : 'Ver como tabela';
  });
});
$$('a[href^="#"]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    var id = a.getAttribute('href').slice(1), t = id && document.getElementById(id);
    if (t && t.scrollIntoView) { e.preventDefault(); t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
  });
});

})();
