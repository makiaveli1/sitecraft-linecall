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
      <section className="page-masthead page-masthead--product product-lab" aria-labelledby="product-title">
        <div className="product-lab__copy">
          <p className="site-kicker">Product / timing laboratory</p>
          <h1 id="product-title">A second caller for the timing problem, not the show.</h1>
          <p>
            LINECALL combines one authoritative run, a constrained agent toolset, and deterministic scheduling rules so a producer can explore timing changes without handing the model final authority.
          </p>
          <div className="product-lab__legend" aria-label="LINECALL product model">
            <span><i aria-hidden="true" /> Observe one run</span>
            <span><i aria-hidden="true" /> Branch safe futures</span>
            <span><i aria-hidden="true" /> Approve one revision</span>
          </div>
        </div>

        <aside className="product-lab__instrument" aria-label="Current LINECALL timing field">
          <div className="product-lab__instrument-top">
            <span>AUTHORITATIVE RUN</span>
            <b>R{revision}</b>
          </div>
          <div className="product-lab__current">
            <span>NOW</span>
            <strong>Q{cueNumber(sequence?.current)}</strong>
            <div><b>{sequence?.current?.label}</b><small>{sequence?.current?.instruction}</small></div>
          </div>
          <div className="product-lab__trace" aria-hidden="true">
            <svg viewBox="0 0 800 230" preserveAspectRatio="none">
              <path className="trace trace--base" d="M0 162 C104 160 128 121 220 125 S352 188 448 142 S612 70 800 89" />
              <path className="trace trace--safe" d="M0 162 C102 159 130 118 220 123 S350 181 447 136 S612 55 800 69" />
              <path className="trace trace--blocked" d="M0 162 C102 159 130 118 220 123 S346 208 438 202 S610 186 800 214" />
              <circle cx="220" cy="123" r="7" />
              <circle cx="447" cy="136" r="7" />
              <circle cx="800" cy="69" r="7" />
            </svg>
            <div className="product-lab__trace-labels"><span>Current run</span><span>Safe ripple</span><span>Blocked future</span></div>
          </div>
          <div className="product-lab__instrument-foot">
            <span>ONE SOURCE OF TRUTH</span>
            <span>COUNTERFACTUALS BEFORE MUTATION</span>
          </div>
        </aside>
      </section>

      <section className="product-chapter product-chapter--run product-chapter--score" aria-labelledby="run-chapter-title">
        <div className="product-chapter__copy">
          <span className="chapter-index">01 / THE RUN</span>
          <h2 id="run-chapter-title">The agent starts from the same live state as the operator.</h2>
          <p>Current cue, next cue, human locks, readiness, segment boundaries, hard out, and revision all come from one run snapshot. No shadow version of the schedule exists.</p>
          <div className="product-chapter__microfacts" aria-label="Run snapshot contents">
            <span>Current + next</span><span>Locks</span><span>Readiness</span><span>Hard out</span><span>Revision</span>
          </div>
        </div>
        <ProductRunVisual sequence={sequence} revision={revision} />
      </section>

      <section className="product-chapter product-chapter--reason product-chapter--branch" aria-labelledby="reason-chapter-title">
        <div className="product-chapter__visual">
          <div className="counterfactual-board">
            <div className="counterfactual-board__request"><small>WHAT IF</small> Q&amp;A +2s</div>
            <div className="counterfactual-board__option is-blocked"><span>SEGMENT ONLY</span><b>Blocked</b><small>chronology breaks</small></div>
            <div className="counterfactual-board__option is-ready"><span>RIPPLE AFTER</span><b>Safe</b><small>13 exact cue changes</small></div>
            <div className="counterfactual-board__impact" aria-label="Downstream impact summary"><span>+2s request</span><i aria-hidden="true">→</i><span>13 cues</span><i aria-hidden="true">→</i><strong>safe future</strong></div>
            <div className="counterfactual-board__result"><i aria-hidden="true" /> Recommend safe ripple</div>
          </div>
        </div>
        <div className="product-chapter__copy">
          <span className="chapter-index">02 / THE REASONING</span>
          <h2 id="reason-chapter-title">Compare futures before the run becomes one of them.</h2>
          <p>The agent can ask LINECALL to evaluate alternative timing strategies. The application calculates the consequences and rejects plans that violate chronology, locks, spacing, stale revisions, or hard out.</p>
          <div className="product-rules" aria-label="Deterministic rule checks">
            <span>Chronology</span><span>Human locks</span><span>Spacing</span><span>Fresh revision</span><span>Hard out</span>
          </div>
        </div>
      </section>

      <section className="product-chapter product-chapter--authority product-chapter--gate" aria-labelledby="authority-chapter-title">
        <div className="product-chapter__copy">
          <span className="chapter-index">03 / THE DECISION</span>
          <h2 id="authority-chapter-title">Consequential authority appears only after a human approves one exact plan.</h2>
          <p>The apply tool is absent while the agent explores. Approval binds one visible plan to one revision. The capability opens, applies once, advances the revision, leaves a receipt, and closes again.</p>
          <div className="product-gate-sequence" aria-label="One-time execution sequence">
            <span><b>4</b><small>inspect</small></span><i aria-hidden="true">→</i><span className="is-human"><b>YOU</b><small>approve</small></span><i aria-hidden="true">→</i><span><b>5</b><small>apply once</small></span><i aria-hidden="true">→</i><span><b>4</b><small>closed</small></span>
          </div>
          <ArrowLink href="/trust">Inspect the trust boundary</ArrowLink>
        </div>
        <figure className="authority-art authority-art--product">
          <img src={assetHref('linecall-authority-keyart.svg')} alt="Diagram of the LINECALL four tools to five tools to four tools human approval lifecycle" />
        </figure>
      </section>

      <section className="product-cta product-cta--lab">
        <p>Leave the laboratory.</p>
        <div><span>R{revision} · LIVE SCENARIO</span><h2>Put two seconds of pressure on the real desk.</h2></div>
        <a className="site-button" href={routeHref('/demo')}>Run the live scenario</a>
      </section>
    </>
  );
}

