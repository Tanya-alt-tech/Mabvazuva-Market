/* Mabvazuva Market. Settings live in data.js; you should not need to edit this file. */
(function () {
'use strict';

const C = window.MM_CONFIG, CATS = window.MM_CATEGORIES, SAMPLE = window.MM_SAMPLE;
const LIVE = !!(C.supabaseUrl && C.supabaseKey);
const RECOVERY = /(^|[#&])type=recovery(&|$)/.test(location.hash);
const LINK_ERROR = /(^|[#&])error_code=/.test(location.hash);
const sb = LIVE && window.supabase ? window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { flowType: 'implicit' } }) : null;

const $ = (s, r) => (r || document).querySelector(s);
const app = $('#app');
const DAY = 864e5;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const catName = id => (CATS.find(c => c.id === id) || { name: 'Everything else' }).name;
const digits = n => { let d = String(n || '').replace(/\D/g, ''); if (d.length === 10 && d[0] === '0') d = '263' + d.slice(1); return d; };
const waLink = (n, text) => 'https://wa.me/' + digits(n) + (text ? '?text=' + encodeURIComponent(text) : '');
const siteUrl = () => location.href.split('#')[0];
const ytId = u => { const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/); return m ? m[1] : ''; };
const SOCIALS = [['instagram', 'Instagram', 'https://www.instagram.com/'], ['facebook', 'Facebook', 'https://www.facebook.com/'], ['tiktok', 'TikTok', 'https://www.tiktok.com/@']];
function socialUrl(kind, v) {
  v = String(v || '').trim(); if (!v) return '';
  const base = SOCIALS.find(x => x[0] === kind)[2];
  const m = v.match(new RegExp('^(?:https?://)?(?:[a-z]+\\.)?' + kind + '\\.com/(.+)$', 'i'));
  if (!m && /[\/:\s]/.test(v)) return '';
  const h = (m ? m[1] : v).replace(/^@/, '').replace(/\/+$/, '');
  return /^[\w.\-\/?=&%]+$/.test(h) ? base + h : '';
}
const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const ago = iso => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (d < 1) return 'today'; if (d < 2) return 'yesterday'; if (d < 14) return d + ' days ago';
  if (d < 60) return Math.floor(d / 7) + ' weeks ago'; return Math.floor(d / 30) + ' months ago';
};

let DB = { all: [], reviews: [], requests: [], events: [], counts: {}, payments: [], reports: [], ideas: [], notes: [], promo: { free_left: 0, founding_left: 0 } };
const PLAN_DAYS = 30, REMIND_DAYS = 5;
const fmtDate = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const daysLeft = b => b.paid_until ? Math.ceil((new Date(b.paid_until).getTime() - Date.now()) / DAY) : null;
const reporterKey = () => { let k = ls.get('mm_reporter'); if (!k) { k = 'r' + Math.random().toString(36).slice(2) + Date.now().toString(36); ls.set('mm_reporter', k); } return k; };
let ME = { user: null, admin: false };

/* ---------------- storage helpers ---------------- */
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
};

/* ---------------- preview backend (no database connected) ---------------- */
const PKEY = 'mm_preview_v1';
let S = null;
function seed() {
  const now = Date.now(), iso = d => new Date(now - d * DAY).toISOString();
  const s = { user: null, biz: [], reviews: [], requests: [], events: [], hits: {} };
  SAMPLE.businesses.forEach(b => {
    const o = Object.assign({}, b, { owner: 'sample', status: 'approved', requested_plan: b.plan, photos: [], created_at: iso(b.daysAgo), review_note: '', lapsed_plan: '',
      paid_until: b.plan !== 'starter' && b.paid ? new Date(now + (3 + (s.biz.length * 7) % 26) * DAY).toISOString() : null });
    delete o.reviews; delete o.hits; delete o.daysAgo;
    s.biz.push(o);
    s.hits[b.id] = { view: b.hits.view.slice(), wa: b.hits.wa.slice() };
    b.reviews.forEach(r => s.reviews.push({ id: uid(), business_id: b.id, name: r.name, stars: r.stars, body: r.body, created_at: iso(r.daysAgo) }));
  });
  s.reviews.sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  s.requests = SAMPLE.requests.map(r => Object.assign({}, r, { wa: '', created_at: iso(r.daysAgo) }));
  s.events = SAMPLE.events.map(e => Object.assign({}, e));
  s.payments = []; s.reports = [];
  s.ideas = [
    { id: 'i1', kind: 'website', topic: 'An idea for a new feature', body: 'A map showing where each business is in the estate.', name: 'Rudo', status: 'new', votes: 0, created_at: iso(3) },
    { id: 'i2', kind: 'website', topic: 'Something is not working', body: 'The photo upload was slow on my phone.', name: '', status: 'planned', votes: 0, created_at: iso(6) }
  ];
  return s;
}
const persist = () => ls.set(PKEY, S);
function localNote(user, key, kind, title, body, link) {   // what the database triggers do on the live site
  S.notes = S.notes || [];
  S.notes.unshift({ id: uid(), user_id: user, device_key: key || null, kind, title, body: body || '', link: link || '', read: false, created_at: new Date().toISOString() });
}
function localPromo() {     // same counter the database keeps
  const used = k => S.biz.filter(b => b.promo === k && b.status !== 'rejected').length;
  return { free_left: Math.max(0, PROMO_SPOTS - used('free')), founding_left: Math.max(0, PROMO_SPOTS - used('founding')) };
}
function localReview(b) {   // same checks the database runs
  const others = S.biz.filter(x => x.id !== b.id && x.status !== 'rejected');
  if (String(b.tagline || '').trim().length < 5) return 'The one-line summary is missing or very short.';
  if (!/^2637\d{8}$/.test(b.wa || '')) return 'The WhatsApp number is not a Zimbabwean mobile number.';
  if (others.some(x => x.name.trim().toLowerCase() === String(b.name).trim().toLowerCase())) return 'Another listing already uses this name.';
  if (others.some(x => x.wa === b.wa && x.owner !== b.owner)) return 'Another owner already uses this WhatsApp number.';
  if (S.biz.some(x => x.owner === b.owner && x.status === 'rejected')) return 'This owner has had a listing rejected before.';
  return '';
}
const local = {
  async session() { ME.user = S.user; ME.admin = !!S.user; },
  async load() {
    S.payments = S.payments || []; S.reports = S.reports || []; S.notes = S.notes || [];
    if (!S.ideas || S.ideas.some(i => i.kind === 'community')) S.ideas = seed().ideas;
    DB.ideas = S.ideas.slice();
    DB.notes = S.notes.filter(n => (ME.user && n.user_id === 'local') || n.device_key === reporterKey()).sort((a, b) => a.created_at < b.created_at ? 1 : -1);
    const now = Date.now();
    S.biz.forEach(b => { if (b.plan !== 'starter' && b.paid_until && new Date(b.paid_until).getTime() < now) Object.assign(b, { lapsed_plan: b.plan, plan: 'starter', paid: false, featured: false, deal: '' }); });
    S.requests = S.requests.filter(r => now - new Date(r.created_at).getTime() < 14 * DAY);
    persist();
    DB.payments = S.payments.slice().sort((a, b) => a.created_at < b.created_at ? 1 : -1); DB.reports = S.reports.slice();
    DB.all = S.biz.slice(); DB.reviews = S.reviews.slice(); DB.events = S.events.slice();
    DB.requests = S.requests.map(r => { const c = Object.assign({}, r); delete c.wa; return c; });
    DB.counts = {}; S.biz.forEach(b => { DB.counts[b.id] = (S.hits[b.id] || { wa: [0, 0, 0, 0] }).wa[3]; });
    DB.promo = localPromo();
  },
  async signUp(email) { S.user = { id: 'local', email, since: new Date().toISOString() }; persist(); await this.session(); return true; },
  async signIn(email) { S.user = { id: 'local', email, since: (S.user && S.user.since) || new Date().toISOString() }; persist(); await this.session(); },
  async signOut() { S.user = null; persist(); await this.session(); },
  async sendReset() { return 'preview'; },
  async deleteAccount() {
    const ids = S.biz.filter(b => b.owner === 'local').map(b => b.id);
    S.biz = S.biz.filter(b => b.owner !== 'local'); S.payments = (S.payments || []).filter(p => !ids.includes(p.business_id));
    S.user = null; persist(); await this.session();
  },
  async removePhotoFile() { },
  async addIdea(o) { S.ideas.unshift(Object.assign({ id: uid(), kind: 'website', status: 'new', votes: 0, created_at: new Date().toISOString() }, o)); localNote('local', null, 'suggestion', 'New suggestion', (o.topic ? o.topic + ': ' : '') + o.body, '#/admin'); persist(); },
  async loadNotes() { DB.notes = (S.notes || []).filter(n => (ME.user && n.user_id === 'local') || n.device_key === reporterKey()).sort((a, b) => a.created_at < b.created_at ? 1 : -1); },
  async markRead() { (S.notes || []).forEach(n => { if ((ME.user && n.user_id === 'local') || n.device_key === reporterKey()) n.read = true; }); persist(); },
  async pushKey() { return null; },
  async savePush() { },
  async removePush() { },
  async setIdeaStatus(id, status) { S.ideas.find(x => x.id === id).status = status; persist(); },
  async deleteIdea(id) { S.ideas = S.ideas.filter(x => x.id !== id); persist(); },
  async setPassword() { if (!S.user) throw new Error('This reset link has expired. Ask for a new one.'); },
  async adminSetPassword() { },
  async createBiz(o) {
    const b = Object.assign({ id: uid(), owner: 'local', plan: 'starter', paid: false, verified: false, featured: false, photos: [], prices: [], deal: '', paid_until: null, lapsed_plan: '', created_at: new Date().toISOString() }, o);
    const problem = localReview(b);
    b.status = problem ? 'pending' : 'approved'; b.review_note = problem;
    const pl = localPromo();
    b.promo = S.biz.some(x => x.owner === b.owner && x.promo) ? '' : pl.free_left > 0 ? 'free' : pl.founding_left > 0 ? 'founding' : '';
    if (b.promo === 'free') Object.assign(b, { plan: 'premium', paid: true, paid_until: new Date(Date.now() + 30 * DAY).toISOString() });
    S.biz.unshift(b);
    localNote('local', null, 'listing', problem ? 'Listing waiting for you' : 'New listing is live', problem ? b.name + ': ' + problem : b.name, problem ? '#/admin' : '#/b/' + b.id);
    persist(); return b;
  },
  async claimPayment(o) {
    if (S.payments.some(p => p.business_id === o.business_id && p.status === 'pending')) throw new Error('duplicate key value violates unique constraint "payments_one_pending"');
    S.payments.unshift(Object.assign({ id: uid(), owner: 'local', status: 'pending', created_at: new Date().toISOString() }, o));
    const bn = (S.biz.find(b => b.id === o.business_id) || {}).name || 'a business';
    localNote('local', null, 'payment', 'Payment to check', `$${o.amount} for ${C.plans[o.plan].name} from ${bn}, reference ${o.reference}`, '#/admin'); persist();
  },
  async confirmPayment(id, good) {
    const p = S.payments.find(x => x.id === id && x.status === 'pending'); if (!p) throw new Error('That payment was already handled.');
    p.status = good ? 'confirmed' : 'rejected';
    if (good) this.extendLocal(p.business_id, p.plan);
    localNote('local', null, good ? 'paid' : 'unpaid', good ? `${C.plans[p.plan].name} plan is on` : 'Payment not found', good ? 'It runs for 30 days. Thank you!' : `The admin could not find reference ${p.reference}.`, '#/dashboard?id=' + p.business_id);
    persist();
  },
  extendLocal(id, plan) {
    const b = S.biz.find(x => x.id === id), from = Math.max(Date.now(), b.paid_until ? new Date(b.paid_until).getTime() : 0);
    Object.assign(b, { plan, paid: true, lapsed_plan: '', paid_until: new Date(from + PLAN_DAYS * DAY).toISOString() });
  },
  async extend(id, plan) { if (!['growth', 'premium'].includes(plan)) throw new Error('Choose Growth or Premium first.'); this.extendLocal(id, plan); persist(); },
  async report(id, reason) {
    const key = reporterKey();
    if (!S.reports.some(r => r.business_id === id && r.reporter === key)) S.reports.push({ id: uid(), business_id: id, reason, reporter: key, created_at: new Date().toISOString() });
    const b = S.biz.find(x => x.id === id);
    if (b && b.status === 'approved' && S.reports.filter(r => r.business_id === id).length >= 3) Object.assign(b, { status: 'pending', review_note: 'Hidden after reports from 3 people.' });
    persist();
  },
  async updateBiz(id, p) {
    const b = S.biz.find(x => x.id === id);
    if (p.status === 'approved' && b.status !== 'approved') S.reports = S.reports.filter(r => r.business_id !== id);
    Object.assign(b, p); persist();
  },
  async deleteBiz(id) { S.biz = S.biz.filter(b => b.id !== id); persist(); },
  async addReview(o) { S.reviews.unshift(Object.assign({ id: uid(), created_at: new Date().toISOString() }, o)); persist(); },
  async deleteReview(id) { S.reviews = S.reviews.filter(r => r.id !== id); persist(); },
  async addRequest(o) {
    S.requests.unshift(Object.assign({ id: uid(), replies: 0, offers: [], poster_key: reporterKey(), created_at: new Date().toISOString() }, o));
    if (S.biz.some(b => b.owner === 'local' && b.status === 'approved' && b.cat === o.cat)) localNote('local', null, 'request', 'New request near you', o.need, '#/requests');
    persist();
  },
  async requestContact(id) {
    if (!ME.user) return { denied: true };
    const r = S.requests.find(x => x.id === id); r.offers = r.offers || [];
    if (!r.offers.includes('local')) {
      r.offers.push('local'); r.replies++;
      const bn = (S.biz.find(b => b.owner === 'local' && b.status === 'approved') || {}).name || 'A business';
      if (r.poster_key) localNote(null, r.poster_key, 'offer', bn + ' can help', 'They saw your request and will message you on WhatsApp.', '#/requests');
    }
    persist(); return { wa: r.wa || '' };
  },
  async deleteRequest(id) { S.requests = S.requests.filter(r => r.id !== id); persist(); },
  async hit(id, kind) { const h = S.hits[id] || (S.hits[id] = { view: [0, 0, 0, 0], wa: [0, 0, 0, 0] }); h[kind][3]++; persist(); },
  async stats(id) { return S.hits[id] || { view: [0, 0, 0, 0], wa: [0, 0, 0, 0] }; },
  async upload(id, blob) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); }); },
  async addEvent(o) { S.events.push(Object.assign({ id: uid() }, o)); persist(); },
  async deleteEvent(id) { S.events = S.events.filter(e => e.id !== id); persist(); }
};

