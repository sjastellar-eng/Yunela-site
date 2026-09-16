import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import './styles.css';

type Classification = 'MATCH' | 'STRETCH' | 'WILDCARD';
type Route = string;
type Answers = Record<string, string>;
type Feedback = 'Loved it' | 'Liked it' | 'Not for me';
type Tea = {
  id: string;
  name: string;
  family: string;
  taste: string;
  body: number;
  sweetness: number;
  roast: number;
  origin: string;
  classification: Classification;
  reason: string;
};

type StoredProfile = {
  liked: string[];
  disliked: string[];
  feedback: Record<string, Feedback>;
  answers: Answers;
};

const teas: Tea[] = [
  { id: '01', name: 'Tea Discovery 01', family: 'Oolong', taste: 'Floral · Honey · Soft', body: 3, sweetness: 4, roast: 2, origin: 'Origin pending approval', classification: 'MATCH', reason: 'A balanced starting direction for soft body, natural sweetness and floral aroma.' },
  { id: '02', name: 'Tea Discovery 02', family: 'Green Tea', taste: 'Fresh · Floral · Clean', body: 2, sweetness: 3, roast: 1, origin: 'Origin pending approval', classification: 'MATCH', reason: 'A fresh, approachable direction for lighter body and bright aromas.' },
  { id: '03', name: 'Tea Discovery 03', family: 'Black Tea', taste: 'Warm · Honey · Full', body: 4, sweetness: 4, roast: 2, origin: 'Origin pending approval', classification: 'MATCH', reason: 'A fuller option that keeps a naturally sweet profile while adding warmth.' },
  { id: '04', name: 'Tea Discovery 04', family: 'Oolong', taste: 'Roasted · Fruity · Deep', body: 4, sweetness: 3, roast: 4, origin: 'Origin pending approval', classification: 'STRETCH', reason: 'A deliberate step toward deeper roasted character.' },
  { id: '05', name: 'Tea Discovery 05', family: 'Dark Tea', taste: 'Earthy · Woody · Smooth', body: 4, sweetness: 2, roast: 3, origin: 'Origin pending approval', classification: 'STRETCH', reason: 'A grounded direction beyond familiar sweetness.' },
  { id: '06', name: 'Tea Discovery 06', family: 'Pu-erh', taste: 'Earthy · Warm · Complex', body: 5, sweetness: 2, roast: 3, origin: 'Origin pending approval', classification: 'WILDCARD', reason: 'An intentional surprise designed to expand the current taste profile.' },
];

const questions = [
  { key: 'body', title: 'How much tea do you want to feel?', options: ['Light', 'Balanced', 'Full'] },
  { key: 'sweetness', title: 'What kind of sweetness sounds good?', options: ['Dry', 'Naturally sweet', 'Rich & sweet'] },
  { key: 'temperature', title: 'Fresh or warm?', options: ['Fresh', 'Balanced', 'Warm / roasted'] },
  { key: 'aroma', title: 'What sounds good right now?', options: ['Floral', 'Fruity', 'Roasted', 'Woody', 'Earthy', 'Creamy'] },
  { key: 'context', title: 'When are you drinking?', options: ['Morning', 'Work', 'Slow evening', 'After a meal', 'Exploring'] },
  { key: 'familiarity', title: 'How familiar are you with Chinese tea?', options: ['New to it', 'Some experience', 'Experienced'] },
  { key: 'explore', title: 'How far should we take you?', options: ['Safe choice', 'A little different', 'Surprise me'] },
] as const;

const defaultProfile: StoredProfile = { liked: [], disliked: [], feedback: {}, answers: {} };
const readProfile = (): StoredProfile => {
  try { return { ...defaultProfile, ...JSON.parse(localStorage.getItem('yunela-profile') || '{}') }; }
  catch { return defaultProfile; }
};
const saveProfile = (profile: StoredProfile) => localStorage.setItem('yunela-profile', JSON.stringify(profile));
const track = (event: string, properties: Record<string, unknown> = {}) => console.info('[YUNELA analytics]', event, properties);
const go = (route: Route) => { location.hash = route; };

