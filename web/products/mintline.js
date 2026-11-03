import {$,config,abis,client,state,esc,link,form,field,area,read,tx,mine,start,button,chainTime} from '../core.js';
import {nice,units,checksum,countdown,tick,optional,many,when,pct} from '../w3kit.js';
import {keccak256,encodeAbiParameters,concat,hexToBigInt,getAddress,isAddress,hexToBytes} from 'viem';
const tally={drops:0,minted:0,live:0};
const qty=new Map();let timers=[],skew=0;
const lists=new Map();
/** A JS copy of MintlineCollection.art(): the same seed, palette and layout, so previews match the chain exactly. */
export function art(collection,id){
 const seed=hexToBytes(keccak256(encodeAbiParameters([{type:'address'},{type:'uint256'}],[collection,BigInt(id)])));const hue=Math.floor(seed[0]*360/256);
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="hsl(${hue},38%,11%)"/>`;
 for(let i=0;i<12;i++){const r=seed[i+1],y=40+i*28,x=24+(r%7)*20,w=90+(r%140),h=(hue+(r%5)*36)%360;s+=`<rect x="${x}" y="${y}" width="${w}" height="${6+r%14}" rx="4" fill="hsl(${h},80%,${52+r%22}%)"/>`;}
 return s+`<circle cx="330" cy="330" r="44" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="4 5"/><text x="330" y="338" font-family="monospace" font-size="22" fill="#fff" text-anchor="middle">#${id}</text></svg>`;
}
const img=(svg,alt)=>`<img src="data:image/svg+xml;utf8,${encodeURIComponent(svg)}" alt="${esc(alt)}" width="400" height="400" loading="lazy">`;
const wl=a=>keccak256(keccak256(encodeAbiParameters([{type:'address'}],[a])));
const pair=(a,b)=>hexToBigInt(a)<hexToBigInt(b)?keccak256(concat([a,b])):keccak256(concat([b,a]));
function proofFor(leaves,index){const out=[];let nodes=[...leaves];while(nodes.length>1){if(index%2)out.push(nodes[index-1]);else if(index+1<nodes.length)out.push(nodes[index+1]);const next=[];for(let i=0;i<nodes.length;i+=2)next.push(i+1<nodes.length?pair(nodes[i],nodes[i+1]):nodes[i]);nodes=next;index=Math.floor(index/2);}return out;}
async function allowlistOf(c,block){
 if(lists.has(c))return lists.get(c);
 const logs=await client.getContractEvents({address:config.contracts.MintlineFactory,abi:abis.MintlineFactory,eventName:'Allowlist',args:{collection:c},fromBlock:block,toBlock:block});
 const l=logs[0]?.args.wallets||[];lists.set(c,l);return l;
}
const f_=(cls,html)=>`<div class="f ${cls}">${html}</div>`;
const sample='0x'+[...crypto.getRandomValues(new Uint8Array(20))].map(b=>b.toString(16).padStart(2,'0')).join('');
function controls(){
 $('list-title').textContent='On the wall';
 $('controls').innerHTML='<div class="composer-head"><div><span class="eyebrow">New drop</span><h2>Hang a collection</h2><p>Fixed price, fixed supply, proceeds straight to you. No host? Mintline draws the art on chain.</p></div><div class="sample" aria-label="Sample on-chain art">'+[1,2,3].map(i=>img(art(sample,i),`Sample token #${i}`)).join('')+'</div></div>'
  +form('hang',f_('wide',field('name','Collection name','','text','maxlength="40" placeholder="Night Lines"'))+f_('',field('symbol','Symbol','','text','maxlength="10" placeholder="NITE"'))+f_('',field('price','Price (BOT)','0.5','text','inputmode="decimal"'))
   +f_('',field('supply','Supply','500','text','inputmode="numeric"'))+f_('',optional(field('per','Per wallet (0 = no limit)','5','text','inputmode="numeric"')))+f_('',field('royalty','Royalty %','5','text','inputmode="decimal"'))
   +f_('',`<label for="startIn">Opens</label><select id="startIn" name="startIn"><option value="0">Right away</option><option value="3600">In 1 hour</option><option value="86400">In 24 hours</option></select>`)
   +f_('wide',`<label for="meta">Artwork</label><select id="meta" name="meta"><option value="chain">Draw it on chain</option><option value="folder">Folder of metadata (URL ending in /)</option><option value="edition">One shared metadata URL (edition)</option></select>`)
   +f_('wide',optional(field('uri','Metadata URL','','text','maxlength="200" placeholder="ipfs://… (not needed for on-chain art)"')))
   +f_('full',area('desc','Description').replace('maxlength="2000" required','maxlength="280"'))
   +f_('wide',area('allow','Allowlist wallets (optional, one per line)').replace(' required',''))+f_('',`<label for="allowHours">Allowlist window</label><select id="allowHours" name="allowHours"><option value="0">None</option><option value="3600">1 hour</option><option value="21600">6 hours</option><option value="86400">24 hours</option></select>`),
   'Hang the collection',async f=>{
    const name=f.name.trim(),symbol=f.symbol.trim().toUpperCase();if(!name||!symbol)throw Error('Add a name and a symbol.');
    if(/["\\]/.test(name+f.desc))throw Error('Leave quotes and backslashes out of the name and description.');
    const price=f.price.trim()==='0'?0n:units(f.price),supply=Number(f.supply),per=Number(f.per||0),roy=Math.round(Number(f.royalty||0)*100);
    if(!(supply>=1&&supply<=100000))throw Error('Supply must be 1 to 100,000.');if(!(roy>=0&&roy<=1000))throw Error('Royalty can be 0% to 10%.');
    const uri=f.meta==='chain'?'':f.uri.trim();if(f.meta==='folder'&&!uri.endsWith('/'))throw Error('A folder URL must end in /.');if(f.meta!=='chain'&&!uri)throw Error('Add the metadata URL.');
    const wallets=[...new Set((f.allow||'').split(/[\s,;]+/).filter(Boolean).map(a=>checksum(a)))];
    const hours=Number(f.allowHours);if(hours&&!wallets.length)throw Error('Add allowlist wallets, or set the window to None.');
    const startAt=BigInt(await chainTime()+Number(f.startIn));
    await tx('MintlineFactory','create',[name,symbol,f.desc||'',uri,price,supply,per,startAt,startAt+BigInt(hours),wallets,roy]);
   });
 $('rules').innerHTML='<ul><li>Price, supply, wallet limit and allowlist are fixed when the collection is created.</li><li>Up to 20 tokens per mint, at the exact price.</li><li>During the allowlist window only listed wallets can mint; then it is public.</li><li>Metadata can be set once and is then frozen. With no host, the contract draws each token.</li><li>All mint proceeds go to the creator. No platform fee.</li></ul>';
 document.addEventListener('click',e=>{const b=e.target.closest('[data-step]');if(!b)return;const c=b.dataset.c,n=Math.max(1,Math.min(20,(qty.get(c)||1)+Number(b.dataset.step)));qty.set(c,n);const box=b.closest('.stepper');box.querySelector('output').textContent=n;box.closest('.placard').querySelector('[data-total]').textContent=`${nice(BigInt(box.dataset.price)*BigInt(n))} BOT`;});
}
const fields=['name','symbol','price','maxSupply','perWallet','start','publicStart','allowRoot','createdBlock','baseURI','frozen','minted','creator','description','raised'];
async function frame(c,v,bal,mineCount,now){
 const [name,symbol,price,maxSupply,perWallet,startT,publicStart,allowRoot,createdBlock,baseURI,frozen,minted,creator]=v;
 const soldOut=minted>=maxSupply,notYet=now<Number(startT),allowPhase=!notYet&&now<Number(publicStart);
 if(!soldOut&&!notYet)tally.live++;tally.minted+=minted;
 const phase=soldOut?'Sold out':notYet?'Opens soon':allowPhase?'Allowlist':'Public';
 if(notYet||allowPhase)timers.push({c,at:(notYet?Number(startT):Number(publicStart))-skew});
 const show=Math.max(1,minted),onchain=!baseURI;
 const artwork=onchain?img(art(c,show),`${name} #${show}`):`<div class="external"><span class="sub">Hosted metadata</span><a href="${esc(baseURI.replace(/^ipfs:\/\//,'https://ipfs.io/ipfs/'))}" target="_blank" rel="noopener noreferrer">${esc(baseURI.length>38?baseURI.slice(0,36)+'…':baseURI)}</a></div>`;
 let proof=[],allowed=!allowPhase,why='';
 if(allowPhase&&state.account){const l=await allowlistOf(c,createdBlock);const i=l.findIndex(a=>a.toLowerCase()===state.account.toLowerCase());if(i>=0){allowed=true;proof=proofFor(l.map(wl),i);}else why='Your wallet is not on the allowlist.';}
 const left=perWallet?Math.max(0,perWallet-mineCount):20,n=Math.min(qty.get(c)||1,Math.max(1,Math.min(20,left,maxSupply-minted)));qty.set(c,n);
 const can=state.account&&!soldOut&&!notYet&&allowed&&left>0;
 if(!why)why=!state.account?'Connect a wallet to mint.':soldOut?'Every token has been minted.':notYet?`Opens in <span data-open="${c}">${countdown(Number(startT)-now)}</span>.`:left<=0?'You reached this drop\'s wallet limit.':allowPhase?`Allowlist window · public in <span data-open="${c}">${countdown(Number(publicStart)-now)}</span>.`:'';
 const acts=[];
 if(mine(creator)&&bal>0n)acts.push(button(`Withdraw ${nice(bal)} BOT`,()=>tx('MintlineCollection','withdraw',[],0n,c)));
 const reveal=mine(creator)&&!frozen?form(`reveal-${c}`,`<label for="reveal-${c}-uri">Reveal metadata (once, then frozen)</label><input id="reveal-${c}-uri" name="uri" placeholder="ipfs://folder/" required>`,'Reveal',async f=>tx('MintlineCollection','reveal',[f.uri.trim()],0n,c)):'';
 return `<article class="frame-card" id="c-${c.slice(2,10)}">
  <div class="frame"><div class="mat">${artwork}</div><span class="phase badge${!soldOut&&!notYet?' live':''}">${phase}</span></div>
  <div class="placard"><h3>${esc(name)}</h3><p class="tiny">${esc(symbol)} · by ${mine(creator)?'you':link(creator)} · ${link(c,'contract')}</p>
   <div class="edition"><span class="mono">${minted.toLocaleString('en-US')} / ${maxSupply.toLocaleString('en-US')}</span><div class="meter" aria-hidden="true"><i style="width:${pct(BigInt(minted),BigInt(maxSupply))}%"></i></div></div>
   <dl class="figs"><div><dt>Price</dt><dd>${price===0n?'Free':`${nice(price)} BOT`}</dd></div><div><dt>Per wallet</dt><dd>${perWallet||'No limit'}</dd></div><div><dt>Art</dt><dd>${onchain?'On chain':frozen?'Hosted · frozen':'Hosted'}</dd></div></dl>
   ${can?`<div class="mint-row"><div class="stepper" data-price="${price}"><button type="button" class="quiet" data-step="-1" data-c="${c}" aria-label="One fewer">−</button><output aria-live="polite">${n}</output><button type="button" class="quiet" data-step="1" data-c="${c}" aria-label="One more">+</button></div>${button('Mint',async()=>{const k=qty.get(c)||1;await tx('MintlineCollection','mint',[k,proof],price*BigInt(k),c);},true)}</div><p class="tiny">Total <b data-total>${nice(price*BigInt(n))} BOT</b>${allowPhase?' · allowlist proof attached':''}</p>`:`<p class="tiny">${why}</p>`}
   ${acts.length?`<div class="actions">${acts.join('')}</div>`:''}${reveal}
  </div></article>`;
}
async function render(){
 const F=config.contracts.MintlineFactory,count=Number(await read('MintlineFactory','collectionCount')),now=await chainTime();skew=now-Date.now()/1000;timers=[];Object.assign(tally,{drops:count,minted:0,live:0});
 if(!count)return '<div class="empty gallery-empty"><p>The walls are bare.</p><p class="tiny">Hang the first collection.</p></div>';
 const idx=[...Array(Math.min(count,24)).keys()].map(k=>count-1-k);
 const cs=await many(idx.map(i=>({address:F,abi:abis.MintlineFactory,functionName:'collectionAt',args:[BigInt(i)]})));
 const A=abis.MintlineCollection,vals=await many(cs.flatMap(c=>fields.slice(0,13).map(fn=>({address:c,abi:A,functionName:fn}))));
 const bals=await Promise.all(cs.map(c=>client.getBalance({address:c})));
 const mineCounts=state.account?await many(cs.map(c=>({address:c,abi:A,functionName:'mintedBy',args:[state.account]}))):[];
 const cards=await Promise.all(cs.map((c,k)=>frame(c,vals.slice(k*13,k*13+13),bals[k],Number(mineCounts[k]||0),now)));
 return `<div class="gallery">${cards.join('')}</div>`;
}
function after(){tick(()=>{const t=Date.now()/1000;let ring=false;for(const x of timers){const el=document.querySelector(`[data-open="${x.c}"]`);if(!el)continue;const s=x.at-t;if(s<=0)ring=true;el.textContent=countdown(s);}if(ring){timers=[];$('refresh').click();}});}
function stats(empty){return [['Collections',empty?'—':String(tally.drops)],['Minting now',empty?'—':String(tally.live)],['Tokens minted',empty?'—':tally.minted.toLocaleString('en-US')]];}
start({controls,render,stats,after});
