import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { polytonize, hasPolytonicMark, convertDocxXml, DOCX_PARTS } from './engine.mjs';
import assert from 'node:assert';

const rel = (p) => join(dirname(fileURLToPath(import.meta.url)), p);
const lexicon = JSON.parse(readFileSync(rel('lexicon.json'), 'utf8'));
const conv = (s) => polytonize(s, lexicon).text;

const cases = [
  // άρθρα + δασεία + βαρεία
  ['ο ήλιος και η θάλασσα', 'ὁ ἥλιος καὶ ἡ θάλασσα'],
  // βαρεία πριν από λέξη, οξεία πριν από στίξη
  ['ο ουρανός είναι ψηλά.', 'ὁ οὐρανὸς εἶναι ψηλά.'],
  // εγκλιτικό: άτονο κτητικό, οξεία μένει
  ['ο φίλος μου', 'ὁ φίλος μου'],
  // έγκλιση τόνου: προπαροξύτονη + εγκλιτικό
  ['ο δάσκαλός μου', 'ὁ δάσκαλός μου'],
  // που αναφορικό = βαρεία πάντα, πού ερωτηματικό = περισπωμένη
  ['το σπίτι που μένω', 'τὸ σπίτι ποὺ μένω'],
  ['πού πας;', 'ποῦ πᾶς;'],
  // γιατί ερωτηματικό κρατά οξεία, αιτιολογικό βαρεία
  ['γιατί έφυγες;', 'γιατί ἔφυγες;'],
  // mixed: πολυτονικές λέξεις μένουν
  ['ὁ οὐρανὸς και η γη', 'ὁ οὐρανὸς καὶ ἡ γῆ'],
  // ΚΕΦΑΛΑΙΑ άθικτα
  ['ΕΛΛΑΣ', 'ΕΛΛΑΣ'],
  // τί ερωτηματικό: ποτέ βαρεία
  ['τι θέλεις εσύ;', 'τί θέλεις ἐσύ;'],
  // αρκτικό υ -> δασεία
  ['υβριδιο', 'ὑβριδιο'],
  ['Υβριδιο', 'Ὑβριδιο'],
  ['Υμπλαξ', 'Ὑμπλαξ'], // ήταν Υ+U+0313: μάρκα χωρίς προσυντεθειμένο τύπο (U+1F58 κενό)
  ['αυτομπλα', 'αὐτομπλα'], // δίφθογγος αυ- κρατά ψιλή — ο κανόνας που έσπασε η Koronis
  ['ευμπλα', 'εὐμπλα'],
  ['ουμπλα', 'οὐμπλα'],
  ['υιμπλα', 'υἱμπλα'], // υι-: δασεία στο ι, μέσω του υπάρχοντος κλάδου διψήφου
  ['Ηνέθη', 'ᾘνέθη'], // κεφαλαίο + υπογεγραμμένη (ήταν 'ἨΙνέθη')
];

let pass = 0, fail = 0;
for (const [input, expected] of cases) {
  const got = conv(input);
  if (got === expected) { pass++; }
  else { fail++; console.log(`FAIL: "${input}"\n  θέλω: "${expected}"\n  πήρα: "${got}"`); }
}
console.log(`${pass}/${cases.length} pass`);

// ---- Invariants ----
const inv = (name, ok) => { if (ok) pass++; else { fail++; console.log(`FAIL invariant: ${name}`); } };

const smp = 'Ο οὐρανός εἶναι ψηλά καὶ ὁ δάσκαλος μου λέει γιατί. Πρώτον· δεύτερον.';
const R = polytonize(smp, lexicon), once = R.text;

inv('ἰδιοδυναμία', conv(once) === once);
inv('NFC στὴν ἔξοδο', once === once.normalize('NFC'));
inv('NFD input == NFC input', conv(smp.normalize('NFD')) === once);
inv('tokens ⊂ text', R.tokens.every((t) => once.includes(t.out)));
const s6 = polytonize('ο δάσκαλος μου', lexicon);
inv('tokens ⊂ text (ἔγκλιση)', s6.tokens.every((t) => s6.text.includes(t.out)));

// Ὅλοι οἱ NFC-σταθεροὶ προσυντεθειμένοι ἑλληνικοὶ χαρακτῆρες πάνω στὶς 8 βάσεις καὶ τὶς
// 7 μάρκες: ἡ κεφαλαιοποίηση δὲν ἐπιτρέπεται νὰ προσθέσει/ἀφαιρέσει γράμμα ἢ μάρκα.
// Παράγεται ἀπὸ τοὺς πίνακες τοῦ runtime — κανένα ξένο fixture.
const SWEEP_BASES = 'αεηιουωρΑΕΗΙΟΥΩΡ';
const SWEEP_MARKS = new Set(['̓', '̔', '̈', '́', '̀', '͂', 'ͅ']);
const bare = (s) => [...s.normalize('NFD')].filter((c) => !/\p{M}/u.test(c)).length;
const mset = (s) => [...s.normalize('NFD')].filter((c) => /\p{M}/u.test(c)).sort().join('');
let swept = 0, sweepBad = 0;
for (const [lo, hi] of [[0x0370, 0x03FF], [0x1F00, 0x1FFF]]) {
  for (let cp = lo; cp <= hi; cp++) {
    const ch = String.fromCodePoint(cp);
    if (ch.normalize('NFC') !== ch) continue;
    const d = [...ch.normalize('NFD')];
    if (d.length < 2 || !SWEEP_BASES.includes(d[0]) || !d.slice(1).every((m) => SWEEP_MARKS.has(m))) continue;
    swept++;
    const val = ch + 'βαβα'; // 3 συστάδες: τὸ post-pass βαρείας τὸ προσπερνᾶ
    const out = polytonize('Αβαβα', { 'αβαβα': val }).text;
    if (bare(out) !== 5 || mset(out) !== mset(val)) {
      sweepBad++;
      if (sweepBad <= 3) console.log(`FAIL sweep: ${ch} -> ${out}`);
    }
  }
}
inv(`reverse sweep (${swept} χαρακτῆρες)`, sweepBad === 0);

