import { readFileSync } from 'node:fs';
import { polytonize, hasPolytonicMark } from './engine.mjs';
import assert from 'node:assert';

const lexicon = JSON.parse(readFileSync('lexicon.json', 'utf8'));
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

// γενικό smoke: μεγάλο δείγμα από lexicon δεν σκάει
const sample = 'Η δημοκρατία είναι το πολίτευμα στο οποίο η εξουσία πηγάζει από τον λαό.';
const r = polytonize(sample, lexicon);
console.log('smoke:', r.text);
assert(hasPolytonicMark(r.text));
process.exit(fail ? 1 : 0);
