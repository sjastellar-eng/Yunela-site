import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, LoaderCircle, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import './styles.css';
import { api, type DiscoveryBox, type DiscoveryBoxItem } from './api/client';
import { ApiClientError } from './api/client';
import { track } from './analytics';
import type { Feedback, TeaProfile } from './contracts/account';
import type { FinderProfileReference, RecommendationRequest, RecommendationResult } from './contracts/recommendation';
import type { Tea } from './contracts/tea';

type Classification = 'MATCH' | 'STRETCH' | 'WILDCARD';
type Route = string;
type Answers = Record<string, string>;
type Status = 'idle' | 'loading' | 'ready' | 'error';

type RecommendationView = RecommendationResult & { teaDetails?: Tea };

const CUSTOMER_STORAGE_KEY = 'yunela-customer-id';
const questions = [
  { key: 'body', title: 'How much tea do you want to feel?', options: ['Light', 'Balanced', 'Full'] },
  { key: 'sweetness', title: 'What kind of sweetness sounds good?', options: ['Dry', 'Naturally sweet', 'Rich & sweet'] },
  { key: 'temperature', title: 'Fresh or warm?', options: ['Fresh', 'Balanced', 'Warm / roasted'] },
  { key: 'aroma', title: 'What sounds good right now?', options: ['Floral', 'Fruity', 'Roasted', 'Woody', 'Earthy', 'Creamy'] },
  { key: 'context', title: 'When are you drinking?', options: ['Morning', 'Work', 'Slow evening', 'After a meal', 'Exploring'] },
  { key: 'familiarity', title: 'How familiar are you with Chinese tea?', options: ['New to it', 'Some experience', 'Experienced'] },
  { key: 'explore', title: 'How far should we take you?', options: ['Safe choice', 'A little different', 'Surprise me'] },
] as const;

const sensoryTags = [
  ['More floral', 'floral'],
  ['More sweet', 'sweet'],
  ['More roasted', 'roasted'],
  ['More fresh', 'fresh'],
  ['More body', 'body'],
  ['More earthy', 'earthy'],
] as const;

const readCustomerId = (): string | null => {
  try { return localStorage.getItem(CUSTOMER_STORAGE_KEY); } catch { return null; }
};
const writeCustomerId = (customerId: string): void => {
  localStorage.setItem(CUSTOMER_STORAGE_KEY, customerId);
};
const clearCustomerId = (): void => {
  try { localStorage.removeItem(CUSTOMER_STORAGE_KEY); } catch { /* storage may be unavailable */ }
};

async function ensureCustomerIdentity(): Promise<{ customerId: string; created: boolean }> {
  const stored = readCustomerId();
  if (stored) {
    try {
      await api.getCustomer(stored);
      return { customerId: stored, created: false };
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.status !== 404) throw error;
      clearCustomerId();
    }
  }
  const created = await api.createAnonymousCustomer();
  writeCustomerId(created.customerId);
  return { customerId: created.customerId, created: true };
}

async function ensureProfile(customerId: string): Promise<{ profile: TeaProfile; created: boolean }> {
  try {
    return { profile: await api.getProfile(customerId), created: false };
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.status !== 404) throw error;
    const profile: TeaProfile = {
      customerId,
      purchasedTeaIds: [],
      likedTeaIds: [],
      dislikedTeaIds: [],
      tastePreferences: {},
      feedbackIds: [],
      recommendationIds: [],
      updatedAt: new Date().toISOString(),
    };
    return { profile: await api.createProfile(profile), created: true };
  }
}

