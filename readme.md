# bactory-mcp

**MCP server for [Bactory](https://bactory.tech): live Base market data and AgentGuard checks for AI assistants.**

Agents propose. Contracts enforce. This server gives Claude, Cursor or any MCP client the same view a Bactory market agent has:
live pools, prices and trades on Base, Chainlink oracle freshness, and a faithful simulation of the onchain `AgentGuard` that decides
whether an agent's treasury action executes.

It is read and propose only. No tool holds a key, signs or sends a transaction.

[Website](https://bactory.tech) · [GitHub](https://github.com/bactory-tech) · [X](https://x.com/bactorydottech)

## Quick start

```bash
git clone https://github.com/bactory-tech/bactory-mcp
cd bactory-mcp
npm install && npm run build
```

### Claude Code

```bash
claude mcp add bactory -- node /absolute/path/to/bactory-mcp/dist/index.js
```

### Claude Desktop, Cursor and other clients

Add to the client's MCP config (`claude_desktop_config.json`, `.cursor/mcp.json`, …):

```json
{
  "mcpServers": {
    "bactory": {
      "command": "node",
      "args": ["/absolute/path/to/bactory-mcp/dist/index.js"],
      "env": { "BASE_RPC_URL": "https://mainnet.base.org" }
    }
  }
}
```

Then ask things like:

- *"What does the AERO market on Base look like right now? Anything an agent should worry about?"*
- *"Is the Chainlink ETH/USD price fresh enough for AgentGuard?"*
- *"My treasury has 10,000 USDC idle, a 30% reserve and a 2,500 per-action limit. Would allocating 3,000 pass the guard?"*
- *"Draft a treasury proposal for cbBTC."* (uses the `propose_treasury_action` prompt)

## Tools

| Tool | What it does |
| --- | --- |
| `search_assets` | Find Base tokens by name, ticker or address. |
| `get_asset` | Price, liquidity, volume, market cap and top pools for a token. |
| `get_asset_pools` | Every DEX pool trading a token. |
| `get_pool` | Live state of one pool. |
| `list_top_markets` | Base pools ranked by 24 h volume. |
| `get_trades` | Latest swaps in a pool. |
| `get_price_history` | OHLCV candles (day, hour, minute). |
| `analyze_market` | Agent-style health check: liquidity depth and concentration, turnover, volatility, price divergence between pools, with plain-language flags. |
| `get_oracle_price` | Chainlink price, its age and the Base sequencer uptime feed: the inputs to the guard's oracle check. |
| `check_agent_proposal` | Offline AgentGuard simulation. Runs the contract's checks in the contract's order and explains each one. |
| `preview_agent_proposal` | Calls `AgentGuard.preview` on a deployed guard. |
| `get_agent_guard` | Reads a deployed guard: market, proposal count, oracle settings, one agent's strikes and rate limit. |

Also included: the `propose_treasury_action` prompt, which walks a model through analyse → draft → check → report, and the
`bactory://agent-guard/rules` resource describing the guard.

## How AgentGuard decides

An agent never holds market assets and never gets admin rights. It submits an action (allocate treasury funds to a strategy, or
recall them) and the guard checks, in order:

1. **AgentSuspended**: the agent has 3 strikes.
2. **MarketPaused**: allocations are blocked while paused; recalls still work.
3. **RateLimited**: the agent used its proposals for the day.
4. **OracleNotFresh**: the L2 sequencer is down or in its 1 h grace period, or the price is older than the limit.
5. **StrategyNotApproved**: the strategy is not approved by the market admin.
6. **ExceedsActionLimit**: zero, or above the per-action limit.
7. **BreaksReserve**: the treasury would keep less idle than its reserve share.
8. **InsufficientAllocation**: a recall larger than what the strategy holds.

Every rejection except rate limiting and suspension adds a strike. `check_agent_proposal` mirrors this logic from
`AgentGuard.sol` and is covered by tests (`npm test`).

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASE_RPC_URL` | viem's public Base RPC | RPC for onchain reads on Base. |
| `BASE_SEPOLIA_RPC_URL` | viem's public Base Sepolia RPC | RPC for Base Sepolia. |

Market data comes from the free [GeckoTerminal API](https://www.geckoterminal.com/dex-api) (about 30 calls a minute). The server
spaces out, caches and retries calls, so heavy use may be slow but will not fail on rate limits right away.

## Development

```bash
npm run dev        # run from source with tsx
npm test           # guard simulation tests
npm run inspect    # open the MCP Inspector against the build
```

## Status

Bactory is in development and its contracts are unaudited. Market data and oracle reads are live; the guard simulation reflects
the current `AgentGuard.sol`. Nothing here is financial advice.

## License

MIT