export function DemoProductBar({ revision, webmcp, showTitle, hold, onToggleHold, onReset }) {
  return (
    <header className="demo-product-bar">
      <a className="demo-product-bar__brand" href={routeHref('/')} aria-label="Exit LINECALL live desk">
        <span className="site-nav__mark" aria-hidden="true">LC</span>
        <span><strong>LINECALL</strong><small>LIVE DESK</small></span>
      </a>

      <div className="demo-product-bar__run">
        <span className={`demo-product-bar__signal ${hold ? 'is-hold' : ''}`}><i aria-hidden="true" />{hold ? 'HOLD' : 'ON AIR'}</span>
        <div>
          <h1 id="live-demo-title">Live timing control</h1>
          <span>{showTitle}</span>
        </div>
      </div>

      <div className="demo-product-bar__telemetry" aria-label="Live desk telemetry">
        <span><small>REVISION</small><b>R{revision}</b></span>
        <span><small>WEBMCP</small><b>{webmcpStatusLabel(webmcp)}</b></span>
        <span><small>AUTHORITY</small><b>Human gated</b></span>
      </div>

      <div className="demo-product-bar__actions">
        <button type="button" className={`demo-hold-control ${hold ? 'is-hold' : ''}`} onClick={onToggleHold}>{hold ? 'Resume run' : 'Hold run'}</button>
        <button type="button" onClick={onReset}>Reset scenario</button>
        <a href={routeHref('/')}>Exit desk</a>
      </div>
    </header>
  );
}

