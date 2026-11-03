import {parseEther} from 'viem';
export default {
 slug:'mintline',liveLabel:true,vercel:'mintlinebot',assets:['BOT'],name:'Mintline',repo:'mintline',contract:'MintlineFactory',color:'#5CF2B8',eyebrow:'NFT DROPS',symbol:'▤',
 line:'Drop a collection. Mint on BOT.',
 app:{title:'The gallery',line:'Every frame is a live collection. Mint from the wall, or hang your own drop.',layout:'wall'},
 description:'NFT collection drops on BOT Chain: a BOT price, a supply cap, wallet limits, an optional allowlist window, royalties, and art drawn on chain if you have no metadata host.',
 abis:['MintlineFactory','MintlineCollection'],artifacts:{MintlineFactory:'Mintline',MintlineCollection:'Mintline'},
 contracts:['src/Mintline.sol'],tests:['test/Mintline.t.sol'],
 landing:{
  steps:[['Hang a drop','Name it, set a BOT price, a supply and a wallet limit. Point it at your metadata, or let Mintline draw the art on chain.'],['Collectors mint','Up to 20 per mint at the exact price. An optional allowlist window opens first, then everyone.'],['Proceeds to you','Every BOT paid sits in your collection until you withdraw it. Royalties follow EIP-2981.']],
  features:[['On-chain art','No IPFS? Each token draws its own ruled-line artwork from its id, straight from the contract.'],['Allowlist on chain','Your allowlist is published with the drop and the root is computed from it, so it cannot be swapped later.'],['Freeze on reveal','Metadata can be set once, then it is frozen. Collections created with a host start frozen.'],['No platform cut','Mintline keeps nothing. Collectors pay your price and BOT Chain gas.']],
  faq:[['Who owns the collection?','You do. It is its own ERC-721 contract with you as creator and royalty receiver.'],['What metadata can I use?','A folder URL ending in / (each token gets its id appended), one shared URL for an edition, or nothing for on-chain art.'],['Can I change the price or supply?','No. They are fixed when the drop is created, so collectors know the terms.'],['How does the allowlist work?','Paste wallets when you create the drop. During the window only they can mint; afterwards it is public.'],['Is there a fee?','No. Mintline takes nothing from mints or royalties.']],
 },
 async deploy({deploy}){await deploy('MintlineFactory');},
 async fork({write,read,tx,artifact,owner,parseEther:pe=parseEther}){
  await write('MintlineFactory','create',['Fork Lines','FORK','Local fixture','',pe('0.001'),10,2,0n,0n,[],500]);
  const n=await read('MintlineFactory','collectionCount'),c=await read('MintlineFactory','collectionAt',[n-1n]);
  const abi=artifact('MintlineCollection').abi;await tx(abi,c,'mint',[1,[]],pe('0.001'));await tx(abi,c,'withdraw',[]);
  return {flow:'create collection → mint 1 → withdraw',collection:c};
 },
};
