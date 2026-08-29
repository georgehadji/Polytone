// Polytone engine: monotonic/mixed Greek -> polytonic. Pure functions, no IO.
// Works in Node and browser (ESM).

const OXIA = '́', VARIA = '̀', PSILI = '̓', DASIA = '̔';
const POLY_MARKS = /[̀̓̔͂ͅ]/; // βαρεία, ψιλή, δασεία, περισπωμένη, ὑπογεγραμμένη (NFD)
const GREEK = /[Ͱ-Ͽἀ-῿]/;
const VOWELS = 'αεηιουωΑΕΗΙΟΥΩ';
const DIPHTHONGS = new Set(['αι', 'ει', 'οι', 'υι', 'αυ', 'ευ', 'ου', 'ηυ']);

// ---- Function-word tables (Τριανταφυλλίδης / κανόνες χρήστη §6-§7) ----
// Άτονα mono -> polytonic βάση με οξεία (η βαρεία μπαίνει στο post-pass).
const OVERRIDES = new Map(Object.entries({
  // άρθρα: ὁ ἡ οἱ αἱ άτονα με δασεία· υπόλοιπα τονισμένα
  'ο': 'ὁ', 'η': 'ἡ', 'οι': 'οἱ', 'αι': 'αἱ',
  'του': 'τοῦ', 'της': 'τῆς', 'των': 'τῶν',
  'τον': 'τόν', 'την': 'τήν', 'το': 'τό', 'τα': 'τά',
  'τους': 'τούς', 'τις': 'τίς', 'τες': 'τές',
  'στον': 'στόν', 'στην': 'στήν', 'στο': 'στό', 'στα': 'στά',
  'στου': 'στοῦ', 'στης': 'στῆς', 'στων': 'στῶν', 'στους': 'στούς', 'στις': 'στίς',
  // μόρια/σύνδεσμοι/προθέσεις (άτονα στο μονοτονικό, τονισμένα στο πολυτονικό)
  'να': 'νά', 'θα': 'θά', 'δε': 'δέ', 'δεν': 'δέν', 'μη': 'μή', 'μην': 'μήν',
  'με': 'μέ', 'σε': 'σέ', 'ως': 'ὡς', 'αν': 'ἄν', 'κι': 'κι', 'και': 'καί',
  'για': 'γιά', 'προς': 'πρός', 'σαν': 'σάν', 'ας': 'ἄς', 'μα': 'μά',
  'εκ': 'ἐκ', 'εξ': 'ἐξ', 'εν': 'ἐν', 'επί': 'ἐπί', 'υπό': 'ὑπό', 'υπέρ': 'ὑπέρ',
  // που/πως: πάντα βαρεία (κανόνας §6στ)· πού/πώς: περισπωμένη
  'που': 'πού', 'πως': 'πώς', 'πού': 'ποῦ', 'πώς': 'πῶς',
  'ή': 'ἤ', 'ό,τι': 'ὅ,τι', 'τι': 'τί',
  // υψίσυχνες που αλλιώς βγαίνουν ψευτο-διφορούμενες από το λεξικό
  'είναι': 'εἶναι', 'ήταν': 'ἦταν', 'είχε': 'εἶχε', 'είχα': 'εἶχα', 'είπε': 'εἶπε',
}));

// Οξύτονες που παίρνουν βαρεία ΚΑΙ πριν από στίξη (ποὺ/πὼς αναφορικά, §6στ)
const ALWAYS_VARIA = new Set(['πού', 'πώς']);

// Εγκλιτικά: άτονα ΜΕΤΑ από λέξη-ξενιστή (κτητικά/αδύνατοι τύποι μετά από ουσιαστικό/ρήμα).
const ENCLITICS = new Set(['μου', 'σου', 'του', 'της', 'μας', 'σας', 'τους',
  'με', 'σε', 'τον', 'την', 'το', 'τα', 'τις', 'τες', 'τος', 'τοι']);
// ponytail: χωρίς POS tagger, θέση = heuristic.
// μου/σου/μας/σας μετά από λέξη -> άτονα κτητικά· αλλιώς τονισμένα (μοῦ εἶπε).
const POSSESSIVES = new Set(['μου', 'σου', 'μας', 'σας']);
// του/τον/... : άρθρα (τονισμένα) μόνο όταν ακολουθεί λέξη· αλλιώς κτητικά/άτονα.
const ARTICLE_LIKE = new Set(['του', 'της', 'των', 'τον', 'την', 'το', 'τα', 'τις', 'τους', 'τες']);

