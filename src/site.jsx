import React from 'react';

function cueNumber(cue) {
  return cue ? String(cue.number).padStart(3, '0') : '—';
}

function webmcpStatusLabel(webmcp) {
  if (webmcp?.status === 'registered' && webmcp.browserVerified) return 'Browser verified';
  if (webmcp?.status === 'registered') return 'Tools registered';
  if (webmcp?.status === 'unsupported') return 'WebMCP browser needed';
  if (webmcp?.status === 'error') return 'Registration needs attention';
  return 'Checking WebMCP';
}

export function SiteNav({ webmcp }) {
  return (
    <header className="site-nav-wrap">
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="site-nav__brand" href="#top" aria-label="LINECALL home">
          <span className="site-nav__mark" aria-hidden="true">LC</span>
          <span>
            <strong>LINECALL</strong>
            <small>Live production × AI</small>
          </span>
        </a>

        <div className="site-nav__links">
          <a href="#what-it-does">What it does</a>
          <a href="#how-it-works">How it works</a>
          <a href="#live-demo">Live desk</a>
          <a href="#safety">Safety</a>
          <a href="#proof">Proof</a>
        </div>

        <div className="site-nav__actions">
          <span className="site-nav__status" data-status={webmcp?.status ?? 'checking'}>
            <i aria-hidden="true" />
            {webmcpStatusLabel(webmcp)}
          </span>
          <a className="site-button site-button--compact" href="#live-demo">Open live desk</a>
        </div>
      </nav>
    </header>
  );
}

export function SiteHero({ showMeta, sequence, revision, webmcp, cueCount }) {
  const toolCount = webmcp?.status === 'registered' ? webmcp.toolCount : 4;
  const toolStatus = webmcp?.status === 'registered' ? `${toolCount} tools active` : '4-tool base contract';

  return (
    <section className="site-hero" id="what-it-does" aria-labelledby="site-hero-title">
      <div className="site-hero__copy">
        <p className="site-kicker">For producers and live-event teams</p>
        <h1 id="site-hero-title">Run the show. Let the agent solve the timing.</h1>
        <p className="site-hero__lede">
          LINECALL helps a live-event team keep the show on time. It tracks every production cue, shows what is happening now and next,
          and gives an AI agent structured tools to find safe timing fixes when the plan changes. Rules check the proposal. You decide whether anything moves.
        </p>

        <div className="site-hero__actions">
          <a className="site-button" href="#live-demo">Explore the working cue desk</a>
          <a className="site-text-link" href="#how-it-works">See the agent control loop <span aria-hidden="true">↘</span></a>
        </div>

        <dl className="site-hero__facts" aria-label="LINECALL at a glance">
          <div>
            <dt>{cueCount}</dt>
            <dd>cues in one authoritative run</dd>
          </div>
          <div>
            <dt>4 → 5 → 4</dt>
            <dd>tools as human approval opens and closes</dd>
          </div>
          <div>
            <dt>R{revision}</dt>
            <dd>current schedule revision</dd>
          </div>
        </dl>
      </div>

      <div className="hero-console" aria-label="LINECALL live run preview">
        <div className="hero-console__topline">
          <div>
            <span className="hero-console__live"><i aria-hidden="true" /> On air</span>
            <strong>{showMeta.title}</strong>
          </div>
          <span className="hero-console__revision">R{revision}</span>
        </div>

        <div className="hero-console__run">
          <div className="hero-console__now">
            <span>NOW</span>
            <strong>Q{cueNumber(sequence.current)}</strong>
            <div>
              <b>{sequence.current?.label ?? 'No current cue'}</b>
              <small>{sequence.current?.instruction ?? 'Waiting for the current cue.'}</small>
            </div>
          </div>
          <div className="hero-console__next">
            <span>NEXT</span>
            <b>Q{cueNumber(sequence.next)} · {sequence.next?.label ?? 'No next cue'}</b>
          </div>
        </div>

        <div className="hero-console__agent">
          <div className="hero-console__agent-head">
            <span>AGENT REQUEST</span>
            <em>{toolStatus}</em>
          </div>
          <p>“Audience Q&amp;A needs to start two seconds later. Find the safest fix and show me the exact change first.”</p>
          <ol aria-label="Agent collaboration path">
            <li><span>01</span><b>Read the run</b></li>
            <li><span>02</span><b>Compare options</b></li>
            <li><span>03</span><b>Preview exact changes</b></li>
            <li className="is-human"><span>04</span><b>Wait for your approval</b></li>
          </ol>
        </div>
      </div>
    </section>
  );
}

