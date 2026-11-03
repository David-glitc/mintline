# Mintline

**Drop a collection. Mint on BOT.** NFT collection drops on BOT Chain: a BOT price, a supply cap, wallet limits, an optional allowlist window, royalties, and art drawn on chain if you have no metadata host.

**Officially launched on BOT Chain Mainnet** on 2026-11-03.

- Website and app: https://mintlinebot.vercel.app (app at [`/app/`](https://mintlinebot.vercel.app/app/))
- Network: BOT Chain mainnet, chain ID 677 · [BOT Chain](https://www.botchain.ai/) · [BOTScan](https://scan.botchain.ai/)

![Mintline landing page](docs/mintline-landing-1280.png)

## How it works

1. **Hang a drop.** Name it, set a BOT price, a supply and a wallet limit. Point it at your metadata, or let Mintline draw the art on chain.
2. **Collectors mint.** Up to 20 per mint at the exact price. An optional allowlist window opens first, then everyone.
3. **Proceeds to you.** Every BOT paid sits in your collection until you withdraw it. Royalties follow EIP-2981.

## Features

- **On-chain art.** No IPFS? Each token draws its own ruled-line artwork from its id, straight from the contract.
- **Allowlist on chain.** Your allowlist is published with the drop and the root is computed from it, so it cannot be swapped later.
- **Freeze on reveal.** Metadata can be set once, then it is frozen. Collections created with a host start frozen.
- **No platform cut.** Mintline keeps nothing. Collectors pay your price and BOT Chain gas.

## Contracts

| Contract | BOT Chain mainnet |
|---|---|
| `MintlineFactory` | [`0xda9f6e137f419516a22ca8e0e3909aa0a0a7b5ba`](https://scan.botchain.ai/address/0xda9f6e137f419516a22ca8e0e3909aa0a0a7b5ba) |

BOT Chain infrastructure used: USDT `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C`, WBOT `0xD5452816194a3784dBa983426cCe7c122F4abd30`, BDEX router `0x07032d47A1b9f8460cBeE9dC17c1d3E438693929`, BDEX QuoterV2 `0x034A705b36067cff99ABf5C662Be881cBd8d0176`.

Source: [`contracts/src`](contracts/src). Tests: [`contracts/test`](contracts/test). The contracts are unaudited; use small amounts.

## Develop

Requires Node 20+, [Foundry](https://getfoundry.sh) and Python 3.

```bash
git clone --recursive https://github.com/David-glitc/mintline.git
cd mintline
npm ci
npm test              # forge test
npm run build         # landing page + app into dist/mintline
npm run preview       # http://127.0.0.1:8771
```

`npm run build` writes `dist/mintline/index.html` (landing page), `dist/mintline/app/` (the dApp) and a Cloudflare Workers bundle under `sites/`.

### Wallets

The app discovers installed wallets with EIP-6963 (BO Wallet, MetaMask, OKX, Rabby and others) and falls back to `window.ethereum`. It switches or adds BOT Chain (chain ID `0x2a5`, RPC `https://rpc.botchain.ai`) before any transaction, and simulates every call before asking for a signature.

### Rehearse on a mainnet fork

```bash
anvil --fork-url https://rpc.botchain.ai --port 8677 --chain-id 677
export BOT_RPC_URL=http://127.0.0.1:8677
node scripts/deploy.mjs && node scripts/fork-check.mjs
```

### Deploy

`scripts/deploy.mjs` reads the deployer key from `BOT_SIGNER_FILE` (default `~/.config/botchain-wave1/deployer.env`, never committed), refuses to broadcast on mainnet without `BOT_MAX_GAS_BOT`, and journals every transaction to `deployments/mainnet.json` so it can resume. `npm run publish` deploys the built site to Vercel as a static production deployment.

## License

MIT. Built on [BOT Chain](https://www.botchain.ai/).