// Λέξεις που κρατούν οξεία και δεν παίρνουν ποτέ βαρεία (ερωτηματικό τί).
const NEVER_VARIA = new Set(['τί']);

// ---- Helpers (NFD-based) ----
const nfd = (s) => s.normalize('NFD');
const nfc = (s) => s.normalize('NFC');

function hasPolytonicMark(word) {
  return POLY_MARKS.test(nfd(word));
}

function isGreek(token) {
  return GREEK.test(token);
}

// Θέσεις φωνηεντικών συστάδων (συλλαβικοί πυρήνες, προσέγγιση με δίψηφα).
// Επιστρέφει array από [startIdx, endIdx) πάνω στο NFD string, μόνο βασικά γράμματα.
function vowelClusters(w) {
  const clusters = [];
  let i = 0;
  while (i < w.length) {
    const ch = w[i];
    if (VOWELS.includes(ch.toLowerCase()) || VOWELS.includes(ch)) {
      let j = i, end = i + 1;
      // μάζεψε combining marks
      while (end < w.length && /\p{M}/u.test(w[end])) end++;
      // δίψηφο; κοίτα επόμενο φωνήεν χωρίς διαλυτικά
      if (end < w.length) {
        const next = w[end];
        const pair = (ch + next).toLowerCase();
        if (DIPHTHONGS.has(pair)) {
          let e2 = end + 1;
          let hasDialytika = false;
          while (e2 < w.length && /\p{M}/u.test(w[e2])) {
            if (w[e2] === '̈') hasDialytika = true;
            e2++;
          }
          if (!hasDialytika) end = e2;
        }
      }
      clusters.push([j, end]);
      i = end;
    } else i++;
  }
  return clusters;
}

// -1 αν άτονη, αλλιώς index συλλαβής από το ΤΕΛΟΣ (0=λήγουσα, 1=παραλήγουσα, 2=προπαραλήγουσα)
function accentPosition(word) {
  const w = nfd(word);
  const cl = vowelClusters(w);
  for (let k = 0; k < cl.length; k++) {
    const seg = w.slice(cl[k][0], cl[k][1]);
    if (seg.includes(OXIA) || seg.includes(VARIA) || seg.includes('͂')) {
      return cl.length - 1 - k;
    }
  }
  return -1;
}

// Οξεία στη λήγουσα -> βαρεία
function oxiaToVaria(word) {
  const w = nfd(word);
  const cl = vowelClusters(w);
  if (!cl.length) return word;
  const [s, e] = cl[cl.length - 1];
  const seg = w.slice(s, e);
  if (!seg.includes(OXIA)) return word;
  return nfc(w.slice(0, s) + seg.replace(OXIA, VARIA) + w.slice(e));
}

// Πρόσθεσε οξεία στη λήγουσα (για έγκλιση τόνου: ὁ δάσκαλός μου)
function addFinalOxia(word) {
  const w = nfd(word);
  const cl = vowelClusters(w);
  if (!cl.length) return word;
  const [s, e] = cl[cl.length - 1];
  const seg = w.slice(s, e);
  if (seg.includes(OXIA) || seg.includes(VARIA) || seg.includes('͂')) return word;
  // τόνος στο τελευταίο φωνήεν της συστάδας, μετά τα υπάρχοντα marks
  return nfc(w.slice(0, s) + seg + OXIA + w.slice(e));
}

function isAllCaps(word) {
  return word === word.toUpperCase() && word !== word.toLowerCase() && word.length > 1;
}

function startsWithVowel(word) {
  const first = nfd(word)[0];
  return first !== undefined && VOWELS.includes(first.toLowerCase());
}

