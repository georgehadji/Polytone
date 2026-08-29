# Verification record

Re-measured independently against the real tree before this plan was saved.
Node v24.14.0, Windows. Script: `verify_plan.mjs` (run `node verify_plan.mjs` from the repo root).

| Claim | Result |
|---|---|
| NFC composes all 9 Koronis defect targets (U+1F98, U+1F99, U+1FA8, U+1FA9, U+1FE4, U+1F50, U+1F54, U+1F52, U+1F56) | **confirmed**, 9/9 |
| `nfc('ά') === 'ά'` (legacy oxia folds to NFC) | **confirmed** |
| Zero legacy-oxia codepoints in `lexicon.json` | **confirmed** |
| **F1** `polytonize('Ηνέθη')` → `ἨΙνέθη` (spurious capital iota) | **confirmed** |
| **F1** sweep: `toUpperCase` expands letter count | **63 violations — confirmed exactly** |
| Sweep pool size | **209 — the plan's original number was right.** A same-session cross-check first flagged this as "207, not 209" using a *looser* scan (generic `\p{Script=Greek}` base test, Greek-Extended block only) that does not match the test actually implemented in `test.mjs` (base restricted to `αεηιουωρΑΕΗΙΟΥΩΡ`, marks restricted to the 7 named combining marks, **both** ranges `[0x370,0x3FF]` and `[0x1F00,0x1FFF]`). Running the real, implemented sweep gives **swept=209, bad=63** — reproduced live during S3, matching the original plan exactly. The "207" correction below is retracted; both are left visible so the error is traceable rather than quietly fixed. |
| `polytonize('Υμπλαξ')` → `U+03A5 U+0313` + μπλαξ, bare combining ψιλή | **confirmed** |
| U+1F58 unassigned (no precomposed Υ+ψιλή) | **confirmed** |
| **F5** `polytonize('ο δάσκαλος μου')`: text `ὁ δάσκαλός μου`, `tokens[1].out === 'δάσκαλος'` | **confirmed** |
| αὐ- / εὐ- / οὐ- keep ψιλή today (must survive the υ rule) | **confirmed**, 3/3 |
| υ-initial base entries in `dict/el-polyton.dic`: 18,965 δασεία vs 119 ψιλή = **99.38%** | **confirmed exactly** (167 further entries carry no breathing) |
| ρ-initial base entries: 4,556 plain, 1 δασεία, 0 ψιλή | **confirmed exactly** |
| `node test.mjs` → 10/10 pass | **confirmed** |
| `web/engine.browser.js` fresh against `engine.mjs` | **confirmed** |
| Working tree is not a git repository | **confirmed** |
| **F4** `lexicon[word] ?? lexicon[lower]` | **confirmed** at `engine.mjs:211` |
| **F2** entity codec duplicated and asymmetric | **confirmed** at `cli.mjs:45,47` and `web/index.html:113,115` |
| **F8** `zip.writeZip(target)` with unchecked target | **confirmed** at `cli.mjs:53` |
| **F11** `font-family: Georgia, 'Times New Roman', serif` | **confirmed** at `web/index.html:11` |

Not independently re-measured (accepted from the analysis run): the 1,136 affected
lexicon picks, the throughput numbers, the highlight timings, and the adm-zip
CVE-2026-39244 code path. Everything load-bearing for the *decision* was.

---

# Polytone × Koronis — Final Implementation Plan

**Baseline re-verified on the real tree, Node v24.14.0**: `node test.mjs` → `10/10 pass`, exit 0, 4.5 s. `web/engine.browser.js` is **currently byte-fresh** against `engine.mjs` (verified: stripped source + tail === bundle). The working directory is **not a git repository** — either `git init` first or apply the nine steps below as ordered patches; the sequencing argument is unchanged either way. Every measurement below was run, not reasoned.

---

## 1. Thesis — what is actually transferred

**Koronis's 512-row table is not the asset. `String.prototype.normalize` already is that table.**

Verified: `nfc('Η'+U+0313+U+0345)` → **U+1F98**, `nfc('Ω'+U+0314+U+0345)` → **U+1FA9**, `nfc('ρ'+U+0313)` → **U+1FE4**, `nfc('υ'+U+0313+U+0342)` → **U+1F56**; `nfc('\u1F71')` → **U+03AC**. NFC emits the correct character for every cell Koronis got wrong. Polytone normalises at every boundary, so all 9 defects and all 16 legacy-oxia codepoints are **already unreachable here** (measured: 0 occurrences of the 16 legacy codepoints anywhere in `lexicon.json`).

| Transferred | Not transferred |
|---|---|
| **One orthographic rule**: word-initial υ takes δασεία. Measured in `dict/el-polyton.dic` (base entries, split on `/`, first NFD mark): **18,965** υ-initial with δασεία vs **119** with ψιλή = 99.38%, and the 119 are one upstream typo family (`ὐπερετίμα`, `ὐπερετίμησα`…). | The 512-row table, `koronis_rules.json`, `verify_rows.json`, the transpiler. Decompiled proprietary 2014 code, no licence grant. **Nothing Koronis-derived enters the repo** — not as data, not as a fixture. |
| **One policy, as its negation**: never drop a mark; never emit a combining mark you could have precomposed. Both halves now bind — see the Υμπλαξ case below. | Koronis's drop policy. Forced on a keyboard that must emit one character; gratuitous in a converter. |
| **The correct scoping of the υ rule** — what Koronis got wrong. `lettery()` applied it context-blind by mutating ribbon state, destroying αὐ-/εὐ-/οὐ-. Polytone tokenizes words, so it *has* the boundary context Koronis lacked. | Ribbon, WH_KEYBOARD hook, 80 ms timer, XOR licensing, `Class3.shif`. Wrong product. |
| **The font-coverage problem** (not the probe). See §3.3 / §4 S12. | Koronis's two glyph probes (`PolytonicFontChecker.cs`, `FontSupport.cs`) and its ribbon font enforcement. |

**The policy's second half binds in exactly one live place**, and it is the strongest argument for the υ rule. Verified on the baseline: `polytonize('Υμπλαξ')` → `Υ̓μπλαξ` = **U+03A5 U+0313**, a bare combining ψιλή on capital upsilon, for which no precomposed form exists (U+1F58 is unassigned). Patched: **U+1F59** `Ὑμπλαξ`. The heuristic does not merely guess better — it removes the engine's only guaranteed-malformed output.

**Also in scope, because the Koronis audit surfaced them**: eleven confirmed defects in Polytone itself, each reproduced live in §4.

---

## 2. The Koronis rule specification, declaratively

Normative source: the 512-row product in `…\scratchpad\koronis\koronis_rules.json` and `rulemodel.txt`. Prose here describes structure only; nothing is copied.

**2.1 Marks** — ψιλή U+0313, δασεία U+0314, διαλυτικά U+0308, ὀξεία U+0301, βαρεία U+0300, περισπωμένη U+0342, ὑπογεγραμμένη U+0345.

**2.2 Exclusions** — `{ψιλή, δασεία, διαλυτικά}` pairwise exclusive; `{ὀξεία, βαρεία, περισπωμένη}` pairwise exclusive; ὑπογεγραμμένη free. 4 × 4 × 2 = 32 states × 16 letter functions = 512.

**2.3 Trigger** — input method. Thread-local `WH_KEYBOARD` hook records the VK, restarts an 80 ms timer, `letterfind()` overwrites the just-typed character. **Context-blind by construction: one character, never a word.** This is why nothing Koronis-derived can inform Polytone's context-dependent passes (βαρεία, ἔγκλιση).

**2.4 Base letters and case** — 8 keys α ε η ι ο υ ω ρ, each with a capital. Case as implemented is `CapsLock OR Shift`; correct is XOR, read at the keystroke rather than latched.

**2.5 Per-letter legality** (combination-level, not mark-level):
- **α η ω** lower: breathing × accent × ὑπογεγραμμένη, all encodable. Διαλυτικά illegal.
- **Α Η Ω**: as above, but περισπωμένη requires a breathing, and accent+ὑπογεγραμμένη requires a breathing.
- **ε ο Ε Ο**: breathing × {ὀξεία|βαρεία}. Short: no περισπωμένη, no ὑπογεγραμμένη.
- **ι**: {ψιλή|δασεία|διαλυτικά} × accent. No ὑπογεγραμμένη. **Ι**: as ι, but περισπωμένη requires a breathing and διαλυτικά+accent is unencodable.
- **υ**: {ψιλή|δασεία|διαλυτικά} × accent. *Koronis suppresses ψιλή — the defect.* **Υ**: {δασεία|διαλυτικά} × accent; ψιλή genuinely unencodable (U+1F58/5A/5C/5E unassigned).
- **ρ Ρ**: breathings only; Koronis implements only δασεία. ρ+ψιλή = U+1FE4 exists and is missing.

