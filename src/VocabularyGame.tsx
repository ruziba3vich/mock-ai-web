import { useState } from "react";

// Original practice examples, not taken from an IELTS exam or another platform.
export const vocabulary = [
  { word:"allocate",meaning:"set aside for a purpose",example:"The council allocated funds to improve the library.",distractors:["remove without permission","measure a distance"] },
  { word:"scarce",meaning:"in short supply",example:"Fresh water becomes scarce during a prolonged drought.",distractors:["easy to replace","widely accepted"] },
  { word:"sustain",meaning:"keep something going",example:"Regular investment can sustain public transport services.",distractors:["divide into equal parts","make an exact prediction"] },
  { word:"fluctuate",meaning:"rise and fall",example:"Visitor numbers fluctuate throughout the year.",distractors:["remain unchanged","disappear permanently"] },
  { word:"assess",meaning:"evaluate carefully",example:"Researchers assessed the effects of the new policy.",distractors:["copy a pattern","delay an event"] },
  { word:"substantial",meaning:"large or significant",example:"Insulation led to a substantial reduction in energy use.",distractors:["difficult to see","occurring by chance"] },
  { word:"retain",meaning:"keep or continue to have",example:"Trees help the soil retain moisture.",distractors:["move to a different place","reject an idea"] },
  { word:"evident",meaning:"clear to see",example:"The benefits became evident after several months.",distractors:["unlikely to happen","still being planned"] },
  { word:"mitigate",meaning:"make less severe",example:"Shade can mitigate the effects of extreme heat.",distractors:["make more complicated","describe in detail"] },
  { word:"diverse",meaning:"including many different kinds",example:"The wetland supports a diverse range of species.",distractors:["limited to one location","recently discovered"] },
  { word:"adjacent",meaning:"next to something",example:"The study room is adjacent to the main hall.",distractors:["far below something","identical to something"] },
  { word:"feasible",meaning:"possible to carry out",example:"A smaller pilot project would be more feasible.",distractors:["required by law","already finished"] },
];
function shuffled<T>(items:T[]):T[]{ const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; }
type Card = typeof vocabulary[number] & { options:string[] };
type Word={word:string;meaning:string;example:string;distractors:string[]};
export default function VocabularyGame({items=vocabulary}:{items?:Word[]}){
  const [cards,setCards]=useState<Card[]>([]);
  const [index,setIndex]=useState(0);
  const [selected,setSelected]=useState<string|null>(null);
  const [score,setScore]=useState(0);
  const [missed,setMissed]=useState<Card[]>([]);
  function start(){setCards(shuffled(items).slice(0,5).map(v=>({...v,options:shuffled([v.meaning,...v.distractors])})));setIndex(0);setSelected(null);setScore(0);setMissed([]);}
  const card=cards[index];const finished=cards.length>0&&!card;
  return <section className="explore-card vocabulary-game" aria-labelledby="vocabulary-title"><p className="eyebrow">Two-minute warm-up · Reading vocabulary</p><h2 id="vocabulary-title">Word warm-up</h2>
    {!cards.length && <><p>{items.length?"Five academic words. Choose their meanings, then learn from an example. No timer, no pressure.":"New vocabulary cards are being prepared. Check back soon."}</p>{items.length>0&&<button className="primary-action" onClick={start}>Play a round →</button>}</>}
    {card && <><p>Word {index+1} of {cards.length}</p><h3 className="vocabulary-word">{card.word}</h3><div className="vocabulary-options">{card.options.map(option=><button key={option} disabled={selected!==null} className={selected!==null&&option===card.meaning?"correct":""} onClick={()=>{setSelected(option);if(option===card.meaning)setScore(v=>v+1);else setMissed(v=>[...v,card]);}}>{option}</button>)}</div>{selected!==null&&<div role="status" className="vocabulary-feedback"><strong>{selected===card.meaning?"That’s right.":`Not quite. ${card.word} means “${card.meaning}”.`}</strong><p>{card.example}</p><button className="secondary-action" onClick={()=>{setIndex(v=>v+1);setSelected(null);}}>{index===cards.length-1?"See my result":"Next word →"}</button></div>}</>}
    {finished&&<div role="status"><h3>{score===5?"Five for five!":"A little more vocabulary, learned."}</h3><p>You matched {score} of 5 meanings.</p>{missed.length>0&&<><h4>Words to revisit</h4><ul>{missed.map(v=><li key={v.word}><strong>{v.word}</strong> — {v.meaning}<p>{v.example}</p></li>)}</ul></>}<button className="primary-action" onClick={start}>Play another round</button></div>}
    <small className="explore-caption">Just for practice. This round is not saved and does not affect your band or leaderboard points.</small>
  </section>;
}