// Πνεύμα στο αρκτικό φωνήεν (default για άγνωστες φωνηεντόληκτες, §7α)
function addBreathing(word) {
  const w = nfd(word);
  const cl = vowelClusters(w);
  if (!cl.length || cl[0][0] !== 0) return word;
  let [s, e] = cl[0];
  const seg = w.slice(s, e);
  const letters = [...seg].filter((c) => !/\p{M}/u.test(c));
  // Αρκτικό ύψιλον παίρνει πάντα δασεία (κάθε γραμματική της αρχαίας· λ.χ. ὕδωρ, ὑπέρ, ὑγιής).
  // Κριτήριο = το ΠΡΩΤΟ γράμμα της συστάδας, όχι η λέξη: αυ-/ευ-/ου- κρατούν ψιλή
  // (letters[0] = α/ε/ο), υι- παίρνει δασεία στο ι.
  const mark = letters[0].toLowerCase() === 'υ' ? DASIA : PSILI;
  // δίψηφο: μάρκα στο δεύτερο φωνήεν· αλλιώς στο πρώτο. Marks πάνε αμέσως μετά το γράμμα.
  if (letters.length === 2) {
    const idx = seg.indexOf(letters[1]);
    return nfc(seg.slice(0, idx + 1) + mark + seg.slice(idx + 1) + w.slice(e));
  }
  return nfc(seg[0] + mark + seg.slice(1) + w.slice(e));
}

// Επιλογή από πολλαπλούς υποψηφίους: προτίμα χωρίς ὑπογεγραμμένη (νεοελληνική χρήση)
function pickCandidate(cands) {
  const noSub = cands.filter((c) => !nfd(c).includes('ͅ'));
  const pool = noSub.length ? noSub : cands;
  return { pick: pool[0], ambiguous: cands.length > 1 && noSub.length !== 1 };
}

function matchCase(result, original) {
  if (!result) return result;
  if (original[0] !== original[0].toLowerCase()) {
    // .toUpperCase() σε προσυντεθειμένο NFC γράμμα ΕΠΕΚΤΕΙΝΕΙ: 'ᾳ' -> 'ΑΙ', 'ᾁ' -> 'ἉΙ'.
    // Κεφαλαιοποιούμε το ΒΑΣΙΚΟ γράμμα σε NFD και ξανασυνθέτουμε: 'ᾳ' -> 'ᾼ'.
    // Όπου δεν υπάρχει προσυντεθειμένος τύπος (ῆ -> Η͂) μένει έγκυρη NFC ακολουθία —
    // καμία μάρκα δεν πέφτει (αντίθετα από την πολιτική πληκτρολογίου).
    const w = nfd(result);
    return nfc(w[0].toUpperCase() + w.slice(1));
  }
  return result;
}

