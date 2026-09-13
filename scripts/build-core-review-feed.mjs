import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { contentPackageGeneratorTargets } from '../dist/packages/core/index.js';

const output = process.argv[2] ?? '/core-feed';
const generatedAt = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString().replace(/\.\d{3}Z$/u, 'Z')
  : '2026-07-13T00:00:00Z';
async function hasCards(directory) {
  let entries;
  try { entries = await readdir(directory, {withFileTypes:true}); }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  for (const entry of entries) {
    if (entry.isFile() && entry.name === 'cards.tsv') return true;
    if (entry.isDirectory() && await hasCards(`${directory}/${entry.name}`)) return true;
  }
  return false;
}
const targets = [];
for (const target of contentPackageGeneratorTargets.filter(t => t.id.endsWith('-core-reviews'))) {
  if (await hasCards(target.sourcePath)) targets.push(target.id);
}
await rm(output, {recursive:true,force:true});
await mkdir(`${output}/packages`, {recursive:true});
if (targets.length) {
  execFileSync(process.execPath, ['dist/packages/core/content-package-generator-cli.js', ...targets.flatMap(t => ['--target',t]), '--output-dir', `${output}/packages`, '--generated-at', generatedAt, '--production'], {stdio:'inherit'});
}
console.log(`Bundled review targets: ${targets.join(', ') || '(none authored)'}`);
execFileSync(process.execPath, ['dist/packages/core/content-package-catalogue-cli.js','--packages-dir',`${output}/packages`,'--output',`${output}/catalogue.json`,'--generated-at',generatedAt], {stdio:'inherit'});
