/* ════════════════════════════════════════════════════════════════
   SECTIONS — content injection + every scroll-linked animation.

   Structure:
     injectContent()  — builds skills / projects / timeline / etc.
                        from data.js (runs for everyone, even with
                        reduced motion — content must always exist)
     initSections()   — creates all ScrollTriggers. Anything that
                        MOVES is gated behind prefers-reduced-motion
                        via gsap.matchMedia, so reduced users get a
                        fully static, fully readable page.
     heroIntro()      — the post-preloader entrance timeline.
   ════════════════════════════════════════════════════════════════ */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ENV, $, $$, clamp, splitChars, splitWords, scramble } from './utils.js';
import { morph, setHighlight, setDrift, setFlare, burst, stats } from './three/app.js';
import { initMagnetic } from './magnetic.js';
import { scrollToTop } from './scroll.js';
import { skillGroups, projects as fallbackProjects, experience, cloudHighlights, cloudStats, socials } from './data.js';
import { driveEmbedVariants } from './works.js';

gsap.registerPlugin(ScrollTrigger);

const MOTION = '(prefers-reduced-motion: no-preference)';

/** Live project list (Firestore via admin, else data.js fallback) */
export let liveProjects = fallbackProjects;

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function imgTag(src, alt, { lazy = true } = {}) {
  const variants = driveEmbedVariants(src);
  const primary = variants[0] || src;
  const alts = variants.slice(1).join('|');
  return `<img src="${escAttr(primary)}" alt="${escAttr(alt)}" loading="${lazy ? 'lazy' : 'eager'}" draggable="false" data-fallbacks="${escAttr(alts)}" />`;
}

function isPlaceholderLink(href) {
  if (!href) return true;
  const h = String(href).trim();
  return h === '#' || h === '' || h === './#' || h.toLowerCase() === 'javascript:void(0)';
}

let toastTimer;
export function showSiteToast(message) {
  let el = $('#site-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'site-toast';
    el.className = 'site-toast mono';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.hidden = false;
  el.textContent = message;
  requestAnimationFrame(() => el.classList.add('is-on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('is-on');
    setTimeout(() => {
      el.hidden = true;
    }, 350);
  }, 2600);
}

function linkOrPlaceholder(href, label, className) {
  if (isPlaceholderLink(href)) {
    return `<a class="${className} is-unavailable" href="#" data-unavailable="${label}" data-magnetic>${label === 'live' ? 'View Project' : 'GitHub ↗'}</a>`;
  }
  const text = label === 'live' ? 'View Project' : 'GitHub ↗';
  return `<a class="${className}" href="${href}" target="_blank" rel="noopener" data-magnetic>${text}</a>`;
}

function initUnavailableLinks() {
  if (document.documentElement.dataset.unavailWired === '1') return;
  document.documentElement.dataset.unavailWired = '1';
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-unavailable], a.is-unavailable');
    if (!a) {
      const bare = e.target.closest('a[href="#"]');
      if (!bare || !bare.closest('.p-links, .socials, .p-mock')) return;
      e.preventDefault();
      e.stopPropagation();
      showSiteToast('SORRY — THIS LINK IS NOT AVAILABLE YET');
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const kind = a.dataset.unavailable;
    const msg =
      kind === 'repo'
        ? 'SORRY — REPO LINK NOT AVAILABLE YET'
        : kind === 'live'
          ? 'SORRY — LIVE DEMO NOT AVAILABLE YET'
          : 'SORRY — THIS LINK IS NOT AVAILABLE YET';
    showSiteToast(msg);
  });
}

