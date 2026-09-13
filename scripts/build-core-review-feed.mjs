import { selectCoreReviewTargets } from './core-review-targets.mjs';
import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { contentPackageGeneratorTargets } from '../dist/packages/core/index.js';

const output = process.argv[2] ?? '/core-feed';
const generatedAt = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString().replace(/\.\d{3}Z$/u, 'Z')
  : '2026-07-13T00:00:00Z';
const targets = await selectCoreReviewTargets(contentPackageGeneratorTargets);
await rm(output, {recursive:true,force:true});
await mkdir(`${output}/packages`, {recursive:true});
if (targets.length) {
  execFileSync(process.execPath, ['dist/packages/core/content-package-generator-cli.js', ...targets.flatMap(t => ['--target',t]), '--output-dir', `${output}/packages`, '--generated-at', generatedAt, '--production'], {stdio:'inherit'});
}
console.log(`Bundled review targets: ${targets.join(', ') || '(none authored)'}`);
execFileSync(process.execPath, ['dist/packages/core/content-package-catalogue-cli.js','--packages-dir',`${output}/packages`,'--output',`${output}/catalogue.json`,'--generated-at',generatedAt], {stdio:'inherit'});