function Button({ children, onClick, secondary = false, disabled = false }: { children: ReactNode; onClick?: () => void; secondary?: boolean; disabled?: boolean }) {
  return <button className={`btn ${secondary ? 'secondary' : ''}`} onClick={onClick} disabled={disabled}>{children}<ArrowRight size={16} /></button>;
}
function Badge({ type }: { type: Classification }) { return <span className={`badge ${type}`}>{type}</span>; }
function LoadingState({ label = 'Loading' }: { label?: string }) { return <div className="empty" role="status"><LoaderCircle className="spin" size={24} /><p>{label}…</p></div>; }
function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div className="empty" role="alert"><h2>We could not load this right now.</h2><p>{message}</p>{onRetry && <button onClick={onRetry}>Try again <ArrowRight size={14} /></button>}</div>; }
function EmptyState({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) { return <div className="empty"><h2>{title}</h2>{action && <button onClick={onClick}>{action} <ArrowRight size={14} /></button>}</div>; }
function Meter({ label, value }: { label: string; value: number }) {
  const normalized = Math.max(0, Math.min(5, Math.round(value / 20)));
  return <div className="meter"><span>{label}</span><i aria-label={`${label}: ${normalized} of 5`}>{'●'.repeat(normalized)}{'○'.repeat(5 - normalized)}</i></div>;
}
function TeaVisual({ tea }: { tea: Tea }) { return <div className="photo"><span>YUNELA<br /><small>{tea.family}</small></span></div>; }
function ProductCard({ tea, classification, reason, onOpen }: { tea: Tea; classification?: Classification; reason?: string; onOpen?: () => void }) {
  return <article className="card" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onOpen) { e.preventDefault(); onOpen(); } }}>
    <TeaVisual tea={tea} />
    <div className="meta">{classification && <Badge type={classification} />}<span>{tea.family}</span></div>
    <h3>{tea.name}</h3>
    <p>{tea.sensory.aroma.join(' · ') || 'Sensory profile available in tea details.'}</p>
    {reason && <p><strong>Why:</strong> {reason}</p>}
    <Meter label="Body" value={tea.sensory.body} />
    <div className="cardfoot"><b>VIEW TEA</b><ArrowRight size={15} /></div>
  </article>;
}
function Header({ cartCount, onSearch }: { cartCount: number; onSearch: () => void }) {
  const [menu, setMenu] = useState(false);
  const links = [['#/finder', 'Find Your Tea'], ['#/tea', 'Tea'], ['#/discovery', 'Discovery'], ['#/journal', 'Journal'], ['#/guide', 'Tea Guide'], ['#/about', 'About']];
  return <>
    <header><a className="logo" href="#/">YUNELA</a><nav className="desktop-nav">{links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
      <div className="tools"><button aria-label="Search" onClick={onSearch}><Search size={18} /></button><button aria-label="Account" onClick={() => go('#/account')}><UserRound size={18} /></button><button aria-label="Cart" onClick={() => go('#/cart')} className="cart-tool"><ShoppingBag size={18} />{cartCount > 0 && <b>{cartCount}</b>}</button><button className="menu-tool" aria-label="Menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <span>MENU</span>}</button></div>
    </header>
    {menu && <div className="mobile-menu">{links.map(([href, label]) => <a key={href} href={href} onClick={() => setMenu(false)}>{label}</a>)}<a href="#/account" onClick={() => setMenu(false)}>Account</a></div>}
  </>;
}
function Footer() { return <footer><div><strong>YUNELA</strong><span>Chinese tea, made easier to discover.</span></div><div><b>DISCOVER</b><a href="#/finder">Find Your Tea</a><a href="#/tea">Tea</a><a href="#/discovery">Discovery</a></div><div><b>LEARN</b><a href="#/journal">Journal</a><a href="#/guide">Tea Guide</a></div><div><b>YUNELA</b><a href="#/about">About</a><a href="#/support">Support</a><a href="#/account">Account</a></div></footer>; }

function Home() {
  const [status, setStatus] = useState<Status>('loading');
  const [teas, setTeas] = useState<Tea[]>([]);
  const [error, setError] = useState('');
  const load = async () => { setStatus('loading'); try { const result = await api.listTeas(); setTeas(result.items); setStatus('ready'); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); setStatus('error'); } };
  useEffect(() => { track('landing_view'); void load(); }, []);
  return <><main>
    <section className="hero"><div className="hero-copy"><small>YUNELA</small><h1>DISCOVER CHINESE TEA THAT FEELS LIKE YOURS.</h1><p>Chinese tea, made easier to discover.</p><div><Button onClick={() => { track('finder_start', { source: 'home' }); go('#/finder'); }}>Find Your Tea</Button><Button secondary onClick={() => go('#/discovery')}>Explore Discovery Box</Button></div></div><div className="heroimage"><span>TEA<br />DISCOVERY</span></div></section>
    <section className="split"><div><small>DISCOVERY, NOT DECISIONS</small><h2>Start with your taste, not a tea dictionary.</h2></div><p>YUNELA helps you move from curiosity to a confident cup. A few simple questions become a clear path through Chinese tea.</p></section>
    <section className="feature"><small>01 — FINDER</small><div><h2>Find the tea that fits you.</h2><p>Tell us what sounds good. We’ll give you a few places to start.</p><Button onClick={() => { track('finder_start', { source: 'home_feature' }); go('#/finder'); }}>Start Tea Finder</Button></div></section>
    <section className="section"><small>02 — DISCOVERY</small><h2>Real teas, selected around taste.</h2>{status === 'loading' && <LoadingState label="Loading the collection" />}{status === 'error' && <ErrorState message={error} onRetry={() => void load()} />}{status === 'ready' && (teas.length ? <div className="grid">{teas.slice(0, 3).map(t => <ProductCard key={t.id} tea={t} onOpen={() => go(`#/tea/${t.id}`)} />)}</div> : <EmptyState title="The tea collection is being prepared." action="Find Your Tea" onClick={() => go('#/finder')} />)}</section>
    <section className="trust"><small>WHY YUNELA</small><h2>Clear enough for beginners. Interesting enough to keep exploring.</h2><div><p><b>Taste-first discovery.</b><br />Start with what you like.</p><p><b>Clear explanations.</b><br />Every recommendation tells you why.</p><p><b>Better over time.</b><br />Feedback becomes part of your taste profile.</p></div></section>
    <section className="final"><small>YOUR NEXT CUP</small><h2>Ready to find your tea?</h2><Button onClick={() => go('#/finder')}>Find Your Tea</Button></section>
  </main><Footer /></>;
}

