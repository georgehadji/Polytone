# Changelog

All notable changes to Polytone are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Public API surface covered by SemVer:

- `polytonize(text, lexicon)` return shape (`{ text, tokens }`) and token `status` values
- CLI flags and `--json` output shape
- `lexicon.json` key/value format

Everything else (internal rule ordering, heuristics, `build_lexicon.mjs` internals) may
change in a patch release. Accuracy changes — a word that converts differently after an
upgrade — are **not** breaking changes and land in minor releases.

## [Unreleased]

### Fixed
- `.docx` conversion corrupted words that Word had split across two runs. Each `<w:t>` was
  converted in isolation, so a fragment was accented as though it were a whole word:
  `π`+`ας` became `π`+`ἄς`, ` α`+`νθρώπου` became ` ἅ`+`νθρώπου`. A 6,111-word book had 358 such
  splits, 347 of them corrupted; 352 of the 358 were between runs with identical formatting,
  i.e. pure Word revision noise. Adjacent `<w:t>` elements separated by nothing but a run
  boundary are now joined before conversion and redistributed afterwards. A `<w:br/>`, tab,
  paragraph or cell boundary, field or symbol still breaks the text, as it should.
  Previous releases documented this as "not converted"; it was in fact mis-converted.

## [1.1.0] - 2026-08-29

### Added
- `LICENSE` (GPL-3.0 full text) and `dict/LICENSE.txt` (upstream dictionary license, verbatim)
- `CONTRIBUTING.md`, `CHANGELOG.md`
- `convertDocxXml(xml, lexicon)` and `DOCX_PARTS` exported from `engine.mjs`: the `.docx`
  text codec that `cli.mjs` and `web/index.html` both now call, replacing two independent
  copies
- `word/comments.xml` (Word review comments) is now included in `.docx` conversion
- Licence notices in `web/`: `web/LICENSE.txt`, `web/dict-LICENSE.txt`, and a header banner
  in the generated `web/lexicon.js` / `web/engine.browser.js`
- `npm run build:web` — regenerates only the browser bundle, without the multi-minute
  lexicon rebuild

### Changed
- `README.md` rewritten for production use: measured performance figures, corrected
  library API example, explicit licensing/redistribution guidance
- Word-initial upsilon (υ/Υ) now takes rough breathing (δασεία) instead of smooth breathing
  (ψιλή) when guessed — every Greek grammar gives υ- rough breathing; ~99.4% of upsilon-initial
  entries in `dict/el-polyton.dic` already agree. Diphthongs (αυ-, ευ-, ου-) are unaffected and
  keep smooth breathing. This is an accuracy change, not a breaking one (see the SemVer note
  above).
- `web/index.html`: output-pane font stack leads with a face that actually covers Extended
  Greek (was `Georgia`, which is missing every polytonic glyph tested); token highlighting is
  now a single regex pass instead of one compiled pattern per distinct flagged word

### Fixed
- `polytonize()` was O(n²) on long documents: the βαρεία post-pass re-joined the entire
  remaining document per `γιατί` occurrence, and looked up each word's report entry with a
  linear `.find()`. 24k words dropped from ~20 s to ~3 s; throughput is now flat regardless
  of document size instead of degrading with it.
- Capitalising a word whose polytonic form has ὑπογεγραμμένη (iota subscript) inserted a
  spurious capital iota — `.toUpperCase()` on a precomposed NFC character can expand it
  (`ᾳ` → `ΑΙ`). Affects every dictionary pick with an ὑπογεγραμμένη candidate. **Documents
  already converted by 1.0.0 keep the inserted letter — re-running Polytone does not repair
  them**, because the output already carries a polytonic mark and is `skipped`.
- `.docx` conversion corrupted named-entity text on every pass: the old codec unescaped only
  `&amp;`/`&lt;`/`&gt;` but re-escaped every `&`, so `&quot;` became `&amp;quot;` and further
  corrupted on each subsequent conversion.
- `.docx` conversion could emit an illegal XML character (e.g. from a crafted numeric
  character reference), producing a `document.xml` that Word refuses to open.
- `tokens[].out` could disagree with the returned `text` after the ἔγκλιση τόνου (enclisis)
  rule rewrote a preceding token.
- Lexicon lookup walked the prototype chain (`lexicon[word] ?? lexicon[lower]`), so a
  polluted `Object.prototype` could shadow a real lookup. Matters most in the browser, where
  the lexicon and third-party scripts share a global object.
- Browser `.docx` handling had no error handling: a corrupted, encrypted or non-Word file
  failed silently with no UI feedback.
- `node cli.mjs a.docx -o a.docx` silently overwrote the source file with its own conversion,
  irreversibly. `-o` targeting the input path is now rejected with an error.
- `package-lock.json` declared the root package `"license": "ISC"` while `package.json` says
  `"GPL-3.0"`.

## [1.0.0] - 2026-08-16

Initial release.

### Added
- Rule + lexicon engine (`engine.mjs`) converting monotonic and mixed Greek to polytonic
  - 739,955-form lexicon expanded from the el-polyton hunspell dictionary
  - Grave accent (βαρεία) at phrase-internal positions, acute before punctuation
  - Enclitic stress propagation (έγκλιση τόνου) for proparoxytone + enclitic sequences
  - Positional heuristics for clitic vs. possessive pronouns (μου, του, σου…)
  - Interrogative vs. causal disambiguation for γιατί / ποὺ / πὼς
  - Existing polytonic diacritics preserved, so mixed-script input is idempotent
  - Per-token status reporting: `ok`, `skipped`, `unknown`, `ambiguous`, `guessed`
- CLI (`cli.mjs`): stdin/stdout, file in/out, `--json` structured output
- `.docx` conversion preserving formatting, headers, footers, footnotes and endnotes
- Browser UI (`web/`): offline, no build step, paste or drag-and-drop `.txt`/`.docx`
- Lexicon build pipeline (`build_lexicon.mjs`) and browser bundler (`build_web.mjs`)
- Test suite (`test.mjs`)

### Known limitations
See [README — Limitations](./README.md#limitations).

[Unreleased]: https://github.com/georgehadji/Polytone/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/georgehadji/Polytone/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/georgehadji/Polytone/releases/tag/v1.0.0
