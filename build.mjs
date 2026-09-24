// Builds public/index.html (the real site) and dist/preview.html (sample-data preview).
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
const r = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const head = r('./src/head.html'), css = r('./src/styles.css'), body = r('./src/body.html');
const js = readdirSync(new URL('./src/js/', import.meta.url)).filter((f) => f.endsWith('.js')).sort().map((f) => `/* ${f} */\n` + r('./src/js/' + f)).join('\n');
const app = `<script>\n(() => {\n'use strict';\n${js}\n})();\n</script>`;

const site = `<!doctype html>\n<html lang="en">\n<head>\n${head}<script src="config.js"></script>\n<style>\n${css}</style>\n</head>\n<body>\n${body}${app}\n</body>\n</html>\n`;
writeFileSync(new URL('./public/index.html', import.meta.url), site);

mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
const small = new URL('./dist/pfp-small.png', import.meta.url);
const pfpFile = (await import('node:fs')).existsSync(small) ? small : new URL('./public/pfp.png', import.meta.url);
const cfg = r('./public/config.js');
const pfp = 'data:image/png;base64,' + readFileSync(pfpFile).toString('base64');
const sim = r('./preview/sim.js');
const previewHead = head.replace('<title>echoes · echo any wallet</title>', '<title>echoes</title>').replace(/<meta property="og:[^>]+>\n|<meta name="twitter:[^>]+>\n/g, '').replace('href="pfp.png"', `href="${pfp}"`);
const preview = `${previewHead}<script>${cfg}</script>\n<style>\n${css}</style>\n${body.replace(/src="pfp\.png"/g, `src="${pfp}"`)}<script>\n${sim}\n</script>\n${app}\n`;
writeFileSync(new URL('./dist/preview.html', import.meta.url), preview);
console.log('site', (site.length / 1024).toFixed(1) + 'KB', 'preview', (preview.length / 1024).toFixed(1) + 'KB');
