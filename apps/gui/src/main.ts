import { invoke } from '@tauri-apps/api/core';
import { createInitialReviewState, recordReviewOutcome, isReviewDue, type ReviewItemState } from './core/review-scheduler';
import './style.css';
const identity = { packageId:'local.proof.geography', packageVersion:'0.1.0', itemId:'belgium-capital' };
import { now } from './clock';
let state:ReviewItemState;
const root=document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML=`<main><header><span>WhackSmacker</span><small>0.1.0-alpha.5 · GUI proof</small></header><p class="eyebrow">GEOGRAPHY / CAPITALS</p><h1>A small step<br>around the world.</h1><section><p>What is the capital of Belgium?</p><form><label for="answer">Your answer</label><input id="answer" autocomplete="off" placeholder="Type a city…" required><button id="submit" disabled>Check answer</button></form><p id="feedback" role="status">Loading your practice…</p></section><footer><span id="progress"></span><p>Separate demo data. Your existing WSM progress is untouched.</p></footer></main>`;
const feedback=document.querySelector<HTMLParagraphElement>('#feedback')!;
const submit=document.querySelector<HTMLButtonElement>('#submit')!;
function render(){document.querySelector('#progress')!.textContent=`Saved reviews: ${state.reviewCount}`;}
async function load(){try{const saved=await invoke<string|null>('load_progress'); state=saved?JSON.parse(saved):createInitialReviewState(identity,now());isReviewDue(state,now());if(state.packageId!==identity.packageId||state.itemId!==identity.itemId)throw Error('Unexpected demo identity');render();feedback.textContent=state.reviewCount?'Your last practice was restored.':'Ready for your first practice.';submit.disabled=false;}catch(e){feedback.textContent=`Could not load practice: ${String(e)}`;}}
document.querySelector('form')!.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{const correct=document.querySelector<HTMLInputElement>('#answer')!.value.trim().toLowerCase()==='brussels';const next=recordReviewOutcome(state,correct?'good':'again',now()).state;await invoke('save_progress',{value:JSON.stringify(next)});state=next;render();feedback.textContent=correct?'Correct — Brussels. Progress saved.':'The answer is Brussels. Progress saved; try again.';}catch(e){feedback.textContent=`Could not save practice: ${String(e)}`;}finally{submit.disabled=false;}});
void load();
