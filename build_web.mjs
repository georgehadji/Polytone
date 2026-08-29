// Παράγει web/ artifacts ώστε το index.html να δουλεύει με διπλό κλικ (file://):
// - web/lexicon.js       (window.LEXICON = {...})
// - web/engine.browser.js (engine.mjs χωρίς export, εκθέτει window.Polytone)
import { readFileSync, writeFileSync } from 'node:fs';

const lexicon = readFileSync('lexicon.json', 'utf8');
writeFileSync('web/lexicon.js', 'window.LEXICON=' + lexicon + ';');

const engine = readFileSync('engine.mjs', 'utf8').replace(/^export /gm, '');
writeFileSync('web/engine.browser.js',
  engine + '\nwindow.Polytone = { polytonize, hasPolytonicMark };\n');

console.log('web/lexicon.js + web/engine.browser.js έτοιμα');