**2.6 Fallback** — never emits a combining mark, never more than one character (one exception, `letteryc` διαλυτικά+accent). Where no precomposed form exists, marks are dropped: letter-illegal first, then accent, then περισπωμένη, then διαλυτικά.

**2.7 The 9 defects** — `letterhc` ψιλή/δασεία+ὑπογεγραμμένη → U+1FCC instead of U+1F98/U+1F99; `lettervc` same → U+1FFC instead of U+1FA8/U+1FA9; `letterr` ψιλή → bare ρ instead of U+1FE4; `lettery` un-checks ψιλή on all four ψιλή states. All are *omissions* — branches nobody wrote. `letterac` has the rows `letterhc`/`lettervc` lack: copy-paste truncation.

**2.8 Output normalisation** — 16 of the 219 correct outputs use legacy 1F00-block singletons.

**2.9 Disposition**

| § | Fate in Polytone |
|---|---|
| 2.1–2.4 | Dropped. No toggle state, no keystroke, wrong product. |
| 2.5 | **Subsumed by `nfc(base+marks)`** except one line: the υ row, with Koronis's suppression *reversed*. |
| 2.6 | **Adopted as its negation** — never drop, never leave un-precomposed. |
| 2.7 | **Already unreachable** — the NFC boundary emits the correct codepoint. |
| 2.8 | **Already fixed** — 0 legacy codepoints in `lexicon.json`; `build_lexicon.mjs` returns NFC at every write site. |

---

## 3. Module-by-module design

### 3.1 `E:\Documents\Vibe-Coding\Polytone\engine.mjs` — hand-written

**Responsibility.** Absorbs every change except the shells. Five surgical edits + one new export block. 325 → ~370 lines; one file, zero imports, zero throws, zero classes, zero async.

**Exported interface**

```js
export function polytonize(text, lexicon): { text, tokens: Array<{word, out, status, index}> }
export function hasPolytonicMark(word): boolean
export function isGreek(token): boolean
// NEW:
export function convertDocxXml(xml: string, lexicon): string
export const DOCX_PARTS: RegExp
```

Status enum **unchanged** (`ok|skipped|guessed|ambiguous|unknown`). Renamed private: `addPsili` → `addBreathing` (one call site, engine.mjs:232). New privates: `isXmlChar`, `xmlDecode`, `xmlEncode`. **No `composeMark`, no `MARK_LEGAL`, no `MARK_DROP_ORDER`** — §7.2.

**E1 — `DASIA` const** (engine.mjs:4)

```js
const OXIA = '\u0301', VARIA = '\u0300', PSILI = '\u0313', DASIA = '\u0314';
```

**E2 — `addPsili` → `addBreathing`, one branch** (engine.mjs:136–150)

```js
// Πνεῦμα στὸ ἀρκτικὸ φωνῆεν (default γιὰ ἄγνωστες φωνηεντόληκτες, §7α)
function addBreathing(word) {
  const w = nfd(word);
  const cl = vowelClusters(w);
  if (!cl.length || cl[0][0] !== 0) return word;
  let [s, e] = cl[0];
  const seg = w.slice(s, e);
  const letters = [...seg].filter((c) => !/\p{M}/u.test(c));
  // Ἀρκτικὸ ὕψιλον παίρνει πάντα δασεία (κάθε γραμματικὴ τῆς ἀρχαίας· λ.χ. ὕδωρ, ὑπέρ, ὑγιής).
  // Κριτήριο = τὸ ΠΡΩΤΟ γράμμα τῆς συστάδας, ὄχι ἡ λέξη: αὐ-/εὐ-/οὐ- κρατοῦν ψιλή
  // (letters[0] = α/ε/ο), ὑι- παίρνει δασεία στὸ ι.
  const mark = letters[0].toLowerCase() === 'υ' ? DASIA : PSILI;
  if (letters.length === 2) {
    const idx = seg.indexOf(letters[1]);
    return nfc(seg.slice(0, idx + 1) + mark + seg.slice(idx + 1) + w.slice(e));
  }
  return nfc(seg[0] + mark + seg.slice(1) + w.slice(e));
}
```

and engine.mjs:232 → `out = addBreathing(word);`

**E3 — `matchCase`: uppercase the base letter under NFD** (engine.mjs:159–165)

```js
function matchCase(result, original) {
  if (!result) return result;
  if (original[0] !== original[0].toLowerCase()) {
    // .toUpperCase() σὲ προσυντεθειμένο NFC γράμμα ΕΠΕΚΤΕΙΝΕΙ: 'ᾳ' -> 'ΑΙ', 'ᾁ' -> 'ἉΙ'.
    // Κεφαλαιοποιοῦμε τὸ ΒΑΣΙΚΟ γράμμα σὲ NFD καὶ ξανασυνθέτουμε: 'ᾳ' -> 'ᾼ'.
    // Ὅπου δὲν ὑπάρχει προσυντεθειμένος τύπος (ῆ -> Η͂) μένει ἔγκυρη NFC ἀκολουθία —
    // καμία μάρκα δὲν πέφτει (ἀντίθετα ἀπὸ τὴν πολιτικὴ πληκτρολογίου).
    const w = nfd(result);
    return nfc(w[0].toUpperCase() + w.slice(1));
  }
  return result;
}
```

**E4 — patch the stale enclisis token** (after engine.mjs:201)

```js
          parts[prevIdx] = addFinalOxia(prev);
          report[wi - 1].out = parts[prevIdx];   // ἀλλιῶς tokens[] ≠ text
```

`report.length === wi` at that point, so `report[wi - 1]` always exists.

**E5 — own-property lexicon lookup** (engine.mjs:211)

```js
        // own-property μόνο: lexicon['constructor'] ἢ ρυπασμένο Object.prototype
        // δὲν πρέπει νὰ περάσει γιὰ λῆμμα.
        const raw = Object.hasOwn(lexicon, word) ? lexicon[word]
          : Object.hasOwn(lexicon, lower) ? lexicon[lower] : undefined;
        const hit = (typeof raw === 'string' || Array.isArray(raw)) ? raw : undefined;
```

A `typeof` guard alone does **not** close the class — verified live: with `Object.prototype['ουρανος']='ΠΩΝΗΡΟ'`, a `typeof`-guarded lookup returns `"ΠΩΝΗΡΟ"` to the user. `Object.hasOwn` is Node 16.9+/Chrome 93+, inside the project's floor.

**E6 — the .docx codec, new export block** (append after `circumflexPossible`)

```js
// ---- .docx κειμενικὰ runs (καθαρὴ ἐπεξεργασία string· τὸ zip μένει στοὺς callers) ----
export const DOCX_PARTS =
  /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/;

const XML_ENTITY = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
// XML 1.0 Char production, χωρὶς CR: τὸ line-end normalisation θὰ τὸ ἄλλαζε σὲ LF στὸ
// ἑπόμενο parse, ὁπότε τὸ ἀφήνουμε κωδικοποιημένο.
const isXmlChar = (cp) => cp === 0x9 || cp === 0xA
  || (cp >= 0x20 && cp <= 0xD7FF) || (cp >= 0xE000 && cp <= 0xFFFD)
  || (cp >= 0x10000 && cp <= 0x10FFFF);

// Ἀποκωδικοποιεῖ τὶς 5 προκαθορισμένες ὀντότητες + ἀριθμητικὲς ἀναφορές — ὅ,τι ἐκπέμπει
// τὸ OOXML — καὶ ξανακωδικοποιεῖ μόνο & < > (" καὶ ' εἶναι νόμιμα σὲ XML text content).
// ponytail: ἄγνωστη ὀντότητα (&nbsp; ἀπὸ χειρόγραφο DTD) ξαναδιαφεύγει ὡς &amp;nbsp;·
// τὸ ἴδιο καὶ μιὰ ἀριθμητικὴ ἀναφορὰ ἐκτὸς Char. Ἔγκυρο XML, ὄχι πιστὸ round-trip.
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

// ponytail: μετατροπὴ ἀνὰ <w:t> run — λέξη κομμένη σὲ δύο runs δὲν πολυτονίζεται (σπάνιο).
export function convertDocxXml(xml, lexicon) {
  return xml.replace(/(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g, (_, open, text, close) =>
    open + xmlEncode(polytonize(xmlDecode(text), lexicon).text) + close);
}
```

