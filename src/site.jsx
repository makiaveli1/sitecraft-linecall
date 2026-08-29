import React from 'react';

const ROUTE_BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export function routeHref(pathname = '/') {
  const route = pathname === '/' ? '' : pathname.replace(/^\/+/, '');
  return `${ROUTE_BASE}${route}`;
}

export function assetHref(filename) {
  return `${ROUTE_BASE}${filename.replace(/^\/+/, '')}`;
}

function cueNumber(cue) {
  return cue ? String(cue.number).padStart(3, '0') : '—';
}

export function webmcpStatusLabel(webmcp) {
  if (webmcp?.status === 'registered' && webmcp.browserVerified) return 'Browser verified';
  if (webmcp?.status === 'registered') return 'Tools registered';
  if (webmcp?.status === 'unsupported') return 'WebMCP browser needed';
  if (webmcp?.status === 'error') return 'Registration needs attention';
  return 'Checking WebMCP';
}

function NavLink({ href, currentPath, children }) {
  const current = href === '/' ? currentPath === '/' : currentPath.startsWith(href);
  return (
    <a href={routeHref(href)} aria-current={current ? 'page' : undefined}>
      {children}
    </a>
  );
}

export function SiteNav({ webmcp, currentPath = '/' }) {
  return (
    <header className="site-nav-wrap">
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="site-nav__brand" href={routeHref('/')} aria-label="LINECALL home">
          <span className="site-nav__mark" aria-hidden="true">LC</span>
          <span>
            <strong>LINECALL</strong>
            <small>Live production × AI</small>
          </span>
        </a>

        <div className="site-nav__links">
          <NavLink href="/product" currentPath={currentPath}>Product</NavLink>
          <NavLink href="/demo" currentPath={currentPath}>Live desk</NavLink>
          <NavLink href="/trust" currentPath={currentPath}>Trust + proof</NavLink>
        </div>

        <div className="site-nav__actions">
          <span className="site-nav__status" data-status={webmcp?.status ?? 'checking'}>
            <i aria-hidden="true" />
            {webmcpStatusLabel(webmcp)}
          </span>
          <a className="site-button site-button--compact" href={routeHref('/demo')}>Run the demo</a>
        </div>
      </nav>
    </header>
  );
}

function ArrowLink({ href, children }) {
  return (
    <a className="site-text-link" href={routeHref(href)}>
      {children} <span aria-hidden="true">↗</span>
    </a>
  );
}