function mapAnswersToProfile(answers: Answers): FinderProfileReference {
  const body: Record<string, number> = { Light: 25, Balanced: 50, Full: 75 };
  const sweetness: Record<string, number> = { Dry: 20, 'Naturally sweet': 60, 'Rich & sweet': 85 };
  const freshness: Record<string, number> = { Fresh: 85, Balanced: 50, 'Warm / roasted': 20 };
  const roastDepth: Record<string, number> = { Fresh: 20, Balanced: 50, 'Warm / roasted': 80 };
  return {
    body: body[answers.body],
    sweetness: sweetness[answers.sweetness],
    freshness: freshness[answers.temperature],
    roastDepth: roastDepth[answers.temperature],
    aroma: answers.aroma ? [answers.aroma.toLowerCase()] : undefined,
    context: answers.context,
    familiarity: answers.familiarity,
    discoveryTolerance: answers.explore,
  };
}

function Finder() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const q = questions[step];
  const selected = answers[q.key];
  const choose = (value: string) => setAnswers(prev => ({ ...prev, [q.key]: value }));
  const finish = async () => {
    setBusy(true); setError(''); track('finder_question_complete', { question: q.key });
    try {
      const identity = await ensureCustomerIdentity();
      if (identity.created) track('profile_created', { source: 'anonymous_identity' });
      const profileReference = mapAnswersToProfile(answers);
      const input: RecommendationRequest = { customerId: identity.customerId, profileReference };
      sessionStorage.setItem('yunela-last-finder-profile', JSON.stringify(profileReference));
      const recommendations = await api.recommend(input);
      track('finder_complete', { question_count: questions.length });
      track('recommendation_generated', { count: recommendations.length });
      sessionStorage.setItem('yunela-recommendations', JSON.stringify(recommendations));
      go('#/recommendations');
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  };
  return <main className="finder"><div className="findtop"><a href="#/">YUNELA</a><span>{String(step + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}</span></div><div className="bar"><i style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div><section><small>FIND YOUR TEA</small><h1>{q.title}</h1><p>Choose what feels closest. There are no wrong answers.</p><div className="options">{q.options.map(option => <button key={option} className={selected === option ? 'selected' : ''} onClick={() => { choose(option); track('finder_question_complete', { question: q.key }); }}>{option}{selected === option && <Check size={17} />}</button>)}</div>{error && <div role="alert"><p>{error}</p></div>}<div className="findnav"><button disabled={step === 0 || busy} onClick={() => setStep(s => s - 1)}><ChevronLeft /> Back</button><button disabled={!selected || busy} onClick={() => { if (step === questions.length - 1) void finish(); else setStep(s => s + 1); }}>{busy ? <LoaderCircle className="spin" size={16} /> : (step === questions.length - 1 ? 'See my teas' : 'Continue')} <ChevronRight /></button></div></section></main>;
}

function useSessionRecommendations(): { status: Status; recommendations: RecommendationView[]; error: string } {
  const [status, setStatus] = useState<Status>('loading');
  const [recommendations, setRecommendations] = useState<RecommendationView[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const raw = sessionStorage.getItem('yunela-recommendations');
    if (!raw) { setStatus('ready'); return; }
    let parsed: RecommendationResult[];
    try { parsed = JSON.parse(raw) as RecommendationResult[]; } catch { setStatus('error'); setError('Your recommendation session could not be read.'); return; }
    const load = async () => {
      try {
        const details = await Promise.all(parsed.map(async item => ({ ...item, teaDetails: await api.getTea(item.tea.id) })));
        setRecommendations(details); setStatus('ready');
        track('recommendation_view', { count: details.length });
      } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); setStatus('error'); }
    };
    void load();
  }, []);
  return { status, recommendations, error };
}