/* ---------------- live backend (Supabase) ---------------- */
const ok = res => { if (res.error) throw new Error(res.error.message || 'Something went wrong'); return res.data; };
const live = {
  async session() {
    const { data } = await sb.auth.getSession();
    const u = data && data.session && data.session.user;
    ME.user = u ? { id: u.id, email: u.email, since: u.created_at } : null; ME.admin = false;
    if (u) { const r = await sb.rpc('is_admin'); ME.admin = !r.error && r.data === true; }
  },
  async load() {
    await sb.rpc('housekeeping').then(() => {}, () => {});
    const [b, r, q, e, c, pr, p, rp, ids] = await Promise.all([
      sb.from('businesses').select('*').order('created_at', { ascending: false }),
      sb.from('reviews').select('*').order('created_at', { ascending: false }),
      sb.from('requests').select('*').order('created_at', { ascending: false }),
      sb.from('events').select('*').order('created_at', { ascending: true }),
      sb.rpc('public_counts'),
      sb.rpc('promo_status'),
      ME.user ? sb.from('payments').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
      ME.admin ? sb.from('reports').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
      ME.admin ? sb.from('ideas').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] })
    ]);
    DB.ideas = ids.error ? [] : ids.data;
    await this.loadNotes();
    DB.all = ok(b); DB.reviews = ok(r); DB.requests = ok(q); DB.events = ok(e);
    DB.payments = p.error ? [] : p.data; DB.reports = rp.error ? [] : rp.data;
    DB.counts = {}; (ok(c) || []).forEach(x => { DB.counts[x.business_id] = Number(x.contacts); });
    DB.promo = !pr.error && pr.data && pr.data[0] ? pr.data[0] : { free_left: 0, founding_left: 0 };
  },
  async signUp(email, pw) { const d = ok(await sb.auth.signUp({ email, password: pw })); await this.session(); return !!(d && d.session); },
  async signIn(email, pw) { ok(await sb.auth.signInWithPassword({ email, password: pw })); await this.session(); },
  async signOut() { await sb.auth.signOut(); await this.session(); },
  async deleteAccount() {
    const paths = mine().flatMap(b => b.photos || []).map(photoPath).filter(Boolean);
    if (paths.length) await sb.storage.from('photos').remove(paths).catch(() => {});
    ok(await sb.rpc('delete_my_account'));
    await sb.auth.signOut({ scope: 'local' }).catch(() => {}); await this.session();
  },
  async addIdea(o) { ok(await sb.from('ideas').insert(o)); },
  async loadNotes() {
    const [mineN, dev] = await Promise.all([
      ME.user ? sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
      sb.rpc('device_notifications', { p_key: reporterKey() })
    ]);
    const all = [].concat(mineN.error ? [] : mineN.data || [], dev.error ? [] : dev.data || []), seenIds = {};
    DB.notes = all.filter(n => !seenIds[n.id] && (seenIds[n.id] = 1)).sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  },
  async markRead() {
    await Promise.all([
      ME.user ? sb.from('notifications').update({ read: true }).eq('read', false) : null,
      sb.rpc('mark_device_read', { p_key: reporterKey() })
    ].filter(Boolean).map(p => p.then(() => {}, () => {})));
  },
  async pushKey() { const r = await sb.rpc('get_push_key'); return r.error ? null : r.data; },
  async savePush(j) { ok(await sb.rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_key: reporterKey() })); },
  async removePush(endpoint) { await sb.rpc('remove_push_subscription', { p_endpoint: endpoint }).then(() => {}, () => {}); },
  async setIdeaStatus(id, status) { ok(await sb.from('ideas').update({ status }).eq('id', id)); },
  async deleteIdea(id) { ok(await sb.from('ideas').delete().eq('id', id)); },
  async removePhotoFile(url) { const p = photoPath(url); if (p) await sb.storage.from('photos').remove([p]).catch(() => {}); },
  async sendReset(email) {
    const r = await sb.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() });
    if (!r.error) return 'sent';
    if (/not authori[sz]ed|rate limit|smtp|sending/i.test(r.error.message || '')) return 'no-email';
    throw new Error(r.error.message);
  },
  async setPassword(pw) {
    if (!ME.user) throw new Error('This reset link has expired. Ask for a new one.');
    ok(await sb.auth.updateUser({ password: pw }));
  },
  async adminSetPassword(email, pw) { ok(await sb.rpc('admin_set_password', { p_email: email, p_password: pw })); },
  async createBiz(o) { return ok(await sb.from('businesses').insert(o).select().single()); },
  async claimPayment(o) { ok(await sb.from('payments').insert(o)); },
  async confirmPayment(id, good) { ok(await sb.rpc('admin_confirm_payment', { p_id: id, p_ok: good })); },
  async extend(id, plan) { ok(await sb.rpc('admin_extend', { p_id: id, p_plan: plan })); },
  async report(id, reason) { ok(await sb.rpc('report_listing', { p_id: id, p_reason: reason, p_reporter: reporterKey() })); },
  async updateBiz(id, p) { ok(await sb.from('businesses').update(p).eq('id', id)); },
  async deleteBiz(id) { ok(await sb.from('businesses').delete().eq('id', id)); },
  async addReview(o) { ok(await sb.from('reviews').insert(o)); },
  async deleteReview(id) { ok(await sb.from('reviews').delete().eq('id', id)); },
  async addRequest(o) { ok(await sb.rpc('post_request', { p_need: o.need, p_when: o.when_text, p_name: o.name, p_cat: o.cat, p_wa: o.wa, p_key: reporterKey() })); },
  async requestContact(id) { const d = ok(await sb.rpc('request_contact', { p_id: id })); return d === null ? { denied: true } : { wa: d }; },
  async deleteRequest(id) { ok(await sb.from('requests').delete().eq('id', id)); },
  async hit(id, kind) { await sb.from('hits').insert({ business_id: id, kind }); },
  async stats(id) {
    const rows = ok(await sb.rpc('biz_stats', { p_id: id })) || [];
    const o = { view: [0, 0, 0, 0], wa: [0, 0, 0, 0] };
    rows.forEach(r => { if (r.wk >= 0 && r.wk < 4 && o[r.k]) o[r.k][3 - r.wk] = Number(r.n); });
    return o;
  },
  async upload(id, blob) {
    const path = id + '/' + Date.now() + '.jpg';
    ok(await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' }));
    return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
  },
  async addEvent(o) { ok(await sb.from('events').insert(o)); },
  async deleteEvent(id) { ok(await sb.from('events').delete().eq('id', id)); }
};
const api = LIVE ? live : local;
function photoPath(url) { const m = String(url || '').match(/\/object\/public\/photos\/(.+)$/); return m ? decodeURIComponent(m[1]) : ''; }

/* ---------------- derived data ---------------- */
const RANK = { premium: 0, growth: 1, starter: 2 };
const reviewsOf = b => b.plan === 'starter' ? [] : DB.reviews.filter(r => r.business_id === b.id);
const rating = b => { const r = reviewsOf(b); return r.length ? r.reduce((a, x) => a + x.stars, 0) / r.length : null; };
const contacts = b => DB.counts[b.id] || 0;
const isNew = b => Date.now() - new Date(b.created_at).getTime() < 14 * DAY;
const byId = id => DB.all.find(b => b.id === id);
const mine = () => ME.user ? DB.all.filter(b => b.owner === ME.user.id) : [];
function approved() {
  return DB.all.filter(b => b.status === 'approved').sort((a, b) =>
    RANK[a.plan] - RANK[b.plan] || (rating(b) || 0) - (rating(a) || 0) || contacts(b) - contacts(a) || a.name.localeCompare(b.name));
}
const PROMO_SPOTS = 10;
const freeLeft = () => Number(DB.promo.free_left) || 0;
const foundingLeft = () => freeLeft() > 0 ? 0 : Number(DB.promo.founding_left) || 0;
// A business keeps the founding price for as long as it stays. New listings see the price they would get today.
const priceNow = (plan, b) => (b ? b.promo === 'founding' : foundingLeft() > 0) ? C.plans[plan].founding : C.plans[plan].price;
const featuredList = () => approved().filter(b => b.featured && b.plan === 'premium').slice(0, C.featuredSlots);

