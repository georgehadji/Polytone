#!/usr/bin/env node
// Polytone CLI: μονοτονικό/mixed -> πολυτονικό.
//   node cli.mjs                    stdin -> stdout
//   node cli.mjs in.txt             -> stdout
//   node cli.mjs in.txt -o out.txt
//   node cli.mjs in.docx            -> in.poly.docx (μορφοποίηση άθικτη)
//   --json                          -> {text, unknown:[], ambiguous:[], guessed:[]} στο stdout
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, basename, resolve } from 'node:path';
import { polytonize, convertDocxXml, DOCX_PARTS } from './engine.mjs';

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

// ponytail: όρια πολιτικής για untrusted .docx. Η adm-zip ήδη φράζει το inflate στο
// δηλωμένο μέγεθος (CVE-2026-39244)· αυτό κατεβάζει το ταβάνι από uint32 σε 64 MiB
// ανά part και 256 MiB συνολικά (το DOCX_PARTS δέχεται headerN/footerN χωρίς όριο).
const MAX_PART_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

function convertDocx(path, out) {
  // lazy import: μόνο όταν χρειάζεται docx
  return import('adm-zip').then(({ default: AdmZip }) => {
    const zip = new AdmZip(path);
    let budget = MAX_TOTAL_BYTES;
    for (const entry of zip.getEntries()) {
      if (!DOCX_PARTS.test(entry.entryName)) continue;
      budget -= entry.header.size;
      if (entry.header.size > MAX_PART_BYTES || budget < 0) {
        throw new Error(`${entry.entryName}: υπερβαίνει το όριο μεγέθους`);
      }
      const xml = entry.getData().toString('utf8');
      zip.updateFile(entry.entryName, Buffer.from(convertDocxXml(xml, lexicon), 'utf8'));
    }
    const target = out ?? path.replace(/\.docx$/i, '.poly.docx');
    // -o πάνω στο ίδιο αρχείο θα έσβηνε ανεπίστρεπτα το πρωτότυπο.
    if (resolve(target) === resolve(path)) {
      throw new Error('το -o δείχνει στο ίδιο αρχείο· δώσε άλλη διαδρομή');
    }
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
