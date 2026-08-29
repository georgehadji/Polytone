import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { polytonize, hasPolytonicMark } from './engine.mjs';
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
inv('χωρὶς legacy oxia στὴν ἔξοδο',
  !/[άέήίόύώΆΈΉΐΊΰΎΌΏ]/.test(once));

// γενικό smoke: μεγάλο δείγμα από lexicon δεν σκάει
const sample = 'Η δημοκρατία είναι το πολίτευμα στο οποίο η εξουσία πηγάζει από τον λαό.';
const r = polytonize(sample, lexicon);
console.log('smoke:', r.text);
assert(hasPolytonicMark(r.text));
process.exit(fail ? 1 : 0);