function hardenProjectImages(root = document) {
  $$('img[data-fallbacks]', root).forEach((img) => {
    if (img.dataset.harden === '1') return;
    img.dataset.harden = '1';
    const queue = (img.dataset.fallbacks || '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    let i = 0;
    img.addEventListener('error', () => {
      if (i >= queue.length) {
        img.classList.add('is-broken');
        return;
      }
      img.src = queue[i++];
    });
  });
}

function initWorkGalleries() {
  hardenProjectImages();
  $$('[data-gallery]').forEach((gal) => {
    const track = $('.p-gallery-track', gal);
    const slides = $$('img', track);
    const dots = $$('.p-gal-dot', gal);
    const count = $('b', $('.p-gal-count', gal));
    if (slides.length < 2) return;
    let i = 0;
    const go = (n) => {
      i = (n + slides.length) % slides.length;
      track.style.transform = `translateX(${-i * 100}%)`;
      dots.forEach((d, k) => d.classList.toggle('is-on', k === i));
      if (count) count.textContent = String(i + 1);
    };
    $('.p-gal-btn.prev', gal)?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      go(i - 1);
    });
    $('.p-gal-btn.next', gal)?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      go(i + 1);
    });
    dots.forEach((d) =>
      d.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        go(+d.dataset.i);
      })
    );
    /* swipe */
    let sx = 0;
    gal.addEventListener(
      'touchstart',
      (e) => {
        sx = e.changedTouches[0].clientX;
      },
      { passive: true }
    );
    gal.addEventListener(
      'touchend',
      (e) => {
        const dx = e.changedTouches[0].clientX - sx;
        if (Math.abs(dx) < 36) return;
        go(i + (dx < 0 ? 1 : -1));
      },
      { passive: true }
    );
  });
}

/* ════════════════════════════════════════════════════════════
   CONTENT INJECTION
   ════════════════════════════════════════════════════════════ */