function Recommendations() {
  const { status, recommendations, error } = useSessionRecommendations();
  if (status === 'loading') return <main><LoadingState label="Preparing your recommendations" /></main>;
  if (status === 'error') return <main><ErrorState message={error} /></main>;
  if (!recommendations.length) return <main><section className="pagehead"><small>YOUR RECOMMENDATIONS</small><h1>Let’s find your starting point.</h1><p>Complete the Tea Finder to receive recommendations.</p><Button onClick={() => go('#/finder')}>Start Tea Finder</Button></section></main>;
  return <main><section className="pagehead"><small>YOUR RECOMMENDATIONS</small><h1>A few places to start.</h1><p>YUNELA returns recommendations from the real Recommendation Engine. The score is fit, not tea quality.</p></section><section className="profile-strip"><span>YOUR TEA PROFILE</span><b>Every recommendation explains its route.</b><a href="#/profile">View profile <ArrowRight size={14} /></a></section><section className="grid results">{recommendations.map(item => item.teaDetails && <ProductCard key={item.tea.id} tea={item.teaDetails} classification={item.classification} reason={item.reasons.join(' ')} onOpen={() => { track('recommendation_click', { tea_id: item.tea.id, classification: item.classification }); go(`#/tea/${item.tea.id}`); }} />)}</section><section className="why"><small>WHY WE RECOMMEND THIS</small><div><h2>Recommendation should feel understandable.</h2><p>Match labels, score and reasons are supplied by C3. YUNELA does not recalculate or reinterpret the recommendation.</p></div></section></main>;
}