function Button({ children, onClick, secondary = false, disabled = false }: { children: React.ReactNode; onClick?: () => void; secondary?: boolean; disabled?: boolean }) {
  return <button className={`btn ${secondary ? 'secondary' : ''}`} onClick={onClick} disabled={disabled}>{children}<ArrowRight size={16} /></button>;
}
function Badge({ type }: { type: Classification }) { return <span className={`badge ${type}`}>{type}</span>; }
function Meter({ label, value }: { label: string; value: number }) { return <div className="meter"><span>{label}</span><i aria-label={`${label}: ${value} of 5`}>{'●'.repeat(value)}{'○'.repeat(5 - value)}</i></div>; }
function ProductCard({ tea, onOpen, feedback }: { tea: Tea; onOpen?: () => void; feedback?: Feedback }) {
  return <article className="card" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen?.(); }}>
    <div className="photo"><span>YUNELA<br /><small>{tea.family}</small></span></div>
    <div className="meta"><Badge type={tea.classification} /><span>{tea.family}</span>{feedback && <span className="feedback-mark">{feedback}</span>}</div>
    <h3>{tea.name}</h3><p>{tea.taste}</p><Meter label="Body" value={tea.body} />
    <div className="cardfoot"><b>VIEW TEA</b><ArrowRight size={15} /></div>
  </article>;
}

function Header({ cartCount, onSearch }: { cartCount: number; onSearch: () => void }) {
  const [menu, setMenu] = useState(false);
  const links = [['#/finder', 'Find Your Tea'], ['#/tea', 'Tea'], ['#/discovery', 'Discovery'], ['#/journal', 'Journal'], ['#/guide', 'Tea Guide'], ['#/about', 'About']];
  return <>
    <header><a className="logo" href="#/">YUNELA</a><nav className="desktop-nav">{links.map(([href, label]) => label === 'Find Your Tea' ? <button key={href} onClick={() => go(href)}>{label}</button> : <a key={href} href={href}>{label}</a>)}</nav>
      <div className="tools"><button aria-label="Search" onClick={onSearch}><Search size={18} /></button><button aria-label="Account" onClick={() => go('#/account')}><UserRound size={18} /></button><button aria-label="Cart" onClick={() => go('#/cart')} className="cart-tool"><ShoppingBag size={18} />{cartCount > 0 && <b>{cartCount}</b>}</button><button className="menu-tool" aria-label="Menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <span>MENU</span>}</button></div>
    </header>
    {menu && <div className="mobile-menu">{links.map(([href, label]) => <a key={href} href={href} onClick={() => setMenu(false)}>{label}</a>)}<a href="#/account" onClick={() => setMenu(false)}>Account</a></div>}
  </>;
}
function Footer() { return <footer><div><strong>YUNELA</strong><span>Chinese tea, made easier to discover.</span></div><div><b>DISCOVER</b><a href="#/finder">Find Your Tea</a><a href="#/tea">Tea</a><a href="#/discovery">Discovery</a></div><div><b>LEARN</b><a href="#/journal">Journal</a><a href="#/guide">Tea Guide</a></div><div><b>YUNELA</b><a href="#/about">About</a><a href="#/support">Support</a><a href="#/account">Account</a></div></footer>; }

function Home() { return <><main>
  <section className="hero"><div className="hero-copy"><small>YUNELA</small><h1>DISCOVER CHINESE TEA THAT FEELS LIKE YOURS.</h1><p>Chinese tea, made easier to discover.</p><div><Button onClick={() => { track('finder_start', { source: 'home' }); go('#/finder'); }}>Find Your Tea</Button><Button secondary onClick={() => go('#/tea')}>Explore Tea</Button></div></div><div className="heroimage"><span>TEA<br />DISCOVERY</span></div></section>
  <section className="split"><div><small>DISCOVERY, NOT DECISIONS</small><h2>Start with your taste, not a tea dictionary.</h2></div><p>YUNELA helps you move from curiosity to a confident cup. A few simple questions become a clear path through Chinese tea.</p></section>
  <section className="feature"><small>01 — FINDER</small><div><h2>Find the tea that fits you.</h2><p>Tell us what sounds good. We’ll give you a few places to start.</p><Button onClick={() => { track('finder_start', { source: 'home_feature' }); go('#/finder'); }}>Start Tea Finder</Button></div></section>
  <section className="section"><small>02 — DISCOVERY</small><h2>Six teas. One guided discovery.</h2><div className="grid">{teas.slice(0, 3).map(t => <ProductCard key={t.id} tea={t} onOpen={() => go(`#/tea/${t.id}`)} />)}</div></section>
  <section className="section paper"><small>03 — SELECTED TEA</small><h2>A collection built around taste.</h2><div className="grid">{teas.slice(0, 4).map(t => <ProductCard key={t.id} tea={t} onOpen={() => go(`#/tea/${t.id}`)} />)}</div></section>
  <section className="trust"><small>WHY YUNELA</small><h2>Clear enough for beginners. Interesting enough to keep exploring.</h2><div><p><b>Taste-first discovery.</b><br />Start with what you like.</p><p><b>Clear explanations.</b><br />Every recommendation tells you why.</p><p><b>Better over time.</b><br />Feedback improves the next recommendation.</p></div></section>
  <section className="final"><small>YOUR NEXT CUP</small><h2>Ready to find your tea?</h2><Button onClick={() => go('#/finder')}>Find Your Tea</Button></section>
</main><Footer /></>; }