export function HomePage({ showMeta, sequence, revision, webmcp, cueCount }) {
  const activeTools = webmcp?.status === 'registered' ? webmcp.toolCount : 4;

  return (
    <>
      <section className="wow-hero wow-hero--cinematic" aria-labelledby="home-title">
        <div className="wow-hero__copy">
          <p className="site-kicker">AI-assisted live production control</p>
          <h1 id="home-title">When the show moves, LINECALL finds the time.</h1>
          <p className="wow-hero__lede">
            A live-event cue system where an AI agent can inspect the run, compare timing fixes, and preview the exact downstream impact. Deterministic rules verify the plan. The human operator keeps the final call.
          </p>
          <div className="wow-hero__actions">
            <a className="site-button site-button--hero" href={routeHref('/demo')}>Enter the live desk</a>
            <ArrowLink href="/product">See how LINECALL works</ArrowLink>
          </div>
          <div className="wow-hero__signal" aria-label="LINECALL live product facts">
            <span><b>{cueCount}</b> cues</span>
            <span><b>4 → 5 → 4</b> authority lifecycle</span>
            <span><b>R{revision}</b> current revision</span>
            <span><b>{activeTools}</b> tools active</span>
          </div>
        </div>

        <aside className="hero-live-card" aria-label="LINECALL live run preview">
          <div className="hero-live-card__topline">
            <span><i aria-hidden="true" /> LIVE RUN</span>
            <b>{showMeta.title}</b>
            <em>R{revision}</em>
          </div>
          <div className="hero-live-card__now">
            <span>NOW</span>
            <strong>Q{cueNumber(sequence?.current)}</strong>
            <div>
              <b>{sequence?.current?.label ?? 'Waiting for cue'}</b>
              <small>{sequence?.current?.instruction ?? 'Waiting for the current cue.'}</small>
            </div>
          </div>
          <div className="hero-live-card__next">
            <span>NEXT</span>
            <b>Q{cueNumber(sequence?.next)} · {sequence?.next?.label ?? 'No next cue'}</b>
          </div>
          <div className="hero-live-card__agent">
            <span>AGENT</span>
            <b>{activeTools} tools active</b>
            <small>Explore the run. Preview the consequence. Stop for human approval.</small>
          </div>
        </aside>

        <div className="hero-edge-note" aria-hidden="true">LIVE PRODUCTION · HUMAN AUTHORITY · WEBMCP</div>
      </section>

      <section className="home-manifesto" aria-labelledby="manifesto-title">
        <div className="home-manifesto__content">
          <p className="site-kicker">The pressure point</p>
          <h2 id="manifesto-title">Two seconds late can become twenty seconds late.</h2>
          <div className="pressure-chain" aria-label="Example timing consequence">
            <div><strong>+2s</strong><span>Audience Q&amp;A shifts</span></div>
            <i aria-hidden="true">→</i>
            <div><strong>13</strong><span>downstream cues move</span></div>
            <i aria-hidden="true">→</i>
            <div><strong>R2</strong><span>one approved run revision</span></div>
          </div>
          <div className="home-manifesto__copy">
            <p>
              LINECALL calculates the chain before anyone touches the live run. The agent compares options, deterministic rules reject unsafe futures, and the operator sees the exact consequence before choosing one.
            </p>
            <ArrowLink href="/product">Follow the timing story</ArrowLink>
          </div>
        </div>
      </section>

      <section className="route-gallery" aria-labelledby="route-gallery-title">
        <div className="route-gallery__intro">
          <div>
            <p className="site-kicker">Explore LINECALL</p>
            <h2 id="route-gallery-title">Three ways into the run.</h2>
          </div>
          <p>Understand the timing engine, operate the real desk, or inspect exactly where agent authority stops.</p>
        </div>
        <div className="route-gallery__grid">
          <a className="route-tile route-tile--product" href={routeHref('/product')}>
            <span className="route-tile__number">01</span>
            <div>
              <small>PRODUCT</small>
              <h3>Understand the timing engine</h3>
              <p>One live run, counterfactual planning, deterministic constraints, and an explicit human decision.</p>
            </div>
            <span className="route-tile__arrow" aria-hidden="true">↗</span>
          </a>
          <a className="route-tile route-tile--demo" href={routeHref('/demo')}>
            <span className="route-tile__number">02</span>
            <div>
              <small>LIVE DESK</small>
              <h3>Operate the actual product</h3>
              <p>Work the cue score and put the real WebMCP timing workflow under pressure.</p>
            </div>
            <span className="route-tile__arrow" aria-hidden="true">↗</span>
          </a>
          <a className="route-tile route-tile--trust" href={routeHref('/trust')}>
            <span className="route-tile__number">03</span>
            <div>
              <small>TRUST + PROOF</small>
              <h3>Inspect the authority boundary</h3>
              <p>See what the agent can do, what it cannot do, and the executable evidence behind that claim.</p>
            </div>
            <span className="route-tile__arrow" aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <section className="home-endcap" aria-labelledby="home-endcap-title">
        <div>
          <p className="site-kicker">Built for the moment the plan changes</p>
          <h2 id="home-endcap-title">The agent explores. The rules verify. You call the show.</h2>
        </div>
        <a className="site-button" href={routeHref('/demo')}>Open LINECALL</a>
      </section>
    </>
  );
}

function ProductRunVisual({ sequence, revision }) {
  return (
    <div className="product-run-visual" aria-label="LINECALL run snapshot illustration">
      <div className="product-run-visual__top">
        <span><i aria-hidden="true" /> authoritative run</span>
        <b>R{revision}</b>
      </div>
      <div className="product-run-visual__now">
        <span>NOW</span>
        <strong>Q{cueNumber(sequence?.current)}</strong>
        <div><b>{sequence?.current?.label}</b><small>{sequence?.current?.instruction}</small></div>
      </div>
      <div className="product-run-visual__timeline" aria-hidden="true">
        <i className="is-done" /><i className="is-current" /><i /><i />
      </div>
      <div className="product-run-visual__labels"><span>Pre-show</span><b>Opening</b><span>Q&amp;A</span><span>Panel</span></div>
    </div>
  );
}