function Catalog() {
  const [status, setStatus] = useState<Status>('loading'); const [teas, setTeas] = useState<Tea[]>([]); const [filter, setFilter] = useState('All'); const [error, setError] = useState('');
  const load = async () => { setStatus('loading'); try { setTeas((await api.listTeas()).items); setStatus('ready'); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); setStatus('error'); } };
  useEffect(() => { void load(); }, []);
  const families = ['All', ...new Set(teas.map(t => t.family))]; const list = teas.filter(t => filter === 'All' || t.family === filter);
  return <main><section className="pagehead"><small>TEA</small><h1>Explore Chinese tea by taste.</h1><p>Browse the real YUNELA tea catalog — or start with Find Your Tea.</p></section>{status === 'loading' && <LoadingState label="Loading tea" />}{status === 'error' && <ErrorState message={error} onRetry={() => void load()} />}{status === 'ready' && <><div className="filters">{families.map(f => <button className={filter === f ? 'active' : ''} key={f} onClick={() => setFilter(f)}>{f}</button>)}</div>{list.length ? <section className="grid catalog-grid">{list.map(t => <ProductCard key={t.id} tea={t} onOpen={() => go(`#/tea/${t.id}`)} />)}</section> : <EmptyState title="No teas match this filter yet." action="Try Find Your Tea" onClick={() => go('#/finder')} />}</>}</main>;
}

function Product({ teaId, customerId, onAdd }: { teaId: string; customerId: string | null; onAdd: (teaId: string) => void }) {
  const [status, setStatus] = useState<Status>('loading'); const [tea, setTea] = useState<Tea | null>(null); const [error, setError] = useState('');
  const load = async () => { setStatus('loading'); try { const result = await api.getTea(teaId); setTea(result); setStatus('ready'); track('product_view', { tea_id: teaId }); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); setStatus('error'); } };
  useEffect(() => { void load(); }, [teaId]);
  if (status === 'loading') return <main><LoadingState label="Loading tea" /></main>;
  if (status === 'error' || !tea) return <main><ErrorState message={error} onRetry={() => void load()} /></main>;
  return <main><section className="product"><TeaVisual tea={tea} /><div className="product-buy"><small>{tea.family}{tea.style ? ` · ${tea.style}` : ''}</small><h1>{tea.name}</h1><p className="lead">{tea.sensory.aroma.join(' · ') || 'A tea with a defined sensory profile.'}</p><div className="meters"><Meter label="Body" value={tea.sensory.body} /><Meter label="Sweetness" value={tea.sensory.sweetness} /><Meter label="Roast" value={tea.sensory.roast} /><Meter label="Freshness" value={tea.sensory.freshness} /></div><div className="origin-note">{[tea.province, tea.area, tea.region].filter(Boolean).join(' · ') || 'Origin details available in the verified tea record.'}</div><div className="buy"><strong>{formatMoney(tea)}</strong><Button onClick={() => onAdd(tea.id)}>Add to Cart</Button></div></div></section><section className="content"><div><small>WHY THIS MAY FIT YOU</small><h2>{customerId ? 'Your recommendation context stays connected to your tea profile.' : 'Start with Find Your Tea to get a personalized fit.'}</h2></div><div><h3>What is this tea?</h3><p>{[tea.family, tea.subfamily, tea.style].filter(Boolean).join(' · ') || 'Tea identity is supplied by the YUNELA catalog.'}</p>{tea.processing && <><h3>Processing</h3><p>{tea.processing}</p></>}<h3>How to brew</h3><p>Brewing guidance will be added when Tea Expert / QA data is approved. YUNELA does not invent brewing parameters.</p></div></section><FeedbackPanel tea={tea} customerId={customerId} /><section className="section"><small>NEXT DISCOVERY</small><h2>Keep exploring.</h2><Button secondary onClick={() => go('#/finder')}>Find Your Tea</Button></section></main>;
}

function formatMoney(tea: Tea): string { return new Intl.NumberFormat(undefined, { style: 'currency', currency: tea.price.currency }).format(tea.price.amount / 100); }

