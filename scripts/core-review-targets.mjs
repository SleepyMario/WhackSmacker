import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
async function hasCards(directory) {
  let entries;
  try { entries = await readdir(directory, {withFileTypes:true}); }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  for (const entry of entries) {
    if (entry.isFile() && entry.name === 'cards.tsv') return true;
    if (entry.isDirectory() && await hasCards(resolve(directory,entry.name))) return true;
  }
  return false;
}
export async function selectCoreReviewTargets(targets, root=process.cwd()) {
  const selected=[];
  for(const target of targets.filter(t=>t.id.endsWith('-core-reviews'))) {
    if(await hasCards(resolve(root,target.sourcePath))) selected.push(target.id);
  }
  return selected;
}