export function injectContent(projectList = liveProjects) {
  liveProjects = projectList?.length ? projectList : fallbackProjects;
  /* ── skills cards (hover ↔ 3D ring highlight) ── */
  const grid = $('#skills-grid');
  skillGroups.forEach((g, i) => {
    const card = document.createElement('div');
    card.className = 'skill-card';
    card.tabIndex = 0;
    card.dataset.ring = String(i);
    card.innerHTML = `
      <div class="skill-card-head">
        <span class="skill-card-index mono">R·0${i + 1}</span>
        <h3 class="skill-card-title">${g.title}</h3>
      </div>
      <div class="skill-chips">${g.skills.map((s) => `<span class="chip">${s}</span>`).join('')}</div>`;
    const light = () => setHighlight(i);
    const dim = () => setHighlight(-1);
    card.addEventListener('mouseenter', light);
    card.addEventListener('mouseleave', dim);
    card.addEventListener('focus', light);
    card.addEventListener('blur', dim);
    // touch: tap toggles ring highlight (no hover on mobile)
    card.addEventListener('click', () => {
      if (!ENV.touch) return;
      const on = card.classList.toggle('is-active');
      $$('.skill-card.is-active').forEach((c) => {
        if (c !== card) c.classList.remove('is-active');
      });
      setHighlight(on ? i : -1);
    });
    grid.appendChild(card);
  });

  /* ── project panels ── */
  const track = $('#work-track');
  const projects = liveProjects;
  const total = String(projects.length).padStart(2, '0');
  $('#wp-total').textContent = total;
  projects.forEach((p, i) => {
    const n = String(i + 1).padStart(2, '0');
    const panel = document.createElement('article');
    panel.className = 'panel panel-project';
    const imgs = (p.images?.length ? p.images : p.image ? [p.image] : []).filter(Boolean);
    let visual;
    if (imgs.length > 1) {
      visual = `
        <div class="p-gallery" data-gallery>
          <div class="p-gallery-track">
            ${imgs
              .map((src, k) => imgTag(src, `${p.title} screenshot ${k + 1}`, { lazy: k > 0 }))
              .join('')}
          </div>
          <button type="button" class="p-gal-btn prev" aria-label="Previous image">‹</button>
          <button type="button" class="p-gal-btn next" aria-label="Next image">›</button>
          <div class="p-gal-dots" role="tablist" aria-label="Project images">
            ${imgs.map((_, k) => `<button type="button" class="p-gal-dot${k === 0 ? ' is-on' : ''}" aria-label="Image ${k + 1}" data-i="${k}"></button>`).join('')}
          </div>
          <span class="p-gal-count mono"><b>1</b> / ${imgs.length}</span>
        </div>`;
    } else if (imgs.length === 1) {
      visual = imgTag(imgs[0], `${p.title} screenshot`, { lazy: true });
    } else {
      visual = `<div class="mock-chrome"><i></i><i></i><i></i><span class="mock-url"></span></div>
         <div class="mock-body">
           <div class="mock-side">
             <span class="mk-line"></span><span class="mk-line short"></span>
             <span class="mk-line mid"></span><span class="mk-line short"></span>
           </div>
           <div class="mock-main">
             <div class="mk-hero"></div>
             <span class="mk-row"></span>
             <span class="mk-row dim"></span>
           </div>
         </div>`;
    }
    const mockTag = imgs.length > 1 ? 'div' : 'a';
    const liveMissing = isPlaceholderLink(p.live);
    const mockAttrs =
      imgs.length > 1
        ? `class="p-mock has-gallery" style="--ph:${p.hue}" data-tilt`
        : liveMissing
          ? `class="p-mock is-unavailable" style="--ph:${p.hue}" href="#" data-unavailable="live" data-tilt data-cursor-text="SOON" aria-label="${p.title} — link not available yet"`
          : `class="p-mock" style="--ph:${p.hue}" href="${p.live}" target="_blank" rel="noopener"
         data-tilt data-cursor-text="VIEW" aria-label="View ${p.title}"`;
    panel.innerHTML = `
      <p class="p-num" aria-hidden="true">${n}</p>
      <${mockTag} ${mockAttrs}>${visual}</${mockTag}>
      <div class="p-info">
        <p class="p-index mono">PROJECT ${n} — ${total}</p>
        <h3 class="p-title">${p.title}</h3>
        <p class="p-desc">${p.desc}</p>
        <div class="p-tags">${p.tech.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
        <div class="p-links">
          ${linkOrPlaceholder(p.live, 'live', 'btn btn-primary')}
          ${linkOrPlaceholder(p.repo, 'repo', 'btn')}
        </div>
      </div>`;
    track.appendChild(panel);
  });

  initWorkGalleries();
  initUnavailableLinks();

  /* ── experience timeline ── */
  const xp = $('#xp-list');
  experience.forEach((e) => {
    const li = document.createElement('li');
    li.className = 'xp-item';
    li.innerHTML = `
      <span class="xp-dot" aria-hidden="true"></span>
      <p class="xp-date mono">${e.date}</p>
      <h3 class="xp-role">${e.role}</h3>
      <p class="xp-co">${e.company}</p>
      <p class="xp-desc">${e.desc}</p>`;
    xp.appendChild(li);
  });

  /* ── cloud proof-of-work + stats ── */
  $('#cert-list').innerHTML = cloudHighlights.map((c) => `<li class="cert-chip">${c}</li>`).join('');
  $('#cloud-stats').innerHTML = cloudStats
    .map((s) => `<div class="cstat"><p class="cstat-num">${s.num}</p><p class="cstat-label">${s.label}</p></div>`)
    .join('');

  /* ── socials ── */
  $('#socials').innerHTML = socials
    .map((s) => {
      if (isPlaceholderLink(s.url)) {
        return `<a class="btn social-pill is-unavailable" href="#" data-unavailable="social" data-magnetic>${s.label}</a>`;
      }
      return `<a class="btn social-pill" href="${s.url}" target="_blank" rel="noopener" data-magnetic>${s.label}</a>`;
    })
    .join('');

  /* ── marquee: clone content until the loop is seamless ── */
  const mq = $('#mq-track');
  const base = mq.children[0];
  const copies = Math.max(1, Math.ceil(innerWidth / Math.max(base.offsetWidth, 1)));
  for (let k = 0; k < copies * 2 - 1; k++) mq.appendChild(base.cloneNode(true));

  /* ── misc ── */
  $('#year').textContent = new Date().getFullYear();
  $('#back-to-top').addEventListener('click', scrollToTop);

  // local time badge (PLACEHOLDER timezone — change if you relocate)
  const timeEl = $('#local-time');
  const tickTime = () => {
    try {
      const t = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Karachi',
      });
      timeEl.textContent = `KARACHI ${t}`;
    } catch {
      timeEl.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
  };
  tickTime();
  setInterval(tickTime, 30_000);

  // reduced motion → skip theatrics, land on final states immediately
  const tw = $('#typewriter');
  if (ENV.reduced) {
    tw.textContent = tw.dataset.text;
    $('.caret')?.remove();
    $$('.stat-num').forEach((el) => (el.textContent = el.dataset.count + (el.dataset.suffix || '')));
    $('#xp-line-fill').style.transform = 'scaleY(1)';
    $$('.xp-item').forEach((i) => i.classList.add('is-active'));
  }

  initMagnetic(); // after injection so new buttons are picked up
}