function FeedbackPanel({ tea, customerId }: { tea: Tea; customerId: string | null }) {
  const [value, setValue] = useState<Feedback['value'] | null>(null); const [tags, setTags] = useState<string[]>([]); const [status, setStatus] = useState<Status>('idle'); const [error, setError] = useState('');
  const submit = async (nextValue: Feedback['value']) => {
    if (!customerId) { setError('Your anonymous tea profile is not ready yet.'); return; }
    setValue(nextValue); setStatus('loading'); setError('');
    try {
      await api.submitFeedback({ id: crypto.randomUUID(), customerId, teaId: tea.id, value: nextValue, sensoryTags: tags, createdAt: new Date().toISOString() });
      setStatus('ready'); track('tea_feedback', { tea_id: tea.id, feedback: nextValue });
    } catch (e) { setStatus('error'); setError(e instanceof Error ? e.message : 'Please try again.'); }
  };
  const toggleTag = (tag: string) => setTags(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag]);
  return <section className="feedback"><div><small>HOW WAS IT?</small><h2>Your taste gets clearer with every cup.</h2>{status === 'ready' && <p role="status">Saved. YUNELA will use this feedback in your tea profile.</p>}{error && <p role="alert">{error}</p>}</div><div><div className="feedback-buttons">{(['Loved it', 'Liked it', 'Not for me'] as const).map(option => <button key={option} className={value === option ? 'selected' : ''} disabled={status === 'loading'} onClick={() => void submit(option)}>{option}{value === option && <Check size={16} />}</button>)}</div><div className="feedback-tags">{sensoryTags.map(([label, tag]) => <button key={tag} className={tags.includes(tag) ? 'selected' : ''} onClick={() => toggleTag(tag)}>{label}</button>)}</div></div></section>;
}

function Discovery() {
  const [status, setStatus] = useState<Status>('loading'); const [box, setBox] = useState<DiscoveryBox | null>(null); const [teas, setTeas] = useState<Record<string, Tea>>({}); const [error, setError] = useState('');
  const load = async () => {
    setStatus('loading'); setError('');
    try {
      const customer = await ensureCustomerIdentity();
      if (customer.created) track('profile_created', { source: 'anonymous_identity' });
      const profile = await ensureProfile(customer.customerId);
      if (profile.created) track('profile_created', { source: 'tea_profile' });
      const finderRaw = sessionStorage.getItem('yunela-last-finder-profile');
      const profileReference: FinderProfileReference = finderRaw ? JSON.parse(finderRaw) as FinderProfileReference : profile.profile.tastePreferences;
      const created = await api.createDiscoveryBox({ customerId: customer.customerId, profileReference });
      setBox(created);
      const details = await Promise.all(created.items.map(item => api.getTea(item.teaId)));
      setTeas(Object.fromEntries(details.map(tea => [tea.id, tea])));
      setStatus('ready');
      track('discovery_box_view', { box_id: created.id, item_count: created.items.length });
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); setStatus('error'); }
  };
  useEffect(() => { void load(); }, []);
  if (status === 'loading') return <main><LoadingState label="Building your Discovery Box" /></main>;
  if (status === 'error') return <main><ErrorState message={error} onRetry={() => void load()} /></main>;
  if (!box) return <main><EmptyState title="No Discovery Box is available yet." action="Find Your Tea" onClick={() => go('#/finder')} /></main>;
  return <main><section className="pagehead"><small>DISCOVERY BOX</small><h1>Six teas. One way to discover what is yours.</h1><p>The classifications below come directly from C4. YUNELA does not recalculate the 3 / 2 / 1 selection.</p></section><div className="box"><div><b>{box.items.filter(i => i.classification === 'MATCH').length}</b><span>MATCH</span></div><div><b>{box.items.filter(i => i.classification === 'STRETCH').length}</b><span>STRETCH</span></div><div><b>{box.items.filter(i => i.classification === 'WILDCARD').length}</b><span>WILDCARD</span></div></div><section className="grid discovery-grid">{box.items.map(item => teas[item.teaId] && <ProductCard key={item.teaId} tea={teas[item.teaId]} classification={item.classification} reason={item.reasons.join(' ')} onOpen={() => { track('recommendation_block_interaction', { tea_id: item.teaId, classification: item.classification }); go(`#/tea/${item.teaId}`); }} />)}</section><section className="final"><h2>Discovery should lead somewhere.</h2><p>Your box is backed by the real C4 selection. Tell us what you liked after tasting.</p><Button onClick={() => go('#/profile')}>View Tea Profile</Button></section></main>;
}

