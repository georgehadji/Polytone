// Παράγει web/ artifacts ώστε το index.html να δουλεύει με διπλό κλικ (file://):
// - web/lexicon.js       (window.LEXICON = {...})
// - web/engine.browser.js (engine.mjs χωρίς export, εκθέτει window.Polytone)
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const BANNER = '/* Polytone — GPL-3.0. Το λεξικό παράγεται από dict/el-polyton,\n' +
  '   © Α. Δεληγιάννη / The Polytonic Project. Η αναφορά πρέπει να διατηρείται\n' +
  '   σε κάθε αναδιανομή· βλ. web/LICENSE.txt και web/dict-LICENSE.txt. */\n';

const lexicon = readFileSync('lexicon.json', 'utf8');
writeFileSync('web/lexicon.js', BANNER + 'window.LEXICON=' + lexicon + ';');

const engine = readFileSync('engine.mjs', 'utf8').replace(/^export /gm, '');
writeFileSync('web/engine.browser.js', BANNER + engine +
  '\nwindow.Polytone = { polytonize, hasPolytonicMark, convertDocxXml, DOCX_PARTS };\n');

copyFileSync('LICENSE', 'web/LICENSE.txt');
copyFileSync('dict/LICENSE.txt', 'web/dict-LICENSE.txt');

console.log('web/lexicon.js + web/engine.browser.js + licence copies έτοιμα');
