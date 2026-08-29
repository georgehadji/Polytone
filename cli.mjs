#!/usr/bin/env node
// Polytone CLI: μονοτονικό/mixed -> πολυτονικό.
//   node cli.mjs                    stdin -> stdout
//   node cli.mjs in.txt             -> stdout
//   node cli.mjs in.txt -o out.txt
//   node cli.mjs in.docx            -> in.poly.docx (μορφοποίηση άθικτη)
//   --json                          -> {text, unknown:[], ambiguous:[], guessed:[]} στο stdout
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, basename } from 'node:path';
import { polytonize } from './engine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const lexicon = JSON.parse(readFileSync(join(here, 'lexicon.json'), 'utf8'));

const args = process.argv.slice(2);
const json = args.includes('--json');
const oIdx = args.indexOf('-o');
const outPath = oIdx !== -1 ? args[oIdx + 1] : null;
const files = args.filter((a, i) => a !== '--json' && (oIdx === -1 || (i !== oIdx && i !== oIdx + 1)));

function convertText(text) {
  const r = polytonize(text, lexicon);
  if (!json) return r.text;
  const by = (s) => [...new Set(r.tokens.filter((t) => t.status === s).map((t) => t.word))];
  return JSON.stringify({
    text: r.text,
    unknown: by('unknown'),
    ambiguous: by('ambiguous'),
    guessed: by('guessed'),
  });
}

const XML_TARGETS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;

function convertDocx(path, out) {
  // lazy import: μόνο όταν χρειάζεται docx
  return import('adm-zip').then(({ default: AdmZip }) => {
    const zip = new AdmZip(path);
    for (const entry of zip.getEntries()) {
      if (!XML_TARGETS.test(entry.entryName)) continue;
      const xml = entry.getData().toString('utf8');
      // ponytail: μετατροπή ανά <w:t> run — λέξη κομμένη σε δύο runs δεν πολυτονίζεται (σπάνιο)
      const converted = xml.replace(/(<w:t[^>]*>)([^<]*)(<\/w:t>)/g, (_, open, text, close) => {
        const unescaped = text.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
        const poly = polytonize(unescaped, lexicon).text;
        const escaped = poly.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
        return open + escaped + close;
      });
      zip.updateFile(entry.entryName, Buffer.from(converted, 'utf8'));
    }
    const target = out ?? path.replace(/\.docx$/i, '.poly.docx');
    zip.writeZip(target);
    console.error(`γράφτηκε: ${target}`);
  });
}

async function main() {
  if (files.length === 0) {
    const input = readFileSync(0, 'utf8'); // stdin
    process.stdout.write(convertText(input));
    return;
  }
  for (const f of files) {
    if (extname(f).toLowerCase() === '.docx') {
      await convertDocx(f, files.length === 1 ? outPath : null);
    } else {
      const result = convertText(readFileSync(f, 'utf8'));
      if (outPath && files.length === 1) writeFileSync(outPath, result);
      else process.stdout.write(result);
    }
  }
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