function Profile() {
  const [status, setStatus] = useState<Status>('loading'); const [profile, setProfile] = useState<TeaProfile | null>(null); const [error, setError] = useState('');
  const load = async () => { setStatus('loading'); try { const identity = await ensureCustomerIdentity(); const result = await ensureProfile(identity.customerId); setProfile(result.profile); if (result.created) track('profile_created', { source: 'tea_profile' }); else track('profile_updated', { source: 'profile_view' }); setStatus('ready'); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); setStatus('error'); } };
  useEffect(() => { void load(); }, []);
  if (status === 'loading') return <main><LoadingState label="Loading your tea profile" /></main>;
  if (status === 'error' || !profile) return <main><ErrorState message={error} onRetry={() => void load()} /></main>;
  const preferences = Object.entries(profile.tastePreferences).filter(([, value]) => value !== undefined && value !== null);
  return <main><section className="pagehead"><small>TEA PROFILE</small><h1>What YUNELA is learning about your taste.</h1><p>Your profile is backed by the Tea Profile API. It becomes more useful as you give feedback.</p></section><section className="profile-grid"><div className="profile-list"><small>TASTE SIGNALS</small>{preferences.length ? preferences.map(([key, value]) => <div key={key} style={{ padding: '18px 0', borderBottom: '1px solid var(--line)' }}><strong>{prettyPreference(key)}</strong><p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>{formatPreference(value)}</p></div>) : <p>No taste signals yet. Taste a tea and leave feedback.</p>}</div><div className="profile-list"><small>YOUR HISTORY</small><div style={{ padding: '18px 0', borderBottom: '1px solid var(--line)' }}><strong>{profile.likedTeaIds.length}</strong><p>liked teas</p></div><div style={{ padding: '18px 0', borderBottom: '1px solid var(--line)' }}><strong>{profile.dislikedTeaIds.length}</strong><p>teas marked not for you</p></div><div style={{ padding: '18px 0', borderBottom: '1px solid var(--line)' }}><strong>{profile.feedbackIds.length}</strong><p>feedback signals</p></div></div></section><section className="final"><Button onClick={() => go('#/finder')}>Discover Again</Button></section></main>;
}
function prettyPreference(key: string): string { return ({ body: 'Body', sweetness: 'Sweetness', freshness: 'Freshness', roastDepth: 'Roast / depth', aroma: 'Aroma', context: 'Context', familiarity: 'Experience', discoveryTolerance: 'Discovery openness' } as Record<string, string>)[key] ?? key; }
function formatPreference(value: unknown): string { if (Array.isArray(value)) return value.join(' · '); if (typeof value === 'number') return value >= 70 ? 'Strong' : value >= 40 ? 'Balanced' : 'Light'; return String(value); }