export function ProductPage({ sequence, revision }) {
  return (
    <>
      <section className="page-masthead page-masthead--product" aria-labelledby="product-title">
        <p className="site-kicker">Product</p>
        <h1 id="product-title">A second caller for the timing problem, not the show.</h1>
        <p>
          LINECALL combines one authoritative run, a constrained agent toolset, and deterministic scheduling rules so a producer can explore timing changes without handing the model final authority.
        </p>
      </section>

      <section className="product-chapter product-chapter--run" aria-labelledby="run-chapter-title">
        <div className="product-chapter__copy">
          <span className="chapter-index">01 / THE RUN</span>
          <h2 id="run-chapter-title">The agent starts from the same live state as the operator.</h2>
          <p>Current cue, next cue, human locks, readiness, segment boundaries, hard out, and revision all come from one run snapshot. No shadow version of the schedule exists.</p>
        </div>
        <ProductRunVisual sequence={sequence} revision={revision} />
      </section>

      <section className="product-chapter product-chapter--reason" aria-labelledby="reason-chapter-title">
        <div className="product-chapter__visual">
          <div className="counterfactual-board">
            <div className="counterfactual-board__request">Q&amp;A +2s</div>
            <div className="counterfactual-board__option is-blocked"><span>SEGMENT ONLY</span><b>Blocked</b><small>chronology breaks</small></div>
            <div className="counterfactual-board__option is-ready"><span>RIPPLE AFTER</span><b>Safe</b><small>13 exact cue changes</small></div>
            <div className="counterfactual-board__result"><i aria-hidden="true" /> Recommend safe ripple</div>
          </div>
        </div>
        <div className="product-chapter__copy">
          <span className="chapter-index">02 / THE REASONING</span>
          <h2 id="reason-chapter-title">Compare futures before the run becomes one of them.</h2>
          <p>The agent can ask LINECALL to evaluate alternative timing strategies. The application calculates the consequences and rejects plans that violate chronology, locks, spacing, stale revisions, or hard out.</p>
        </div>
      </section>

      <section className="product-chapter product-chapter--authority" aria-labelledby="authority-chapter-title">
        <div className="product-chapter__copy">
          <span className="chapter-index">03 / THE DECISION</span>
          <h2 id="authority-chapter-title">Consequential authority appears only after a human approves one exact plan.</h2>
          <p>The apply tool is absent while the agent explores. Approval binds one visible plan to one revision. The capability opens, applies once, advances the revision, leaves a receipt, and closes again.</p>
          <ArrowLink href="/trust">Inspect the trust boundary</ArrowLink>
        </div>
        <figure className="authority-art">
          <img src={assetHref('linecall-authority-keyart.svg')} alt="Diagram of the LINECALL four tools to five tools to four tools human approval lifecycle" />
        </figure>
      </section>

      <section className="product-cta">
        <p>Enough explanation.</p>
        <h2>Put two seconds of pressure on the real desk.</h2>
        <a className="site-button" href={routeHref('/demo')}>Run the live scenario</a>
      </section>
    </>
  );
}

export function DemoHero({ revision }) {
  return (
    <section className="demo-masthead" aria-labelledby="live-demo-title">
      <div>
        <p className="site-kicker">Live desk</p>
        <h1 id="live-demo-title">This is the actual LINECALL product.</h1>
        <p>Operate the cue score directly, or ask a WebMCP-aware agent to inspect and solve the run. Nothing below is a marketing mockup.</p>
      </div>
      <div className="demo-scenario" aria-label="Recommended LINECALL demo scenario">
        <span>RECOMMENDED SCENARIO · R{revision}</span>
        <p>“Audience Q&amp;A needs to start two seconds later. Find the safest way to absorb that delay and show me the exact change before anything moves.”</p>
      </div>
    </section>
  );
}

