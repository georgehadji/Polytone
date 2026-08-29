# Contributing to Polytone

Thanks for helping. This document covers setup, how to make the two kinds of change that
matter (rules and lexicon), and what a mergeable pull request looks like.

## Setup

```bash
git clone https://github.com/georgehadji/Polytone.git polytone
cd polytone
npm install
npm test
```

Requires Node.js 18 or newer. No other toolchain — no bundler, no transpiler, no framework.

`lexicon.json` (37 MB) is generated from `dict/`. If it is missing or you changed the
dictionary, rebuild:

```bash
npm run build     # dict/ -> lexicon.json, then web/lexicon.js + web/engine.browser.js
```

The build takes a few minutes and needs roughly 2 GB of free RAM.

If you only changed `engine.mjs`, you do not need the full build — regenerate the browser
bundle and re-run the suite:

```bash
npm run build:web && npm test
```

`test.mjs` executes the committed `web/engine.browser.js` and checks it agrees with
`engine.mjs`; editing the engine without regenerating the bundle first gives a red suite.

## Project layout

| Path                | Role                                                             |
| ------------------- | ---------------------------------------------------------------- |
| `engine.mjs`        | Conversion engine. All linguistic rules, plus the shared `.docx` text codec. |
| `cli.mjs`           | CLI wrapper: stdin/files/`--json`, and the zip shell for `.docx`.  |
| `build_lexicon.mjs` | Expands hunspell `.dic` + `.aff` into `lexicon.json`.             |
| `build_web.mjs`     | Copies engine + lexicon into `web/` as browser-loadable scripts.  |
| `dict/`             | Upstream hunspell dictionary. Do not hand-edit — see below.       |
| `test.mjs`          | Test suite. Plain `node:assert`, no framework.                    |
| `web/`              | Zero-dependency browser UI. Generated files are `lexicon.js` and `engine.browser.js`. |

## The two kinds of change

### 1. Fixing a rule

Accent placement, breathing marks, enclitics, clitic disambiguation — these are decided by
`engine.mjs`, not by the dictionary. Fix them here.

**Always add a test case first.** `test.mjs` is a list of `[input, expected]` pairs; append
yours, watch it fail, then change the engine.

```bash
npm test
```

A rule change that fixes your sentence but breaks an existing case is not a fix. If the
existing case was itself wrong, say so explicitly in the pull request and cite a source.

Cite a source for orthographic claims. Grammar references, established style guides, or the
historical-accentuation conventions the dictionary itself follows. "Looks right to me" is not
reviewable; contributors and reviewers do not always share the same dialect intuitions.

### 2. Fixing a word

Wrong or missing polytonic forms come from the dictionary, not the engine. **Do not patch
`dict/el-polyton.dic` or `lexicon.json` directly** — both are regenerated, and local edits are
lost on the next build. They are also third-party works (see [Licensing](#licensing-of-contributions)).

Report dictionary errors upstream to The Polytonic Project (contact details in
`dict/LICENSE.txt`), and open an issue here linking the report so the fix can be tracked
through to the next dictionary bump.

If a word must be overridden before upstream ships a fix, propose it as an explicit override
table in `engine.mjs` with a comment naming the upstream report. Keep such overrides few and
short-lived.

## Pull requests

- One logical change per pull request.
- `npm test` passes.
- New behaviour has a test. Bug fixes have a regression test that fails before the fix.
- Update `CHANGELOG.md` under `## [Unreleased]`.
- Update `README.md` if you changed the CLI, the library API, or a documented limitation.

Match the surrounding code style: ES modules, no semicolon-free experiments, comments in the
language already used in that file. Mark a deliberate simplification with a `ponytail:` comment
naming its ceiling, as existing code does.

### Commit messages

Conventional Commits:

```
fix: keep acute before closing quotation mark
feat: add --stdin-encoding flag to CLI
docs: document ambiguous token status
```

Types in use: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

## Reporting bugs

Open an issue with:

- Input text, exact and minimal — the shortest sentence that reproduces it
- Actual output and expected output
- Whether you ran the CLI or the web UI, and the Node.js version for the CLI
- For accent disputes, a source supporting the expected form

Run `node cli.mjs --json` and include the token statuses; a word reported as `guessed` or
`ambiguous` is a known-uncertain case and points straight at the responsible code path.

## Security

Do not open a public issue for a security report. Polytone parses untrusted input — `.docx`
archives in particular — so archive-extraction and XML-handling issues are in scope.

Report privately through GitHub's [private vulnerability reporting](https://github.com/georgehadji/Polytone/security/advisories/new)
(Security → Report a vulnerability). Allow reasonable time for a fix before disclosure.

## Licensing of contributions

Polytone is GPL-3.0, and it is a derivative of a third-party GPL dictionary
(see [README — Licensing](./README.md#licensing)). By contributing you agree your
contribution is licensed under GPL-3.0.

There is no CLA, and the project cannot accept one: the dictionary's copyright is held by
The Polytonic Project, so no contributor and no maintainer can relicense the combined work.
Contributions that would require relicensing cannot be merged.

Do not paste code or word lists from proprietary or incompatibly licensed sources. This
includes decompiled or reverse-engineered code: artefacts derived from decompiling a
proprietary third-party polytonic input tool (kept outside this repository, under
`scratchpad/koronis/` — `koronis_rules.json`, `verify_rows.json`, `extract_rules.py`) carry no
licence grant to anyone and must never be imported into this project, as data, as a fixture,
or otherwise. Behaviour learned from studying such a tool may inform a change only when it is
independently re-derived from a citable source (a grammar, the dictionary itself, or the
Unicode Standard) and the commit says so.

`web/jszip.min.js` is vendored, not installed via npm: JSZip 3.10.1, 97,630 bytes, SHA-256
`acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e`, dual MIT/GPLv3. Record any
upgrade's new version, size and hash here.
