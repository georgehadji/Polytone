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

### Added
- `LICENSE` (GPL-3.0 full text) and `dict/LICENSE.txt` (upstream dictionary license, verbatim)
- `CONTRIBUTING.md`, `CHANGELOG.md`

### Changed
- `README.md` rewritten for production use: measured performance figures, corrected
  library API example, explicit licensing/redistribution guidance

### Fixed
- `polytonize()` was O(n²) on long documents: the βαρεία post-pass re-joined the entire
  remaining document per `γιατί` occurrence, and looked up each word's report entry with a
  linear `.find()`. 24k words dropped from ~20 s to ~3 s; throughput is now flat regardless
  of document size instead of degrading with it.

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

[Unreleased]: https://github.com/OWNER/polytone/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/OWNER/polytone/releases/tag/v1.0.0
