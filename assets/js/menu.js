/**
 * Tera — navegação em telas pequenas.
 *
 * O painel é montado a partir do <nav> que já existe na página, em vez de o
 * markup ser repetido nos seis arquivos. Isso significa que cada página herda
 * automaticamente os próprios links e o próprio item ativo: a home usa rotas
 * de hash, as internas usam páginas, e nada aqui precisa saber a diferença.
 *
 * Sem dependência, sem build, um único arquivo compartilhado.
 */
(function () {
  'use strict';

  var BREAKPOINT = '(max-width: 900px)';
  var header = document.querySelector('header');
  var nav = header && header.querySelector('nav');
  if (!header || !nav) return;

  var links = Array.prototype.slice.call(nav.querySelectorAll('a'));
  if (!links.length) return;

  /* ------------------------------------------------------------- markup */

  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'menu-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'menu-panel');
  toggle.setAttribute('aria-label', 'Abrir menu');
  toggle.appendChild(document.createElement('i')).setAttribute('aria-hidden', 'true');
  header.appendChild(toggle);

  var panel = document.createElement('div');
  panel.className = 'menu-panel';
  panel.id = 'menu-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Navegação');
  panel.dataset.open = 'false';

  // O painel usa a mesma medida de coluna do resto do site.
  var inner = document.createElement('div');
  inner.className = 'wrap';
  inner.style.display = 'flex';
  inner.style.flexDirection = 'column';
  inner.style.flex = '1';
  panel.appendChild(inner);

  var head = document.createElement('div');
  head.className = 'menu-head';
  var label = document.createElement('span');
  label.className = 'menu-label';
  label.textContent = 'Navegação';
  head.appendChild(label);
  inner.appendChild(head);

  // O CTA do cabeçalho vira o rodapé do painel; os demais viram a lista.
  var cta = null;
  var list = document.createElement('ul');
  list.className = 'menu-links';

  links.forEach(function (a) {
    if (a.classList.contains('nav-cta') && !cta) { cta = a; return; }
    var li = document.createElement('li');
    var copy = document.createElement('a');
    copy.href = a.getAttribute('href');
    copy.textContent = a.textContent.replace(/\s*↗\s*$/, '').trim();
    if (a.classList.contains('nav-active') || a.dataset.route === current()) {
      copy.setAttribute('aria-current', 'page');
    }
    if (a.target) copy.target = a.target;
    li.appendChild(copy);
    list.appendChild(li);
  });
  inner.appendChild(list);

  if (cta) {
    var foot = document.createElement('div');
    foot.className = 'menu-foot';
    var button = document.createElement('a');
    button.className = 'menu-cta';
    button.href = cta.getAttribute('href');
    button.innerHTML = '<span></span><span aria-hidden="true">↗</span>';
    button.firstChild.textContent = cta.textContent.replace(/\s*↗\s*$/, '').trim();
    foot.appendChild(button);
    var note = document.createElement('small');
    note.textContent = 'Tera · Maringá · Paraná';
    foot.appendChild(note);
    inner.appendChild(foot);
  }

  document.body.appendChild(panel);

  /** Rota atual na home, que navega por hash. */
  function current() {
    return (location.hash || '#inicio').slice(1);
  }

  /* ------------------------------------------------------------ estados */

  var media = window.matchMedia(BREAKPOINT);
  var open = false;

  function focusables() {
    return Array.prototype.slice.call(
      panel.querySelectorAll('a[href], button:not([disabled])')
    );
  }

  function setOpen(next) {
    if (next === open) return;
    open = next;
    panel.dataset.open = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.documentElement.classList.toggle('menu-open', open);
    document.body.classList.toggle('menu-open', open);
    if (open) {
      var first = focusables()[0];
      if (first) first.focus();
    } else {
      toggle.focus();
    }
  }

  toggle.addEventListener('click', function () { setOpen(!open); });

  // Um link tocado fecha o painel. Nas rotas de hash a página não recarrega,
  // então fechar aqui é o que devolve a leitura ao visitante.
  panel.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key !== 'Tab') return;
    // Enquanto o painel está aberto ele é a página inteira: o foco circula
    // dentro dele em vez de escapar para o conteúdo escondido atrás.
    var items = focusables();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // Passar para o desktop com o painel aberto deixaria a página travada atrás
  // de um painel que o CSS já não mostra.
  function sync() { if (!media.matches) setOpen(false); }
  if (media.addEventListener) media.addEventListener('change', sync);
  else media.addListener(sync);

  // A home marca o item ativo pela rota; o painel acompanha.
  window.addEventListener('hashchange', function () {
    var now = current();
    Array.prototype.forEach.call(list.querySelectorAll('a'), function (a) {
      var route = (a.getAttribute('href') || '').replace(/^#/, '');
      if (a.getAttribute('href').charAt(0) !== '#') return;
      if (route === now) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  });
})();