function Finder() {
  const [step, setStep] = useState(0); const [answers, setAnswers] = useState<Answers>({}); const q = questions[step]; const selected = answers[q.key];
  const choose = (value: string) => setAnswers(prev => ({ ...prev, [q.key]: value }));
  return <main className="finder"><div className="findtop"><a href="#/">YUNELA</a><span>{String(step + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}</span></div><div className="bar"><i style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div><section><small>FIND YOUR TEA</small><h1>{q.title}</h1><p>Choose what feels closest. There are no wrong answers.</p><div className="options">{q.options.map(option => <button key={option} className={selected === option ? 'selected' : ''} onClick={() => choose(option)}>{option}{selected === option && <Check size={17} />}</button>)}</div><div className="findnav"><button disabled={step === 0} onClick={() => setStep(s => s - 1)}><ChevronLeft /> Back</button><button disabled={!selected} onClick={() => { if (step === questions.length - 1) { track('finder_complete', { question_count: questions.length }); localStorage.setItem('yunela-finder-answers', JSON.stringify(answers)); go('#/results'); } else setStep(s => s + 1); }}>{step === questions.length - 1 ? 'See my teas' : 'Continue'} <ChevronRight /></button></div></section></main>;
}

function Results() { return <main><section className="pagehead"><small>YOUR RECOMMENDATIONS</small><h1>A few places to start.</h1><p>Three MATCH choices, two STRETCH directions and one WILDCARD for intentional discovery.</p></section><section className="profile-strip"><span>YOUR TEA PROFILE</span><b>Taste fit is the strongest signal.</b><a href="#/profile">View profile <ArrowRight size={14} /></a></section><section className="grid results">{teas.map(t => <ProductCard key={t.id} tea={t} onOpen={() => go(`#/tea/${t.id}`)} />)}</section><section className="why"><small>WHY WE RECOMMEND THIS</small><div><h2>Recommendation should feel understandable.</h2><p>YUNELA uses taste fit as the strongest signal, with body, roast/depth, familiarity, context and discovery tolerance shaping the route. These are discovery categories, not tea-quality scores.</p></div></section></main>; }

function Catalog() { const [filter, setFilter] = useState('All'); const families = ['All', ...new Set(teas.map(t => t.family))]; const list = teas.filter(t => filter === 'All' || t.family === filter); return <main><section className="pagehead"><small>TEA</small><h1>Explore Chinese tea by taste.</h1><p>Browse the collection when you know what you want — or start with Find Your Tea.</p></section><div className="filters">{families.map(f => <button className={filter === f ? 'active' : ''} key={f} onClick={() => { setFilter(f); track('catalog_filter', { family: f }); }}>{f}</button>)}</div><section className="grid catalog-grid">{list.map(t => <ProductCard key={t.id} tea={t} onOpen={() => go(`#/tea/${t.id}`)} />)}</section>{list.length === 0 && <EmptyState title="Nothing here yet." action="Try Find Your Tea" onClick={() => go('#/finder')} />}</main>; }

function Product({ tea, onAdd }: { tea: Tea; onAdd: () => void }) { return <main><section className="product"><div className="productimage"><span>YUNELA<br />{tea.family}</span></div><div className="product-buy"><Badge type={tea.classification} /><small>{tea.family}</small><h1>{tea.name}</h1><p className="lead">{tea.taste}</p><div className="meters"><Meter label="Body" value={tea.body} /><Meter label="Sweetness" value={tea.sweetness} /><Meter label="Roast" value={tea.roast} /></div><div className="origin-note">{tea.origin}</div><div className="buy"><strong>$—</strong><Button onClick={onAdd}>Add to Cart</Button></div></div></section><section className="content"><div><small>WHY YUNELA RECOMMENDS IT</small><h2>{tea.reason}</h2></div><div><h3>What is this tea?</h3><p>Verified product story and origin details will appear when approved commercial data is connected.</p><h3>How to brew</h3><p>Brewing parameters are pending Tea Expert / QA approval.</p></div></section><FeedbackPanel tea={tea} /><section className="section"><small>IF YOU LIKED THIS → TRY THIS NEXT</small><h2>Keep discovering.</h2><div className="grid">{teas.filter(t => t.id !== tea.id).slice(0, 3).map(t => <ProductCard key={t.id} tea={t} onOpen={() => go(`#/tea/${t.id}`)} />)}</div></section></main>; }

function FeedbackPanel({ tea }: { tea: Tea }) { const [saved, setSaved] = useState<Feedback | null>(() => readProfile().feedback[tea.id] || null); const submit = (value: Feedback) => { const p = readProfile(); p.feedback[tea.id] = value; if (value === 'Loved it' || value === 'Liked it') p.liked = [...new Set([...p.liked, tea.id])]; if (value === 'Not for me') p.disliked = [...new Set([...p.disliked, tea.id])]; saveProfile(p); setSaved(value); track('tea_feedback', { tea_id: tea.id, feedback: value }); }; return <section className="feedback"><div><small>HOW WAS IT?</small><h2>Your taste gets clearer with every cup.</h2></div><div><div className="feedback-buttons">{(['Loved it', 'Liked it', 'Not for me'] as Feedback[]).map(v => <button key={v} className={saved === v ? 'selected' : ''} onClick={() => submit(v)}>{v}{saved === v && <Check size={16} />}</button>)}</div><div className="feedback-tags"><span>More floral</span><span>More sweet</span><span>More roasted</span><span>More fresh</span><span>More body</span><span>More earthy</span></div></div></section>; }

function Discovery() { return <main><section className="pagehead"><small>DISCOVERY BOX</small><h1>Six teas. One way to discover what is yours.</h1><p>Three strong matches, two steps beyond your usual taste, and one wildcard.</p></section><div className="box"><div><b>3</b><span>MATCH</span></div><div><b>2</b><span>STRETCH</span></div><div><b>1</b><span>WILDCARD</span></div></div><section className="grid discovery-grid">{teas.map(t => <ProductCard key={t.id} tea={t} onOpen={() => go(`#/tea/${t.id}`)} />)}</section><section className="final"><h2>Discovery should lead somewhere.</h2><p>Try the box, tell us what you liked, and let the next recommendation become more useful.</p><Button onClick={() => go('#/tea')}>Explore Tea</Button></section></main>; }

function Profile() { const profile = readProfile(); const liked = teas.filter(t => profile.liked.includes(t.id)); const disliked = teas.filter(t => profile.disliked.includes(t.id)); return <main><section className="pagehead"><small>TEA PROFILE</small><h1>Your taste gets clearer with every cup.</h1><p>Your saved feedback and Finder answers shape a simple record of what you like and what to explore next.</p></section><section className="profile-grid"><ProfileList title="Liked teas" items={liked} empty="No feedback yet. Start with a tea." /><ProfileList title="Not for me" items={disliked} empty="Nothing marked yet." /></section><section className="section paper"><small>NEXT DISCOVERY</small><h2>A few directions to explore.</h2><div className="grid">{teas.filter(t => !profile.disliked.includes(t.id)).slice(0, 3).map(t => <ProductCard key={t.id} tea={t} onOpen={() => go(`#/tea/${t.id}`)} />)}</div></section></main>; }
function ProfileList({ title, items, empty }: { title: string; items: Tea[]; empty: string }) { return <div className="profile-list"><small>{title}</small>{items.length ? items.map(t => <button key={t.id} onClick={() => go(`#/tea/${t.id}`)}><span>{t.name}<small>{t.taste}</small></span><ArrowRight size={16} /></button>) : <p>{empty}</p>}</div>; }

function SearchPage() { const [query, setQuery] = useState(''); const matches = useMemo(() => teas.filter(t => `${t.name} ${t.family} ${t.taste}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6), [query]); return <main><section className="pagehead"><small>SEARCH</small><h1>Find a tea, family or taste.</h1><div className="search-box"><Search size={18} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tea, oolong, floral..." aria-label="Search" /></div></section>{query && <section className="grid search-results">{matches.map(t => <ProductCard key={t.id} tea={t} onOpen={() => go(`#/tea/${t.id}`)} />)}</section>}{query && !matches.length && <EmptyState title="No matches yet." action="Try Find Your Tea" onClick={() => go('#/finder')} />}</main>; }

function Checkout({ cartCount, onComplete }: { cartCount: number; onComplete: () => void }) { return <main><section className="pagehead"><small>CHECKOUT</small><h1>Complete your discovery.</h1><p>{cartCount} item{cartCount === 1 ? '' : 's'} selected. This frontend checkout is a UI foundation only; payment and order processing are not connected.</p><div className="checkout-form"><label>Email<input type="email" placeholder="you@example.com" /></label><label>Delivery address<input type="text" placeholder="Address" /></label><label>City<input type="text" placeholder="City" /></label><Button onClick={onComplete}>Continue</Button></div></section></main>; }
function Confirmation() { return <main><section className="pagehead confirmation"><small>ORDER CONFIRMATION</small><h1>Your tea journey starts here.</h1><p>The confirmation surface is ready for the future commerce integration. No real order or payment is processed by this UI foundation.</p><Button onClick={() => go('#/profile')}>Open Tea Profile</Button></section></main>; }
function Account() { return <main><section className="pagehead"><small>ACCOUNT</small><h1>Your tea journey, in one place.</h1><p>Orders, saved teas, recommendations and your Tea Profile will live here once approved account services are connected.</p><div className="account-actions"><Button onClick={() => go('#/profile')}>Open Tea Profile</Button><Button secondary onClick={() => go('#/finder')}>Find Your Tea</Button></div></section><div className="placeholder">ACCOUNT SERVICE FOUNDATION — no authentication or account backend is connected in this UI scope.</div></main>; }
function Simple({ title, head, copy, cta = 'Find Your Tea' }: { title: string; head: string; copy: string; cta?: string }) { return <main><section className="pagehead"><small>{title}</small><h1>{head}</h1><p>{copy}</p><Button onClick={() => go('#/finder')}>{cta}</Button></section><div className="placeholder">CONTENT FOUNDATION — approved editorial/product content will be connected here.</div></main>; }
function EmptyState({ title, action, onClick }: { title: string; action: string; onClick: () => void }) { return <div className="empty"><h2>{title}</h2><button onClick={onClick}>{action} <ArrowRight size={15} /></button></div>; }

function App() {
  const [route, setRoute] = useState(location.hash || '#/');
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => { const listener = () => { setRoute(location.hash || '#/'); window.scrollTo(0, 0); }; addEventListener('hashchange', listener); return () => removeEventListener('hashchange', listener); }, []);
  const addToCart = (teaId: string) => { setCartCount(c => c + 1); track('add_to_cart', { tea_id: teaId }); };
  const search = () => go('#/search');
  let page: React.ReactNode;
  if (route === '#/finder') page = <Finder />;
  else if (route === '#/results') page = <Results />;
  else if (route === '#/tea') page = <Catalog />;
  else if (route.startsWith('#/tea/')) { const tea = teas.find(t => route.endsWith(t.id)) || teas[0]; page = <Product tea={tea} onAdd={() => addToCart(tea.id)} />; }
  else if (route === '#/discovery') page = <Discovery />;
  else if (route === '#/profile') page = <Profile />;
  else if (route === '#/account') page = <Account />;
  else if (route === '#/search') page = <SearchPage />;
  else if (route === '#/cart') page = <main><section className="pagehead"><small>CART</small><h1>{cartCount ? `${cartCount} item${cartCount === 1 ? '' : 's'} ready to discover.` : 'Your cart is waiting.'}</h1><p>{cartCount ? 'Review your selection and continue to checkout.' : 'Start with Find Your Tea or explore the collection.'}</p>{cartCount ? <Button onClick={() => go('#/checkout')}>Checkout</Button> : <Button onClick={() => go('#/finder')}>Find Your Tea</Button>}</section></main>;
  else if (route === '#/checkout') page = <Checkout cartCount={cartCount} onComplete={() => go('#/confirmation')} />;
  else if (route === '#/confirmation') page = <Confirmation />;
  else if (route === '#/about') page = <Simple title="ABOUT YUNELA" head="Chinese tea is worth discovering, but discovering it should not be difficult." copy="YUNELA creates a clear path from curiosity to personal taste." />;
  else if (route === '#/journal') page = <Simple title="JOURNAL" head="Stories for discovering Chinese tea." copy="Tea stories, origins, taste, discovery and culture — editorial content that helps you understand what you are drinking." />;
  else if (route === '#/guide') page = <Simple title="TEA GUIDE" head="Chinese tea, explained simply." copy="Start with tea families, styles, taste and brewing. Then return to Find Your Tea when you are ready to explore." />;
  else if (route === '#/support') page = <Simple title="TEA CONCIERGE" head="Need help choosing?" copy="Ask about a tea, brewing, discovery or an order." cta="Help me choose" />;
  else page = <Home />;
  return <><Header cartCount={cartCount} onSearch={search} />{page}<nav className="mobilebar"><a href="#/">Home</a><a href="#/finder">Find</a><a href="#/tea">Tea</a><a href="#/discovery">Discovery</a><a href="#/account">Account</a></nav></>;
}

createRoot(document.getElementById('root')!).render(<App />);
