# Muhammad Muzammil Alam — Portfolio

A single-page, fully 3D portfolio built around one continuous idea instead of stacked sections.

**Stack:** Vite · Three.js (vanilla, no framework — fastest possible runtime) · GSAP + ScrollTrigger · Lenis smooth scroll.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # serve the production build
```

## Deploy

### Netlify (custom domain + static hosting)

This repo includes `netlify.toml`. Firestore, admin auth, and traffic analytics still use Firebase project **muzammil-26858**.

1. Push this repo to GitHub (if not already).
2. Netlify → **Add new site** → **Import from Git** → select the repo.
3. Netlify reads build settings from `netlify.toml` (`npm run build` → `dist`). Deploy.
4. **Domain:** Site settings → Domain management → add `muhammadmuzammilalam.dev` (and `www` if you use it).
5. **Firebase Auth (required for `/admin`):** [Firebase Console](https://console.firebase.google.com/project/muzammil-26858/authentication/settings) → **Authorized domains** → add:
   - `muhammadmuzammilalam.dev`
   - `www.muhammadmuzammilalam.dev` (if used)
   - your `*.netlify.app` preview URL (for testing before the domain is live)

Clean URLs: `/play` and `/admin` rewrite to the HTML entries (same as Firebase hosting).

### Firebase Hosting (alternative)

```bash
npm run deploy
```

Live at https://muzammil-26858.web.app — connect a custom domain under Firebase Console → Hosting if you prefer one platform for frontend + backend.

---

## The creative concept: "One System"

Everything you see in 3D is **a single pool of ~3,200 particles that never leaves the screen**. There are no separate scenes — the same material is reshaped by scroll, the way a career reshapes the same person:

| Section | Formation | Meaning |
|---|---|---|
| 00 Hero | A lattice tower assembles from scattered dust (with light-beam edges) | *building systems* |
| 01 About | The structure loosens into a thought-nebula | *the person behind it* |
| 02 Stack | Particles organise into 4 orbit rings — one per skill group, hover a card to ignite its ring | *tools in constant motion* |
| 03 Work | The field dims into a receding stage floor and slides sideways with the horizontal project chapters | *the work takes the spotlight* |
| 04 Path | A rotating **DNA double helix** — two strands with accent-lit base pairs, one per chapter of the career | *career, encoded* |
| 05 Cloud | Five stacked strata: edge / compute / data / network layers | *infrastructure* |
| 06 Contact | Everything collapses into one bright core, with a faint echo of the hero lattice | *resolution — the bookend* |

Scroll position drives a `{a, b, t}` morph state; every particle chases its blended target with its own spring constant, so transitions feel like a swarm re-organising rather than a tween. The camera reads the same state through 7 keyframes, with damped mouse parallax layered on top.

Layered on top of the morphs: a terminal-style **scramble/decode** on labels, a **proximity wave** that ripples the hero letters away from the cursor, **click bursts** that shockwave the particle field, **signal packets** — bright accent motes that constantly hop particle-to-particle so data visibly flows through every formation — a **flare** that lights the core when you hover the email, subtle **camera roll** per chapter, a live **system HUD** (current formation + fps), and an **adaptive quality governor** that trades pixel ratio for frame rate on slow machines.

## GRID RUN — the standalone 3D endless runner (`/play.html`)

A Subway-Surfers-style lane runner through a neon **data highway**, linked from the nav ("Play ↗"). Separate Vite entry — its code loads only on that page, so the portfolio's load time is untouched.

**Gameplay:** 3 lanes (←→/A·D or swipe), jump (↑/Space/tap), slide + fast-fall (↓/S/swipe down). Firewalls to dodge, barriers to jump, overhead bars to slide under, data freights (some slow-moving) to weave around. Data-bit coins in lines/arcs/zigzags; power-ups: **Magnet**, **Shield**, **×2 Score**. Distance score with a combo multiplier fed by coin streaks and **near-misses** (dodge/jump/slide past something at the last moment). Difficulty ramps by tier every 240m; the world recolors each zone (lime → cyan → magenta → amber). Local top-5 leaderboard, pause (P), mute (M), zero-asset WebAudio SFX.

**Architecture (`src/game/`):** `config.js` (every tuning knob), `engine.js` (loop, chase-cam, shake/FOV/slow-mo), `world.js` (scrolling-shader floor, pooled decor chunks, zones), `player.js` (controller + procedural low-poly rig), `spawner.js` (object pools, pattern templates, difficulty director), `physics.js` (lane-domain AABB collision + near-miss detection), `effects.js` (single pooled particle system), `audio.js`, `hud.js`, `main.js` (state machine).

**Engineering note:** no physics engine on purpose — lane-runner collisions are axis-aligned interval tests, so direct math is exact, deterministic, allocation-free and lighter than cannon-es/Rapier. Object pooling everywhere; zero GC during play.

**Model swap points** are marked with `⚠ MODEL SWAP POINT` comments (player rig in `player.js`, obstacle builders in `spawner.js`, decor in `world.js`) — replace primitives with GLTF, keep the collider data.

**Theme alternatives** if the data-highway feels too on-the-nose: (1) *low-poly vaporwave sunset* — pastel gradient sky, wireframe terrain, palm silhouettes; (2) *brutalist void* — monochrome monoliths and a single red hazard color, maximum minimalism.

### Positioning note

The content is written for an **independent freelancer** (no employers, no certification claims): the timeline reads as a freelance journey, and the Cloud section leads with "systems in production", not badges. All of it is placeholder text in `src/js/data.js` / `index.html` — swap in your real milestones and clients.

**Where to edit the animation logic:**
- `src/js/three/app.js` — morph engine, camera keyframes, shader, per-section alpha
- `src/js/three/formations.js` — the 7 particle shapes (each is a pure function → easy to redesign one without touching the rest)
- `src/js/sections.js` — every ScrollTrigger: the morph driver, the pinned horizontal work section, timeline draw, text reveals

## Swap in your real content

| What | Where |
|---|---|
| Projects, skills, experience, certs, socials | `src/js/data.js` — everything is marked PLACEHOLDER |
| Project screenshots | drop into `public/projects/`, set `image: '/projects/foo.jpg'` in data.js (replaces the procedural mockup) |
| Name, tagline, bio, stats, email | directly in `index.html` (marked with `<!-- PLACEHOLDER -->`) |
| Accent color | one line in `src/styles/base.css` (`--accent`) — the 3D scene reads it automatically |

## Accent options (pre-tuned)

- **Acid lime `#b8ff3c`** — default; terminal/code energy, pops hardest on near-black
- **Electric blue `#5b8cff`** — cooler, more literal "cloud"
- **Amber `#ffb03a`** — warmer, more editorial

