import assert from 'node:assert/strict';
import { test } from 'node:test';
import { memorizationOutputsFromAnswer } from '../dist/packages/core/memorization-item.js';
import { medicalArtworkAllowed, medicalPresentation } from '../dist/packages/core/medical-presentation.js';
import { renderEmbeddedReviewSession } from '../dist/apps/cli/interactive-menu.js';

test('medical artwork hides only the unanswered target-language prompt', () => {
  const item = { tags: ['medical','respiratory'], language: {base:'en',target:'zh-Hant'},
    prompt:{text:'![Lung](media/lung.png) 肺',mediaType:'text/markdown',language:'zh-Hant'},
    answer:{text:'English: lung\nArtwork: ![Lung](media/lung.png)',mediaType:'text/markdown',language:'en'} };
  assert.equal(medicalArtworkAllowed(item,'prompt'),false);
  assert.equal(medicalArtworkAllowed(item,'answer'),true);
  const shown=medicalPresentation(item,'en-US');
  assert.equal(shown.prompt.text,'肺');
  assert.equal(shown.answer,item.answer);
  assert.equal(shown.notes,'Part of the respiratory system.');
  assert.match(item.prompt.text,/!\[/);
  assert.equal(medicalArtworkAllowed({...item,prompt:{...item.prompt,language:'en'}}),true);
});

test('medical reveal appends target-first artwork but keeps source-first artwork above', () => {
  const exercise={itemIdentity:{},kind:'vocabulary',title:'',promptLines:['肺'],answerLines:['lung'],hintLines:[],noteLines:[],exampleLines:[],metadataLines:[],warnings:[]};
  const base={node:{label:'Medical I'},items:[{itemId:'x'}],index:0,side:'answer',promptRendered:exercise,answerRendered:exercise,artwork:{},promptArtworkRendered:true,answerArtworkRendered:true};
  const item={id:'x',tags:['medical'],prompt:{language:'zh-Hant'},language:{base:'en'}};
  const reverse=renderEmbeddedReviewSession({...base,developerItems:[{item}]},false);
  const marker='[[WHACKSMACKER_REVIEW_ARTWORK_REGION]]';
  assert(reverse.indexOf(marker)>reverse.indexOf('lung'));
  const forward=renderEmbeddedReviewSession({...base,developerItems:[{item:{...item,prompt:{language:'en'}}}]},false);
  assert(forward.indexOf(marker)<forward.indexOf('Phrase:'));
  const question=renderEmbeddedReviewSession({...base,side:'prompt',artwork:undefined,developerItems:[{item}]},false);
  assert(!question.includes(marker));
});

test('medical ABC separates translation and image with safe text fallback', () => {
  const outputs = memorizationOutputsFromAnswer({
    text: 'Chinese: 白血球\nArtwork: ![Blood components](media/blood-components.png)',
    mediaType: 'text/markdown', language: 'zh-Hant'
  });
  assert.equal(outputs.length, 2);
  assert.equal(outputs[0].content.text, '白血球');
  assert.equal(outputs[1].id, 'artwork');
  assert.equal(outputs[1].content.plainText, '[Image: Blood components]');
});