function SearchPage() {
  const [query, setQuery] = useState(''); const [status, setStatus] = useState<Status>('loading'); const [teas, setTeas] = useState<Tea[]>([]); const [error, setError] = useState('');
  useEffect(() => { api.listTeas().then(result => { setTeas(result.items); setStatus('ready'); }).catch(e => { setError(e instanceof Error ? e.message : 'Please try again.'); setStatus('error'); }); }, []);
  const matches = useMemo(() => teas.filter(t => `${t.name} ${t.family} ${t.style ?? ''} ${t.sensory.aroma.join(' ')}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8), [query, teas]);
  return <main><section className="pagehead"><small>SEARCH</small><h1>Find a tea, family or taste.</h1><div className="search-box"><Search size={18} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tea, oolong, floral..." aria-label="Search" /></div></section>{status === 'loading' && <LoadingState label="Loading tea" />}{status === 'error' && <ErrorState message={error} />}{status === 'ready' && query && (matches.length ? <section className="grid search-results">{matches.map(t => <ProductCard key={t.id} tea={t} onOpen={() => go(`#/tea/${t.id}`)} />)}</section> : <EmptyState title="No matches yet." action="Try Find Your Tea" onClick={() => go('#/finder')} />)}</main>;
}

function Placeholder({ title, head, copy, cta }: { title: string; head: string; copy: string; cta?: string }) { return <main><section className="pagehead"><small>{title}</small><h1>{head}</h1><p>{copy}</p>{cta && <Button onClick={() => go('#/finder')}>{cta}</Button>}</section></main>; }
function Cart({ count }: { count: number }) { return <main><section className="pagehead"><small>CART</small><h1>{count ? `${count} item${count === 1 ? '' : 's'} ready to discover.` : 'Your cart is waiting.'}</h1><p>{count ? 'Cart and checkout commerce are not connected to a backend contract in D1.' : 'Start with Find Your Tea or explore the collection.'}</p>{!count && <Button onClick={() => go('#/finder')}>Find Your Tea</Button>}</section></main>; }
function Account() { return <Placeholder title="ACCOUNT" head="Your discovery, kept in one place." copy="YUNELA currently uses anonymous server-created identity. Authentication is intentionally out of scope for D1." />; }

function App() {
  const [route, setRoute] = useState(location.hash || '#/'); const [cartCount, setCartCount] = useState(0); const [customerId, setCustomerId] = useState<string | null>(readCustomerId());
  useEffect(() => { const listener = () => { setRoute(location.hash || '#/'); window.scrollTo(0, 0); }; addEventListener('hashchange', listener); return () => removeEventListener('hashchange', listener); }, []);
  useEffect(() => { if (['#/profile', '#/discovery'].includes(route) || route.startsWith('#/tea/')) { ensureCustomerIdentity().then(identity => setCustomerId(identity.customerId)).catch(() => undefined); } }, [route]);
  const addToCart = (teaId: string) => { setCartCount(c => c + 1); track('add_to_cart', { tea_id: teaId }); };
  const search = () => go('#/search');
  let page: ReactNode;
  if (route === '#/finder') page = <Finder />;
  else if (route === '#/recommendations' || route === '#/results') page = <Recommendations />;
  else if (route === '#/tea') page = <Catalog />;
  else if (route.startsWith('#/tea/')) page = <Product teaId={decodeURIComponent(route.slice('#/tea/'.length))} customerId={customerId} onAdd={addToCart} />;
  else if (route === '#/discovery' || route.startsWith('#/discovery/')) page = <Discovery />;
  else if (route === '#/profile') page = <Profile />;
  else if (route === '#/account') page = <Account />;
  else if (route === '#/search') page = <SearchPage />;
  else if (route === '#/cart') page = <Cart count={cartCount} />;
  else if (route === '#/checkout') page = <Placeholder title="CHECKOUT" head="Complete your discovery." copy="Payment and order processing are outside the approved D1 API contract, so no fake checkout transaction is created." />;
  else if (route === '#/confirmation') page = <Placeholder title="ORDER" head="Your order confirmation will appear here." copy="Commerce confirmation is intentionally not simulated in D1." />;
  else if (route === '#/about') page = <Placeholder title="ABOUT YUNELA" head="Chinese tea is worth discovering, but discovering it should not be difficult." copy="YUNELA creates a clear path from curiosity to personal taste." />;
  else if (route === '#/journal') page = <Placeholder title="JOURNAL" head="Stories for discovering Chinese tea." copy="Tea stories, origins, taste, discovery and culture." />;
  else if (route === '#/guide') page = <Placeholder title="TEA GUIDE" head="Chinese tea, explained simply." copy="Start with tea families, styles, taste and brewing." />;
  else if (route === '#/support') page = <Placeholder title="TEA CONCIERGE" head="Need help choosing?" copy="Ask about a tea, brewing, discovery or an order." cta="Help me choose" />;
  else page = <Home />;
  return <><Header cartCount={cartCount} onSearch={search} />{page}<nav className="mobilebar"><a href="#/">Home</a><a href="#/finder">Find</a><a href="#/tea">Tea</a><a href="#/discovery">Discovery</a><a href="#/account">Account</a></nav></>;
}

const go = (route: Route) => { location.hash = route; };
createRoot(document.getElementById('root')!).render(<App />);
