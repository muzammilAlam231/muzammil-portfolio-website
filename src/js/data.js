/* ════════════════════════════════════════════════════════════════
   DATA — every piece of swappable content lives here.
   ⚠ Everything in this file is PLACEHOLDER content: replace freely.
   ════════════════════════════════════════════════════════════════ */

/* ── 02 · SKILLS ─────────────────────────────────────────────
   Four groups — each maps 1:1 to one orbit ring in the 3D scene
   (hovering a card lights up its ring). Keep exactly 4 groups.  */
export const skillGroups = [
  {
    title: 'Frontend',
    skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Three.js', 'GSAP'],
  },
  {
    title: 'Backend',
    skills: ['Node.js', 'Express', 'NestJS', 'GraphQL', 'REST APIs', 'Python'],
  },
  {
    title: 'Cloud / AWS',
    skills: ['EC2', 'Lambda', 'S3', 'ECS · Fargate', 'CloudFront', 'RDS', 'AWS CDK'],
  },
  {
    title: 'Data & Tools',
    skills: ['MongoDB', 'PostgreSQL', 'Git', 'GitHub', 'Firebase'],
  },
];

/* ── 03 · PROJECTS ───────────────────────────────────────────
   PLACEHOLDER projects. For each one:
     title / desc / tech  → replace with the real thing
     hue                  → 0-360, drives the mockup's color scheme
     image                → set '/projects/foo.jpg' to replace the
                            procedural mockup with a real screenshot
     links                → live URL + repo URL ('#' hides nothing,
                            it just goes nowhere yet)               */
export const projects = [
  {
    title: 'Nimbus',
    desc: 'Cloud cost intelligence dashboard that turns AWS billing noise into clear, actionable signals.',
    tech: ['React', 'Node.js', 'AWS Lambda', 'DynamoDB'],
    hue: 205,
    image: null,
    live: '#',
    repo: '#',
  },
  {
    title: 'Relay',
    desc: 'Real-time collaboration platform — presence, cursors and conflict-free editing at scale.',
    tech: ['Next.js', 'WebSockets', 'Redis', 'ECS'],
    hue: 160,
    image: null,
    live: '#',
    repo: '#',
  },
  {
    title: 'Forge',
    desc: 'Zero-config CI/CD pipeline builder: from git push to production without writing YAML.',
    tech: ['TypeScript', 'Docker', 'AWS CodeBuild', 'CDK'],
    hue: 35,
    image: null,
    live: '#',
    repo: '#',
  },
  {
    title: 'Atlas',
    desc: 'Geospatial analytics engine rendering millions of data points into live, queryable maps.',
    tech: ['React', 'PostGIS', 'Node.js', 'S3'],
    hue: 275,
    image: null,
    live: '#',
    repo: '#',
  },
  {
    title: 'Pulse',
    desc: 'Event-driven health-data platform ingesting device streams with sub-second latency.',
    tech: ['NestJS', 'Kinesis', 'RDS', 'CloudFront'],
    hue: 345,
    image: null,
    live: '#',
    repo: '#',
  },
];

/* ── 04 · EXPERIENCE ── PLACEHOLDER freelance milestones ──
   The path of an independent developer, not an employee CV.   */
export const experience = [
  {
    date: '2024 — NOW',
    role: 'Freelance Full-Stack Developer',
    company: 'Independent · Remote, worldwide',
    desc: 'Building complete products for startups and agencies — React frontends, Node.js APIs and the AWS infrastructure underneath, delivered end to end.',
  },
  {
    date: '2022 — 2024',
    role: 'Freelance Web Developer',
    company: 'Upwork · Direct clients',
    desc: 'Shipped 20+ projects solo — e-commerce, dashboards, booking platforms — owning everything from brief to production.',
  },
  {
    date: '2021 — 2022',
    role: 'First Paying Clients',
    company: 'Local businesses',
    desc: 'Websites and internal tools for local businesses; learned to scope, quote and deliver like a professional.',
  },
  {
    date: '2019 — 2021',
    role: 'Self-Taught Foundations',
    company: 'Learning in public',
    desc: 'Built clones, broke builds, deployed anyway — the reps that made everything after possible.',
  },
];

/* ── 05 · CLOUD ── PLACEHOLDER: real AWS work, no badge claims ──
   Honest proof-of-work list — swap in the things you've actually
   run in production.                                             */
export const cloudHighlights = [
  'Serverless APIs — Lambda · API Gateway',
  'Containers — ECS · Fargate deployments',
  'Delivery — S3 · CloudFront pipelines',
  'Data — RDS · DynamoDB in production',
];

export const cloudStats = [
  { num: '12+', label: 'AWS services in production' },
  { num: '99.9%', label: 'Uptime maintained' },
  { num: '-40%', label: 'Client infra costs cut' },
];

/* ── 06 · CONTACT ── PLACEHOLDER links ── */
export const socials = [
  { label: 'GitHub', url: 'https://github.com/muzammilAlam231/muzammil-portfolio-website' },
  { label: 'LinkedIn', url: 'https://linkedin.com/' },
];