/* ---------------- small pieces ---------------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), Math.max(4200, msg.length * 90));
}
const mono = name => name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const plaque = (b, cls) => b.photos && b.photos.length
  ? `<span class="plaque ${cls || ''}"><img src="${esc(b.photos[0])}" alt="" loading="lazy"></span>`
  : `<span class="plaque ${cls || ''}" aria-hidden="true">${esc(mono(b.name))}</span>`;
const tick = b => b.verified ? '<span class="tick" title="Verified Mabvazuva resident">Verified resident</span>' : '';
const starText = b => { const r = rating(b); return r ? `<span class="stars">★ ${r.toFixed(1)}</span> from ${plural(reviewsOf(b).length, 'review', 'reviews')}` : ''; };
function metaLine(b) {
  const bits = [starText(b)];
  if (contacts(b)) bits.push(`${plural(contacts(b), 'neighbour', 'neighbours')} made contact this week`);
  return bits.filter(Boolean).join('<span class="sep"></span>');
}
const row = b => `
  <a class="row" href="#/b/${esc(b.id)}">
    ${plaque(b)}
    <span class="row-main">
      <span class="row-name">${esc(b.name)} ${tick(b)} ${isNew(b) ? '<span class="new">New</span>' : ''}</span>
      <span class="row-tag">${esc(b.tagline)}</span>
      <span class="row-meta">${esc(catName(b.cat))}${metaLine(b) ? '<span class="sep"></span>' + metaLine(b) : ''}</span>
    </span>
  </a>`;
const head = (title, link, label) => `<div class="sec-head"><h2>${title}</h2>${link ? `<a href="${link}">${label}</a>` : ''}</div>`;
const catOptions = sel => CATS.map(c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
const field = (label, inner, hint) => `<label class="field"><span class="field-label">${label}</span>${inner}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
const val = (fd, k) => String(fd.get(k) || '').trim();
const promoDots = left => `<span class="promo-dots" aria-hidden="true">${Array.from({ length: PROMO_SPOTS }, (_, i) => `<i class="${i < PROMO_SPOTS - left ? 'taken' : ''}"></i>`).join('')}</span>`;
function foundingNote() {
  const f = freeLeft(), d = foundingLeft();
  if (f > 0) return `<div class="promo"><p class="promo-title">Launch offer: the first ${PROMO_SPOTS} businesses get Premium free for a month</p>
    ${promoDots(f)}<p class="promo-left"><strong>${f} of ${PROMO_SPOTS}</strong> free places left. Just list your business and it switches on by itself, no payment and no code needed.</p></div>`;
  if (d > 0) return `<div class="promo"><p class="promo-title">Founding price for the next ${PROMO_SPOTS} businesses: Premium $${C.plans.premium.founding} instead of $${C.plans.premium.price}</p>
    ${promoDots(d)}<p class="promo-left"><strong>${d} of ${PROMO_SPOTS}</strong> founding places left. Growth is $${C.plans.growth.founding} instead of $${C.plans.growth.price}, and you keep the lower price for as long as you stay.</p></div>`;
  return '';
}

/* ---------------- pages ---------------- */
function home() {
  const list = approved(), feat = featuredList();
  const fresh = list.filter(isNew).slice(0, 4);
  const deals = list.filter(b => b.deal && b.plan !== 'starter').slice(0, 3);
  const revs = DB.reviews.filter(r => { const b = byId(r.business_id); return b && b.status === 'approved' && b.plan !== 'starter'; }).slice(0, 3);
  const totalContacts = list.reduce((a, b) => a + contacts(b), 0);
  const counts = {}; list.forEach(b => { counts[b.cat] = (counts[b.cat] || 0) + 1; });

  return `
  <section class="hero hero-photo">
    <div class="wrap hero-in">
      <p class="greet">${greeting()}, Mabvazuva</p>
      <h1>Welcome home. Everything you need is inside the gate.</h1>
      <p class="hero-sub">Bakers, tutors, plumbers and stylists, run by your neighbours and the people they trust. Find one, tap once, chat on WhatsApp.</p>
      <form class="search" data-form="search" role="search">
        <label class="sr" for="q">What do you need today?</label>
        <input id="q" name="q" type="search" placeholder="What do you need today?" autocomplete="off">
        <button class="btn btn-brass" type="submit">Search</button>
      </form>
      <p class="quick">${window.MM_QUICK.map(q => `<a href="#/browse?q=${encodeURIComponent(q)}">${esc(q)}</a>`).join('')}</p>
      ${list.length >= 5 ? `<dl class="hero-stats">
        <div><dt>${list.length}</dt><dd>businesses listed</dd></div>
        ${totalContacts ? `<div><dt>${totalContacts}</dt><dd>${totalContacts === 1 ? 'neighbour' : 'neighbours'} made contact this week</dd></div>` : ''}
        ${list.filter(b => b.verified).length ? `<div><dt>${list.filter(b => b.verified).length}</dt><dd>run by verified residents</dd></div>` : ''}
      </dl>` : ''}
    </div>
  </section>

  <div class="wrap">
    <div id="install-slot"></div>
    ${totalContacts && list.length < 5 ? `<p class="pulse">${plural(totalContacts, 'neighbour', 'neighbours')} contacted a Mabvazuva business through this site in the last 7 days.</p>` : ''}

    <section class="sec">
      ${head('Browse by what you need', '#/browse', 'See everything')}
      <ul class="cats">${CATS.map(c => `<li><a href="#/browse?cat=${c.id}"><span>${esc(c.name)}</span><span class="count">${counts[c.id] || 0}</span></a></li>`).join('')}</ul>
    </section>

    ${feat.length ? `<section class="sec">
      ${head('Featured in Mabvazuva')}
      <div class="feat">${feat.map(b => `
        <a class="feat-card" href="#/b/${esc(b.id)}">
          ${plaque(b, 'plaque-lg')}
          <span class="feat-name">${esc(b.name)}</span>
          <span class="feat-tag">${esc(b.tagline)}</span>
          <span class="feat-meta">${tick(b)} ${starText(b)}</span>
        </a>`).join('')}</div>
    </section>` : ''}

    ${!list.length ? `<section class="sec empty">
      <h2>The directory opens with its first listing.</h2>
      <p>Run a business in Mabvazuva? Be the name everyone sees first.</p>
      <a class="btn btn-green" href="#/join">List your business free</a>
    </section>` : ''}

    ${fresh.length ? `<section class="sec">${head('New this week', '#/browse', 'All businesses')}<div class="rows">${fresh.map(row).join('')}</div></section>` : ''}

    ${deals.length ? `<section class="sec">${head('Deals from your neighbours', '#/deals', 'All deals and events')}
      <div class="deals">${deals.map(dealCard).join('')}</div></section>` : ''}

    ${revs.length ? `<section class="sec">${head('What neighbours are saying')}
      <div class="quotes">${revs.map(r => { const b = byId(r.business_id); return `
        <figure class="quote"><blockquote>${esc(r.body)}</blockquote>
        <figcaption>${esc(r.name)} on <a href="#/b/${esc(b.id)}">${esc(b.name)}</a></figcaption></figure>`; }).join('')}</div></section>` : ''}

    <section class="sec band">
      <div>
        <h2>Cannot find it? Ask the whole community.</h2>
        <p>Post what you need on the request board and let businesses come to you.</p>
      </div>
      <a class="btn btn-green" href="#/requests">Post a request</a>
    </section>

    <section class="sec band band-green">
      <div>
        <h2>Run a business in Mabvazuva?</h2>
        <p>List it free in under two minutes. Your customers already live here.</p>
        ${foundingNote()}
      </div>
      <a class="btn btn-brass" href="#/join">List your business</a>
    </section>
  </div>`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
const dealCard = b => `<a class="deal" href="#/b/${esc(b.id)}"><span class="deal-text">${esc(b.deal)}</span><span class="deal-by">${esc(b.name)}</span></a>`;

function browse(parts, params) {
  const q = (params.get('q') || '').trim(), cat = params.get('cat') || '';
  let list = approved();
  if (cat) list = list.filter(b => b.cat === cat);
  if (q) {
    const words = q.toLowerCase().split(/\s+/);
    list = list.filter(b => {
      const hay = [b.name, b.tagline, b.descr, catName(b.cat), (b.prices || []).map(p => p[0]).join(' ')].join(' ').toLowerCase();
      return words.every(w => hay.includes(w) || hay.includes(w.replace(/s$/, '')));
    });
  }
  const link = c => '#/browse?' + new URLSearchParams(Object.assign({}, q ? { q } : {}, c ? { cat: c } : {})).toString();
  return `<div class="wrap page">
    <h1>${cat ? esc(catName(cat)) : 'All businesses'}</h1>
    <form class="search search-light" data-form="search" role="search">
      <label class="sr" for="q">Search</label>
      <input id="q" name="q" type="search" value="${esc(q)}" placeholder="Search businesses and services" autocomplete="off">
      <input type="hidden" name="cat" value="${esc(cat)}">
      <button class="btn btn-green" type="submit">Search</button>
    </form>
    <p class="chips"><a href="${link('')}" class="${cat ? '' : 'on'}">All</a>${CATS.map(c => `<a href="${link(c.id)}" class="${c.id === cat ? 'on' : ''}">${esc(c.name)}</a>`).join('')}</p>
    ${list.length ? `<p class="result-count">${plural(list.length, 'business', 'businesses')}${q ? ` for “${esc(q)}”` : ''}</p><div class="rows">${list.map(row).join('')}</div>`
      : `<div class="empty"><h2>Nobody is listed for ${q ? `“${esc(q)}”` : 'this'} yet.</h2>
          <p>Post it on the request board and any business that can help will message you.</p>
          <p><a class="btn btn-green" href="#/requests">Post a request</a> <a class="btn btn-line" href="#/join">I offer this</a></p></div>`}
  </div>`;
}

const seen = new Set();
function profile(parts) {
  const b = byId(decodeURIComponent(parts[0] || ''));
  if (!b) return notFound();
  const own = ME.user && (b.owner === ME.user.id || ME.admin);
  if (b.status === 'approved' && !own && !seen.has(b.id)) { seen.add(b.id); api.hit(b.id, 'view').catch(() => {}); }
  const revs = reviewsOf(b), canReview = b.plan !== 'starter';
  const socials = b.plan === 'starter' ? [] : SOCIALS.map(x => [x[1], socialUrl(x[0], b[x[0]])]).filter(x => x[1]);
  const hello = `Hi ${b.name}, I found you on ${C.siteName}.`;
  const share = 'https://wa.me/?text=' + encodeURIComponent(`${b.name} on ${C.siteName}: ${b.tagline} ${siteUrl()}#/b/${b.id}`);
  const waBtn = b.wa
    ? `<a class="btn btn-wa" href="${waLink(b.wa, hello)}" target="_blank" rel="noopener" data-act="wa" data-id="${esc(b.id)}">Chat on WhatsApp</a>`
    : `<button class="btn btn-wa" type="button" data-act="wa-preview" data-id="${esc(b.id)}">Chat on WhatsApp</button>`;
  return `
  <section class="pro-head">
    <div class="wrap">
      <p class="crumb"><a href="#/browse?cat=${b.cat}">${esc(catName(b.cat))}</a></p>
      <div class="pro-id">${plaque(b, 'plaque-lg')}<div>
        <h1>${esc(b.name)}</h1>
        <p class="pro-tag">${esc(b.tagline)}</p>
        <p class="pro-meta">${[tick(b), metaLine(b)].filter(Boolean).join('<span class="sep"></span>')}</p>
      </div></div>
    </div>
  </section>
  <div class="wrap page pro">
    ${b.status !== 'approved' ? `<p class="notice">This listing is ${b.status === 'pending' ? 'waiting for approval' : 'not approved'}. Only you can see it.</p>` : ''}
    ${b.photos && b.photos.length ? `<div class="gallery">${b.photos.map(p => `<img src="${esc(p)}" alt="Photo from ${esc(b.name)}" loading="lazy">`).join('')}</div>` : ''}
    ${b.plan === 'premium' && ytId(b.video) ? `<div class="video${/shorts\//.test(b.video) ? ' video-tall' : ''}"><iframe src="https://www.youtube-nocookie.com/embed/${ytId(b.video)}" title="Video from ${esc(b.name)}" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>` : ''}
    ${b.deal && b.plan !== 'starter' ? `<div class="deal deal-wide"><span class="deal-text">${esc(b.deal)}</span><span class="deal-by">Current deal</span></div>` : ''}
    <div class="pro-grid">
      <div>
        ${b.descr ? `<section><h2>About</h2><p class="prose">${esc(b.descr)}</p>${b.owner_name ? `<p class="by">Run by ${esc(b.owner_name)}</p>` : ''}</section>` : ''}
        ${canReview ? `<section><h2>Reviews</h2>
          ${revs.length ? revs.map(r => `<div class="review"><p class="review-top"><span class="stars">${'★'.repeat(r.stars)}<span class="stars-off">${'★'.repeat(5 - r.stars)}</span></span> ${esc(r.name)}<span class="sep"></span>${ago(r.created_at)}</p><p>${esc(r.body)}</p></div>`).join('')
            : '<p class="muted">No reviews yet. Used this business? Be the first to say how it went.</p>'}
          <details class="add-review"><summary>Write a review</summary>
            <form data-form="review" data-id="${esc(b.id)}">
              ${field('Your name', '<input name="name" required maxlength="40" placeholder="e.g. Rumbi M.">')}
              ${field('Rating', '<select name="stars"><option value="5">5, excellent</option><option value="4">4, good</option><option value="3">3, okay</option><option value="2">2, poor</option><option value="1">1, bad</option></select>')}
              ${field('How did it go?', '<textarea name="body" required minlength="3" maxlength="600" rows="3"></textarea>')}
              <button class="btn btn-green" type="submit">Post review</button>
            </form></details></section>` : ''}
      </div>
      <aside>
        ${(b.prices || []).length ? `<section><h2>Prices</h2><table class="prices">${b.prices.map(p => `<tr><td>${esc(p[0])}</td><td>${esc(p[1])}</td></tr>`).join('')}</table></section>` : ''}
        ${b.hours ? `<section><h2>Hours</h2><p>${esc(b.hours)}</p></section>` : ''}
        ${socials.length ? `<section><h2>Find us on</h2><p class="socials">${socials.map(x => `<a class="btn btn-line btn-small" href="${esc(x[1])}" target="_blank" rel="noopener">${x[0]}</a>`).join('')}</p></section>` : ''}
        <p><a class="btn btn-line" href="${share}" target="_blank" rel="noopener">Share with a neighbour</a></p>
        ${b.status === 'approved' && !own ? ((ls.get('mm_reported') || {})[b.id] ? '<p class="muted">You reported this listing. Thank you, the admin will look into it.</p>'
          : `<details class="report"><summary>Report this listing</summary>
            <form data-form="report" data-id="${esc(b.id)}">
              ${field('What is wrong?', `<select name="reason">${['Not in or near Mabvazuva', 'Wrong number, or never replies', 'Fake or spam', 'Rude, unsafe or a scam', 'Something else'].map(x => `<option>${x}</option>`).join('')}</select>`)}
              ${field('Anything to add?', '<textarea name="detail" rows="2" maxlength="150"></textarea>', 'Optional. The business does not see who reported it.')}
              <button class="btn btn-line" type="submit">Send report</button>
            </form></details>`) : ''}
      </aside>
    </div>
  </div>
  <div class="sticky-wa"><div class="wrap">${waBtn}</div></div>`;
}

function requestsPage() {
  return `<div class="wrap page">
    <h1>Request board</h1>
    <p class="lead">Say what you need. Any Mabvazuva business that can help will message you on WhatsApp, and you will be told on the bell here.</p>
    ${pushState() === 'off' || pushState() === 'ios' ? pushCard('request') : ''}
    <form class="card-form" data-form="request">
      ${field('What do you need?', '<input name="need" required minlength="5" maxlength="300" placeholder="e.g. A plumber for a leaking geyser">')}
      <div class="two">
        ${field('When?', '<input name="when_text" maxlength="60" placeholder="e.g. Saturday morning">')}
        ${field('Category', `<select name="cat">${catOptions('other')}</select>`)}
      </div>
      <div class="two">
        ${field('Your first name', '<input name="name" required maxlength="40">')}
        ${field('Your WhatsApp number', '<input name="wa" required inputmode="tel" placeholder="e.g. 0771 234 567">', 'Never shown on the site. Only approved businesses that offer to help can message you.')}
      </div>
      <button class="btn btn-green" type="submit">Post request</button>
    </form>
    ${head('Open requests')}
    ${DB.requests.length ? `<div class="reqs">${DB.requests.map(r => `
      <div class="req">
        <p class="req-need">${esc(r.need)}</p>
        <p class="req-meta">${esc(r.name)}<span class="sep"></span>${esc(catName(r.cat))}${r.when_text ? `<span class="sep"></span>${esc(r.when_text)}` : ''}<span class="sep"></span>${ago(r.created_at)}</p>
        <p class="req-foot"><span class="muted">${r.replies ? plural(r.replies, 'business has', 'businesses have') + ' offered to help' : 'No offers yet. Be the first.'}</span>
        <span data-slot="${esc(r.id)}"><button class="btn btn-line btn-small" type="button" data-act="respond" data-id="${esc(r.id)}">I can help</button></span></p>
      </div>`).join('')}</div>` : '<p class="muted">No open requests right now. Yours could be the first.</p>'}
  </div>`;
}

function dealsPage() {
  const list = approved(), deals = list.filter(b => b.deal && b.plan !== 'starter'), fresh = list.filter(isNew);
  let digest = `What's new in Mabvazuva this week\n`;
  if (fresh.length) digest += `\nNew businesses:\n` + fresh.map(b => `- ${b.name}: ${b.tagline}`).join('\n') + '\n';
  if (deals.length) digest += `\nDeals:\n` + deals.map(b => `- ${b.name}: ${b.deal}`).join('\n') + '\n';
  if (DB.events.length) digest += `\nComing up:\n` + DB.events.map(e => `- ${e.date_text}: ${e.title}`).join('\n') + '\n';
  digest += `\nSee it all: ${siteUrl()}`;
  return `<div class="wrap page">
    <h1>Deals and events</h1>
    <p class="lead">Offers from businesses inside the gate, and what is happening in the community.</p>
    ${fresh.length || deals.length || DB.events.length ? `<p><a class="btn btn-wa" href="https://wa.me/?text=${encodeURIComponent(digest)}" target="_blank" rel="noopener">Share this week's digest on WhatsApp</a></p>` : ''}
    ${head('Deals')}
    ${deals.length ? `<div class="deals">${deals.map(dealCard).join('')}</div>` : '<p class="muted">No deals running right now. Business owners can post one from their dashboard.</p>'}
    ${head('Community events')}
    ${DB.events.length ? `<ul class="events">${DB.events.map(e => `<li><span class="ev-date">${esc(e.date_text)}</span><span><strong>${esc(e.title)}</strong><br>${esc(e.detail)}</span></li>`).join('')}</ul>` : '<p class="muted">Nothing on the calendar yet.</p>'}
  </div>`;
}

function planCards(mode, selected) {
  const fl = foundingLeft() > 0, free = freeLeft() > 0;
  return ['premium', 'growth', 'starter'].map(id => {
    const p = C.plans[id], price = priceNow(id);
    const priceHtml = p.price === 0 ? '<span class="price-n">Free</span>'
      : `<span class="price-n">$${price}</span><span class="price-per">a month</span>${fl ? `<span class="price-was">Founding price. Usually $${p.price}</span>` : ''}${free && id === 'premium' ? '<span class="price-was">First month free for the first 10 businesses</span>' : ''}`;
    const body = `
      ${id === 'growth' ? '<span class="pop">Most popular</span>' : ''}
      <span class="plan-name">${p.name}</span>
      <span class="plan-line">${esc(p.line)}</span>
      <span class="price">${priceHtml}</span>
      <ul>${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`;
    return mode === 'pick'
      ? `<label class="plan plan-${id}"><input type="radio" name="plan" value="${id}"${id === selected ? ' checked' : ''}>${body}<span class="plan-pick">Choose ${p.name}</span></label>`
      : `<div class="plan plan-${id}">${body}<a class="btn ${id === 'growth' ? 'btn-brass' : 'btn-line'}" href="#/join?plan=${id}">${p.price ? 'Start with ' + p.name : 'List free'}</a></div>`;
  }).join('');
}

function pricing() {
  const taken = featuredList().length;
  return `<div class="wrap page">
    <h1>Put your business in front of every household in Mabvazuva.</h1>
    <p class="lead">Start free. Move up when the enquiries come in. No contracts, cancel any month.</p>
    ${foundingNote()}
    <div class="plans">${planCards('show')}</div>
    <p class="muted">${C.featuredSlots - taken} of ${C.featuredSlots} homepage feature slots are open. Pay monthly by EcoCash, bank transfer or cash. Every listing is checked by the admin before it goes live.</p>
    <div class="faq">
      <details><summary>Do I need a registered company?</summary><p>No. If you offer a service in or for Mabvazuva, you can list it: lessons, baking, repairs, anything.</p></details>
      <details><summary>How do customers reach me?</summary><p>Every listing has one WhatsApp button that opens a chat with you. No middleman and no commission.</p></details>
      <details><summary>What does the Verified resident badge mean?</summary><p>The admin has confirmed that the owner lives in Mabvazuva.</p></details>
    </div>
  </div>`;
}

/* ---- list your business: 3 steps ---- */
let J = { step: 1, d: {}, plan: 'growth' };
function join(parts, params) {
  if (params.get('plan') && C.plans[params.get('plan')]) J.plan = params.get('plan');
  const d = J.d;
  const steps = `<ol class="steps">${['Your business', 'How to reach you', 'Choose a plan'].map((s, i) => `<li class="${J.step === i + 1 ? 'on' : J.step > i + 1 ? 'done' : ''}">${s}</li>`).join('')}</ol>`;
  if (J.step === 4) {
    const nb = byId(J.id) || {}, gotFree = nb.promo === 'free', gotFounding = nb.promo === 'founding';
    const live = J.status === 'approved', paidPick = J.plan !== 'starter' && !gotFree;
    const msg = `Hi, I have just listed "${J.d.name}" on ${C.siteName}.`;
    const html = `<div class="wrap page narrow"><div class="done-box">
      <h1>${live ? `${esc(J.d.name)} is live.` : 'Sent for approval.'}</h1>
      <p>${live ? 'Neighbours can find it in the directory now. Add photos and prices so it stands out.' : `${esc(J.d.name)} will appear in the directory as soon as the admin has checked it, usually within a day.`}</p>
      ${gotFree ? `<p class="notice"><strong>You got one of the ${PROMO_SPOTS} free places.</strong> Premium is on for free until ${fmtDate(nb.paid_until)}. Add up to ${C.plans.premium.photos} photos in your dashboard.</p>` : ''}
      ${gotFounding ? `<p class="notice"><strong>You got a founding place.</strong> You pay $${C.plans.premium.founding} instead of $${C.plans.premium.price} for Premium, or $${C.plans.growth.founding} instead of $${C.plans.growth.price} for Growth, for as long as you stay.</p>` : ''}
      ${paidPick ? `<p>You chose ${C.plans[J.plan].name} at $${priceNow(J.plan, nb)} a month. To switch it on, pay ${C.paymentNote ? esc(C.paymentNote.replace(/\.$/, '')) : 'the admin by EcoCash'}, then enter the transaction reference in your dashboard. It runs for ${PLAN_DAYS} days from when it is confirmed.</p>` : ''}
      <p>${paidPick ? `<a class="btn btn-brass" href="#/dashboard?id=${esc(J.id)}&pay=${J.plan}">Enter my payment reference</a> ` : ''}<a class="btn btn-green" href="#/dashboard?id=${esc(J.id)}">Add photos and prices</a>
      ${!live && C.adminWhatsApp ? ` <a class="btn btn-wa" href="${waLink(C.adminWhatsApp, msg)}" target="_blank" rel="noopener">Tell the admin on WhatsApp</a>` : ''}</p>
    </div></div>`;
    J = { step: 1, d: {}, plan: 'growth' };
    return html;
  }
  if (J.step === 5) {
    return `<div class="wrap page narrow"><div class="done-box"><h1>Check your email.</h1>
      <p>We sent a confirmation link to your address. Open it, then sign in here and your listing will be added automatically.</p>
      <p><a class="btn btn-green" href="#/account">Sign in</a></p></div></div>`;
  }
  let body;
  if (J.step === 1) body = `<form data-form="join1">
      ${field('Business name', `<input name="name" required minlength="2" maxlength="80" value="${esc(d.name)}" placeholder="e.g. Mai Tino's Bakes">`)}
      ${field('Category', `<select name="cat">${catOptions(d.cat || 'other')}</select>`)}
      ${field('What do you offer, in one line?', `<input name="tagline" required maxlength="140" value="${esc(d.tagline)}" placeholder="e.g. Celebration cakes and weekend bakes">`)}
      ${field('Tell neighbours more', `<textarea name="descr" rows="4" maxlength="2000" placeholder="What you do, who it is for, how to order">${esc(d.descr)}</textarea>`, 'Optional. You can add this later.')}
      <button class="btn btn-green" type="submit">Next</button></form>`;
  else if (J.step === 2) body = `<form data-form="join2">
      ${field('Your name', `<input name="owner_name" required maxlength="60" value="${esc(d.owner_name)}">`)}
      ${field('WhatsApp number for customers', `<input name="wa" required inputmode="tel" value="${esc(d.wa)}" placeholder="e.g. 0771 234 567">`, 'This is the number the Chat on WhatsApp button opens.')}
      ${field('Opening hours', `<input name="hours" maxlength="120" value="${esc(d.hours)}" placeholder="e.g. Mon to Sat, 8am to 5pm">`, 'Optional.')}
      <p class="form-nav"><button class="btn btn-line" type="button" data-act="join-back">Back</button> <button class="btn btn-green" type="submit">Next</button></p></form>`;
  else body = `<form data-form="join3">
      ${foundingNote()}
      <div class="plans plans-pick">${planCards('pick', J.plan)}</div>
      <p class="muted">Nothing is charged now. After listing, you can pay for Growth or Premium from your dashboard.</p>
      ${ME.user ? `<p class="muted">Listing as ${esc(ME.user.email)}.</p>` : `
        <h2>Create your login</h2>
        <p class="muted">So you can edit your listing later. Already have one? <a href="#/account">Sign in first</a>.</p>
        <div class="two">${field('Email', '<input name="email" type="email" required autocomplete="email">')}${field('Password', '<input name="password" type="password" required minlength="6" autocomplete="new-password">', 'At least 6 characters.')}</div>`}
      <p class="form-nav"><button class="btn btn-line" type="button" data-act="join-back">Back</button> <button class="btn btn-brass" type="submit">List my business</button></p></form>`;
  return `<div class="wrap page ${J.step === 3 ? '' : 'narrow'}">
    <h1>List your business</h1>
    <p class="lead">Three short steps. Under two minutes.</p>
    ${steps}${body}</div>`;
}

function account(parts, params) {
  if (ME.user) {
    const m = mine(), email = ME.user.email || '';
    const initials = (email.split('@')[0].replace(/[^a-z0-9]/gi, ' ').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || '?').toUpperCase();
    const role = ME.admin ? 'Admin' : m.length ? 'Business owner' : 'Member';
    const weekContacts = m.reduce((n, b) => n + contacts(b), 0);
    const claims = DB.payments.filter(x => x.status === 'pending').length, waitingN = DB.all.filter(b => b.status === 'pending').length;
    const pref = themePref();
    const opt = (v, label) => `<label class="seg-opt"><input type="radio" name="theme" value="${v}" data-change="theme"${pref === v ? ' checked' : ''}><span>${label}</span></label>`;
    const installRow = standalone() ? '<p class="muted">Vazuva is on your home screen.</p>'
      : installEvt ? '<p><button class="btn btn-line" type="button" data-act="install">Add to home screen</button></p>'
      : '<p><a class="btn btn-line" href="#/install">Show me how, step by step</a></p>';
    return `<div class="wrap page narrow acct">
      <section class="acct-head">
        <span class="avatar" aria-hidden="true">${esc(initials)}</span>
        <div><h1>Your account</h1>
          <p class="acct-email">${esc(email)}</p>
          <p class="acct-meta"><span class="role role-${role === 'Admin' ? 'admin' : 'owner'}">${role}</span>${ME.user.since ? `<span class="sep"></span>Member since ${new Date(ME.user.since).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}` : ''}</p></div>
      </section>

      ${ME.admin ? `<section class="acct-card acct-admin">
        <div><h2>Admin</h2><p>${claims ? plural(claims, 'payment', 'payments') + ' to check' : 'No payments to check'}<span class="sep"></span>${waitingN ? plural(waitingN, 'listing', 'listings') + ' waiting' : 'No listings waiting'}</p></div>
        <a class="btn btn-brass" href="#/admin">Open admin</a></section>` : ''}

      <section>
        <div class="sec-head"><h2>Your businesses</h2>${m.length ? '<a href="#/join">List another</a>' : ''}</div>
        ${m.length ? `${weekContacts ? `<p class="muted">${plural(weekContacts, 'neighbour', 'neighbours')} contacted your ${m.length === 1 ? 'business' : 'businesses'} on WhatsApp this week.</p>` : ''}
        <div class="biz-cards">${m.map(b => `<div class="biz-card">
          <div class="biz-top">${plaque(b)}<div><p class="biz-name">${esc(b.name)}</p><p class="muted">${statusText(b)}</p></div></div>
          <p class="biz-acts"><a class="btn btn-green btn-small" href="#/dashboard?id=${esc(b.id)}">Dashboard</a>
          ${b.status === 'approved' ? `<a class="btn btn-line btn-small" href="#/b/${esc(b.id)}">View listing</a>
          <a class="btn btn-line btn-small" href="https://wa.me/?text=${encodeURIComponent(`Find ${b.name} on ${C.siteName}: ${siteUrl()}#/b/${b.id}`)}" target="_blank" rel="noopener">Share</a>` : ''}</p></div>`).join('')}</div>`
        : `<div class="empty"><h2>No business listed yet</h2><p>It takes under two minutes, and Starter is free.</p><p><a class="btn btn-green" href="#/join">List your business</a></p></div>`}
      </section>

      <section class="acct-card">
        <h2>Settings</h2>
        <div class="set-row"><div><p class="set-label">Appearance</p><p class="muted">Choose light or dark, or follow your phone.</p></div>
          <div class="seg" role="radiogroup" aria-label="Appearance">${opt('light', 'Light')}${opt('dark', 'Dark')}${opt('system', 'Match my phone')}</div></div>
        <div class="set-row"><div><p class="set-label">Notifications</p><p class="muted">${pushOn() ? 'Pop-ups are on for this phone.' : 'See them on the bell, or turn on phone pop-ups.'}</p></div><p><a class="btn btn-line" href="#/notifications">Manage</a></p></div>
        <div class="set-row"><div><p class="set-label">App</p><p class="muted">Open ${esc(C.siteName)} from your home screen, like any app.</p></div>${installRow}</div>
        <details class="set-row set-details"><summary><span class="set-label">Change password</span></summary>
          <form data-form="newpass">
            ${field('New password', '<input name="password" type="password" required minlength="6" autocomplete="new-password">', 'At least 6 characters.')}
            ${field('Type it again', '<input name="password2" type="password" required minlength="6" autocomplete="new-password">')}
            <button class="btn btn-green" type="submit">Save new password</button>
          </form></details>
      </section>

      <section class="acct-card">
        <h2>Help</h2>
        <p class="muted">Questions about your listing, a payment or anything else.</p>
        <p>${C.adminWhatsApp ? `<a class="btn btn-wa" href="${waLink(C.adminWhatsApp, `Hi, I need help with my ${C.siteName} account (${email}).`)}" target="_blank" rel="noopener">Message the admin</a> ` : ''}<a class="btn btn-line" href="#/pricing">Plans and prices</a> <a class="btn btn-line" href="#/suggest">Suggest an improvement</a></p>
      </section>

      <p class="acct-out"><button class="btn btn-line" type="button" data-act="signout">Sign out</button></p>

      <section class="danger">
        <h2>Delete account</h2>
        ${ME.admin ? '<p class="muted">The admin account cannot be deleted from here. This keeps the directory from being lost by accident.</p>' : `
        <p>This permanently removes your login${m.length ? `, ${m.length === 1 ? 'your business' : `your ${m.length} businesses`} (${m.map(b => esc(b.name)).join(', ')}), their photos and your payment history` : ''}. It cannot be undone.</p>
        ${m.some(b => b.plan !== 'starter' && b.paid) ? '<p class="notice notice-warn">You have a paid plan running. Deleting your account ends it, and the remaining days are not refunded.</p>' : ''}
        <details><summary>Delete my account</summary>
          <form data-form="delete-account">
            ${field('Type DELETE to confirm', '<input name="confirm" required autocomplete="off" autocapitalize="characters">')}
            <button class="btn btn-danger" type="submit">Delete my account for good</button>
          </form></details>`}
      </section>
    </div>`;
  }
  const isNewAcc = params.get('mode') === 'new';
  return `<div class="wrap page narrow"><h1>${isNewAcc ? 'Create an account' : 'Sign in'}</h1>
    <p class="lead">For business owners. You do not need an account to browse or contact a business.</p>
    <form data-form="${isNewAcc ? 'signup' : 'signin'}">
      ${field('Email', '<input name="email" type="email" required autocomplete="email">')}
      ${field('Password', `<input name="password" type="password" required minlength="6" autocomplete="${isNewAcc ? 'new-password' : 'current-password'}">`)}
      <button class="btn btn-green" type="submit">${isNewAcc ? 'Create account' : 'Sign in'}</button>
    </form>
    ${isNewAcc ? '' : '<p><a href="#/forgot">Forgot your password?</a></p>'}
    <p class="muted">${isNewAcc ? 'Already registered? <a href="#/account">Sign in</a>.' : 'New here? <a href="#/join">List your business</a> and your login is created on the way, or <a href="#/account?mode=new">create an account</a>.'}</p></div>`;
}

const statusText = b => (b.status === 'approved' ? 'Live' : b.status === 'pending' ? 'Waiting for the admin' : 'Not approved') + ', ' + C.plans[b.plan].name + ' plan'
  + (b.plan !== 'starter' && b.paid_until ? `, paid until ${fmtDate(b.paid_until)}` : '');

async function dashboard(parts, params) {
  if (!ME.user) return `<div class="wrap page narrow"><h1>Business dashboard</h1><p class="lead">Sign in to manage your listing.</p><p><a class="btn btn-green" href="#/account">Sign in</a> <a class="btn btn-line" href="#/join">List your business</a></p></div>`;
  const id = params.get('id'), m = mine();
  const b = id ? DB.all.find(x => x.id === id && (x.owner === ME.user.id || ME.admin)) : m[0];
  if (!b) return `<div class="wrap page narrow"><h1>Business dashboard</h1><p class="lead">You have no listing yet.</p><p><a class="btn btn-green" href="#/join">List your business</a></p></div>`;
  const st = await api.stats(b.id);
  const paid = b.plan !== 'starter', p = C.plans[b.plan];
  const inCat = approved().filter(x => x.cat === b.cat), pos = inCat.findIndex(x => x.id === b.id) + 1;
  const max = Math.max(1, ...st.wa), labels = ['3 weeks ago', '2 weeks ago', 'Last week', 'This week'];
  const share = 'https://wa.me/?text=' + encodeURIComponent(`Find ${b.name} on ${C.siteName}: ${siteUrl()}#/b/${b.id}`);
  const photos = b.photos || [];
  const pays = DB.payments.filter(x => x.business_id === b.id);
  const waiting = pays.find(x => x.status === 'pending'), turnedDown = pays[0] && pays[0].status === 'rejected' ? pays[0] : null;
  const left = paid ? daysLeft(b) : null, ending = left !== null && left <= REMIND_DAYS;
  const payPlan = C.plans[params.get('pay')] && params.get('pay') !== 'starter' ? params.get('pay') : (paid ? b.plan : (b.lapsed_plan || b.requested_plan || 'growth'));
  const pickPlan = payPlan === 'starter' ? 'growth' : payPlan;
  const payOpen = !!params.get('pay') || ending || !!b.lapsed_plan || !!turnedDown;
  const howToPay = C.paymentNote ? esc(C.paymentNote.replace(/\.$/, '')) : 'the admin by EcoCash';
  const payForm = waiting ? '' : `<section id="pay"><details class="pay"${payOpen ? ' open' : ''}><summary>${paid ? 'Pay for your next month' : 'Upgrade your plan'}</summary>
      <form data-form="pay" data-id="${esc(b.id)}" class="card-form">
        ${field('Plan', `<select name="plan" data-change="pay-plan">${['growth', 'premium'].map(x => `<option value="${x}"${x === pickPlan ? ' selected' : ''}>${C.plans[x].name}, $${priceNow(x, b)} a month</option>`).join('')}</select>`)}
        <p>Pay ${howToPay}. Then enter the details below and the admin will switch your plan on for ${PLAN_DAYS} days.</p>
        <div class="two">
          ${field('EcoCash transaction reference', '<input name="reference" required minlength="3" maxlength="60" autocomplete="off" placeholder="e.g. MP231118.1200.A12345">', 'It is in the SMS EcoCash sends you. Paid in cash? Type CASH.')}
          ${field('Amount paid ($)', `<input name="amount" type="number" min="0" max="999" step="0.01" required value="${priceNow(pickPlan, b)}">`)}
        </div>
        <button class="btn btn-brass" type="submit">Send payment details</button>
      </form></details></section>`;
  const planNote = waiting
    ? `<p class="notice">Payment details sent: $${esc(waiting.amount)} for ${C.plans[waiting.plan].name}, reference <span class="ref">${esc(waiting.reference)}</span>. The admin will confirm it, usually the same day, and your plan switches on straight away.</p>`
    : ending ? `<p class="notice notice-warn">Your ${p.name} plan ${left <= 0 ? 'ends today' : `ends in ${plural(left, 'day', 'days')}`}, on ${fmtDate(b.paid_until)}. Pay $${priceNow(b.plan, b)} below to keep your place in search${b.plan === 'premium' ? ', your video and your feature slot' : ', your deals and your reviews'}.</p>`
    : !paid && b.lapsed_plan ? `<p class="notice notice-warn">Your ${C.plans[b.lapsed_plan].name} plan ended${b.paid_until ? ` on ${fmtDate(b.paid_until)}` : ''}, so your listing is back on Starter. Pay below to switch it back on.</p>`
    : turnedDown ? `<p class="notice notice-warn">The admin could not find payment reference <span class="ref">${esc(turnedDown.reference)}</span>. Check the reference in your EcoCash SMS and send it again${C.adminWhatsApp ? `, or <a href="${waLink(C.adminWhatsApp, `Hi, about my payment for ${b.name} on ${C.siteName}, reference ${turnedDown.reference}.`)}" target="_blank" rel="noopener">message the admin</a>` : ''}.</p>`
    : '';

  return `<div class="wrap page">
    ${m.length > 1 ? `<p class="chips">${m.map(x => `<a href="#/dashboard?id=${esc(x.id)}" class="${x.id === b.id ? 'on' : ''}">${esc(x.name)}</a>`).join('')}</p>` : ''}
    <h1>${esc(b.name)}</h1>
    <p class="lead">${statusText(b)}. ${b.status === 'approved' ? `<a href="#/b/${esc(b.id)}">View listing</a>` : ''}</p>
    ${b.status === 'pending' ? `<p class="notice">Your listing is waiting for the admin to check it${b.review_note ? `, because: ${esc(b.review_note.replace(/\.$/, '').replace(/^./, c => c.toLowerCase()))}` : ''}. You can add photos and prices while you wait.</p>` : ''}
    ${b.status === 'rejected' ? `<p class="notice">This listing was not approved. ${C.adminWhatsApp ? `<a href="${waLink(C.adminWhatsApp, 'Hi, about my listing ' + b.name)}" target="_blank" rel="noopener">Message the admin</a> to find out why.` : ''}</p>` : ''}
    ${planNote}

    <section class="dash-stats">
      <div class="stat"><span class="stat-n">${st.view[3]}</span><span class="stat-l">profile views this week</span></div>
      ${paid ? `<div class="stat"><span class="stat-n">${st.wa[3]}</span><span class="stat-l">WhatsApp clicks this week</span></div>` : ''}
      ${pos ? `<div class="stat"><span class="stat-n">${pos}<small> of ${inCat.length}</small></span><span class="stat-l">your position in ${esc(catName(b.cat))}</span></div>` : ''}
    </section>
    ${paid ? `<section><h2>WhatsApp clicks, last 4 weeks</h2>
      <div class="bars">${st.wa.map((n, i) => `<div class="bar"><span class="bar-n">${n}</span><span class="bar-fill" style="height:${Math.round(n / max * 100)}%"></span><span class="bar-l">${labels[i]}</span></div>`).join('')}</div></section>`
      : `<section class="upsell"><h2>${st.view[3]} ${st.view[3] === 1 ? 'neighbour' : 'neighbours'} looked at your listing this week.</h2>
          <p>How many tapped WhatsApp? On Starter you cannot see that, and paid listings sit above yours in every search. Growth shows you clicks week by week, lets you post deals, collect reviews and link your Instagram, Facebook and TikTok.</p>
          <p><a class="btn btn-brass" href="#/dashboard?id=${esc(b.id)}&pay=growth">Upgrade to Growth, $${priceNow('growth', b)} a month</a></p></section>`}
    ${b.plan === 'growth' && pos > 1 ? `<section class="upsell"><h2>You are number ${pos} in ${esc(catName(b.cat))}.</h2><p>Premium listings always show first, and get a homepage feature slot, a business video and the Verified resident badge.</p>
      <p><a class="btn btn-brass" href="#/dashboard?id=${esc(b.id)}&pay=premium">Upgrade to Premium, $${priceNow('premium', b)} a month</a></p></section>` : ''}
    ${payForm}

    <section><h2>Bring your own customers</h2>
      <p>Listings that are shared in the estate WhatsApp groups get seen first.</p>
      <p><a class="btn btn-wa" href="${share}" target="_blank" rel="noopener">Share my listing on WhatsApp</a></p></section>

    <section><h2>Photos</h2>
      <p class="muted">${photos.length} of ${p.photos} used on ${p.name}.</p>
      <div class="thumbs">${photos.map((u, i) => `<span class="thumb"><img src="${esc(u)}" alt=""><button type="button" data-act="photo-del" data-id="${esc(b.id)}" data-i="${i}" aria-label="Remove photo">Remove</button></span>`).join('')}</div>
      ${photos.length < p.photos ? `<label class="btn btn-line file">Add a photo<input type="file" accept="image/*" data-change="photo" data-id="${esc(b.id)}"></label>` : (b.plan === 'starter' ? '<p class="muted">Growth and Premium listings can show up to 8 photos.</p>' : '')}
    </section>

    <section><h2>Your listing</h2>
      <form data-form="edit" data-id="${esc(b.id)}">
        ${field('Business name', `<input name="name" required minlength="2" maxlength="80" value="${esc(b.name)}">`)}
        ${field('Category', `<select name="cat">${catOptions(b.cat)}</select>`)}
        ${field('One-line summary', `<input name="tagline" required maxlength="140" value="${esc(b.tagline)}">`)}
        ${field('About', `<textarea name="descr" rows="5" maxlength="2000">${esc(b.descr)}</textarea>`)}
        ${field('Prices', `<textarea name="prices" rows="4" placeholder="Exterior wash - $5">${esc((b.prices || []).map(x => x[0] + ' - ' + x[1]).join('\n'))}</textarea>`, 'One per line, as: item - price')}
        <div class="two">${field('Opening hours', `<input name="hours" maxlength="120" value="${esc(b.hours)}">`)}${field('WhatsApp number', `<input name="wa" required inputmode="tel" value="${esc(b.wa)}">`)}</div>
        ${field('Your name', `<input name="owner_name" maxlength="60" value="${esc(b.owner_name)}">`)}
        ${paid ? `<div class="two">${field('Instagram', `<input name="instagram" maxlength="200" value="${esc(b.instagram)}" placeholder="@yourbusiness">`)}${field('Facebook', `<input name="facebook" maxlength="200" value="${esc(b.facebook)}" placeholder="Page name or link">`)}</div>
          ${field('TikTok', `<input name="tiktok" maxlength="200" value="${esc(b.tiktok)}" placeholder="@yourbusiness">`, 'Shown as buttons on your listing. Leave any of them empty.')}`
          : '<p class="muted">Growth and Premium listings can also link their Instagram, Facebook and TikTok.</p>'}
        ${b.plan === 'premium' ? field('Business video', `<input name="video" maxlength="200" value="${esc(b.video)}" placeholder="YouTube link">`, `A short video, up to 30 seconds, plays at the top of your listing.${C.adminWhatsApp ? ` Send the clip to the admin on WhatsApp and it will be put up for you.` : ''}`) : ''}
        ${paid ? field('Current deal', `<input name="deal" maxlength="200" value="${esc(b.deal)}" placeholder="e.g. First wash free on a monthly plan">`, 'Shown on the homepage and the deals page. Leave empty for no deal.') : ''}
        <button class="btn btn-green" type="submit">Save changes</button>
      </form></section>
  </div>`;
}

function admin() {
  if (!ME.user) return `<div class="wrap page narrow"><h1>Admin</h1><p><a class="btn btn-green" href="#/account">Sign in</a></p></div>`;
  if (!ME.admin) return `<div class="wrap page narrow"><h1>Admin</h1><p class="lead">This account is not an admin.</p></div>`;
  const pending = DB.all.filter(b => b.status === 'pending');
  const rest = DB.all.filter(b => b.status !== 'pending').sort((a, b) => RANK[a.plan] - RANK[b.plan] || a.name.localeCompare(b.name));
  const payers = rest.filter(b => b.status === 'approved' && b.plan !== 'starter' && b.paid);
  const revenue = payers.reduce((a, b) => a + C.plans[b.plan].price, 0);
  const featN = DB.all.filter(b => b.featured).length;
  const claims = DB.payments.filter(x => x.status === 'pending');
  const soon = DB.all.filter(b => b.plan !== 'starter' && b.paid_until && daysLeft(b) <= REMIND_DAYS).sort((a, b) => a.paid_until < b.paid_until ? -1 : 1);
  const ended = DB.all.filter(b => b.plan === 'starter' && b.lapsed_plan && b.status === 'approved');
  const remind = (b, plan, endedNow) => b.wa ? `<a class="btn btn-wa btn-small" href="${waLink(b.wa, `Hi ${b.owner_name || b.name}, your ${C.plans[plan].name} plan for ${b.name} on ${C.siteName} ${endedNow ? 'ended' : 'ends'}${b.paid_until ? ` on ${fmtDate(b.paid_until)}` : ''}. To ${endedNow ? 'switch it back on' : 'keep it'}, pay $${priceNow(plan, b)}${C.paymentNote ? ` (${C.paymentNote.replace(/\.$/, '')})` : ' by EcoCash'} and enter the payment reference in your dashboard: ${siteUrl()}#/dashboard?id=${b.id}&pay=${plan}`)}" target="_blank" rel="noopener">Send reminder</a>` : '<span class="muted">No WhatsApp number</span>';
  const reasons = b => DB.reports.filter(r => r.business_id === b.id).map(r => esc(r.reason));
  const paidCell = b => b.plan === 'starter' ? '<span class="muted">Free</span>'
    : !b.paid ? '<span class="muted">Not paid</span>'
    : b.paid_until ? `${fmtDate(b.paid_until)}<br><span class="muted">${daysLeft(b) <= 0 ? 'ends today' : plural(daysLeft(b), 'day', 'days') + ' left'}</span>` : '<span class="muted">No end date</span>';
  const tog = (b, f, on, off) => `<button type="button" class="tog ${b[f] ? 'on' : ''}" data-act="adm-toggle" data-id="${esc(b.id)}" data-f="${f}">${b[f] ? on : off}</button>`;
  return `<div class="wrap page">
    <h1>Admin</h1>
    <section class="dash-stats">
      <div class="stat"><span class="stat-n">${DB.all.filter(b => b.status === 'approved').length}</span><span class="stat-l">live listings</span></div>
      <div class="stat"><span class="stat-n">${payers.length}</span><span class="stat-l">paying businesses</span></div>
      <div class="stat"><span class="stat-n">$${revenue}</span><span class="stat-l">a month at full list prices</span></div>
      <div class="stat"><span class="stat-n">${featN}<small> of ${C.featuredSlots}</small></span><span class="stat-l">feature slots used</span></div>
    </section>

    <section><h2>Payments to check</h2>
      ${claims.length ? claims.map(x => { const b = byId(x.business_id) || { name: 'Deleted business', wa: '' }; return `<div class="adm-pending">
        <p><strong>${esc(b.name)}</strong><span class="sep"></span>${C.plans[x.plan].name}<span class="sep"></span>$${esc(x.amount)}<span class="sep"></span>${ago(x.created_at)}</p>
        <p>Reference <span class="ref">${esc(x.reference)}</span>${b.wa ? `<span class="sep"></span><a href="${waLink(b.wa)}" target="_blank" rel="noopener">WhatsApp the owner</a>` : ''}</p>
        <p class="muted">Check that this reference and amount are in your EcoCash messages. Confirming switches ${C.plans[x.plan].name} on for ${PLAN_DAYS} days.</p>
        <p><button class="btn btn-green btn-small" type="button" data-act="adm-pay" data-id="${esc(x.id)}" data-ok="1">Confirm payment</button>
        <button class="btn btn-line btn-small" type="button" data-act="adm-pay" data-id="${esc(x.id)}" data-ok="0">Not found</button></p></div>`; }).join('')
        : '<p class="muted">No payments waiting.</p>'}</section>

    ${soon.length || ended.length ? `<section><h2>Ending soon</h2>
      <p class="muted">Plans end by themselves when the time is up, and owners see a warning in their dashboard. A WhatsApp reminder from you helps them renew.</p>
      <ul class="adm-list adm-soon">${soon.map(b => `<li><span><strong>${esc(b.name)}</strong>, ${C.plans[b.plan].name}: ${daysLeft(b) <= 0 ? 'ends today' : `ends in ${plural(daysLeft(b), 'day', 'days')}`}</span> ${remind(b, b.plan, false)}</li>`).join('')}
      ${ended.map(b => `<li><span><strong>${esc(b.name)}</strong>: ${C.plans[b.lapsed_plan].name} ended${b.paid_until ? ` on ${fmtDate(b.paid_until)}` : ''}, now on Starter</span> ${remind(b, b.lapsed_plan, true)}</li>`).join('')}</ul></section>` : ''}

    <section><h2>Waiting for approval</h2>
      <p class="muted">Listings that pass the automatic checks go live by themselves. These ones need you.</p>
      ${pending.length ? pending.map(b => `<div class="adm-pending">
        <p><strong>${esc(b.name)}</strong><span class="sep"></span>${esc(catName(b.cat))}</p>
        ${b.review_note ? `<p class="why">Why it needs you: ${esc(b.review_note)}</p>` : ''}
        ${reasons(b).length ? `<p class="muted">Reports: ${reasons(b).join('; ')}</p>` : ''}
        <p>${esc(b.tagline)}</p><p class="muted">${esc(b.owner_name)}${b.wa ? `<span class="sep"></span><a href="${waLink(b.wa)}" target="_blank" rel="noopener">WhatsApp ${esc(b.wa)}</a>` : ''}<span class="sep"></span><a href="#/b/${esc(b.id)}">Preview</a></p>
        <p><button class="btn btn-green btn-small" type="button" data-act="adm-status" data-id="${esc(b.id)}" data-v="approved">Approve</button>
        <button class="btn btn-line btn-small" type="button" data-act="adm-status" data-id="${esc(b.id)}" data-v="rejected">Reject</button></p></div>`).join('')
        : '<p class="muted">Nothing waiting.</p>'}</section>

    <section><h2>All businesses</h2>
      <div class="table-scroll"><table class="adm">
        <thead><tr><th>Business</th><th>Plan</th><th>Paid until</th><th>Verified</th><th>Featured</th><th></th></tr></thead>
        <tbody>${rest.map(b => `<tr>
          <td><a href="#/b/${esc(b.id)}">${esc(b.name)}</a>${b.status === 'rejected' ? ' <span class="muted">(rejected)</span>' : ''}${reasons(b).length ? `<br><span class="muted">${plural(reasons(b).length, 'report', 'reports')}</span>` : ''}</td>
          <td><select data-change="adm-plan" data-id="${esc(b.id)}" aria-label="Plan for ${esc(b.name)}">${['starter', 'growth', 'premium'].map(x => `<option value="${x}"${x === b.plan ? ' selected' : ''}>${C.plans[x].name}</option>`).join('')}</select></td>
          <td>${paidCell(b)}${b.plan !== 'starter' ? `<br><button type="button" class="link" data-act="adm-extend" data-id="${esc(b.id)}">+1 month</button>` : ''}</td>
          <td>${tog(b, 'verified', 'Verified', 'No')}</td>
          <td>${b.plan === 'premium' ? tog(b, 'featured', 'Featured', 'No') : '<span class="muted">Premium only</span>'}</td>
          <td class="adm-acts"><a href="#/dashboard?id=${esc(b.id)}">Edit</a> ${b.status === 'rejected' ? `<button type="button" class="link" data-act="adm-status" data-id="${esc(b.id)}" data-v="approved">Approve</button>` : ''} <button type="button" class="link danger" data-act="adm-delete" data-id="${esc(b.id)}">Delete</button></td>
        </tr>`).join('')}</tbody></table></div>
      ${rest.length ? '' : '<p class="muted">No businesses yet.</p>'}</section>

    <section><h2>Community events</h2>
      <form class="card-form" data-form="event"><div class="two">${field('When', '<input name="date_text" required maxlength="40" placeholder="e.g. Sat 21 Nov">')}${field('Title', '<input name="title" required maxlength="80">')}</div>
        ${field('Details', '<input name="detail" maxlength="200">')}<button class="btn btn-green" type="submit">Add event</button></form>
      <ul class="adm-list">${DB.events.map(e => `<li>${esc(e.date_text)}: ${esc(e.title)} <button type="button" class="link danger" data-act="adm-del" data-kind="Event" data-id="${esc(e.id)}">Remove</button></li>`).join('')}</ul></section>

    <section><h2>Reset an owner's password</h2>
      <p class="muted">When an owner forgets their password, set a temporary one here and send it to them on WhatsApp. They can change it from their Account page after signing in.</p>
      <form class="card-form" data-form="adm-pass"><div class="two">
        ${field("Owner's login email", '<input name="email" type="email" required autocomplete="off">')}
        ${field('Temporary password', `<input name="password" required minlength="6" autocomplete="off" value="${tempPass()}">`, 'Already filled in for you. Change it if you like.')}
      </div><button class="btn btn-green" type="submit">Set password</button></form></section>

    <section><h2>Suggestions</h2>
      <p class="muted">From residents and owners, about the website. Only you see these.</p>
      ${DB.ideas.length ? `<ul class="adm-list adm-ideas">${DB.ideas.map(i => `<li><span>${i.topic ? `<strong>${esc(i.topic)}:</strong> ` : ''}${esc(i.body)} <span class="muted">${i.name ? esc(i.name) + ', ' : ''}${ago(i.created_at)}</span></span>
        <span class="adm-acts"><select data-change="idea-status" data-id="${esc(i.id)}" aria-label="Status">${['new', 'planned', 'done'].map(x => `<option value="${x}"${i.status === x ? ' selected' : ''}>${STATUS[x]}</option>`).join('')}</select>
        <button type="button" class="link danger" data-act="adm-del" data-kind="Idea" data-id="${esc(i.id)}">Remove</button></span></li>`).join('')}</ul>` : '<p class="muted">No suggestions yet.</p>'}
    </section>

    <section><h2>Requests</h2><ul class="adm-list">${DB.requests.map(r => `<li>${esc(r.name)}: ${esc(r.need)} <button type="button" class="link danger" data-act="adm-del" data-kind="Request" data-id="${esc(r.id)}">Remove</button></li>`).join('') || '<li class="muted">None.</li>'}</ul></section>

    <section><h2>Reviews</h2><ul class="adm-list">${DB.reviews.map(r => `<li>${'★'.repeat(r.stars)} ${esc(r.name)} on ${esc((byId(r.business_id) || {}).name || 'deleted business')}: ${esc(r.body)} <button type="button" class="link danger" data-act="adm-del" data-kind="Review" data-id="${esc(r.id)}">Remove</button></li>`).join('') || '<li class="muted">None.</li>'}</ul></section>
  </div>`;
}

const STATUS = { new: 'New', planned: 'Planned', done: 'Done' };
const TOPICS = ['Something is not working', 'An idea for a new feature', 'Something else'];
function suggestPage(parts, params) {
  if (params.get('sent')) return `<div class="wrap page narrow"><div class="done-box"><h1>Thank you.</h1>
    <p>Your suggestion went straight to the admin. Every one is read, and the best ideas end up on the site.</p>
    <p><a class="btn btn-green" href="#/">Back to the directory</a> <a class="btn btn-line" href="#/suggest">Send another</a></p></div></div>`;
  return `<div class="wrap page narrow">
    <h1>Suggest an improvement</h1>
    <p class="lead">Something not working, or a feature you wish ${esc(C.siteName)} had? Tell us. Only the admin sees what you send.</p>
    <form class="card-form" data-form="idea">
      ${field('What is it about?', `<select name="topic">${TOPICS.map(t => `<option>${t}</option>`).join('')}</select>`)}
      ${field('Your suggestion', '<textarea name="body" required minlength="5" maxlength="600" rows="4" placeholder="e.g. A map showing where each business is"></textarea>')}
      ${field('Your first name', `<input name="name" maxlength="40" autocomplete="given-name"${ME.user ? '' : ''}>`, 'Optional.')}
      <button class="btn btn-green" type="submit">Send suggestion</button>
    </form>
  </div>`;
}
const adminHelp = (email) => C.adminWhatsApp
  ? `<a class="btn btn-wa" href="${waLink(C.adminWhatsApp, `Hi, I have forgotten my ${C.siteName} password.${email ? ' My login email is ' + email + '.' : ''}`)}" target="_blank" rel="noopener">Ask the admin on WhatsApp</a>`
  : '';
function forgot(parts, params) {
  const st = params.get('s'), email = params.get('e') || '';
  if (st === 'sent') return `<div class="wrap page narrow"><div class="done-box"><h1>Check your email.</h1>
    <p>If ${email ? esc(email) : 'that address'} has an account, a link to set a new password is on its way. It can take a few minutes, so check your spam folder too.</p>
    <p>No email after ten minutes? The admin can reset it for you.</p><p>${adminHelp(email)}</p></div></div>`;
  if (st === 'no-email' || st === 'preview') return `<div class="wrap page narrow"><div class="done-box"><h1>The admin will reset it for you.</h1>
    <p>${st === 'preview' ? 'Reset emails are not sent in preview mode.' : 'Password emails are not switched on yet.'} Message the admin on WhatsApp with your login email and you will get a new password back, usually the same day.</p>
    <p>${adminHelp(email)}</p></div></div>`;
  return `<div class="wrap page narrow"><h1>Forgot your password?</h1>
    ${params.get('expired') ? '<p class="notice">That reset link has expired or was already used. Ask for a new one below.</p>' : ''}
    <p class="lead">Enter the email you signed up with and we will send you a link to set a new password.</p>
    <form data-form="forgot">
      ${field('Email', '<input name="email" type="email" required autocomplete="email">')}
      <button class="btn btn-green" type="submit">Send reset link</button>
    </form>
    ${C.adminWhatsApp ? `<p class="muted">Or <a href="${waLink(C.adminWhatsApp, `Hi, I have forgotten my ${C.siteName} password.`)}" target="_blank" rel="noopener">message the admin on WhatsApp</a> and they will reset it for you.</p>` : ''}</div>`;
}
function resetPage() {
  if (!ME.user) return `<div class="wrap page narrow"><h1>This link has expired.</h1>
    <p class="lead">Reset links only work once and only for a short time.</p><p><a class="btn btn-green" href="#/forgot">Ask for a new link</a></p></div>`;
  return `<div class="wrap page narrow"><h1>Set a new password</h1>
    <p class="lead">For ${esc(ME.user.email)}.</p>
    <form data-form="newpass">
      ${field('New password', '<input name="password" type="password" required minlength="6" autocomplete="new-password">', 'At least 6 characters.')}
      ${field('Type it again', '<input name="password2" type="password" required minlength="6" autocomplete="new-password">')}
      <button class="btn btn-green" type="submit">Save new password</button>
    </form></div>`;
}

function tempPass() {
  const words = ['sun', 'gate', 'cake', 'rose', 'park', 'lion', 'wave', 'star', 'moon', 'leaf'];
  const r = n => Math.floor(Math.random() * n);
  return words[r(words.length)] + (1000 + r(9000)) + words[r(words.length)];
}
/* ---------------- phone pop-ups ---------------- */
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const pushOn = () => pushSupported() && Notification.permission === 'granted' && !!ls.get('mm_push_on');
function pushState() {
  if (!pushSupported()) return isIOS() && !standalone() ? 'ios' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return pushOn() ? 'on' : 'off';
}
function b64ToBytes(s) { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function pushSubscribe() {
  if (!LIVE) return toast('Phone pop-ups work on the live site, not in preview mode.');
  if (!pushSupported()) return toast(isIOS() ? 'On iPhone, add Vazuva to your home screen first, then open it from there.' : 'This browser cannot show pop-ups. The bell still works.');
  const key = await api.pushKey();
  if (!key) return toast('Phone pop-ups are not switched on for the site yet. The bell still works.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { render(true); return toast('Pop-ups were not allowed. You can allow them later in your browser settings.'); }
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  await api.savePush(sub.toJSON()); ls.set('mm_push_on', 1);
  toast('Pop-ups are on for this phone.'); render(true);
}
async function pushUnsubscribe() {
  try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (sub) { await api.removePush(sub.endpoint); await sub.unsubscribe(); } } catch (e) { /* already off */ }
  ls.del('mm_push_on'); toast('Pop-ups are off for this phone. The bell still works.'); render(true);
}
async function pushResync(asGuest) {   // links this phone's pop-ups to whoever is signed in now
  if (!LIVE || !pushOn()) return;
  try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (!sub) return;
    if (asGuest) await api.removePush(sub.endpoint);
    await api.savePush(sub.toJSON()); } catch (e) { /* try again next visit */ }
}
function pushCard(context) {
  const st = pushState();
  const why = context === 'request' ? 'Get a pop-up on this phone the moment a business offers to help.' : 'Get a pop-up on this phone, even when Vazuva is closed.';
  const msg = { on: 'Pop-ups are on for this phone.', blocked: 'Pop-ups are blocked for this site. Allow notifications for vazuva.com in your browser settings to turn them on.',
    ios: 'On iPhone, pop-ups only work once Vazuva is on your home screen. <a href="#/install?on=iphone">Show me how, step by step</a>.',
    unsupported: 'This browser cannot show pop-ups. The bell on the site still works.', off: why }[st];
  const btn = st === 'on' ? '<button type="button" class="btn btn-line btn-small" data-act="push-off">Turn off</button>'
    : st === 'off' ? '<button type="button" class="btn btn-green btn-small" data-act="push-on">Turn on pop-ups</button>' : '';
  return `<div class="push-card push-${st}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5"></rect><path d="M11 18h2"></path></svg><p>${msg}</p>${btn}</div>`;
}

/* ---------------- notifications page ---------------- */
const NOTE_ICON = { signup: 'person', listing: 'store', approved: 'store', rejected: 'store', payment: 'money', paid: 'money', unpaid: 'money', report: 'flag', suggestion: 'chat', request: 'hand', offer: 'hand', ending: 'clock', ended: 'clock' };
const ICON_PATH = { person: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path>', store: '<path d="M4 10h16l-1.5-5h-13zM5 10v9h14v-9M10 19v-5h4v5"></path>',
  money: '<rect x="3" y="6" width="18" height="12" rx="2"></rect><circle cx="12" cy="12" r="2.5"></circle>', flag: '<path d="M5 21V4h11l-2 4 2 4H5"></path>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>', hand: '<path d="M7 11V6a2 2 0 0 1 4 0v4M11 9V4a2 2 0 0 1 4 0v6M15 8a2 2 0 0 1 4 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4a1.8 1.8 0 0 1 3-2L7 14"></path>',
  clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>', bell: '<path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16zM10 21h4"></path>' };
const noteIcon = k => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATH[NOTE_ICON[k] || 'bell']}</svg>`;
function notificationsPage() {
  const list = DB.notes;
  setTimeout(markAllRead, 600);
  return `<div class="wrap page narrow">
    <h1>Notifications</h1>
    ${pushCard()}
    ${list.length ? `<div class="notes">${list.map(n => `<${n.link ? `a href="${esc(n.link)}"` : 'div'} class="note${n.read ? '' : ' unread'}">
      <span class="note-ic">${noteIcon(n.kind)}</span>
      <span class="note-main"><span class="note-title">${esc(n.title)}</span>${n.body ? `<span class="note-body">${esc(n.body)}</span>` : ''}<span class="note-when">${ago(n.created_at)}</span></span>
      ${n.read ? '' : '<span class="note-dot" aria-label="New"></span>'}</${n.link ? 'a' : 'div'}>`).join('')}</div>`
      : `<div class="empty"><h2>Nothing yet</h2><p>${ME.user ? 'New requests, payments and updates about your listings will show here.' : 'Post a request and you will be told here when a business offers to help.'}</p></div>`}
  </div>`;
}
async function markAllRead() {
  if (!location.hash.startsWith('#/notifications') || !DB.notes.some(n => !n.read)) return;
  await api.markRead(); DB.notes.forEach(n => { n.read = true; }); updateBell();
}
function updateBell() {
  const n = DB.notes.filter(x => !x.read).length, el = $('#bell-n'), bell = $('#bell');
  if (!el || !bell) return;
  el.textContent = n > 9 ? '9+' : String(n); el.hidden = !n;
  bell.setAttribute('aria-label', n ? `Notifications, ${n} new` : 'Notifications');
}
async function refreshNotes() {
  try { await api.loadNotes(); updateBell(); if (location.hash.startsWith('#/notifications')) render(true); } catch (e) { /* offline */ }
}
setInterval(() => { if (document.visibilityState === 'visible') refreshNotes(); }, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshNotes(); });

/* ---------------- appearance ---------------- */
const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const themePref = () => { try { const v = localStorage.getItem('mm_theme'); return v === 'dark' || v === 'system' ? v : 'light'; } catch (e) { return 'light'; } };
function applyTheme() {
  const t = themePref(), dark = t === 'dark' || (t === 'system' && darkQuery && darkQuery.matches);
  document.documentElement.toggleAttribute('data-theme', false);
  if (dark) document.documentElement.setAttribute('data-theme', 'dark');
}
if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', () => { if (themePref() === 'system') applyTheme(); });

/* ---------------- add to home screen ---------------- */
let installEvt = null;
const standalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function fillInstall() {
  const slot = document.getElementById('install-slot'); if (!slot) return;
  if (standalone() || ls.get('mm_install_hidden')) { slot.innerHTML = ''; return; }
  const close = '<button type="button" class="link install-x" data-act="install-hide" aria-label="Hide this">Not now</button>';
  if (installEvt) slot.innerHTML = `<div class="install"><div><strong>Get ${esc(C.siteName)} on your phone</strong><p>One tap from your home screen, like any other app. Free, and no app store needed.</p></div><p class="install-acts"><button class="btn btn-green" type="button" data-act="install">Add to home screen</button>${close}</p></div>`;
  else if (isIOS() || /android/i.test(navigator.userAgent)) slot.innerHTML = `<div class="install"><div><strong>Get ${esc(C.siteName)} on your phone</strong><p>One tap from your home screen, like any other app. Free, and no app store needed.</p></div><p class="install-acts"><a class="btn btn-green" href="#/install">Show me how</a>${close}</p></div>`;
  else slot.innerHTML = '';
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; fillInstall(); });
window.addEventListener('appinstalled', () => { installEvt = null; fillInstall(); toast(`${C.siteName} is on your home screen.`); });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}


/* ---- "add to your phone" guide, written for people new to smartphones ---- */
const ICON = {
  share: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"/></svg>',
  add: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
  dots: '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  vdots: '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  compass: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor"/></svg>',
  bell: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16zM10 21h4"/></svg>'
};
const gStep = (icon, title, text) => `<li class="g-step">${icon ? `<span class="g-icon" aria-hidden="true">${icon}</span>` : '<span class="g-icon g-blank" aria-hidden="true"></span>'}<div><h3>${title}</h3><p>${text}</p></div></li>`;
function installPage(parts, params) {
  const which = params.get('on') || (isIOS() ? 'iphone' : 'android');
  const tab = (id, label) => `<a class="g-tab${which === id ? ' on' : ''}" href="#/install?on=${id}">${label}</a>`;
  const done = standalone() ? `<p class="notice"><strong>${esc(C.siteName)} is already on this phone.</strong> You are using it right now.</p>` : '';
  const iphone = `<ol class="guide">
      ${gStep(ICON.compass, 'Open the link in Safari', `Safari is the blue compass app. If you tapped the link inside WhatsApp, look at the bottom of the screen and tap the small compass ${ICON.compass.replace('width="30" height="30"', 'width="18" height="18" class="inl"')} to open it in Safari.`)}
      ${gStep(ICON.share, 'Tap the Share button', `It is a square with an arrow pointing up, at the bottom of the screen. Can't see it? Tap the three dots ${ICON.dots.replace('width="30" height="30"', 'width="18" height="18" class="inl"')} first, then tap <strong>Share</strong>.`)}
      ${gStep(ICON.add, 'Tap "Add to Home Screen"', 'A list opens. Move your finger up the screen to scroll down the list until you see <strong>Add to Home Screen</strong>, then tap it. If you see a switch called <strong>Open as Web App</strong>, leave it on (green).')}
      ${gStep('', 'Tap "Add"', 'It is at the top right of the screen.')}
      ${gStep(`<img src="icon-192.png" alt="" width="30" height="30" style="border-radius:7px">`, `Open ${esc(C.siteName)} from your home screen`, `Close Safari. You will now see the ${esc(C.siteName)} icon with your other apps. From now on, always open ${esc(C.siteName)} by tapping that icon.`)}
      ${gStep(ICON.bell, 'Turn on notifications (optional)', `Inside the app, tap the bell at the top, then <strong>Turn on pop-ups</strong>, then <strong>Allow</strong>. Your phone will tell you when someone needs your service.`)}
    </ol>`;
  const android = `<ol class="guide">
      ${gStep(ICON.compass, 'Open the link in Chrome', `If you tapped the link inside WhatsApp, tap the three dots ${ICON.vdots.replace('width="30" height="30"', 'width="18" height="18" class="inl"')} at the top right, then <strong>Open in Chrome</strong>.`)}
      ${installEvt ? gStep(ICON.add, 'Or just tap this button', '<button class="btn btn-green" type="button" data-act="install">Add to my home screen</button>') : ''}
      ${gStep(ICON.vdots, 'Tap the three dots', 'They are at the top right of Chrome.')}
      ${gStep(ICON.add, 'Tap "Add to Home screen" or "Install app"', 'You may need to scroll down the menu a little. Then tap <strong>Install</strong> or <strong>Add</strong>.')}
      ${gStep(`<img src="icon-192.png" alt="" width="30" height="30" style="border-radius:7px">`, `Open ${esc(C.siteName)} from your home screen`, `You will now see the ${esc(C.siteName)} icon with your other apps. Tap it any time to open ${esc(C.siteName)}.`)}
      ${gStep(ICON.bell, 'Turn on notifications (optional)', 'Inside the app, tap the bell at the top, then <strong>Turn on pop-ups</strong>, then <strong>Allow</strong>.')}
    </ol>`;
  const share = 'https://wa.me/?text=' + encodeURIComponent(`How to put ${C.siteName} on your phone, step by step: ${siteUrl()}#/install`);
  return `<div class="wrap page narrow guide-page">
    <h1>Put ${esc(C.siteName)} on your phone</h1>
    <p class="lead">It takes one minute, it is free, and you do not need the app store. Follow the steps one at a time.</p>
    ${done}
    <div class="g-tabs">${tab('iphone', 'iPhone')}${tab('android', 'Android (Samsung, Tecno, Itel and others)')}</div>
    ${which === 'iphone' ? iphone : android}
    <p class="muted">Stuck? Ask someone to help you with this page, or <a href="${share}" target="_blank" rel="noopener">send these steps to someone on WhatsApp</a>.</p>
  </div>`;
}

const notFound = () => `<div class="wrap page narrow"><h1>That page is not here.</h1><p><a class="btn btn-green" href="#/">Back to the directory</a></p></div>`;

/* ---------------- router ---------------- */
const routes = { '': home, browse, b: profile, requests: requestsPage, deals: dealsPage, pricing, join, account, dashboard, admin, forgot, reset: resetPage, suggest: suggestPage, ideas: suggestPage, notifications: notificationsPage, install: installPage };
async function render(keepScroll) {
  const h = location.hash.replace(/^#\/?/, ''), cut = h.indexOf('?');
  const path = cut < 0 ? h : h.slice(0, cut), params = new URLSearchParams(cut < 0 ? '' : h.slice(cut + 1));
  const parts = path.split('/'), fn = routes[parts[0]] || notFound;
  try { app.innerHTML = await fn(parts.slice(1), params); }
  catch (e) { app.innerHTML = `<div class="wrap page narrow"><h1>Something went wrong.</h1><p>${esc(e.message)}</p><p><a class="btn btn-green" href="#/">Back to the directory</a></p></div>`; }
  const key = parts[0] || 'home';
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === key));
  $('#nav-account').textContent = ME.user ? 'Account' : 'Sign in';
  updateBell();
  $('#foot-admin').hidden = !ME.admin;
  document.body.classList.toggle('has-sticky', !!$('.sticky-wa'));
  fillInstall();
  document.title = ($('#app h1') ? $('#app h1').textContent + ' | ' : '') + C.siteName;
  if (!keepScroll) window.scrollTo(0, 0);
  if (params.get('pay') && $('#pay') && $('#pay').scrollIntoView) $('#pay').scrollIntoView({ block: 'start' });
}
const refresh = async () => { await api.load(); await render(true); };
const go = hash => { if (location.hash === hash) render(); else location.hash = hash; };

/* ---------------- forms ---------------- */
const forms = {
  async search(fd) { const q = val(fd, 'q'), cat = val(fd, 'cat'); go('#/browse?' + new URLSearchParams(Object.assign({}, q ? { q } : {}, cat ? { cat } : {})).toString()); },
  async join1(fd) { Object.assign(J.d, { name: val(fd, 'name'), cat: val(fd, 'cat'), tagline: val(fd, 'tagline'), descr: val(fd, 'descr') }); J.step = 2; render(); },
  async join2(fd) {
    const wa = digits(val(fd, 'wa'));
    if (wa.length < 9) return toast('Enter a full WhatsApp number, for example 0771 234 567.');
    Object.assign(J.d, { owner_name: val(fd, 'owner_name'), wa, hours: val(fd, 'hours') }); J.step = 3; render();
  },
  async join3(fd) {
    J.plan = val(fd, 'plan') || 'starter';
    const d = Object.assign({}, J.d, { requested_plan: J.plan });
    if (!ME.user) {
      const hasSession = await api.signUp(val(fd, 'email'), val(fd, 'password'));
      if (!hasSession) { ls.set('mm_draft', d); J.step = 5; return render(); }
    }
    const row = await api.createBiz(d);
    J.step = 4; J.id = row.id; J.status = row.status; await api.load(); go('#/join');
  },
  async signin(fd) { await api.signIn(val(fd, 'email'), val(fd, 'password')); await afterSignIn(); },
  async idea(fd) {
    await api.addIdea({ kind: 'website', topic: val(fd, 'topic'), body: val(fd, 'body'), name: val(fd, 'name') });
    if (ME.admin) await api.load();
    go('#/suggest?sent=1');
  },
  async 'delete-account'(fd) {
    if (val(fd, 'confirm').toUpperCase() !== 'DELETE') return toast('Type DELETE in capitals to confirm.');
    await api.deleteAccount(); await api.load(); go('#/');
    toast('Your account and listings have been deleted.');
  },
  async forgot(fd) {
    const email = val(fd, 'email'), r = await api.sendReset(email);
    go('#/forgot?' + new URLSearchParams({ s: r, e: email }).toString());
  },
  async newpass(fd, f) {
    if (val(fd, 'password') !== val(fd, 'password2')) return toast('The two passwords do not match.');
    await api.setPassword(val(fd, 'password'));
    f.reset(); toast('New password saved.');
    if (location.hash.indexOf('#/reset') === 0) go(mine().length ? '#/dashboard' : '#/account');
  },
  async 'adm-pass'(fd, f) {
    const email = val(fd, 'email'), pw = val(fd, 'password');
    await api.adminSetPassword(email, pw);
    f.querySelector('[name=email]').value = ''; f.querySelector('[name=password]').value = tempPass();
    toast(`Password for ${email} is now ${pw}. Send it to them on WhatsApp.`);
  },
  async signup(fd) {
    const has = await api.signUp(val(fd, 'email'), val(fd, 'password'));
    if (!has) return toast('Check your email for a confirmation link, then sign in.');
    await afterSignIn();
  },
  async review(fd, f) {
    await api.addReview({ business_id: f.dataset.id, name: val(fd, 'name'), stars: Number(val(fd, 'stars')), body: val(fd, 'body') });
    toast('Review posted. Thank you.'); await refresh();
  },
  async request(fd) {
    const wa = digits(val(fd, 'wa'));
    if (wa.length < 9) return toast('Enter a full WhatsApp number so businesses can reach you.');
    await api.addRequest({ need: val(fd, 'need'), when_text: val(fd, 'when_text'), name: val(fd, 'name'), cat: val(fd, 'cat'), wa });
    toast(pushOn() ? 'Request posted. You will get a pop-up when a business offers to help.' : 'Request posted. Watch the bell for businesses offering to help.'); await refresh();
  },
  async edit(fd, f) {
    const prices = val(fd, 'prices').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.lastIndexOf(' - '); return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 3).trim()]; }).slice(0, 20);
    const p = { name: val(fd, 'name'), cat: val(fd, 'cat'), tagline: val(fd, 'tagline'), descr: val(fd, 'descr'), prices, hours: val(fd, 'hours'), wa: digits(val(fd, 'wa')), owner_name: val(fd, 'owner_name') };
    if (fd.has('deal')) p.deal = val(fd, 'deal');
    for (const s of SOCIALS) if (fd.has(s[0])) {
      p[s[0]] = val(fd, s[0]);
      if (p[s[0]] && !socialUrl(s[0], p[s[0]])) return toast(`That ${s[1]} entry does not look right. Use your @name or the link to your page.`);
    }
    if (fd.has('video')) { p.video = val(fd, 'video'); if (p.video && !ytId(p.video)) return toast('Paste the YouTube link to the video, for example https://youtu.be/...'); }
    await api.updateBiz(f.dataset.id, p); toast('Changes saved.'); await refresh();
  },
  async pay(fd, f) {
    const plan = val(fd, 'plan'), reference = val(fd, 'reference').toUpperCase(), amount = Number(val(fd, 'amount'));
    if (!C.plans[plan] || plan === 'starter') return toast('Choose Growth or Premium.');
    await api.claimPayment({ business_id: f.dataset.id, plan, amount, reference });
    toast('Payment details sent. Your plan switches on as soon as the admin confirms it.'); await refresh();
  },
  async report(fd, f) {
    const detail = val(fd, 'detail'), reason = val(fd, 'reason') + (detail ? ': ' + detail : '');
    await api.report(f.dataset.id, reason);
    const done = ls.get('mm_reported') || {}; done[f.dataset.id] = 1; ls.set('mm_reported', done);
    toast('Thank you. The admin will look into it.'); await refresh();
  },
  async plan(fd, f) {
    const plan = val(fd, 'plan');
    await api.updateBiz(f.dataset.id, { requested_plan: plan });
    toast(`${C.plans[plan].name} requested. It switches on once payment is in.`); await refresh();
  },
  async event(fd) { await api.addEvent({ date_text: val(fd, 'date_text'), title: val(fd, 'title'), detail: val(fd, 'detail') }); toast('Event added.'); await refresh(); }
};
async function afterSignIn() {
  const draft = ls.get('mm_draft');
  if (draft && ME.user) { const row = await api.createBiz(draft); ls.del('mm_draft'); toast(row.status === 'approved' ? 'Your listing is live.' : 'Your listing was sent for approval.'); }
  pushResync(false);
  await api.load(); go(mine().length ? '#/dashboard' : '#/account');
}