export function ProductMeaningSection() {
  return (
    <section className="site-section site-section--meaning" aria-labelledby="meaning-title">
      <div className="site-section__intro">
        <p className="site-kicker">What LINECALL actually changes</p>
        <h2 id="meaning-title">AI helps with the hard timing work without becoming the show caller.</h2>
        <p>
          Live production is full of small timing changes with large downstream consequences. LINECALL gives the agent enough structure
          to reason about those changes, while keeping the real run, safety rules, and final authority visible to the operator.
        </p>
      </div>

      <div className="meaning-grid">
        <article>
          <span className="meaning-grid__index">01</span>
          <h3>One run stays authoritative</h3>
          <p>Now, next, cue locks, readiness, hard out, and schedule revision all live in the same visible operating surface.</p>
        </article>
        <article>
          <span className="meaning-grid__index">02</span>
          <h3>The agent reasons over structure</h3>
          <p>Instead of guessing from buttons and text, the browser exposes focused WebMCP tools for the actual production job.</p>
        </article>
        <article>
          <span className="meaning-grid__index">03</span>
          <h3>Advice is separate from authority</h3>
          <p>LINECALL can reject unsafe timing plans before the operator sees them. The agent cannot approve itself or remove a human lock.</p>
        </article>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section className="site-section site-section--how" id="how-it-works" aria-labelledby="how-title">
      <div className="site-section__intro site-section__intro--split">
        <div>
          <p className="site-kicker">The control loop</p>
          <h2 id="how-title">Four tools to explore. One temporary tool to act.</h2>
        </div>
        <p>
          LINECALL uses WebMCP so the browser can expose a small set of structured actions to an AI agent. The consequential apply tool
          does not exist until the operator approves one exact plan, and it disappears again after use.
        </p>
      </div>

      <ol className="how-grid">
        <li>
          <span className="how-grid__number">01</span>
          <div>
            <p className="how-grid__meta">4 tools</p>
            <h3>Read and explore</h3>
            <p>The agent reads the current revision, compares timing strategies, previews exact changes, or updates low-risk readiness.</p>
          </div>
        </li>
        <li>
          <span className="how-grid__number">02</span>
          <div>
            <p className="how-grid__meta">Deterministic check</p>
            <h3>Rules verify the plan</h3>
            <p>Chronology, hard out, department spacing, stale revisions, and human locks are checked by code, not by model confidence.</p>
          </div>
        </li>
        <li className="how-grid__human">
          <span className="how-grid__number">03</span>
          <div>
            <p className="how-grid__meta">5 tools</p>
            <h3>You approve one exact plan</h3>
            <p>Your approval is bound to the visible plan ID and current revision. Only then does the one-time apply capability appear.</p>
          </div>
        </li>
        <li>
          <span className="how-grid__number">04</span>
          <div>
            <p className="how-grid__meta">Back to 4</p>
            <h3>The change applies once</h3>
            <p>The schedule advances to a new revision, a receipt is left behind, and the temporary apply capability closes again.</p>
          </div>
        </li>
      </ol>

      <div className="tool-lifecycle" aria-label="WebMCP tool lifecycle">
        <div><strong>4</strong><span>inspect · compare · preview · readiness</span></div>
        <i aria-hidden="true">→</i>
        <div className="tool-lifecycle__approval"><strong>5</strong><span>human-approved apply tool opens</span></div>
        <i aria-hidden="true">→</i>
        <div><strong>4</strong><span>apply consumed · authority closes</span></div>
      </div>
    </section>
  );
}