`<w:t(?:\s[^>]*)?>` rather than `<w:t[^>]*>`: verified, the loose form also matches `<w:tab/>`, `<w:tbl>`, `<w:tc>`. Unreachable in valid WordprocessingML, but the regex is moving *into* the file designated as the security boundary, and the tight form costs three characters. `DOCX_PARTS` gains `comments` — Word review comments are ordinary `<w:t>` runs and were silently left monotonic. (Correctly still excluded: `numbering.xml` uses `<w:lvlText>`; `commentsExtended.xml` carries no text.)

**Paradigm.** Pure, **total** functions over NFD strings, NFC at boundaries. Totality is not stylistic: `web/index.html`'s `convert()` (index.html:66–89) is called from a debounced `input` listener with no `try` anywhere; a throw there leaves a silently dead UI with no message. (The draft's CLI justification was wrong and is withdrawn — `new AdmZip(path)` does `readFileSync` eagerly, `updateFile` mutates only the in-memory object, and `writeZip` targets a different path, so a throw in that loop loses nothing on disk.) The file's universal failure idiom is `return word` unchanged (engine.mjs:108, 111, 119, 122, 140, and 160/164 inside `matchCase`); every new path preserves it — `xmlDecode` returns the raw match `m` rather than throwing.

**Pattern.** *Oracle delegation* — the 209-character Greek precomposition table ships inside every JS runtime, correct and version-maintained. Climbing to it is both the laziest and the only zero-defect option. Explicitly **not** Strategy, **not** Factory, **not** a table: a hand-written mark table is the exact artefact class whose defects this exercise exists to eliminate. Plus an *Anti-Corruption Layer* for the .docx codec — CONTRIBUTING.md:111 puts `.docx` XML in security scope, and a security boundary must exist in one place.

**Invariants preserved.** *Purity* — no IO, throw, state, async or import. *Zero deps.* *NFD/NFC* — `const src = nfc(text)` at engine.mjs:171 **stays**; see §7.2 for why the ἄνω τελεία change is rejected. *One engine, two hosts* — no `export default`, no top-level `await`, no `import()`; new top-level names `DASIA`, `DOCX_PARTS`, `XML_ENTITY`, `isXmlChar`, `xmlDecode`, `xmlEncode` collide with none of the 15 the file owns.

**Security properties, as proven rather than as hoped.** (1) *No letter loss and no letter gain* under capitalisation — measured over all 209 precomposed Greek base+mark characters: baseline **63 violations**, patched **0**, with 0 mark loss. (2) *No tag injection* — `&`, `<`, `>` are always re-encoded, so engine output can never open an element. (3) *Emitted XML contains no illegal character* — every decoded numeric reference passes the Char production; verified `&#0;`, `&#x1;`, `&#xD800;`, `&#xFFFE;`, `&#13;` all survive re-encoded rather than becoming NUL, a C0 control, a lone surrogate (which `Buffer.from(…, 'utf8')` would silently turn into U+FFFD) or a CR. This is *not* the same claim as "well-formedness guaranteed" and is not stated as one. (4) *No entity expansion* — a bounded finite substitution; no DTD is ever interpreted, so no XXE, no billion-laughs. (5) *No regex built from input*; both codec patterns are fixed and linear. (6) *Prototype-chain lookups closed* by E5. (7) *Idempotence preserved* — every new mark write sits inside `addBreathing`, downstream of the `hasPolytonicMark` guard at engine.mjs:188.

### 3.2 `E:\Documents\Vibe-Coding\Polytone\cli.mjs` — hand-written

**Responsibility.** Shrink to a zip shell. Delete `XML_TARGETS` (line 34) and the inline `<w:t>` replace with both escape chains (lines 43–49). Add `resolve` to the `node:path` import.

```js
import { polytonize, convertDocxXml, DOCX_PARTS } from './engine.mjs';

// ponytail: ὅρια πολιτικῆς γιὰ untrusted .docx. Ἡ adm-zip ἤδη φράζει τὸ inflate στὸ
// δηλωμένο μέγεθος (CVE-2026-39244)· αὐτὸ κατεβάζει τὸ ταβάνι ἀπὸ uint32 σὲ 64 MiB
// ἀνὰ part καὶ 256 MiB συνολικά (τὸ DOCX_PARTS δέχεται headerN/footerN χωρὶς ὅριο).
const MAX_PART_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

function convertDocx(path, out) {
  return import('adm-zip').then(({ default: AdmZip }) => {
    const zip = new AdmZip(path);
    let budget = MAX_TOTAL_BYTES;
    for (const entry of zip.getEntries()) {
      if (!DOCX_PARTS.test(entry.entryName)) continue;
      budget -= entry.header.size;
      if (entry.header.size > MAX_PART_BYTES || budget < 0) {
        throw new Error(`${entry.entryName}: ὑπερβαίνει τὸ ὅριο μεγέθους`);
      }
      const xml = entry.getData().toString('utf8');
      zip.updateFile(entry.entryName, Buffer.from(convertDocxXml(xml, lexicon), 'utf8'));
    }
    const target = out ?? path.replace(/\.docx$/i, '.poly.docx');
    // -o πάνω στὸ ἴδιο ἀρχεῖο θὰ ἔσβηνε ἀνεπίστρεπτα τὸ πρωτότυπο.
    if (resolve(target) === resolve(path)) {
      throw new Error('τὸ -o δείχνει στὸ ἴδιο ἀρχεῖο· δῶσε ἄλλη διαδρομή');
    }
    zip.writeZip(target);
    console.error(`γράφτηκε: ${target}`);
  });
}
```

**Interface.** No CLI surface change — flags, `--json` shape and exit codes are SemVer-covered (CHANGELOG.md:11) and stay identical, now pinned by a test for the first time (§5.6).

**Paradigm / pattern.** Imperative shell + *Adapter*. The lazy-import discipline at line 38 is load-bearing — it keeps the zero-runtime-dependency claim true for text conversion — and survives untouched. Both `throw`s land in the shell, where `main().catch()` at line 75 already turns them into a clean message and exit 1; the engine stays throw-free.

**Security, stated honestly.** `entry.header.size` is an attacker-declared uint32 read from CENLEN, so this bounds *declared* size, not actual expansion; and `new AdmZip(path)` has already read the whole archive into memory before the loop, so this is a per-part and per-document **policy cap**, not an ingestion bound. It is a real tightening (uint32 → 64 MiB) and nothing more. **Zip-slip is not present and must stay absent**: entry names are only regex-tested against an *anchored full-match*, never joined to a filesystem path, and nothing is extracted to disk.

### 3.3 `E:\Documents\Vibe-Coding\Polytone\web\index.html` — hand-written

Four changes, all measured.

**(a) Font stack** (index.html:11). Probed on this machine with WPF `GlyphTypeface` over U+1F28 U+1FBC U+1F98 U+1FE4 U+1F56 U+1F76: **Georgia is missing all six** (it has U+03B1, so monotonic renders and polytonic does not); Times New Roman, Palatino Linotype and Cambria have all six. The output pane — whose entire job is displaying polytonic — currently renders base letters in Georgia and every converted letter in a fallback face, at different metrics.

```css
  body { margin: 0; padding: 1.2rem; background: var(--bg); color: var(--ink);
         font-family: 'Palatino Linotype', 'Times New Roman', Georgia, serif; }
```

This is the correct translation of Koronis's font capability into a converter: zero JS, zero probing, zero dependency. **Deliberately not proposed**: any glyph probe, any `<w:rFonts>` rewriting.

**(b) Single-pass highlight** (index.html:73–88). The current loop compiles one RegExp per distinct flagged token and runs a full-text `replace` for each — O(distinct × length). Measured on 2,000 words with 500 distinct flagged neologisms: conversion 192 ms, **highlight 563 ms**. Replacement, verified byte-identical output, **10 ms**:

```js
  const marked = r.tokens.filter((t) => t.status !== 'ok' && t.status !== 'skipped');
  // ponytail: ἕνα πέρασμα, χάρτης out->status. Χρωματίζεται ΚΑΘΕ ἐμφάνιση σημαδεμένης
  // λέξης, ὄχι μόνο ἐκείνη ποὺ σημαδεύτηκε — ἴδια συμπεριφορὰ μὲ πρίν· ἀκριβὴς θέση
  // θὰ ἀπαιτοῦσε character offsets ἀπὸ τὴ μηχανή (αὔξηση δημόσιου API).
  const st = new Map(marked.map((t) => [t.out, t.status]));
  $('out').innerHTML = esc(r.text)
    .replace(/[\u0300-\u036F\u0370-\u03FF\u1F00-\u1FFF]+/gu, (w) => {
      const s = st.get(w);
      return s ? `<span class="${s}" title="${s}">${w}</span>` : w;
    });
```

`status` remains a closed set of five engine-controlled literals, so the `.unknown`/`.ambiguous`/`.guessed` CSS coupling (index.html:19–21) and the `title="${…}"` interpolation stay safe. Say so in a Greek comment there.

**(c) .docx branch: one codec, plus the error handling it never had** (index.html:105–130). `handleFile` is `async`, invoked as `e.target.files[0] && handleFile(…)` with no `.catch`; a corrupt, encrypted or non-Word file rejects into the void and the UI just stops.

```js
async function handleFile(f) {
  try {
    if (f.name.toLowerCase().endsWith('.docx')) {
      const zip = await JSZip.loadAsync(f);
      for (const name of Object.keys(zip.files).filter((n) => window.Polytone.DOCX_PARTS.test(n))) {
        const xml = await zip.file(name).async('string');
        // ponytail: ὅριο ΜΕΤΑ τὴν ἀποσυμπίεση — φράζει τὴν ἔξοδο, ὄχι τὴ μνήμη τῆς JSZip.
        if (xml.length > 64e6) throw new Error(`${name}: ὑπερβαίνει τὸ ὅριο μεγέθους`);
        zip.file(name, window.Polytone.convertDocxXml(xml, window.LEXICON));
      }
      /* …generateAsync / download ὅπως πρίν… */
    } else {
      $('in').value = await f.text();
      convert();
    }
  } catch (e) {
    $('status').textContent = 'σφάλμα ἀρχείου: ' + (e?.message ?? e);
  }
}
```

**(d) Attribution footer** — one line before `</body>`, since a served `web/` *is* the conveyance:

```html
<p class="legend">Polytone — GPL-3.0 (<a href="LICENSE.txt">ἄδεια</a>). Λεξικό: el-polyton,
© Α. Δεληγιάννη / The Polytonic Project (<a href="dict-LICENSE.txt">ἄδεια</a>).</p>
```

**Paradigm.** Imperative shell, *Adapter* mirroring `cli.mjs`. Classic scripts (index.html:58–60), so everything arrives as a global.

### 3.4 `E:\Documents\Vibe-Coding\Polytone\build_web.mjs` — hand-written

```js
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const BANNER = '/* Polytone — GPL-3.0. Τὸ λεξικὸ παράγεται ἀπὸ dict/el-polyton,\n' +
  '   © Α. Δεληγιάννη / The Polytonic Project. Ἡ ἀναφορὰ πρέπει νὰ διατηρεῖται\n' +
  '   σὲ κάθε ἀναδιανομή· βλ. web/LICENSE.txt καὶ web/dict-LICENSE.txt. */\n';

const lexicon = readFileSync('lexicon.json', 'utf8');
writeFileSync('web/lexicon.js', BANNER + 'window.LEXICON=' + lexicon + ';');

const engine = readFileSync('engine.mjs', 'utf8').replace(/^export /gm, '');
writeFileSync('web/engine.browser.js', BANNER + engine +
  '\nwindow.Polytone = { polytonize, hasPolytonicMark, convertDocxXml, DOCX_PARTS };\n');

copyFileSync('LICENSE', 'web/LICENSE.txt');
copyFileSync('dict/LICENSE.txt', 'web/dict-LICENSE.txt');
```

**Pattern.** *Concatenating linker with an explicit export allowlist.* The allowlist is not an accident to clean up — `isGreek` is genuinely exported at engine.mjs:55 and genuinely unreachable from the page, which is standing proof it does real work. Add exactly two names; resist generating the list from source.

**Security / licence.** Verified: `web/lexicon.js` currently begins `window.LEXICON={"Αιγίου":…`, `web/engine.browser.js` begins with the plain technical comment inherited from `engine.mjs`, `web/index.html` carries nothing, and `web/` has no LICENSE — while the one vendored third-party file, `web/jszip.min.js`, is the only artefact in the directory that *does* carry its licence header. README.md:229 states that serving the bundle is conveying the work, and README.md:69–70 promises `web/` works standalone from disk; the two copied files are what make that combination lawful.

### 3.5 `E:\Documents\Vibe-Coding\Polytone\test.mjs` — hand-written

Covered in §5.

### 3.6 `web/engine.browser.js`, `web/lexicon.js` — **generated**

Never hand-edited. **Current state re-measured: the bundle is byte-fresh** (stripped source + tail === file; `sentenceAfter` present). The draft's staleness finding is historical and its S1 is a no-op today — but the class it names is real and unguarded, so §5.5's *execution* check still lands. Regenerate whenever `engine.mjs` or `build_web.mjs` changes.

### 3.7 `E:\Documents\Vibe-Coding\Polytone\package.json` / `package-lock.json` — hand-written

Three edits, all forced by other steps:

```json
    "build": "node build_lexicon.mjs && node build_web.mjs",
    "build:web": "node build_web.mjs",
```

- `build:web` exists so §5.5's failure message can name a documented script instead of a raw node command. `npm run build` costs minutes and ~2 GB (CONTRIBUTING.md:24) and must not be what a contributor is told to run after touching `engine.mjs`.
- `version` → `1.1.0` at the end of the sequence; `CHANGELOG.md` gets a `## [1.1.0] - <date>` section and its link refs at CHANGELOG.md:56–57 updated to `compare/v1.1.0...HEAD` plus a `[1.1.0]` line. Two new exports and no changed status value = minor.
- `package-lock.json` declares the root package `"license": "ISC"` while `package.json` says `"GPL-3.0"` (verified in the checked-in lockfile). In a plan that treats a missing notice on `web/lexicon.js` as a compliance fix, a lockfile asserting a permissive licence for the GPL work is the same defect. Edit the one line (or `npm install` and commit the regenerated file).

### 3.8 `build_lexicon.mjs` and `dict/` — untouched

**Paradigm**: batch generator, run rarely, output committed. Its one relevant guarantee — no legacy-oxia codepoints reach `lexicon.json` — is not luck: `toMonotonic` returns `out.normalize('NFC')` (build_lexicon.mjs:18) and every generated and base form is `.normalize('NFC')`d before entering `forms` (lines ~94/100). NFC maps U+1F71 → U+03AC by definition, so the property is a consequence of the standard, not of a check. Measured: **0** legacy occurrences in the whole 37 MB file. No post-condition assert is added (§7.2). `dict/` is upstream and never hand-edited (CONTRIBUTING.md:34, 61–63).

---

## 4. Security and correctness findings — every one reproduced