// ---- Main ----
// lexicon: { mono: poly | [poly, ...] }
// returns { text, tokens: [{word, out, status}] } — status: ok|skipped|unknown|ambiguous|guessed
function polytonize(text, lexicon) {
  const src = nfc(text);
  // tokens: ελληνικές λέξεις (γράμματα+marks, με ' για ό,τι δεν πιάνουμε) και ο,τιδήποτε άλλο
  const parts = src.split(/([\p{Script=Greek}̀-ͅ]+(?:,τι)?)/u);
  const report = [];
  const words = []; // indices στο parts που είναι ελληνικές λέξεις

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1 && isGreek(parts[i])) words.push(i);
  }

  for (let wi = 0; wi < words.length; wi++) {
    const idx = words[wi];
    const word = parts[idx];
    let out = word, status = 'ok';

    if (isAllCaps(word)) {
      status = 'skipped'; // ΚΕΦΑΛΑΙΑ: χωρίς τόνους/πνεύματα (§48δ)
    } else if (hasPolytonicMark(word)) {
      status = 'skipped'; // ήδη πολυτονική (mixed κείμενο)
    } else {
      const lower = word.toLowerCase();
      const override = OVERRIDES.get(lower);
      if (POSSESSIVES.has(lower) && wi > 0 && isBefore(parts, idx, words[wi - 1])) {
        // εγκλιτικό κτητικό μετά από λέξη: μένει άτονο (ὁ φίλος μου)
        out = word;
        // έγκλιση τόνου (§43.2): προπαροξύτονος/προπερισπώμενος ξενιστής παίρνει δεύτερο τόνο
        const prevIdx = words[wi - 1];
        const prev = parts[prevIdx];
        const pos = accentPosition(prev);
        if (pos === 2 || (pos === 1 && nfd(prev).includes('͂'))) {
          parts[prevIdx] = addFinalOxia(prev);
          report[wi - 1].out = parts[prevIdx]; // αλλιώς tokens[] ≠ text
        }
      } else if (override !== undefined) {
        out = matchCase(override, word);
        if (ARTICLE_LIKE.has(lower)) {
          // άρθρο μόνο αν ακολουθεί λέξη στην ίδια φράση· αλλιώς κτητικό/αντωνυμία: άτονο
          const nextI = words[wi + 1];
          if (nextI === undefined || !isBefore(parts, nextI, idx)) out = word;
        }
      } else {
        // own-property μόνο: lexicon['constructor'] ή ρυπασμένο Object.prototype
        // δεν πρέπει να περάσει για λήμμα.
        const raw = Object.hasOwn(lexicon, word) ? lexicon[word]
          : Object.hasOwn(lexicon, lower) ? lexicon[lower] : undefined;
        const hit = (typeof raw === 'string' || Array.isArray(raw)) ? raw : undefined;
        if (hit !== undefined) {
          if (Array.isArray(hit)) {
            const { pick, ambiguous } = pickCandidate(hit);
            out = matchCase(pick, word);
            if (ambiguous) status = 'ambiguous';
          } else {
            out = matchCase(hit, word);
          }
        } else {
          // Άγνωστη λέξη. Διπλοτονισμένη (δάσκαλός μου στο μονοτονικό); δοκίμασε βάση.
          const double = doubleAccented(word);
          if (double) {
            const baseHit = lexicon[double.base] ?? lexicon[double.base.toLowerCase()];
            if (baseHit !== undefined) {
              const pick = Array.isArray(baseHit) ? pickCandidate(baseHit).pick : baseHit;
              out = addFinalOxia(matchCase(pick, word));
            } else {
              out = word;
            }
          } else if (startsWithVowel(word)) {
            out = addBreathing(word); // §7α: οι περισσότερες παίρνουν ψιλή
            status = 'guessed';
          } else {
            // σύμφωνο-αρχική: ταυτότητα. Unknown μόνο αν θα μπορούσε να θέλει περισπωμένη
            // (μακρόχρονο η/ω/δίφθογγος σε τονισμένη λήγουσα/παραλήγουσα) — αλλιώς σίγουρη.
            // ponytail: χάνεται πιθανή περισπωμένη σπάνιας λέξης· λεξικό καλύπτει τα συνήθη.
            status = circumflexPossible(word) ? 'unknown' : 'ok';
          }
        }
      }
      parts[idx] = out;
    }
    report.push({ word, out: parts[idx], status, index: idx });
  }

  // ---- Post-pass: βαρεία (§6α) ----
  for (let wi = 0; wi < words.length; wi++) {
    const idx = words[wi];
    const w = parts[idx];
    if (!isGreek(w) || isAllCaps(w)) continue;
    if (accentPosition(w) !== 0) continue; // μόνο οξύτονες
    if (!nfd(w).includes(OXIA)) continue;
    const lowerW = w.toLowerCase().normalize('NFC');
    if (NEVER_VARIA.has(lowerW)) continue;
    // γιατί: ερωτηματικό (πρόταση με ερωτηματικό) κρατά οξεία· αιτιολογικό παίρνει
    // βαρεία ΠΑΝΤΑ, ακόμα και πριν από κόμμα (§6β)
    if (lowerW === 'γιατὶ' || lowerW === 'γιατί') {
      const sentence = sentenceAfter(parts, idx + 1);
      if (/[;;?]/.test(sentence)) continue; // ερωτηματική πρόταση -> οξεία
      parts[idx] = oxiaToVaria(w);
      report[wi].out = parts[idx];
      continue;
    }
    // τι ακολουθεί; στίξη -> μένει οξεία. Εγκλιτικό (άτονο) -> μένει οξεία. Αλλιώς βαρεία.
    const nextIdx = words[wi + 1];
    if (!ALWAYS_VARIA.has(lowerW)) {
      if (nextIdx === undefined) continue; // τέλος κειμένου
      const between = parts.slice(idx + 1, nextIdx).join('');
      if (/[.,;:!·;…»)\]}—–?\n]/.test(between)) continue; // στίξη/νέα γραμμή μετά
    }
    if (nextIdx !== undefined) {
      const next = parts[nextIdx];
      if (accentPosition(next) === -1 && ENCLITICS.has(nfc(nfd(next.toLowerCase()).replace(/[̓̔]/g, '')))) continue;
    }
    parts[idx] = oxiaToVaria(w);
    report[wi].out = parts[idx];
  }

  return { text: parts.join(''), tokens: report };
}

