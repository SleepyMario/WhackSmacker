// Application release gate. npm test additionally runs authoring/recovery
// audits against external curriculum trees, including retired lesson editions.
import { spawnSync } from 'node:child_process';
const files = [
  'architecture', 'brief-introduction-setting-validation',
  'chess-cli','chess-core','chess-desktop','cli',
  'core-review-feed','content-package-manager','content-package-source-path','content-package-spec',
  'curriculum-display','deck-family','deck-framework','deploy-production',
  'docker-workflow','east-asian-name-policy','exercise-renderer',
  'geography-renderer','geography-review','i18n',
  'language-adaptive-lexicon-policy','language-terms','lexical-identity-policy',
  'linguistic-terminology','mathematics-artifacts','mathematics-pdf','mathematics-workbook',
  'medical-output-artwork','memorization-item','new-vocabulary-display',
  'package-media','package','postgres-auth','reading-review-integration',
  'review-menu-status-colors','review-scheduler','terminal-artwork',
  'topic-review-presentation','user-data-backup','web-reader','web'
];
console.log(`Docker application gate: ${files.length} test files; external chapter-edition audits remain under npm test.`);
const result = spawnSync(process.execPath, ['--test','--test-concurrency=1',...files.map(file=>`test/${file}.test.mjs`)],{stdio:'inherit'});
if(result.error) throw result.error;
process.exit(result.status ?? 1);