/* ---------------- buttons ---------------- */
const acts = {
  wa(t) { api.hit(t.dataset.id, 'wa').catch(() => {}); },
  'wa-preview'(t) { api.hit(t.dataset.id, 'wa'); toast('Sample listing. On a real listing this opens a WhatsApp chat with the owner.'); },
  'join-back'() { J.step = Math.max(1, J.step - 1); render(); },
  async signout() { await api.signOut(); pushResync(true); await api.load(); go('#/'); },
  async respond(t) {
    if (!ME.user) return toast('Only listed businesses can reply. Sign in, or list your business free.');
    const r = await api.requestContact(t.dataset.id);
    if (r.denied) return toast('Only approved businesses can reply. List your business free to answer requests.');
    const slot = document.querySelector(`[data-slot="${t.dataset.id}"]`), req = DB.requests.find(x => x.id === t.dataset.id);
    if (!r.wa) { slot.innerHTML = '<span class="muted">No number was left for this request.</span>'; return; }
    slot.innerHTML = `<a class="btn btn-wa btn-small" href="${waLink(r.wa, `Hi ${req ? req.name : ''}, I saw your request on ${C.siteName} and I can help.`)}" target="_blank" rel="noopener">Open WhatsApp chat</a>`;
  },
  async 'photo-del'(t) {
    const b = byId(t.dataset.id), photos = (b.photos || []).slice(); photos.splice(Number(t.dataset.i), 1);
    const gone = (b.photos || [])[Number(t.dataset.i)];
    await api.updateBiz(b.id, { photos }); api.removePhotoFile(gone); await refresh();
  },
  async 'adm-status'(t) { await api.updateBiz(t.dataset.id, t.dataset.v === 'approved' ? { status: 'approved', review_note: '' } : { status: t.dataset.v }); toast(t.dataset.v === 'approved' ? 'Approved. The listing is live.' : 'Rejected.'); await refresh(); },
  async 'adm-pay'(t) {
    const good = t.dataset.ok === '1';
    await api.confirmPayment(t.dataset.id, good);
    toast(good ? `Confirmed. The plan is on for ${PLAN_DAYS} days.` : 'Marked as not found. The owner will see it in their dashboard.'); await refresh();
  },
  async 'adm-extend'(t) {
    const b = byId(t.dataset.id);
    await api.extend(b.id, b.plan); toast(`${b.name}: ${C.plans[b.plan].name} extended by ${PLAN_DAYS} days.`); await refresh();
  },
  async 'adm-toggle'(t) {
    const b = byId(t.dataset.id), f = t.dataset.f;
    if (f === 'featured' && !b.featured && DB.all.filter(x => x.featured).length >= C.featuredSlots) return toast(`All ${C.featuredSlots} feature slots are taken. Free one up first.`);
    await api.updateBiz(b.id, { [f]: !b[f] }); await refresh();
  },
  async 'adm-delete'(t) {
    if (t.dataset.sure !== '1') { t.dataset.sure = '1'; t.textContent = 'Tap again to delete'; return; }
    await api.deleteBiz(t.dataset.id); toast('Listing deleted.'); await refresh();
  },
  async 'adm-del'(t) { await api['delete' + t.dataset.kind](t.dataset.id); toast(t.dataset.kind + ' removed.'); await refresh(); },
  async install() {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch (e) { /* closed */ }
    installEvt = null; fillInstall();
  },
  async 'push-on'() { await pushSubscribe(); },
  async 'push-off'() { await pushUnsubscribe(); },
  'install-hide'() { ls.set('mm_install_hidden', 1); fillInstall(); },
  'preview-reset'() { ls.del(PKEY); S = seed(); persist(); api.session().then(refresh); toast('Preview reset to the sample data.'); }
};
const changes = {
  theme(t) { try { localStorage.setItem('mm_theme', t.value); } catch (e) { /* storage blocked */ } applyTheme(); },
  async 'idea-status'(t) { await api.setIdeaStatus(t.dataset.id, t.value); toast('Status updated.'); await refresh(); },
  'pay-plan'(t) { const a = t.form.querySelector('[name=amount]'); if (a) a.value = priceNow(t.value, byId(t.form.dataset.id)); },
  async 'adm-plan'(t) {
    const p = { plan: t.value }; if (t.value !== 'premium') p.featured = false; if (t.value === 'starter') Object.assign(p, { paid: false, paid_until: null, lapsed_plan: '' });
    await api.updateBiz(t.dataset.id, p); toast('Plan changed.'); await refresh();
  },
  async photo(t) {
    const file = t.files && t.files[0]; if (!file) return;
    toast('Uploading photo…');
    const blob = await shrink(file, LIVE ? 1280 : 560);
    const url = await api.upload(t.dataset.id, blob), b = byId(t.dataset.id);
    await api.updateBiz(b.id, { photos: (b.photos || []).concat(url) }); toast('Photo added.'); await refresh();
  }
};
function shrink(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error('Could not read that image.')), 'image/jpeg', 0.8);
    };
    img.onerror = () => rej(new Error('Could not read that image.'));
    img.src = url;
  });
}
const nice = e => {
  const m = (e && e.message) || 'Something went wrong.';
  if (/already registered/i.test(m)) return 'That email already has an account. Sign in instead.';
  if (/invalid login/i.test(m)) return 'Wrong email or password.';
  if (/not confirmed/i.test(m)) return 'Confirm your email first. Check your inbox for the link.';
  if (/no account with that email/i.test(m)) return 'No account uses that email. Check the spelling.';
  if (/should be different/i.test(m)) return 'Choose a password you have not used before.';
  return m;
};
document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault();
  const btn = f.querySelector('[type=submit]'); if (btn) btn.disabled = true;
  try { await forms[f.dataset.form](new FormData(f), f); } catch (err) { toast(nice(err)); }
  if (btn) btn.disabled = false;
});
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  try { await acts[t.dataset.act](t); } catch (err) { toast(nice(err)); }
});
document.addEventListener('change', async e => {
  const t = e.target.closest('[data-change]'); if (!t) return;
  try { await changes[t.dataset.change](t); } catch (err) { toast(nice(err)); }
});
window.addEventListener('hashchange', () => render());

/* ---------------- start ---------------- */
(async function start() {
  try {
    if (LIVE && !sb) throw new Error('Could not load the database library. Check your connection and reload.');
    if (!LIVE) {
      S = ls.get(PKEY) || seed(); persist();
      $('#ribbon').innerHTML = `<div class="ribbon"><span>Preview mode: sample businesses, saved on this device only. Connect the database to go live.</span> <button type="button" data-act="preview-reset">Reset preview</button></div>`;
    }
    await api.session(); await api.load();
    const clean = h => history.replaceState(null, '', location.pathname + location.search + h);
    if (RECOVERY) clean('#/reset');
    else if (LINK_ERROR) clean('#/forgot?expired=1');
    if (ME.user) pushResync(false);
  } catch (e) { toast(nice(e)); }
  render();
})();

})();