// κείμενο από startIdx μέχρι το πρώτο τέλος πρότασης (χωρίς join ολόκληρης της ουράς — O(απόσταση), όχι O(n))
function sentenceAfter(parts, startIdx) {
  let sentence = '';
  for (let i = startIdx; i < parts.length; i++) {
    const p = parts[i];
    const m = p.search(/[.!·…\n]/);
    if (m === -1) {
      sentence += p;
    } else {
      sentence += p.slice(0, m);
      break;
    }
  }
  return sentence;
}

// υπάρχει ΜΟΝΟ κενό ανάμεσα στην προηγούμενη λέξη και σε αυτήν (ίδια πρόταση);
function isBefore(parts, idx, prevIdx) {
  const between = parts.slice(prevIdx + 1, idx).join('');
  return /^\s+$/.test(between);
}

// δύο οξείες (μονοτονική γραφή εγκλιτικού: "ο δάσκαλός μου") -> {base: χωρίς τη 2η}
function doubleAccented(word) {
  const w = nfd(word);
  const accents = [...w.matchAll(/́/g)];
  if (accents.length !== 2) return null;
  const last = accents[1].index;
  return { base: nfc(w.slice(0, last) + w.slice(last + 1)) };
}

// θα μπορούσε η λέξη να θέλει περισπωμένη; (τονισμένο η/ω/δίφθογγος σε λήγουσα/παραλήγουσα)
function circumflexPossible(word) {
  const w = nfd(word);
  const cl = vowelClusters(w);
  for (let k = Math.max(0, cl.length - 2); k < cl.length; k++) {
    const seg = w.slice(cl[k][0], cl[k][1]);
    if (!seg.includes(OXIA)) continue;
    const letters = [...seg].filter((c) => !/\p{M}/u.test(c)).join('').toLowerCase();
    if (/[ηω]/.test(letters) || letters.length >= 2) return true; // μακρό ή δίφθογγος
  }
  return false;
}

// ---- .docx κειμενικά runs (καθαρή επεξεργασία string· το zip μένει στους callers) ----
const DOCX_PARTS =
  /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/;

const XML_ENTITY = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
// XML 1.0 Char production, χωρίς CR: το line-end normalisation θα το άλλαζε σε LF στο
// επόμενο parse, οπότε το αφήνουμε κωδικοποιημένο.
const isXmlChar = (cp) => cp === 0x9 || cp === 0xA
  || (cp >= 0x20 && cp <= 0xD7FF) || (cp >= 0xE000 && cp <= 0xFFFD)
  || (cp >= 0x10000 && cp <= 0x10FFFF);

// Αποκωδικοποιεί τις 5 προκαθορισμένες οντότητες + αριθμητικές αναφορές — ό,τι εκπέμπει
// το OOXML — και ξανακωδικοποιεί μόνο & < > (" και ' είναι νόμιμα σε XML text content).
// ponytail: άγνωστη οντότητα (&nbsp; από χειρόγραφο DTD) ξαναδιαφεύγει ως &amp;nbsp;·
// το ίδιο και μια αριθμητική αναφορά εκτός Char. Έγκυρο XML, όχι πιστό round-trip.
function xmlDecode(s) {
  return s.replace(/&(?:amp|lt|gt|quot|apos);|&#(?:[0-9]+|[xX][0-9A-Fa-f]+);/g, (m) => {
    const named = XML_ENTITY[m];
    if (named !== undefined) return named;
    const body = m.slice(2, -1);
    const cp = (body[0] === 'x' || body[0] === 'X')
      ? parseInt(body.slice(1), 16) : parseInt(body, 10);
    return isXmlChar(cp) ? String.fromCodePoint(cp) : m;
  });
}

const xmlEncode = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// ponytail: μετατροπή ανά <w:t> run — λέξη κομμένη σε δύο runs δεν πολυτονίζεται (σπάνιο).
function convertDocxXml(xml, lexicon) {
  return xml.replace(/(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g, (_, open, text, close) =>
    open + xmlEncode(polytonize(xmlDecode(text), lexicon).text) + close);
}

window.Polytone = { polytonize, hasPolytonicMark, convertDocxXml, DOCX_PARTS };