## Font pairing options

Implemented: **Syne** (display) + **Manrope** (body) + **JetBrains Mono** (labels/numbers).
Alternatives that fit the same premium-tech register (all on Google Fonts — swap the `<link>` in `index.html` and the font vars in `base.css`):

1. **Fraunces** (soft display serif) + **Inter** — more editorial/human
2. **Unbounded** (wide geometric display) + **Sora** — more futuristic
3. **Bricolage Grotesque** + **Manrope** — quirky grotesque, very "now"

## Performance & accessibility

- Fully procedural 3D — zero textures/models to download; 2 draw calls (points + lines)
- Low-power devices (≤4 cores/GB, touch): 1,400 particles, DPR capped at 1.5, no cursor/tilt/repulsion
- `prefers-reduced-motion`: smooth scroll, morphing, pinning and reveals all disabled — the page becomes a clean static document with the assembled structure as a poster
- No WebGL → gradient fallback, site fully usable
- Split text keeps originals in `aria-label`; keyboard focus mirrors hover states (skill rings)

---

## Alternative 3D directions (if you want a different concept)

1. **"The Terminal"** — everything rendered as glyph particles (ASCII/katakana points sprites). Hero name types itself in 3D glyphs; sections are "commands" whose output builds the page. Monochrome green-on-black, CRT scanline post-processing. Cheaper to render, very distinctive, leans hard into full-stack identity.
2. **"Blueprint"** — inverted light theme: technical-drawing aesthetic, thin ink lines on paper. Wireframe structures extrude to solid as you scroll (SVG + Three.js line materials), dimensions/annotations animate like CAD. Unique against the sea of dark portfolios.
3. **"Data District"** — camera flies through an endless instanced isometric city of server racks at night; each section is a "district" the camera stops at. More literal cloud-infrastructure storytelling, heavier GPU cost (instanced meshes + bloom), max wow-factor.
