/**
 * Tera — interface behaviour.
 *
 * Everything here is DOM: buttons stay buttons, links stay links, the form
 * stays a form. The scene never takes over anything a person needs to use.
 */

import { clamp, damp } from './motion/math.js';

const finePointer = () => matchMedia('(pointer: fine)').matches;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------- magnetism */
/**
 * A control that answers before it is touched. The surface, the label and the
 * mark move by different amounts — that difference is what makes it feel like
 * an object instead of a div sliding around.
 */
function magnetise(elements) {
  if (!elements.length) return;
  const items = elements.map((el) => ({
    el,
    strength: Number(el.dataset.magnetic || 1),
    cx: 0, cy: 0, tx: 0, ty: 0,
  }));

  let raf = 0;
  let last = performance.now();
  let pointerX = -9999;
  let pointerY = -9999;

  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let moving = false;
    for (const it of items) {
      it.cx = damp(it.cx, it.tx, 14, dt);
      it.cy = damp(it.cy, it.ty, 14, dt);
      it.el.style.setProperty('--mx', `${it.cx.toFixed(2)}px`);
      it.el.style.setProperty('--my', `${it.cy.toFixed(2)}px`);
      if (Math.abs(it.cx - it.tx) > 0.05 || Math.abs(it.cy - it.ty) > 0.05) moving = true;
    }
    raf = moving ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };

  // One listener, one pass. Rects are read together so the browser gets a
  // single layout read per pointer event instead of one per control.
  const measure = () => {
    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      if (r.bottom < -140 || r.top > innerHeight + 140 || r.width === 0) {
        it.tx = 0; it.ty = 0;
        continue;
      }
      const dx = pointerX - (r.left + r.width / 2);
      const dy = pointerY - (r.top + r.height / 2);
      const reach = Math.max(r.width, r.height) * 0.9 + 90;
      // The control answers before the pointer is on it — that anticipation
      // is the whole point.
      const pull = clamp(1 - Math.hypot(dx, dy) / reach);
      it.tx = dx * 0.22 * pull * it.strength;
      it.ty = dy * 0.3 * pull * it.strength;
      it.el.style.setProperty('--pull', pull.toFixed(3));
    }
    kick();
  };

  let pending = false;
  addEventListener('pointermove', (e) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; measure(); });
  }, { passive: true });

  addEventListener('blur', () => {
    for (const it of items) { it.tx = 0; it.ty = 0; }
    kick();
  });
}

/* ----------------------------------------------------------------- header */
function header() {
  const el = document.querySelector('[data-header]');
  const rule = document.querySelector('[data-progress]');
  if (!el) return;
  let ticking = false;
  const write = () => {
    const y = scrollY;
    el.dataset.lifted = y > 40 ? 'true' : 'false';
    if (rule) {
      const max = document.documentElement.scrollHeight - innerHeight;
      rule.style.transform = `scaleX(${max > 0 ? (y / max).toFixed(4) : 0})`;
    }
    ticking = false;
  };
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(write); }
  }, { passive: true });
  write();
}

/* -------------------------------------------------------------- the dock */
/** One CTA, only once the visitor has seen enough to want it. */
function dock() {
  const el = document.querySelector('[data-dock]');
  const contact = document.getElementById('contato');
  if (!el || !contact) return;
  let atContact = false;
  new IntersectionObserver(([entry]) => {
    atContact = entry.isIntersecting;
    el.dataset.on = String(scrollY > innerHeight * 1.2 && !atContact);
  }, { threshold: 0.06 }).observe(contact);
  addEventListener('scroll', () => {
    el.dataset.on = String(scrollY > innerHeight * 1.2 && !atContact);
  }, { passive: true });
}

/* ------------------------------------------------------------ navigation */
function navState() {
  const links = [...document.querySelectorAll('[data-nav]')];
  if (!links.length) return;
  const targets = links
    .map((a) => ({ a, el: document.querySelector(a.getAttribute('href')) }))
    .filter((t) => t.el);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      for (const t of targets) t.a.dataset.current = String(t.el === e.target);
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  for (const t of targets) io.observe(t.el);
}

/* --------------------------------------------------------------- projects */
/**
 * Progressive disclosure: hovering brings a project forward and reveals its
 * coordinates; opening it gives the rest. Nothing dumps everything at once.
 */
function projects() {
  const cards = [...document.querySelectorAll('[data-project]')];
  for (const card of cards) {
    const toggle = card.querySelector('[data-project-toggle]');
    const panel = card.querySelector('[data-project-detail]');
    if (toggle && panel) {
      toggle.addEventListener('click', () => {
        const open = card.dataset.open === 'true';
        card.dataset.open = String(!open);
        toggle.setAttribute('aria-expanded', String(!open));
        panel.hidden = open;
      });
    }
    if (!finePointer() || reduced()) continue;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--hx', ((e.clientX - r.left) / r.width).toFixed(3));
      card.style.setProperty('--hy', ((e.clientY - r.top) / r.height).toFixed(3));
    }, { passive: true });
  }
}

/* ------------------------------------------------------------------- form */
function form() {
  const el = document.getElementById('project-form');
  const status = document.getElementById('form-status');
  if (!el || !status) return;

  if (new URLSearchParams(location.search).get('enviado') === '1') {
    status.textContent = 'Recebemos seu projeto. A equipe da Tera entra em contato.';
    status.dataset.state = 'ok';
    el.reset();
  }

  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!el.checkValidity()) { el.reportValidity(); return; }
    const button = el.querySelector('[type="submit"]');
    const label = button.querySelector('[data-label]');
    const original = label ? label.textContent : button.textContent;
    button.disabled = true;
    if (label) label.textContent = 'Enviando';
    status.dataset.state = 'busy';
    status.textContent = 'Enviando o contexto do projeto…';
    try {
      const res = await fetch('https://formsubmit.co/ajax/canhete.jr@gmail.com', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(el),
      });
      const data = await res.json();
      if (!res.ok || String(data.success) !== 'true') throw new Error(data.message || 'falha');
      el.reset();
      status.dataset.state = 'ok';
      status.textContent = 'Projeto enviado. A equipe da Tera entra em contato.';
    } catch {
      status.dataset.state = 'error';
      status.textContent = 'Não foi possível enviar agora. Tente novamente em alguns instantes.';
    } finally {
      button.disabled = false;
      if (label) label.textContent = original;
    }
  });
}

/* ----------------------------------------------------------------- misc */
function year() {
  for (const el of document.querySelectorAll('[data-year]')) {
    el.textContent = String(new Date().getFullYear());
  }
}

/**
 * The old site routed five screens through the hash. Those URLs still exist
 * in the wild, so they still land somewhere correct.
 */
function legacyHashes() {
  const map = {
    '#inicio': '#topo',
    '#servicos': '#capacidades',
    '#projetos': '#projetos',
    '#sobre': '#origem',
    '#contato': '#contato',
  };
  const go = () => {
    const to = map[location.hash];
    if (!to || to === location.hash) return;
    const el = document.querySelector(to);
    if (el) el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  };
  addEventListener('hashchange', go);
  if (location.hash) requestAnimationFrame(go);
}

export function initUI() {
  header();
  dock();
  navState();
  projects();
  form();
  year();
  legacyHashes();
  if (finePointer() && !reduced()) {
    magnetise([...document.querySelectorAll('[data-magnetic]')]);
  }
}