/* ════════════════════════════════════════════════════════════
   HERO INTRO — chained off the preloader curtain in main.js
   ════════════════════════════════════════════════════════════ */
let heroChars = [];

export function heroIntro() {
  if (ENV.reduced) return;
  const tl = gsap.timeline();
  tl.to(heroChars, { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.035 }, 0.1)
    .from('.hero-eyebrow', { autoAlpha: 0, y: 16, duration: 0.7, ease: 'power3.out' }, 0.7)
    .from('.hero-role', { autoAlpha: 0, y: 16, duration: 0.7, ease: 'power3.out' }, 0.85)
    .from('.nav', { yPercent: -120, duration: 0.8, ease: 'power3.out', clearProps: 'transform' }, 0.9)
    .from('.rail', { autoAlpha: 0, x: 20, duration: 0.7 }, 1.1)
    .from('.scroll-cue', { autoAlpha: 0, duration: 0.9 }, 1.3)
    .add(typewrite, 1.0);
}

function typewrite() {
  const el = $('#typewriter');
  const text = el.dataset.text;
  let i = 0;
  const tick = () => {
    el.textContent = text.slice(0, ++i);
    if (i < text.length) setTimeout(tick, 22 + Math.random() * 26);
    else gsap.to('.caret', { autoAlpha: 0, duration: 0.4, delay: 1.6 });
  };
  tick();
}

/* ════════════════════════════════════════════════════════════
   SCROLL CHOREOGRAPHY
   ════════════════════════════════════════════════════════════ */