export function TrustPage({ webmcp, cueCount }) {
  return (
    <>
      <section className="page-masthead page-masthead--trust trust-vault" aria-labelledby="trust-title">
        <div className="trust-vault__copy">
          <p className="site-kicker">Trust + proof / authority vault</p>
          <h1 id="trust-title">Useful because the agent cannot quietly become the operator.</h1>
          <p>LINECALL narrows model authority at the product boundary. Tool availability changes with human state, deterministic rules own scheduling safety, and every consequential apply is bound to an exact revision and plan.</p>
        </div>
        <div className="trust-vault__cycle" aria-label="LINECALL permission lifecycle">
          <span className="trust-vault__node"><b>4</b><small>observe</small></span>
          <i aria-hidden="true">→</i>
          <span className="trust-vault__human"><b>YOU</b><small>approve one exact plan</small></span>
          <i aria-hidden="true">→</i>
          <span className="trust-vault__node is-open"><b>5</b><small>apply once</small></span>
          <i aria-hidden="true">→</i>
          <span className="trust-vault__node"><b>4</b><small>closed again</small></span>
        </div>
        <div className="trust-vault__status" aria-label="Trust status summary">
          <span>DETERMINISTIC RULES</span><span>HUMAN APPROVAL</span><span>ONE-TIME EXECUTION</span><span>VISIBLE RECEIPT</span>
        </div>
      </section>

      <section className="trust-art-section trust-art-section--ledger" aria-labelledby="lifecycle-title">
        <div className="trust-art-section__copy">
          <span className="chapter-index">THE AUTHORITY LIFECYCLE</span>
          <h2 id="lifecycle-title">4 → 5 → 4 is a permission story, not a visual effect.</h2>
          <p>Four tools are available for inspection, comparison, preview, and readiness. The fifth exists only while one exact human-approved plan remains valid.</p>
          <div className="trust-chain" aria-label="Authority chain of custody">
            <div><b>01</b><span><strong>Observe</strong><small>Read the exact run and revision</small></span></div>
            <div><b>02</b><span><strong>Propose</strong><small>Compare and preview without mutation</small></span></div>
            <div><b>03</b><span><strong>Authorize</strong><small>Human binds one visible plan</small></span></div>
            <div><b>04</b><span><strong>Record</strong><small>Apply once, advance revision, leave receipt</small></span></div>
          </div>
        </div>
        <figure className="authority-art authority-art--wide authority-art--vault">
          <img src={assetHref('linecall-authority-keyart.svg')} alt="LINECALL authority lifecycle showing four tools, human approval opening a fifth tool, then returning to four" />
        </figure>
      </section>

      <section className="authority-grid authority-grid--page authority-grid--vault" aria-label="LINECALL agent authority boundaries">
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
        <div className="authority-grid__seal" aria-hidden="true"><span>HUMAN</span><b>FINAL</b><span>AUTHORITY</span></div>
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

      <section className="proof-page proof-page--vault" aria-labelledby="proof-title">
        <div className="proof-page__headline">
          <p className="site-kicker">Executable evidence</p>
          <h2 id="proof-title">The claim is tested from source to browser.</h2>
          <p>The attended native WebMCP proof is separate from the deterministic application test suite, so browser-native evidence is never silently replaced by a shim.</p>
        </div>
        <div className="proof-grid proof-grid--page proof-grid--ledger">
          <article><span>RELEASE SUITE</span><strong>30</strong><small>source + Chromium tests</small></article>
          <article><span>AGENT CONTRACT</span><strong>7 evals</strong><small>choice, ordering, negative cases</small></article>
          <article><span>STATEFUL RUN</span><strong>{cueCount}</strong><small>cues with locks, readiness, revisions</small></article>
          <article><span>BROWSER STATUS</span><strong>{webmcpStatusLabel(webmcp)}</strong><small>current WebMCP registration</small></article>
        </div>
        <div className="proof-ledger" aria-label="LINECALL proof ledger">
          <div><span>01</span><b>Inspect surface</b><small>4 tools available before approval</small><em>PASS</em></div>
          <div><span>02</span><b>Human gate</b><small>apply capability absent until exact-plan approval</small><em>PASS</em></div>
          <div><span>03</span><b>One-time execution</b><small>R1 → R2, then authority closes</small><em>PASS</em></div>
          <div><span>04</span><b>Boundary preservation</b><small>Q014 lock survives · receipt remains visible</small><em>PASS</em></div>
        </div>
        <div className="proof-terminal" aria-label="LINECALL proof summary">
          <span>&gt; linecall proof --native</span>
          <b>4 tools → approval → 5 tools → apply once → R2 → 4 tools</b>
          <span>Q014 lock preserved · cue-024 readiness mutable · receipt visible</span>
        </div>
      </section>

      <section className="trust-endcap trust-endcap--vault">
        <div><span>THE CONTRACT IS VISIBLE</span><h2>See the boundary operate instead of reading about it.</h2></div>
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