// ---- .docx codec ----
const dx = convertDocxXml('<w:t>Ο &quot;λόγος&quot; &amp; το &#8217; και &lt;tag&gt;</w:t>', lexicon);
inv('docx: καμία διπλή διαφυγή', !dx.includes('&amp;quot;') && !dx.includes('&amp;#8217'));
inv('docx: ιδιοδυναμία', convertDocxXml(dx, lexicon) === dx);
inv('docx: το markup μένει άθικτο', dx.startsWith('<w:t>') && dx.endsWith('</w:t>'));

const dxBad = convertDocxXml('<w:t>a&#0;b &#xD800; &#13; ο</w:t>', lexicon);
inv('docx: κανένας παράνομος XML χαρακτήρας', ![...dxBad].some((c) => {
  const cp = c.codePointAt(0);
  return (cp < 0x20 && cp !== 0x9 && cp !== 0xA) || (cp >= 0xD800 && cp <= 0xDFFF);
}));
inv('docx: <w:tab/> δεν πιάνεται',
  convertDocxXml('<w:tab/>ουρανος</w:t>', lexicon) === '<w:tab/>ουρανος</w:t>');
inv('DOCX_PARTS αγκυρωμένο', DOCX_PARTS.test('word/comments.xml')
  && !DOCX_PARTS.test('x/word/document.xml') && !DOCX_PARTS.test('word/document.xml.evil'));

// Το Word κόβει runs στη μέση λέξης (rsid, ορθογράφος). Μετατροπή ανά <w:t> τόνιζε
// τα κομμάτια σαν χωριστές λέξεις: π|ας -> π|ἄς. Πραγματικό .docx: 358 τέτοια σπασίματα.
const SPLIT = '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>π</w:t></w:r>'
  + '<w:r><w:rPr><w:b/></w:rPr><w:t>ας</w:t></w:r></w:p>';
const splitOut = convertDocxXml(SPLIT, lexicon);
const tText = (x) => [...x.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
inv('docx: λέξη σπασμένη σε δύο runs ενώνεται',
  tText(splitOut) === 'πᾶς');
inv('docx: κανένα κομμάτι δεν τονίζεται μόνο του',
  !splitOut.includes('ἄς'));
inv('docx: ιδιοδυναμία στο σπασμένο run', convertDocxXml(splitOut, lexicon) === splitOut);

// Ό,τι δεν είναι όριο run σπάει το chunk: το κείμενο δεν είναι συνεχόμενο.
for (const [name, sep] of [['<w:br/>', '<w:br/>'], ['<w:tab/>', '<w:tab/>'],
  ['όριο παραγράφου', '</w:p><w:p>'], ['σύμβολο', '<w:sym w:font="Wingdings" w:char="F0E0"/>']]) {
  const xml = '<w:p><w:r><w:t>π</w:t></w:r>' + sep + '<w:r><w:t>ας</w:t></w:r></w:p>';
  inv(`docx: ${name} σπάει το chunk`, tText(convertDocxXml(xml, lexicon)) !== 'πᾶς');
}

// ---- Bundle execution (αντικαθιστά byte-equality) ----
const win = {};
new Function('window', readFileSync(rel('web/engine.browser.js'), 'utf8'))(win);
inv('bundle εκτελείται και εκθέτει το API — τρέξε: npm run build:web',
  typeof win.Polytone?.polytonize === 'function' && typeof win.Polytone?.convertDocxXml === 'function');
inv('bundle συμφωνεί με τη μηχανή',
  win.Polytone.polytonize('ο ήλιος και η θάλασσα', lexicon).text === conv('ο ήλιος και η θάλασσα'));

// ---- CLI smoke ----
const cliOut = JSON.parse(execFileSync(process.execPath, [rel('cli.mjs'), '--json'],
  { input: 'ο ήλιος', encoding: 'utf8' }));
inv('CLI --json σχήμα + exit 0',
  cliOut.text === 'ὁ ἥλιος' && ['text', 'unknown', 'ambiguous', 'guessed'].every((k) => k in cliOut));

inv('χωρὶς legacy oxia στὴν ἔξοδο',
  !/[άέήίόύώΆΈΉΐΊΰΎΌΏ]/.test(once));

// γενικό smoke: μεγάλο δείγμα από lexicon δεν σκάει
const sample = 'Η δημοκρατία είναι το πολίτευμα στο οποίο η εξουσία πηγάζει από τον λαό.';
const r = polytonize(sample, lexicon);
console.log('smoke:', r.text);
assert(hasPolytonicMark(r.text));
process.exit(fail ? 1 : 0);
