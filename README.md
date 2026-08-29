# Polytone

Converts monotonic (and mixed monotonic/polytonic) Greek text to polytonic.

A 739,955-form lexicon expanded from the el-polyton hunspell dictionary, plus a rule engine
for the parts a dictionary cannot decide: grave accent placement, enclitic stress
propagation, and clitic-vs-possessive disambiguation.

Runs fully offline. No network calls, no model, no API key. The same engine backs the CLI and
the browser UI, so both produce identical output.

---

## Quick start

```bash
npm install
npm run serve      # http://localhost:8321
```

Paste text, or drag in a `.txt` or `.docx` file.

Headless:

```bash
echo "ο ήλιος και η θάλασσα" | node cli.mjs
# ὁ ἥλιος καὶ ἡ θάλασσα
```

---

## Features

- **Mixed input** — words already carrying polytonic diacritics are left untouched, so
  running Polytone twice changes nothing the second time.
- **`.docx` in place** — converts `document.xml`, headers, footers, footnotes and endnotes,
  leaving fonts, styles and structure intact.
- **Per-word confidence** — every token reports whether it was a dictionary hit, a heuristic
  guess, or ambiguous, so uncertain output can be routed to a human.
- **Zero runtime dependencies** for text conversion; `adm-zip` is lazily imported and only
  needed for `.docx`.
- **No build step in the browser** — `web/` is plain HTML and JavaScript.

---

## Installation

Requires **Node.js 18+**.

```bash
git clone <repo-url> polytone
cd polytone
npm install
npm test
```

`lexicon.json` (37 MB) ships generated. To rebuild it from `dict/`:

```bash
npm run build      # a few minutes; needs ~2 GB free RAM
```

---

## Usage

### Browser

`npm run serve`, then open http://localhost:8321. `web/index.html` also works opened
directly from disk — the UI has no server-side component.

### CLI

```bash
node cli.mjs                          # stdin  -> stdout
node cli.mjs input.txt                # file   -> stdout
node cli.mjs input.txt -o output.txt  # file   -> file
node cli.mjs document.docx            # -> document.poly.docx
node cli.mjs document.docx -o out.docx
node cli.mjs --json < input.txt       # structured output
```

`--json` emits deduplicated word lists alongside the converted text:

```json
{
  "text": "ὁ ἥλιος καὶ ἡ θάλασσα",
  "unknown": [],
  "ambiguous": [],
  "guessed": []
}
```

Use these lists to gate a workflow — e.g. flag a document for review when `ambiguous` is
non-empty.

### Library

`polytonize` takes the lexicon as an argument; loading and caching it is the caller's job,
so a long-running process pays the load cost once.

```javascript
import { readFileSync } from 'node:fs';
import { polytonize } from './engine.mjs';

const lexicon = JSON.parse(readFileSync('./lexicon.json', 'utf8'));

const result = polytonize('ο ήλιος και η θάλασσα', lexicon);

result.text;    // 'ὁ ἥλιος καὶ ἡ θάλασσα'
result.tokens;  // [{ word, out, status, index }, ...]
```

Also exported: `hasPolytonicMark(word)` and `isGreek(text)`.

#### Token statuses

| Status      | Meaning                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `ok`        | Dictionary hit, or a form that provably needs no change.                |
| `skipped`   | Left as-is: all-caps (unaccented by convention), or already polytonic.  |
| `guessed`   | Not in the dictionary; vowel-initial, so smooth breathing was assumed.  |
| `ambiguous` | Several polytonic forms exist and context did not settle the choice.    |
| `unknown`   | Not in the dictionary and a circumflex may be required. Needs review.   |

`guessed`, `ambiguous` and `unknown` are the ones worth surfacing to a user.

---

## How it works

1. **Lexicon build** — `build_lexicon.mjs` expands the hunspell `.dic` + `.aff` pair into
   every inflected form, then keeps only the pairs where the monotonic and polytonic
   spellings actually differ. 739,955 keys.
2. **Tokenize** — the input is split on Greek word boundaries. Words already carrying
   polytonic marks, and all-caps words, are set aside untouched.