| # | Finding | Verified evidence | Fix |
|---|---|---|---|
| **F1** | **Silent letter insertion on capitalisation.** `matchCase` calls `.toUpperCase()` on a precomposed NFC string; JS *expands*. The output word gains a letter. | `polytonize('Ηνέθη')` → `"ἨΙνέθη"` (U+1F28 **U+0399** U+03BD…). Reverse sweep: **63 of 209** precomposed base+mark characters violate letter-count. 1,136 lexicon picks affected, all ὑπογεγραμμένη combinations. | **E3.** After: `"ᾘνέθη"` (U+1F98). Sweep **0/209**, 0 mark loss, **0 picks made worse**. |
| **F2** | **`.docx` entity round-trip corruption.** Codec unescapes only `&amp; &lt; &gt;` but re-escapes every `&`. Duplicated verbatim in cli.mjs:45–47 and index.html:113–115. | `<w:t>Ο &quot;λόγος&quot; &amp; το &#8217;</w:t>` → `Ο &amp;quot;λόγος&amp;quot; &amp; το &amp;#8217;`. Corrupts on **every** pass. | **E6.** Verified output `<w:t>Ὁ "λόγος" &amp; το ’ καί &lt;tag&gt;</w:t>`, idempotent. |
| **F3** | **Illegal XML characters from numeric references** — new surface E6 would introduce if validated only as `0 ≤ cp ≤ 0x10FFFF`. | With the draft's guard: `&#0;`→NUL, `&#x1;`→U+0001, `&#xD800;`→lone surrogate (→U+FFFD via `Buffer.from`), `&#13;`→CR. Word refuses a document.xml containing any of these — a cosmetic bug upgraded to an unopenable file. | **`isXmlChar` in E6.** Verified: all five stay encoded, output contains no code point < 0x20 and no surrogate. |
| **F4** | **Prototype-chain lexicon lookup.** `lexicon[word] ?? lexicon[lower]` walks the chain. A `typeof` guard rejects only the accidental case. | `Object.prototype['ουρανος']='ΠΩΝΗΡΟ'` → `typeof`-guarded lookup returns `"ΠΩΝΗΡΟ"` to the user. Matters most in the browser, where a 95 KB third-party `jszip.min.js` shares the realm with `window.LEXICON`. | **E5** (`Object.hasOwn`). |
| **F5** | **`tokens[].out` disagrees with `text`.** The enclisis rule rewrites `parts[prevIdx]` after that word's report entry was pushed. | `polytonize('ο δάσκαλος μου')` → text `ὁ δάσκαλός μου`, `tokens[1].out === 'δάσκαλος'`. (Not reproducible with the already-double-accented `ο δάσκαλός μου` — that takes the `doubleAccented` branch.) | **E4**, mirroring engine.mjs:262/277. Verified fixed. |
| **F6** | **No automated coverage of the executed browser bundle.** A committed generated artefact no test imports and no build verifies. | Fresh today, but nothing enforces it, and byte-equality against a duplicated `tail` literal would not catch a typo edited into both. | **§5.5 execution check.** Verified: `new Function('window', bundle)` exposes all four names and agrees with the engine. |
| **F7** | **`.docx` part sizes uncapped by policy.** *Not* the unbounded read the draft claimed. | `node_modules/adm-zip/zipEntry.js:79–99` already carries the CVE-2026-39244 fix — STORED allocates from real compressed length, DEFLATED passes `_centralHeader.size` as zlib `maxOutputLength`. So `getData()` errors rather than OOMs. But `header.size` is an attacker-declared uint32, and `DOCX_PARTS` accepts `header\d*`/`footer\d*` without limit. | **§3.2** per-part + aggregate budget. Framed as lowering an existing cap. |
| **F8** | **`node cli.mjs a.docx -o a.docx` destroys the original.** | cli.mjs:66 passes `outPath` through; `writeZip(target)` writes wherever told. The archive is fully in memory, so this silently replaces the user's source document with its converted form — irreversible. | **§3.2** `resolve()` equality guard. |
| **F9** | **Browser .docx path: no error handling, no cap.** | index.html:131 `e.target.files[0] && handleFile(…)`, no `.catch`, no `try`. A corrupt/encrypted file → unhandled rejection, silent UI. `async('string')` has no ceiling. | **§3.3(c)**. Hardening now covers both hosts, not one. |
| **F10** | **Quadratic highlight in the primary UI.** | 2,000 words / 500 distinct flags: conversion 192 ms, highlight **563 ms** — 3× the engine cost, scaling with the product, behind a 300 ms debounce on `npm run serve`, README's Quick start. | **§3.3(b)**: 10 ms, byte-identical output, fewer lines. |
| **F11** | **Polytonic-incapable font on the output pane.** | `font-family: Georgia, …` (index.html:11); Georgia is missing all six probed polytonic codepoints. | **§3.3(a)** + a README Limitations bullet for the .docx case, which the codec cannot fix. |
| **F12** | **Licence/provenance gaps.** | `web/lexicon.js`, `web/engine.browser.js`, `web/index.html` carry no notice; `web/` has no LICENSE; `package-lock.json` says `"license": "ISC"`; `web/jszip.min.js` (97,630 bytes, JSZip 3.10.1, dual MIT/GPLv3, SHA-256 `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e`) has no lockfile entry, no integrity record and no provenance note. | **§3.4** banners + copied licences; **§3.3(d)** footer; **§3.7** lockfile; **S8** records the JSZip version/hash/licence in CONTRIBUTING. |

**Safety properties of the new code.** No new dependency, no network, no IO added to the engine, no `eval`, no dynamic `RegExp`. Every new engine function is total. The only new loop is `xmlDecode`'s single linear pass over a fixed alternation. Adversarial input verified non-throwing and non-hanging: empty string, 500 stacked U+0301, U+0489, lone U+0345, `ΐϊϋ`. **Throughput improves**: 20,000 words of γιατί-heavy prose, baseline **14,367 ms**, patched **10,223 ms**. README's Performance table needs no change.

---

## 5. Test strategy

**On the "512-state space".** Polytone has no 512-state space — that is 16 letter functions × 32 *toggle* states of an input method. Its structural analogue is the composition/capitalisation path, and the exhaustive analogue is the **209-character reverse sweep**. A forward sweep over 8 bases × 128 mark subsets would exercise `String.normalize` and nothing of ours. **Do not ship tests for stdlib.**

Everything appends to the existing hand-rolled harness — no framework (CONTRIBUTING.md:15), same counter, Greek failure output, `process.exit(fail ? 1 : 0)`. **Measured cost: baseline suite 4.5 s; with §5.6's CLI spawn ≈ 9.5 s.**

**5.0 Path fix** (test.mjs:5 is cwd-relative, unlike cli.mjs:13–14):

```js
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const rel = (p) => join(dirname(fileURLToPath(import.meta.url)), p);
const lexicon = JSON.parse(readFileSync(rel('lexicon.json'), 'utf8'));
```

**5.1 Golden pairs** — appended to `cases`, all eight verified green on the built prototype and red before their step:

```js
  ['υβριδιο', 'ὑβριδιο'],        // ἀρκτικὸ υ -> δασεία
  ['Υβριδιο', 'Ὑβριδιο'],
  ['Υμπλαξ', 'Ὑμπλαξ'],          // ἦταν Υ+U+0313: μάρκα χωρὶς προσυντεθειμένο τύπο (U+1F58 κενό)
  ['αυτομπλα', 'αὐτομπλα'],      // δίφθογγος αυ- κρατᾶ ψιλή — ὁ κανόνας ποὺ ἔσπασε ἡ Koronis
  ['ευμπλα', 'εὐμπλα'],
  ['ουμπλα', 'οὐμπλα'],
  ['υιμπλα', 'υἱμπλα'],          // υι-: δασεία στὸ ι, μέσῳ τοῦ ὑπάρχοντος κλάδου διψήφου
  ['Ηνέθη', 'ᾘνέθη'],            // κεφαλαῖο + ὑπογεγραμμένη (ἦταν 'ἨΙνέθη')
```

**5.2 Invariants**

```js
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
  !/[\u1F71\u1F73\u1F75\u1F77\u1F79\u1F7B\u1F7D\u1FBB\u1FC9\u1FCB\u1FD3\u1FDB\u1FE3\u1FEB\u1FF9\u1FFB]/.test(once));
```