export function DemoIntro({ revision }) {
  return (
    <div className="demo-intro">
      <div>
        <p className="site-kicker">The actual working product</p>
        <h2 id="live-demo-title">Operate the run, then ask the agent to solve a timing problem.</h2>
      </div>
      <div className="demo-scenario" aria-label="Recommended LINECALL demo scenario">
        <span>DEMO PATH · R{revision}</span>
        <p>Ask for Audience Q&amp;A to start two seconds later. LINECALL should compare two strategies, reject the unsafe one, preview the safe ripple, and stop for human approval.</p>
      </div>
    </div>
  );
}

export function SafetySection() {
  return (
    <section className="site-section site-section--safety" id="safety" aria-labelledby="safety-title">
      <div className="site-section__intro">
        <p className="site-kicker">Designed around the trust boundary</p>
        <h2 id="safety-title">The agent is useful because its authority is narrow.</h2>
        <p>
          LINECALL does not give the model a generic “control the page” permission. It exposes specific production capabilities and keeps
          consequential authority in deterministic code and visible operator actions.
        </p>
      </div>

      <div className="authority-grid">
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
      </div>
    </section>
  );
}

export function ProofSection({ webmcp, cueCount }) {
  return (
    <section className="site-section site-section--proof" id="proof" aria-labelledby="proof-title">
      <div className="site-section__intro site-section__intro--split">
        <div>
          <p className="site-kicker">Challenge evidence</p>
          <h2 id="proof-title">The safety story is executable, not just copy.</h2>
        </div>
        <p>
          LINECALL ships with deterministic schedule tests, real Chromium UI verification, WebMCP contract checks, and seven agent-eval cases.
          The attended native WebMCP run remains a separate final proof gate before the challenge is frozen.
        </p>
      </div>

      <div className="proof-grid">
        <article><strong>30</strong><span>automated tests in the verified suite</span></article>
        <article><strong>Real Chromium</strong><span>production rendering, interaction, responsive, and geometry checks</span></article>
        <article><strong>7 evals</strong><span>tool choice, ordering, trust boundaries, mutation, and no-tool behavior</span></article>
        <article><strong>{cueCount} cues</strong><span>a real stateful run with locks, readiness, revisions, and receipts</span></article>
      </div>

      <div className="proof-status">
        <div>
          <span>WebMCP runtime</span>
          <strong>{webmcpStatusLabel(webmcp)}</strong>
        </div>
        <div>
          <span>Mutation boundary</span>
          <strong>Exact plan + exact revision + human approval</strong>
        </div>
        <div>
          <span>Native attended proof</span>
          <strong>Final challenge gate</strong>
        </div>
      </div>
    </section>
  );
}

export function FinalCallToAction() {
  return (
    <section className="site-final" aria-labelledby="site-final-title">
      <p className="site-kicker">See the boundary in action</p>
      <h2 id="site-final-title">Give the agent a real timing problem. Keep the final call human.</h2>
      <div>
        <a className="site-button" href="#live-demo">Return to the live desk</a>
        <a
          className="site-text-link"
          href="https://github.com/makiaveli1/sitecraft-linecall"
          target="_blank"
          rel="noreferrer"
        >
          Inspect the source <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <span className="site-nav__mark" aria-hidden="true">LC</span>
        <div><strong>LINECALL</strong><span>Agent-native live production control</span></div>
      </div>
      <p>Built as an open-source WebMCP Challenge project. The operator remains the final authority over consequential timing changes.</p>
      <div className="site-footer__links">
        <a href="#top">Back to top</a>
        <a href="https://developer.chrome.com/docs/ai/webmcp" target="_blank" rel="noreferrer">WebMCP docs</a>
        <a href="https://github.com/makiaveli1/sitecraft-linecall" target="_blank" rel="noreferrer">GitHub</a>
      </div>
    </footer>
  );
}