export function TrustPage({ webmcp, cueCount }) {
  return (
    <>
      <section className="page-masthead page-masthead--trust" aria-labelledby="trust-title">
        <p className="site-kicker">Trust + proof</p>
        <h1 id="trust-title">Useful because the agent cannot quietly become the operator.</h1>
        <p>LINECALL narrows model authority at the product boundary. Tool availability changes with human state, deterministic rules own scheduling safety, and every consequential apply is bound to an exact revision and plan.</p>
      </section>

      <section className="trust-art-section" aria-labelledby="lifecycle-title">
        <div className="trust-art-section__copy">
          <span className="chapter-index">THE AUTHORITY LIFECYCLE</span>
          <h2 id="lifecycle-title">4 → 5 → 4 is a permission story, not a visual effect.</h2>
          <p>Four tools are available for inspection, comparison, preview, and readiness. The fifth exists only while one exact human-approved plan remains valid.</p>
        </div>
        <figure className="authority-art authority-art--wide">
          <img src={assetHref('linecall-authority-keyart.svg')} alt="LINECALL authority lifecycle showing four tools, human approval opening a fifth tool, then returning to four" />
        </figure>
      </section>

      <section className="authority-grid authority-grid--page" aria-label="LINECALL agent authority boundaries">
        <article className="authority-grid__can">
          <p className="authority-grid__label">Agent can</p>
          <ul>
            <li>Read the current run and revision</li>
            <li>Compare counterfactual timing strategies</li>
            <li>Preview exact cue-level changes</li>
            <li>Update low-risk cue readiness</li>
            <li>Apply one exact plan after human approval</li>
          </ul>
        </article>
        <article className="authority-grid__cannot">
          <p className="authority-grid__label">Agent cannot</p>
          <ul>
            <li>Remove a human cue lock</li>
            <li>Approve its own timing plan</li>
            <li>Apply a stale or mismatched plan</li>
            <li>Keep mutation authority after the action</li>
            <li>Bypass chronology or hard-out rules</li>
          </ul>
        </article>
      </section>

      <section className="proof-page" aria-labelledby="proof-title">
        <div className="proof-page__headline">
          <p className="site-kicker">Executable evidence</p>
          <h2 id="proof-title">The claim is tested from source to browser.</h2>
          <p>The attended native WebMCP proof is separate from the deterministic application test suite, so browser-native evidence is never silently replaced by a shim.</p>
        </div>
        <div className="proof-grid proof-grid--page">
          <article><strong>30</strong><span>source + Chromium tests in the current release suite</span></article>
          <article><strong>7 evals</strong><span>tool choice, ordering, negative cases, trust boundaries, and mutation</span></article>
          <article><strong>{cueCount}</strong><span>stateful cues with locks, readiness, revisions, and receipts</span></article>
          <article><strong>{webmcpStatusLabel(webmcp)}</strong><span>current browser WebMCP registration status</span></article>
        </div>
        <div className="proof-terminal" aria-label="LINECALL proof summary">
          <span>&gt; linecall proof --native</span>
          <b>4 tools → approval → 5 tools → apply once → R2 → 4 tools</b>
          <span>Q014 lock preserved · cue-024 readiness mutable · receipt visible</span>
        </div>
      </section>

      <section className="trust-endcap">
        <h2>See the boundary operate instead of reading about it.</h2>
        <a className="site-button" href={routeHref('/demo')}>Open the live desk</a>
      </section>
    </>
  );
}

export function NotFoundPage() {
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <p className="site-kicker">404 / off cue</p>
      <h1 id="not-found-title">That route is not in the run of show.</h1>
      <p>Return to LINECALL or enter the working live desk.</p>
      <div><a className="site-button" href={routeHref('/')}>Go home</a><ArrowLink href="/demo">Open live desk</ArrowLink></div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer site-footer--multipage">
      <div className="site-footer__brand">
        <span className="site-nav__mark" aria-hidden="true">LC</span>
        <div><strong>LINECALL</strong><span>Human-controlled AI for live production</span></div>
      </div>
      <nav className="site-footer__links" aria-label="Footer navigation">
        <a href={routeHref('/product')}>Product</a>
        <a href={routeHref('/demo')}>Live desk</a>
        <a href={routeHref('/trust')}>Trust + proof</a>
        <a href="https://github.com/makiaveli1/sitecraft-linecall" target="_blank" rel="noreferrer">Source ↗</a>
      </nav>
      <p>Built as an open-source WebMCP Challenge project. The operator remains the final authority over consequential timing changes.</p>
    </footer>
  );
}