export function initSections() {
  const mm = gsap.matchMedia();

  /* ────────────────────────────────────────────────────────
     3D MORPH DRIVER — the spine of the whole site.
     Each section owns the transition INTO itself: while its top
     travels from 85% → 25% of the viewport, morph.t scrubs 0→1
     between formation (i-1) and formation (i). app.js reads this
     every frame. Fast scrolling is fine: particles chase targets
     with damping, so state jumps still look organic.
     ──────────────────────────────────────────────────────── */
  mm.add(MOTION, () => {
    $$('[data-formation]').forEach((sec) => {
      const i = +sec.dataset.formation;
      if (i === 0) return; // hero is the resting state
      const apply = (p) => {
        morph.a = i - 1;
        morph.b = i;
        morph.t = p;
      };
      ScrollTrigger.create({
        trigger: sec,
        start: 'top 85%',
        end: 'top 25%',
        onUpdate: (self) => apply(self.progress),
        // restore correct state on refresh/deep-load (triggers refresh
        // in document order, so the deepest section with progress wins)
        onRefresh: (self) => self.progress > 0 && apply(self.progress),
      });
    });
  });

  /* ── hero: name lines drift apart + fade as you leave ── */
  mm.add(MOTION, () => {
    // pre-hide name chars behind their mask for the intro timeline
    heroChars = [];
    $$('.hn-line').forEach((line) => {
      line.classList.add('hl'); // mask
      heroChars.push(...splitChars(line));
    });
    gsap.set(heroChars, { yPercent: 120 });

    gsap.to('.hn-line', {
      yPercent: (i) => -22 - i * 14, // each line leaves at its own speed
      ease: 'none',
      scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
    });
    gsap.to('.hero-inner, .scroll-cue', {
      autoAlpha: 0,
      ease: 'none',
      scrollTrigger: { trigger: '#hero', start: '30% top', end: 'bottom top', scrub: true },
    });

    /* letters ripple away from the cursor (proximity wave, not just hover) */
    if (!ENV.touch) {
      const wave = heroChars
        .filter((c) => c.textContent !== '\u00A0')
        .map((c) => ({
          el: c,
          y: gsap.quickTo(c, 'y', { duration: 0.4, ease: 'power3' }),
          r: gsap.quickTo(c, 'rotation', { duration: 0.45, ease: 'power3' }),
        }));
      const onMove = (e) => {
        if (scrollY > innerHeight) return; // hero off-screen
        const R = 150;
        for (const w of wave) {
          const rect = w.el.getBoundingClientRect();
          const dx = e.clientX - (rect.left + rect.width / 2);
          const dy = e.clientY - (rect.top + rect.height / 2);
          const d = Math.hypot(dx, dy);
          const f = Math.max(0, 1 - d / R) ** 2;
          w.y(-f * 22);
          w.r((dx < 0 ? -1 : 1) * f * 9);
        }
      };
      const onLeave = () => wave.forEach((w) => (w.y(0), w.r(0)));
      window.addEventListener('mousemove', onMove);
      document.addEventListener('mouseleave', onLeave);
      return () => {
        window.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseleave', onLeave);
      };
    }
  });

  /* ── generic reveals: masked heading lines + .reveal fade-ups ── */
  mm.add(MOTION, () => {
    $$('.section-head, .panel-intro, .contact-inner').forEach((head) => {
      const lines = $$('.hl-in', head);
      if (!lines.length) return;
      gsap.from(lines, {
        yPercent: 115,
        duration: 1,
        ease: 'power4.out',
        stagger: 0.09,
        scrollTrigger: {
          trigger: head,
          start: 'top 80%',
          once: true,
          onEnter: () => head.classList.add('is-inview'), // draws the divider line
        },
      });
    });
    $$('.reveal').forEach((el) => {
      gsap.from(el, {
        autoAlpha: 0,
        y: 28,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 82%', once: true },
      });
    });
    // eyebrows decode like terminal output instead of fading
    $$('.eyebrow').forEach((el) => {
      const original = el.textContent;
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () => scramble(el, original, 850),
      });
    });
  });

  /* ── about: bio words sharpen in, one by one, scrubbed ── */
  mm.add(MOTION, () => {
    const words = splitWords($('.about-bio'));
    gsap.set(words, { opacity: 0.14 });
    gsap.to(words, {
      opacity: 1,
      stagger: 0.045,
      ease: 'none',
      scrollTrigger: { trigger: '.about-bio', start: 'top 78%', end: 'top 28%', scrub: true },
    });

    // stat counters
    $$('.stat-num').forEach((el) => {
      const target = +el.dataset.count;
      const suffix = el.dataset.suffix || '';
      const state = { v: 0 };
      ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: () =>
          gsap.to(state, {
            v: target,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate: () => (el.textContent = Math.round(state.v) + suffix),
          }),
      });
    });
  });

  /* ── skills: cards cascade in (animate on enter — cards stay visible if trigger misses) ── */
  mm.add(MOTION, () => {
    ScrollTrigger.create({
      trigger: '#skills-grid',
      start: 'top 92%',
      once: true,
      onEnter: () => {
        gsap.from('.skill-card', {
          y: ENV.touch ? 20 : 32,
          opacity: ENV.touch ? 1 : 0,
          duration: 0.75,
          ease: 'power3.out',
          stagger: 0.09,
          clearProps: 'opacity,transform',
        });
      },
    });
  });

  /* ────────────────────────────────────────────────────────
     WORK — desktop gets the pinned horizontal journey; mobile
     and reduced-motion get a clean vertical stack instead.
     ──────────────────────────────────────────────────────── */
  mm.add(`(min-width: 900px) and ${MOTION}`, () => {
    const work = $('#work');
    const track = $('#work-track');
    work.classList.add('is-horizontal');

    const dist = () => track.scrollWidth - innerWidth;
    const panels = $$('.panel', track).length;
    const wpFill = $('#wp-bar-fill');
    const wpCur = $('#wp-current');
    const wpName = $('#wp-name');
    let lastIdx = 0;

    // Project titles become per-char kinetic type (masked by .p-title)
    $$('.p-title', track).forEach((t) => splitChars(t));

    // Pin the section and translate the track by exactly its overflow,
    // so 1px of vertical scroll = 1px of horizontal travel. Snap makes
    // each project settle like a chapter. (Remove `snap` if you prefer
    // fully free scrolling.)
    const tween = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: work,
        start: 'top top',
        end: () => '+=' + dist(),
        scrub: 1,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        snap: { snapTo: 1 / (panels - 1), duration: { min: 0.25, max: 0.55 }, ease: 'power1.inOut', delay: 0.12 },
        onUpdate: (self) => {
          setDrift(self.progress); // particle field slides along
          wpFill.style.transform = `scaleX(${self.progress})`;
          const idx = clamp(Math.round(self.progress * (panels - 1)), 1, liveProjects.length);
          if (idx !== lastIdx) {
            lastIdx = idx;
            wpCur.textContent = String(idx).padStart(2, '0');
            scramble(wpName, liveProjects[idx - 1].title.toUpperCase(), 450); // HUD decodes the title
          }
        },
      },
    });
    scramble(wpName, liveProjects[0].title.toUpperCase(), 450);
    lastIdx = 1;

    // Per-panel reveals + parallax, timed against the container motion
    $$('.panel-project', track).forEach((panel) => {
      gsap.from($$('.p-title .char', panel), {
        yPercent: 120,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.03,
        scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left 70%', toggleActions: 'play none none reverse' },
      });
      gsap.from($$('.p-index, .p-desc, .p-tags, .p-links', panel), {
        autoAlpha: 0,
        y: 34,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.07,
        scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left 65%', toggleActions: 'play none none reverse' },
      });
      gsap.from($('.p-mock', panel), {
        autoAlpha: 0,
        rotateY: -14,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left 75%', toggleActions: 'play none none reverse' },
      });
      // depth: mockup and ghost number drift at different speeds
      gsap.fromTo(
        $('.p-mock', panel),
        { xPercent: 6 },
        { xPercent: -6, ease: 'none',
          scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } }
      );
      gsap.fromTo(
        $('.p-num', panel),
        { xPercent: -22 },
        { xPercent: 22, ease: 'none',
          scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } }
      );
    });

    return () => {
      work.classList.remove('is-horizontal');
      setDrift(0);
    };
  });

  // Vertical fallback reveals (mobile with motion allowed)
  mm.add(`(max-width: 899px) and ${MOTION}`, () => {
    $$('.panel-project').forEach((panel) => {
      gsap.from(panel, {
        autoAlpha: 0,
        y: 48,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: panel, start: 'top 78%', once: true },
      });
    });
  });

  /* ── mockup 3D tilt (fine pointer only) ── */
  if (!ENV.touch && !ENV.reduced) {
    $$('.p-mock').forEach((mock) => {
      const rx = gsap.quickTo(mock, 'rotationX', { duration: 0.55, ease: 'power3' });
      const ry = gsap.quickTo(mock, 'rotationY', { duration: 0.55, ease: 'power3' });
      gsap.set(mock, { transformPerspective: 900 });
      mock.addEventListener('mousemove', (e) => {
        const r = mock.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 14);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 12);
      });
      mock.addEventListener('mouseleave', () => {
        rx(0);
        ry(0);
      });
    });
  }

  /* ── experience: line draws itself; nodes ignite as you pass ── */
  mm.add(MOTION, () => {
    gsap.to('#xp-line-fill', {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.xp-wrap', start: 'top 65%', end: 'bottom 55%', scrub: true },
    });
    $$('.xp-item').forEach((item, idx) => {
      gsap.from(item, {
        autoAlpha: 0,
        y: 44,
        x: idx % 2 ? 44 : -44, // items slide in toward the center line
        duration: 0.85,
        ease: 'power3.out',
        scrollTrigger: { trigger: item, start: 'top 75%', once: true },
      });
      ScrollTrigger.create({
        trigger: item,
        start: 'top 62%',
        onEnter: () => item.classList.add('is-active'),
        onLeaveBack: () => item.classList.remove('is-active'),
      });
    });
  });

  /* ── cloud: certs + stats cascade ── */
  mm.add(MOTION, () => {
    gsap.from('.cert-chip, .cstat', {
      autoAlpha: 0,
      y: 26,
      duration: 0.7,
      ease: 'power3.out',
      stagger: 0.08,
      scrollTrigger: { trigger: '.cloud-side', start: 'top 80%', once: true },
    });
  });

  /* ── contact: CTA words rise from masks; letters bounce on hover ── */
  mm.add(MOTION, () => {
    const cta = $('.cta-title');
    const words = splitWords(cta, { mask: true });
    const chars = [];
    words.forEach((w) => chars.push(...splitChars(w)));

    gsap.from(words, {
      yPercent: 115,
      duration: 1.05,
      ease: 'power4.out',
      stagger: 0.08,
      scrollTrigger: { trigger: cta, start: 'top 80%', once: true },
    });
    gsap.from('.email-link, .socials', {
      autoAlpha: 0,
      y: 30,
      duration: 0.9,
      stagger: 0.12,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.email-link', start: 'top 85%', once: true },
    });

    // hovering the email makes the 3D core flare — the site answers back
    const email = $('.email-link');
    email.addEventListener('mouseenter', () => setFlare(1));
    email.addEventListener('mouseleave', () => setFlare(0));

    // kinetic hover: each letter pops up and springs back
    if (!ENV.touch) {
      chars.forEach((c) => {
        c.addEventListener('mouseenter', () => {
          gsap.to(c, { y: -16, color: 'var(--accent)', duration: 0.18, ease: 'power2.out' });
          gsap.to(c, { y: 0, color: 'inherit', duration: 1, delay: 0.18, ease: 'elastic.out(1, 0.35)' });
        });
      });
    }
  });

  /* ── nav hide-on-scroll-down + rail progress + active states ── */
  mm.add(MOTION, () => {
    const nav = $('#site-nav');
    ScrollTrigger.create({
      start: 'top top',
      end: 'max',
      onUpdate: (self) => {
        nav.classList.toggle('nav-hidden', self.direction === 1 && self.scroll() > 300);
      },
    });
    gsap.to('#rail-progress', {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: true },
    });
  });

  /* ── system HUD: live formation name + fps (bottom-left, desktop) ── */
  mm.add(`(min-width: 900px) and ${MOTION}`, () => {
    const hud = $('#hud');
    const timer = setInterval(() => {
      hud.innerHTML = `SYS · <span class="hud-acc">${stats.formation}</span> / ${stats.fps} FPS`;
    }, 300);
    return () => clearInterval(timer);
  });

  /* ── click anywhere on the background → particle shockwave ── */
  if (!ENV.reduced) {
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('a, button, .skill-card, [data-magnetic], input, textarea, select, .p-mock')) return;
      burst(e.clientX, e.clientY);
    });
  }

  // Active section markers (also useful without motion → outside mm)
  $$('[data-formation]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => {
        if (!self.isActive) return;
        $$('.rail-item').forEach((r) => r.classList.toggle('is-active', r.dataset.rail === sec.id));
        $$('.nav-links a').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + sec.id));
      },
    });
  });
}
