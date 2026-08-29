// Build lexicon.json: monotonic form -> polytonic form(s), from el-polyton hunspell .dic/.aff
// Expands affix rules (κλιτοί τύποι), skips βαρεία-variants (τις παράγει το runtime).
// Only stores pairs that DIFFER (identical pairs need no conversion).
import { readFileSync, writeFileSync } from 'node:fs';

const VARIA = '̀';
const DROP = new Set([0x0313, 0x0314, 0x0345, 0x0304, 0x0306]); // ψιλή, δασεία, ὑπογεγρ., macron, breve
const TO_TONOS = new Set([0x0300, 0x0342]); // βαρεία, περισπωμένη
const VOWELS = 'αεηιουω';

export function toMonotonic(word) {
  let out = '';
  for (const ch of word.normalize('NFD')) {
    const cp = ch.codePointAt(0);
    if (DROP.has(cp)) continue;
    out += TO_TONOS.has(cp) ? '́' : ch;
  }
  return out.normalize('NFC');
}

function stripAccent(word) {
  return word.normalize('NFD').replace(/́/g, '').normalize('NFC');
}

function vowelClusterCount(word) {
  const w = stripAccent(word.toLowerCase()).normalize('NFD').replace(/\p{M}/gu, '');
  const m = w.match(/(αι|ει|οι|υι|αυ|ευ|ου|ηυ|[αεηιουω])/g);
  return m ? m.length : 0;
}

// ---- Parse .aff ----
const affLines = readFileSync('dict/el-polyton.aff', 'utf8').split('\n');
const rules = new Map(); // flag -> { type, cross, entries: [{strip, add, cond}] }
for (const line of affLines) {
  const p = line.trim().split(/\s+/);
  if (p[0] !== 'SFX' && p[0] !== 'PFX') continue;
  const [type, flag, a, b, c] = p;
  if (!rules.has(flag)) {
    rules.set(flag, { type, cross: a === 'Y', entries: [] }); // header: TYPE flag cross count
  } else {
    const strip = a === '0' ? '' : a;
    const add = (b === '0' ? '' : b).split('/')[0]; // αγνόησε continuation flags
    const cond = c === '.' || c === undefined ? null
      : new RegExp(type === 'SFX' ? c + '$' : '^' + c);
    rules.get(flag).entries.push({ strip, add, cond });
  }
}

function applyRules(word, flags) {
  const out = [];
  const sfxForms = []; // για cross PFX
  for (const f of flags) {
    const r = rules.get(f);
    if (!r) continue;
    for (const e of r.entries) {
      if (e.cond && !e.cond.test(word)) continue;
      let form;
      if (r.type === 'SFX') {
        if (e.strip && !word.endsWith(e.strip)) continue;
        form = word.slice(0, word.length - e.strip.length) + e.add;
        if (r.cross) sfxForms.push({ form, flags });
      } else {
        if (e.strip && !word.startsWith(e.strip)) continue;
        form = e.add + word.slice(e.strip.length);
      }
      out.push(form);
    }
  }
  // cross-products PFX x SFX: εφάρμοσε PFX και στα SFX-παράγωγα
  for (const f of flags) {
    const r = rules.get(f);
    if (!r || r.type !== 'PFX' || !r.cross) continue;
    for (const e of r.entries) {
      for (const { form } of sfxForms) {
        if (e.cond && !e.cond.test(form)) continue;
        if (e.strip && !form.startsWith(e.strip)) continue;
        out.push(e.add + form.slice(e.strip.length));
      }
    }
  }
  return out;
}

// ---- Expand .dic ----
const SUBSCRIPT = 'ͅ';
const hasSub = (w) => w.normalize('NFD').includes(SUBSCRIPT);
const lines = readFileSync('dict/el-polyton.dic', 'utf8').split('\n');
const forms = new Set();
let dativesSkipped = 0;
for (let i = 1; i < lines.length; i++) {
  const raw = lines[i].trim();
  if (!raw) continue;
  const [base, flagstr] = raw.split('/');
  const word = base.normalize('NFC');
  if (!word) continue;
  forms.add(word);
  if (flagstr) {
    const baseSub = hasSub(word);
    for (const gen of applyRules(word, [...flagstr])) {
      const g = gen.normalize('NFC');
      // αρχαΐζουσες δοτικές (-ῃ/-ᾳ) που γεννά το aff: εκτός — μονοτονικό input δεν τις εννοεί
      if (!baseSub && hasSub(g)) { dativesSkipped++; continue; }
      forms.add(g);
    }
  }
}

// ---- Build map ----
const map = new Map(); // mono key -> Set(poly)
const identity = new Set(); // κλειδιά όπου υπάρχει τύπος ταυτόσημος με το μονοτονικό
function addKey(key, poly) {
  if (key === poly) { identity.add(key); return; }
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(poly);
}

// συνίζηση: δισύλλαβη γραφή που προφέρεται μονοσύλλαβα (ποιος, μια, πιο) — άτονη στο μονοτονικό
const SYNIZESIS = /^[^αεηιουω]*(οι|ει|ι|υ)[αοευωη]/;

let withVaria = 0;
for (const poly of forms) {
  if (poly.normalize('NFD').includes(VARIA)) { withVaria++; continue; } // runtime δουλειά
  const mono = toMonotonic(poly);
  addKey(mono, poly);
  const clusters = vowelClusterCount(mono);
  const bare = stripAccent(mono);
  if (bare !== mono) {
    // μονοσύλλαβα: το μονοτονικό τα γράφει άτονα (γη, πας, φως)
    if (clusters === 1) addKey(bare, poly);
    // συνίζηση: ποιός->ποιος, μιά->μια
    else if (clusters === 2 && SYNIZESIS.test(bare.toLowerCase())) addKey(bare, poly);
  }
}

const obj = {};
let collisions = 0;
const samples = [];
for (const [mono, set] of map) {
  const arr = [...set];
  if (identity.has(mono)) arr.unshift(mono); // ο ταυτόσημος τύπος είναι κι αυτός υποψήφιος
  if (arr.length > 1) {
    collisions++;
    if (samples.length < 20) samples.push(`${mono} -> ${arr.join(' | ')}`);
  }
  obj[mono] = arr.length === 1 ? arr[0] : arr;
}

writeFileSync('lexicon.json', JSON.stringify(obj));
console.log(`expanded forms: ${forms.size} (+${withVaria} βαρεία-variants skipped)`);
console.log(`keys stored: ${map.size}, collisions: ${collisions}`);
console.log(samples.join('\n'));
