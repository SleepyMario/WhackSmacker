// Preserve historical archives; derive the live feed and reset reminders.
import fs from 'node:fs';
import path from 'node:path';
const [input, output] = process.argv.slice(2);
const feed = JSON.parse(fs.readFileSync(input, 'utf8'));
const root = path.dirname(path.dirname(input));
const retired = new Set();
function hasChapters(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).some(e =>
    e.isDirectory() && (e.name.startsWith('chapter-') || hasChapters(path.join(dir, e.name))));
}
for (const entry of feed.packages) {
  if (entry.contentType !== 'language-curriculum') continue;
  const repo = path.basename(entry.source?.repository ?? '').replace(/\.git$/, '');
  if (!repo.endsWith('-curriculum')) continue;
  const dir = path.join(root, repo);
  const readme = path.join(dir, 'README.md');
  const units = path.join(dir, 'units');
  if (fs.existsSync(readme) && fs.existsSync(units)
      && fs.readFileSync(readme, 'utf8').includes('curriculum-reset-status:')
      && !hasChapters(units)) retired.add(entry.packageId);
}
fs.writeFileSync(path.join(path.dirname(output), 'launcher-reset-packages.json'),
  JSON.stringify([...retired].flatMap(id => [id, id + '.reviews'])) + '\n');
// Prefer verified current reading/review artifacts over superseded legacy archives.
const recoveredPackages = new Set(['japanese', 'korean', 'vietnamese'].flatMap(language =>
  ['', '.reviews'].map(suffix => `com.sleepymario.language.${language}${suffix}`)));
feed.packages = feed.packages.filter(entry => !recoveredPackages.has(entry.packageId)
  || entry.deckVersion !== undefined);
fs.writeFileSync(output + '.tmp', JSON.stringify(feed, null, 2) + '\n');
fs.renameSync(output + '.tmp', output);
if (retired.size) console.error(`WhackSmacker launcher: showing ${retired.size} reset curricula as reminders; automatic installation is skipped.`);