The `smp` sample uses the **single-accent** `δάσκαλος μου`, so `tokens ⊂ text` is genuinely red before E4. (The draft's `δάσκαλός μου` is already double-accented, takes the `doubleAccented` branch, and is green on the baseline — verified; the acceptance criterion it was carrying could not have been met.)

**5.3 The reverse sweep** — differential against the runtime's own Unicode tables. No vendored fixture, therefore no Koronis licence exposure. This is the assertion that would have caught **all nine** Koronis defects, because all nine are omissions and no finite golden list detects a branch nobody wrote.

```js
// Ὅλοι οἱ NFC-σταθεροὶ προσυντεθειμένοι ἑλληνικοὶ χαρακτῆρες πάνω στὶς 8 βάσεις καὶ τὶς
// 7 μάρκες: ἡ κεφαλαιοποίηση δὲν ἐπιτρέπεται νὰ προσθέσει/ἀφαιρέσει γράμμα ἢ μάρκα.
// Παράγεται ἀπὸ τοὺς πίνακες τοῦ runtime — κανένα ξένο fixture.
const SWEEP_BASES = 'αεηιουωρΑΕΗΙΟΥΩΡ';
const SWEEP_MARKS = new Set(['\u0313','\u0314','\u0308','\u0301','\u0300','\u0342','\u0345']);
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
    const val = ch + 'βαβα';                 // 3 συστάδες: τὸ post-pass βαρείας τὸ προσπερνᾶ
    const out = polytonize('Αβαβα', { 'αβαβα': val }).text;
    if (bare(out) !== 5 || mset(out) !== mset(val)) {
      sweepBad++;
      if (sweepBad <= 3) console.log(`FAIL sweep: ${ch} -> ${out}`);
    }
  }
}
inv(`reverse sweep (${swept} χαρακτῆρες)`, sweepBad === 0);
```

Measured: `swept === 209`; baseline **63** violations, patched **0**. Not pinned to 209 — a future Unicode version adding a character should widen coverage, not fail the build.

**5.4 The .docx codec** — testable for the first time, string fixtures, no zip file:

```js
const dx = convertDocxXml('<w:t>Ο &quot;λόγος&quot; &amp; το &#8217; και &lt;tag&gt;</w:t>', lexicon);
inv('docx: καμία διπλὴ διαφυγή', !dx.includes('&amp;quot;') && !dx.includes('&amp;#8217'));
inv('docx: ἰδιοδυναμία', convertDocxXml(dx, lexicon) === dx);
inv('docx: τὸ markup μένει ἄθικτο', dx.startsWith('<w:t>') && dx.endsWith('</w:t>'));

const dxBad = convertDocxXml('<w:t>a&#0;b &#xD800; &#13; ο</w:t>', lexicon);
inv('docx: κανένας παράνομος XML χαρακτήρας', ![...dxBad].some((c) => {
  const cp = c.codePointAt(0);
  return (cp < 0x20 && cp !== 0x9 && cp !== 0xA) || (cp >= 0xD800 && cp <= 0xDFFF);
}));
inv('docx: <w:tab/> δὲν πιάνεται',
  convertDocxXml('<w:tab/>ουρανος</w:t>', lexicon) === '<w:tab/>ουρανος</w:t>');
inv('DOCX_PARTS ἀγκυρωμένο', DOCX_PARTS.test('word/comments.xml')
  && !DOCX_PARTS.test('x/word/document.xml') && !DOCX_PARTS.test('word/document.xml.evil'));
```

**5.5 Bundle execution** — replaces byte-equality, and with it the duplicated `tail` literal the draft asked contributors to keep in sync by hand:

```js
const win = {};
new Function('window', readFileSync(rel('web/engine.browser.js'), 'utf8'))(win);
inv('bundle ἐκτελεῖται καὶ ἐκθέτει τὸ API — τρέξε: npm run build:web',
  typeof win.Polytone?.polytonize === 'function' && typeof win.Polytone?.convertDocxXml === 'function');
inv('bundle συμφωνεῖ μὲ τὴ μηχανή',
  win.Polytone.polytonize('ο ήλιος και η θάλασσα', lexicon).text === conv('ο ήλιος και η θάλασσα'));
```

Verified working, ~1 ms, tolerant of the new licence banner (byte-equality would not have been). It subsumes freshness: a bundle generated from a different `engine.mjs` disagrees on the golden sentence.

**5.6 CLI smoke** — first coverage of a surface CHANGELOG.md:11 names as SemVer-public, in a module this plan rewrites:

```js
import { execFileSync } from 'node:child_process';
const cliOut = JSON.parse(execFileSync(process.execPath, [rel('cli.mjs'), '--json'],
  { input: 'ο ήλιος', encoding: 'utf8' }));           // ponytail: ~5 s, φορτώνει τὸ λεξικὸ ξανά
inv('CLI --json σχῆμα + exit 0',
  cliOut.text === 'ὁ ἥλιος' && ['text','unknown','ambiguous','guessed'].every((k) => k in cliOut));
```

Verified: 5,033 ms, exit 0, exactly those four keys.

**Regression protection.** All 10 original golden pairs stay verbatim and must pass at every commit (CONTRIBUTING.md:52). Verified on the fully-patched prototype: **31/31 pass** (10 original + 8 new pairs + 6 invariants + sweep + 6 codec/bundle assertions).

**Deliberately not added.** Unit tests per private helper, fixtures, mocks, coverage tooling, a runner, a hash assertion on `jszip.min.js` (see S8).

---

## 6. Sequencing

Nine steps, each independently shippable with one acceptance criterion. **S0**: run `node build_web.mjs`; today it produces no diff (verified byte-fresh), so there is nothing to commit — if it ever does, that commit goes first, alone.

**S1 — `test: path resolution + invariants`**
§5.0 and §5.2. Do **not** add the sweep, codec, bundle or CLI checks yet.
*Accept:* suite runs from any cwd; `tokens ⊂ text (ἔγκλιση)` **fails** on `ο δάσκαλος μου` — F5 arriving RED, per CONTRIBUTING.md:77.

**S2 — `fix(engine): tokens[].out consistent with text`**
E4, one line.
*Accept:* all §5.2 invariants green; 10/10 golden.

**S3 — `test: reverse sweep over the capitalisation path`**, then **`fix(engine): capitalise the base letter, never expand`**
Land §5.3 RED (63/209), then E3.
*Accept:* sweep 0 violations; `Ηνέθη` → `ᾘνέθη`; 10/10 golden. The largest single correctness win: 1,136 lexicon picks, none made worse.

**S4 — `feat(engine): ἀρκτικὸ υ παίρνει δασεία`**
§5.1's eight pairs first (all fail), then E1 + E2.
*Accept:* eight new pairs pass; 10/10 originals still pass; αὐ-/εὐ-/οὐ- verifiably untouched. The commit message cites a grammar and the `Υμπλαξ` composition fix — **not** the dictionary count, **not** Koronis.

**S5 — `refactor: one .docx codec; fix XML entity round-trip`**
Land §5.4 RED, then E6 + E5 + §3.2 + §3.3(c) + the `build_web.mjs` allowlist line. Then `npm run build:web`, commit the bundle, then land §5.5 and §5.6.
*Accept:* `&quot;`/`&#8217;` survive a round trip; no illegal XML character emitted; codec idempotent; `<w:tab/>` untouched; `comments.xml` converted; per-part and aggregate caps present; `-o`-onto-input rejected; browser branch catches and reports; zip-slip still structurally absent (anchored `DOCX_PARTS`, no path join, no extraction); bundle and CLI checks green. **Also in this commit**: the CONTRIBUTING process note that editing `engine.mjs` requires `npm run build:web` before `npm test`.

**S6 — `perf(web): single-pass highlight; fix(web): polytonic-capable font stack`**
§3.3(a) + §3.3(b).
*Accept:* highlight output byte-identical to before on a 500-distinct-flag document, measured under 20 ms; `body` font stack leads with a face that has Extended Greek.

**S7 — `chore(build): licence notices on the conveyed artefacts`**
§3.4 + §3.3(d) + the `package-lock.json` licence line; `npm run build:web`; commit `web/lexicon.js`, `web/engine.browser.js`, `web/LICENSE.txt`, `web/dict-LICENSE.txt`. Independent of everything above.
*Accept:* `head -c 200 web/lexicon.js` and `head -c 200 web/engine.browser.js` both show the GPL-3.0 + © Α. Δεληγιάννη notice; `web/` opened from disk shows the footer and both licence links resolve; lockfile says `GPL-3.0`.

**S8 — `docs`**
- **CHANGELOG.md** `[Unreleased]` → cut `## [1.1.0]`, update the link refs at :56–57. *Added:* `convertDocxXml`, `DOCX_PARTS`; `word/comments.xml` conversion; licence notices in `web/`. *Fixed:* capitalisation of ὑπογεγραμμένη forms (**and: documents converted by 1.0.0 keep the inserted letter — re-running does not repair them**); `.docx` entity round-trip; illegal-XML-character emission; stale `tokens[].out`; prototype-chain lexicon lookup; missing error handling on the browser `.docx` path; `-o` onto the input file. *Changed:* ἀρκτικὸ υ now takes δασεία — cite CHANGELOG.md:15–16, accuracy changes are not breaking. *Performance:* single-pass highlight in the web UI.
- **README.md**, five edits, each falsified or owed by the work: **:114** list `convertDocxXml` and `DOCX_PARTS`; **:122** the `guessed` row (smooth breathing is no longer what is always assumed); **:143** How-it-works step 5, same; **:192**/**:199** the tree (`engine.mjs` = linguistic rules *plus the shared .docx text codec*; `web/` now also holds copied licences); **:36** add `comments.xml` to the Features bullet. Plus three Limitations bullets: (a) *Polytone emits correct Unicode; it does not change the document's font. A .docx set in a font without Extended Greek coverage (Georgia, many UI fonts) shows fallback or tofu in Word — restyle in a polytonic-capable face.* (b) *Output produced by Polytone 1.0.0 that shows a spurious capital iota (`ἨΙ…`) is not repaired by re-running: the word already carries a polytonic mark and is `skipped`.* (c) *Text produced by older polytonic input tools may use non-standard codepoints (a dot-above for ἄνω τελεία, U+1FBE for iota). Polytone passes these through unchanged.* The Performance table needs no change — measured faster, not slower.
- **CONTRIBUTING.md**: **:30** `engine.mjs` = "All linguistic rules, plus the shared `.docx` text codec"; **:31** `cli.mjs` = "CLI wrapper: stdin/files/`--json`, and the zip shell for `.docx`"; the Setup section gains `npm run build:web` and the note that `npm test` verifies the bundle; the Licensing section gains **one sentence** that the decompiled Koronis artefacts in scratchpad (`koronis_rules.json`, `verify_rows.json`, `extract_rules.py`) are non-importable into this repo, and **one line** recording `web/jszip.min.js` as JSZip 3.10.1, 97,630 bytes, SHA-256 `acc7e414…d59e`, dual MIT/GPLv3.
- **package.json**: `build:web`, `version` → `1.1.0`.

**S9 — upstream, not code.** Report the 119-form `ὐπερετίμα` family to The Polytonic Project **and open a tracking issue here linking the report** — CONTRIBUTING.md:65–67 requires both. Do **not** patch `dict/`, do **not** patch `lexicon.json`, and do **not** add an `OVERRIDES` entry: CONTRIBUTING.md:69–71 offers that path, and it is deliberately declined here because all 119 forms are *in* the dictionary, so the lookup wins before `addBreathing` is ever reached and the override could never fire. Say that in the issue, so the deviation reads as considered.

---

## 7. Non-goals and residual risks

### 7.1 Grafted from the losing proposals and the review

From **P2**: `convertDocxXml` + `DOCX_PARTS` extraction and the entity fix; the size cap plus the explicit finding that zip-slip is absent and `DOCX_PARTS` must stay anchored; the reverse sweep as a test **decoupled from `composeMark`** (count re-derived: **209**); provenance as architecture.

From **P1**: `addPsili` → `addBreathing`; keying the υ rule on `letters[0]`; per-token type-guarding of the lexicon hit; the `import.meta.url` path fix; citing a grammar rather than a measurement.

**From the judges**: delete `MARK_DROP_ORDER` and the relaxation loop. Verified strictly better on every axis — `ᾳ→ᾼ`, `ᾁ→ᾉ` as single precomposed characters, `ῆ→Η͂` lossless where none exists, 0/209 sweep violations vs 63, 1,136/1,136 picks improved, none worse, in two lines with zero hand-written data.

**From the review**: `Object.hasOwn` over `typeof`; the XML Char guard; the tight `<w:t>` pattern; `comments.xml`; the single-accent enclisis sample; the honest re-framing of the adm-zip finding; the aggregate budget; the `-o` guard; browser error handling; the bundle *execution* check replacing byte-equality; the CLI `--json` smoke test; the font stack; the single-pass highlight; the licence notices on **both** generated files; the `package.json`/lockfile section; the un-repairable-output disclosure; the tracking issue.

### 7.2 Dropped, with the reason

| Dropped | Why |
|---|---|
| **Preserving the ἄνω τελεία (the draft's E4/S6)** | **Rejected outright, on three grounds, all measured.** (a) It breaks the project's hard architectural constraint. U+0387 has a canonical *singleton* decomposition, so any string containing it is by definition not NFC — verified: every patched output containing an ἄνω τελεία flags `isNFC === false`. "Boundaries emit NFC" is pinned in README and package.json. (b) It produces three wrong-Greek regressions, because the punctuation classes hold U+00B7 and ASCII `;` (codepoints dumped: engine.mjs:270 non-ASCII members are only U+00B7 U+2026 U+00BB U+2014 U+2013; :288 only U+00B7 U+2026; :260 is two ASCII semicolons). Reproduced: `ο ουρανός·  η γη` → `οὐρανὸς` (βαρεία before punctuation, the exact rule golden case 2 protects); `γιατί έφυγες` + U+037E → `γιατὶ`; `γιατί ήρθε·  τι θέλεις;` → `γιατί`. (c) The gain is nil: NFC(U+0387) = U+00B7 is a Unicode-mandated equivalence and the two render identically. Adding U+0387/U+037E to the three classes would fix (b) but not (a), and would be dead code besides — `nfc(text)` at engine.mjs:171 makes both unreachable. `nfc(text)` **stays**. This also retires the draft's related risk entries about Latin combining sequences and NFD/NFC divergence, which existed only as consequences of the change. |
| **`composeMark` + `MARK_RANK` + `MARK_LEGAL`** | **No reachable consumer.** The engine writes marks in exactly three places and in each the mark is already legal for its base: `oxiaToVaria` and `addFinalOxia` operate on an existing vowel cluster, `addBreathing` on a word-initial vowel. A legality oracle with no illegal caller is an interface with one implementation and zero users. `MARK_LEGAL` is also 8 lines of hand-written data — the artefact class this exercise exists to eliminate — and it cannot be verified for over-permission (it permits Υ+ψιλή, which Unicode leaves unassigned). The sweep, the valuable half, works without it. |
| **`MARK_DROP_ORDER`** | Reproduces Koronis's fallback policy in miniature, inside the function being fixed. Superseded by E3. |
| **`variants()` + correction UI** | Permanent public API growth for a feature nobody asked for; its own risk list concedes it offers orthographically implausible Greek. **Banked**: `Object.create(window.LEXICON)` with the user's pick as an own property is the right mechanism if it is ever requested — zero engine change, no 37 MB copy, status flips `guessed`→`ok`. Ship it only with E5 in place. |
| **Per-status counts / "copy the flagged words" button in the web UI** | Real gap (the CLI gets this from `--json`, the web user gets a colour), but nobody asked, and it is orthogonal to every defect above. Four lines whenever it is wanted. |
| **ρ → ῥ** (Koronis `letterr` defect) | Measured: `dict/el-polyton.dic` has **4,556** plain ρ-initial entries, **1** with δασεία, **0** with ψιλή. Adopting it would make Polytone contradict its own dictionary on 4,556 words. |
| **A legacy-oxia post-condition assert in `build_lexicon.mjs`** | The property is a consequence of `String.prototype.normalize('NFC')`, which the generator already calls at every write site — not luck. Asserting it over 739,955 keys is testing the stdlib. §5.2's one-line output-side guard is the whole warranted cost. |
| **U+2028/U+2029 escaping in `build_web.mjs`** | Measured 0 occurrences in `lexicon.json` today, and — decisively — U+2028/2029 have been legal inside string literals since ES2019, which every engine the project supports (Node 18+, modern browsers) implements. Not a latent hazard, a fixed one. |
| **Replacing `adm-zip` with the vendored JSZip on both hosts** | Genuinely tempting: it would collapse the two zip paths to one and leave the project with zero npm dependencies. Rejected for now — it turns the CLI's synchronous file loop async, moves a 95 KB minified third-party blob to the repo root as a build input rather than a web asset, and gives up `adm-zip`'s already-present CVE-2026-39244 fix for a file with no lockfile entry. README's zero-dependency claim is explicitly scoped to *text conversion* and is already true. Revisit if the two `.docx` paths ever diverge again. |
| **A `--repair` mode for 1.0.0 output** | Detection is a one-line regex over output; the fix is not. Belongs in an issue. The **disclosure** (S8) is mandatory, the code is not. |
| **U+02D9 / U+1FBE Koronis-ingest repair** | Affects only files produced by an abandoned 2014 add-in; U+1FBE would need a repair pass *before* the normalisation boundary. ~5 lines if ever wanted. Documented as a Limitation instead (S8), so the deferral is visible to the person it affects. |
| **An all-caps conversion mode** | E3 makes it possible for the first time (`ᾳ→ᾼ` correctly). Still out of scope: README documents all-caps as deliberately unaccented, and `isAllCaps` → `skipped` is a documented behaviour. Revisit only on request. |
| **A new `status` value for "a mark was dropped"** | Nothing drops a mark any more; and status values are SemVer-covered. |
| **A SHA-256 assertion on `web/jszip.min.js`** | Recorded as provenance in CONTRIBUTING instead (S8). The hash in a test must be hand-updated on every legitimate upgrade; the prose costs nothing and is what is actually missing. |
| **Everything from Koronis's ribbon, hook, timer, licensing, and its two font probes** | Input method, not converter. Note the distinction: the probing *mechanism* is out of scope, the *problem it solved* is not — hence §3.3(a). |

### 7.3 Residual risks

- **The υ rule is 99.38%, not 100%.** It is wrong on the 119 `ὐπερετίμα`-family entries — but the rule fires **only on lexicon misses**, and all 119 are in the dictionary, so the lookup wins and Polytone keeps emitting the upstream form. The real error set is out-of-lexicon υ-initial neologisms wanting ψιλή, a near-empty category. Status stays `guessed`, the honest signal. Do **not** add an exception table; that is re-importing Koronis's mistake.
- **Pre-fix output is not self-healing.** Verified: the fixed engine returns `ἨΙνέθη` unchanged, `skipped`, because `hasPolytonicMark` is true. README's headline idempotence promise is exactly what makes the 1.0.0 damage permanent. Disclosed in CHANGELOG and README (S8); repair deferred.
- **The .docx codec now emits `"` where the input had `&quot;`.** Lossless and XML-legal, but a visible diff in the output archive. Documented.
- **The codec re-escapes what it will not decode.** `&nbsp;` → `&amp;nbsp;`, and an out-of-Char numeric reference likewise. Valid XML, not a faithful round trip. OOXML from Word emits only the five predefined entities plus numeric references, so the ceiling bites only on hand-authored markup or an internal DTD. Named in a `ponytail:` comment.
- **`npm test` now costs ~9.5 s instead of 4.5 s**, almost entirely the CLI subprocess re-loading the 37 MB lexicon. That is the price of any coverage at all on a SemVer-public surface that is being rewritten.
- **The bundle assertion changes the local workflow.** Editing `engine.mjs` and running `npm test` before `npm run build:web` gives a red suite. Intended — hence the failure message naming the 2 s script rather than `npm run build` (minutes, ~2 GB). CONTRIBUTING is updated in the same commit (S5 acceptance criterion, not prose), or the third contributor to hit it deletes the assertion.
- **S7's acceptance is partly manual.** Nothing in the suite opens a produced `.poly.docx`; `updateFile` + `writeZip` recompresses and reorders the container. Convert one real document and open it in Word once, at S5.
- **Pre-existing, untouched, measured.** `POLY_MARKS` (engine.mjs:5) excludes U+0308, so a word carrying only διαλυτικά is not "already polytonic" and still gets a breathing guessed onto it. Adding U+0308 would be *worse* — it would freeze every ordinary `προϊόν`/`ταΐζω` as `skipped`. Separate change, separate golden pairs. `sentenceAfter` remains O(distance to the next terminator), so γιατί-dense text without terminators is quadratic: 20k such words, baseline **14.4 s**, patched **10.2 s** — not caused here, and improved rather than worsened.
- **`matchCase` uppercases `nfd(result)[0]`**, assuming the first NFD character of a lexicon value is a base letter. True for every value in the shipped lexicon; a future form beginning with a combining mark returns the input unchanged — degraded, not dangerous, per the module's totality contract. No guard added.

### 7.4 The GPL-3.0 constraint

`lexicon.json` derives from the el-polyton hunspell dictionary, © Α. Δεληγιάννη / The Polytonic Project, GPL-3.0. Copyright is held by a third party, so **no CLA is possible and Polytone cannot be relicensed** (CONTRIBUTING.md:121–123). Serving `web/` *is* the conveyance (README.md:228–230), and **none** of the three files that constitute it currently carries a notice — S7 is a compliance fix, not a chore.

**Koronis is the sharper legal risk**, because the lexicon at least has a licence: `koronis_rules.json`, `verify_rows.json` and the transpiler are mechanical derivations of a decompiled proprietary 2014 add-in with no grant to anyone. The mitigation is **structural, not procedural**: nothing Koronis-derived enters the repository — not as data, not as a fixture, not as a vendored table. The reverse sweep is generated from the runtime's own Unicode tables precisely so it needs none. The one behaviour transferred is `ἀρκτικὸ υ → δασεία`, a fact in every Greek grammar, and its Greek comment cites a grammar rather than the extraction or the dictionary count — so the clean-room boundary is *visibly* true in the source, not merely true in the author's reasoning. S8 adds the sentence to CONTRIBUTING naming the scratchpad artefacts as non-importable.

**Nothing here touches the licence boundary or requires relicensing.** No new dependency, no build-step addition, no `npm run build` change, no status value, no lexicon rebuild. Four new files, all of them copies of licences.

---

## Objections rejected

1. **"Keep E4/S6 and add U+0387/U+037E to the three punctuation classes."** (Reviewer #1's fix; #9's first branch.) The regressions they diagnose are real and reproduced — but the character-class patch fixes only the linguistic half. Preserving U+0387 breaks "boundaries emit NFC" *by definition*, since U+0387 is a canonical singleton and no string containing it is NFC (verified on the patched build). **S6 is dropped entirely**, which is #9's own preferred remedy and lazier than either patch. The three classes are therefore left alone: post-`nfc(text)`, U+0387 and U+037E are unreachable, and adding them would be dead code.
2. **"Add a `.replaceAll` over the joined output to restore the ἄνω τελεία."** (#9's fallback.) Same NFC violation, arrived at by a different route.
3. **"NFC the odd part whenever it is Greek or all-combining-marks; restate the contract in README."** (#11's fix.) Moot — the contract is not being changed.
4. **"`inv('μὴ ἑλληνικὰ ἄθικτα', …)`; extend §7.3 to say Latin combining sequences are now passed through."** (#26.) Moot for the same reason: with E4 dropped, `nfc(text)` still composes them and no behaviour changes for mixed Latin/Greek text.
5. **"The dictionary count is 19,132, not 18,965."** (#8b.) Re-measured on `dict/el-polyton.dic`: **18,965** δασεία and **119** ψιλή among base entries, splitting each line on `/` and reading the first NFD combining mark. The reviewer's larger figure presumably counts a different population (expanded forms, or capitals separately). The ratio — 99.38% — is identical either way, and the plan now states the counting method so the claim is reproducible. #8a is accepted: engine.mjs:161 is not a failure-idiom site, and the list is corrected in §3.1.
6. **"Assert in `build_lexicon.mjs` that no key or value matches the 16-codepoint legacy-oxia class before `writeFileSync`."** (#29.) The generator already returns NFC at every write site, and NFC maps U+1F71 → U+03AC by standard mandate; the assert would test `String.prototype.normalize`. §5.2's output-side one-liner is kept as the cheap net. The rest of #29 — a `build_lexicon.mjs` / `dict/` module section — is accepted (§3.8).
7. **"Escape U+2028/U+2029 when writing `web/lexicon.js`."** (#18, offered as a judgement call.) Declined and now stated rather than left unexamined: measured 0 occurrences, and both characters have been legal inside string literals since ES2019 — every engine the project supports. Not a latent hazard.
8. **"Add a SHA-256 assertion for `web/jszip.min.js` to the suite."** (#15, first branch.) Taking the second branch instead: version, byte size, SHA-256 and licence recorded in CONTRIBUTING. A hash in a test must be hand-edited on every legitimate upgrade; the missing thing is provenance, and prose supplies it at zero runtime cost.
9. **"Add per-status counts and a copy-the-flagged-words button to the web UI."** (#33, first branch.) Taking the second branch: a row in the dropped table. Nobody asked, and it is orthogonal to every defect this plan fixes.
10. **"Adopt or reject jszip-on-both-hosts."** (#30.) Not rejected as an objection — the row is added (§7.2) — but the option itself is declined: async CLI rewrite, a vendored blob promoted to a build input, and the loss of adm-zip's shipped CVE fix, against a zero-dependency claim that is already true as scoped.