3. **Look up** — each remaining word is resolved against a small override table first, then
   the lexicon. Words with several candidates are scored and marked `ambiguous` when the
   choice is not clear-cut.
4. **Post-pass** — grave accent (βαρεία) is applied to oxytone words that are not
   phrase-final, enclitic hosts receive the second accent required by έγκλιση τόνου, and
   γιατί / ποὺ / πὼς are resolved by looking at the surrounding sentence.
5. **Unknown words** — vowel-initial words take a smooth breathing and are marked `guessed`;
   consonant-initial words are returned unchanged, and marked `unknown` only when a
   circumflex was plausible.

---

## Limitations

These are known and documented, not open bugs.

- **No part-of-speech tagger.** Clitic-vs-possessive decisions (μου, του, σου…) use position
  heuristics. Constructions that move the clitic away from its host — «χθὲς μοῦ ἔδωσε» —
  can be missed.
- **`.docx` runs.** Conversion happens per `<w:t>` element. A word split across two runs by
  a formatting change mid-word is not converted.
- **γιατί.** Interrogative vs. causal is decided from the sentence's terminal punctuation,
  which fails on questions written without a question mark.
- **All-caps text.** Deliberately left unaccented, following standard practice. Headings set
  in capitals will not be converted.
- **Dictionary coverage is the ceiling.** Proper nouns, technical vocabulary and neologisms
  are largely absent and fall through to the heuristics. Check `unknown` and `guessed`.

---

## Performance

Measured on Node.js v24, Windows, warm cache. Numbers are indicative, not a guarantee.

| Metric                    | Value                                                     |
| ------------------------- | --------------------------------------------------------- |
| Lexicon load (one-off)    | ~8 s, ~290 MB resident                                     |
| Throughput, 3k words      | ~7,400 words/s                                             |
| Throughput, 24k words     | ~7,800 words/s (linear — no longer degrades with size)     |

The lexicon load dominates short jobs. For batch work, import `polytonize` directly and
reuse one parsed lexicon across documents rather than invoking the CLI per file.

---

## Development

```bash
npm test           # node test.mjs
npm run build      # rebuild lexicon.json, then web/ bundles
npm run serve      # static server on :8321
```

```
polytone/
├── engine.mjs           # conversion engine — all linguistic rules
├── cli.mjs              # CLI: stdin/files/.docx/--json
├── build_lexicon.mjs    # dict/ -> lexicon.json
├── build_web.mjs        # engine + lexicon -> web/
├── test.mjs             # test suite (node:assert)
├── lexicon.json         # generated, 37 MB
├── dict/                # upstream hunspell dictionary + its license
└── web/                 # browser UI; lexicon.js and engine.browser.js are generated
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to change a rule versus a dictionary entry —
they are fixed in different places.

---

## Licensing

**Polytone is licensed under GPL-3.0.** See [LICENSE](./LICENSE).

This is not a choice the project can revisit. `lexicon.json` is a derivative of the
el-polyton hunspell dictionary of **The Polytonic Project** (© Α. Δεληγιάννη), distributed
under the GNU General Public License. The verbatim upstream license is preserved at
[`dict/LICENSE.txt`](./dict/LICENSE.txt). Attribution must be retained in any redistribution.

### What this means commercially

Copyright in the dictionary is held by a third party, so **Polytone cannot be dual-licensed
and no proprietary or "commercial exception" licence can be granted** by this project or its
contributors. Anyone distributing Polytone, or a work derived from it, does so under GPL-3.0
and must make the corresponding source available.

Two consequences worth knowing before building a product on this:

- **Hosting is not distribution.** GPL-3.0 contains no network clause — the AGPL does, and
  this is not the AGPL. Running Polytone server-side and selling access to the result does
  not by itself oblige you to publish your source.
- **The browser UI ships the lexicon.** `web/lexicon.js` sends the dictionary to every
  visitor, which *is* conveying the work. A hosted product that serves the current `web/`
  bundle inherits the full GPL source obligation. A server-side API does not.

This section is a summary for orientation, not legal advice. Take proper counsel before
commercialising, and consider contacting The Polytonic Project directly
(details in [`dict/LICENSE.txt`](./dict/LICENSE.txt)) about terms for your intended use.

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).
