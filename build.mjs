// Builds public/index.html (the real site) and dist/preview.html (sample-data preview).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { build } from 'esbuild';
const u = (p) => new URL(p, import.meta.url);
const r = (p) => readFileSync(u(p), 'utf8');
const head = r('./src/head.html'), body = r('./src/body.html');
const css = r('./src/styles.css').replace(/url\(FONT:([a-z0-9-]+)\)/g, (_, n) => `url(data:font/woff2;base64,${readFileSync(u(`./src/fonts/${n}.woff2`)).toString('base64')})`);
// explicit order; anything else in src/js is ignored
const JS = ['00-core', '10-sprites', '15-ambient', '20-hero', '25-scan', '40-feed', '50-board', '60-profile', '70-token', '80-sections', '90-main', '95-parade'].map((n) => n + '.js');
const js = JS.map((f) => `/* ${f} */\n` + r('./src/js/' + f)).join('\n');
const app = `<script>\n(() => {\n'use strict';\n${js}\n})();\n</script>`;
const three = (await build({ entryPoints: [u('./src/3d/index.js').pathname], bundle: true, minify: true, format: 'iife', write: false, legalComments: 'none', target: 'es2020' })).outputFiles[0].text;
const vx = `<script>\n${three.replace(/<\/script/gi, '<\\/script')}</script>`;

const site = `<!doctype html>\n<html lang="en">\n<head>\n${head}<script src="config.js"></script>\n<style>\n${css}</style>\n</head>\n<body>\n${body}${vx}\n${app}\n</body>\n</html>\n`;
writeFileSync(u('./public/index.html'), site);

mkdirSync(u('./dist/'), { recursive: true });
const small = u('./dist/pfp-small.png');
const pfp = 'data:image/png;base64,' + readFileSync(existsSync(small) ? small : u('./public/pfp.png')).toString('base64');
const cfg = r('./public/config.js');
const sim = r('./preview/sim.js');
const previewHead = head.replace('<title>echoes · echo any wallet</title>', '<title>echoes</title>').replace(/<meta property="og:[^>]+>\n|<meta name="twitter:[^>]+>\n/g, '').replace('href="pfp.png"', `href="${pfp}"`);
const preview = `${previewHead}<script>${cfg}</script>\n<style>\n${css}</style>\n${body.replace(/src="pfp\.png"/g, `src="${pfp}"`)}<script>\n${sim}\n</script>\n${vx}\n${app}\n`;
writeFileSync(u('./dist/preview.html'), preview);
console.log('site', (site.length / 1024).toFixed(1) + 'KB', 'preview', (preview.length / 1024).toFixed(1) + 'KB', '3d', (three.length / 1024).toFixed(1) + 'KB');
