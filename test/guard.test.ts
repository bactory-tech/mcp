import { describe, expect, it } from 'vitest';
import { checkProposal, type GuardState } from '../src/guard.js';

// 10,000 USDC treasury (6 decimals), 30% reserve, 2,500 per action.
const usdc = (x: number) => BigInt(x) * 1_000_000n;
const base: GuardState = {
  agentSuspended: false, marketPaused: false, usedToday: 0, maxPerDay: 4,
  oracleAgeSeconds: 120, oracleMaxAgeSeconds: 3600, sequencerUp: true,
  strategyApproved: true, actionLimit: usdc(2_500), idle: usdc(10_000), totalValue: usdc(10_000),
  reserveBps: 3000, allocated: 0n,
};

describe('checkProposal', () => {
  it('executes an allocation inside every limit', () => {
    const r = checkProposal(base, { kind: 'allocate', amount: usdc(2_000) });
    expect(r).toMatchObject({ executed: true, reason: 'None', addsStrike: false });
    expect(r.checks.every((c) => c.passed)).toBe(true);
  });

  it('rejects above the per-action limit and adds a strike', () => {
    expect(checkProposal(base, { kind: 'allocate', amount: usdc(2_501) })).toMatchObject({ reason: 'ExceedsActionLimit', addsStrike: true });
  });

  it('rejects a zero amount', () => {
    expect(checkProposal(base, { kind: 'allocate', amount: 0n }).reason).toBe('ExceedsActionLimit');
    expect(checkProposal(base, { kind: 'recall', amount: 0n }).reason).toBe('InsufficientAllocation');
  });

  it('protects the reserve', () => {
    const s = { ...base, idle: usdc(5_000), allocated: usdc(5_000) };
    // 30% of 10,000 = 3,000 must stay idle, so at most 2,000 can move.
    expect(checkProposal(s, { kind: 'allocate', amount: usdc(2_000) }).reason).toBe('None');
    expect(checkProposal(s, { kind: 'allocate', amount: usdc(2_001) }).reason).toBe('BreaksReserve');
  });

  it('rate limits without a strike', () => {
    expect(checkProposal({ ...base, usedToday: 4 }, { kind: 'allocate', amount: 1n })).toMatchObject({ reason: 'RateLimited', addsStrike: false });
  });

  it('blocks allocations but not recalls while paused', () => {
    const s = { ...base, marketPaused: true, allocated: usdc(1_000) };
    expect(checkProposal(s, { kind: 'allocate', amount: 1n }).reason).toBe('MarketPaused');
    expect(checkProposal(s, { kind: 'recall', amount: usdc(1_000) }).reason).toBe('None');
  });

  it('needs a fresh oracle and a live sequencer', () => {
    expect(checkProposal({ ...base, oracleAgeSeconds: 3601 }, { kind: 'allocate', amount: 1n }).reason).toBe('OracleNotFresh');
    expect(checkProposal({ ...base, sequencerUp: false, oracleAgeSeconds: null }, { kind: 'allocate', amount: 1n }).reason).toBe('OracleNotFresh');
    expect(checkProposal({ ...base, oracleAgeSeconds: null }, { kind: 'allocate', amount: 1n }).reason).toBe('None');
  });

  it('checks in contract order: suspension before everything', () => {
    const s = { ...base, agentSuspended: true, marketPaused: true, usedToday: 9 };
    expect(checkProposal(s, { kind: 'allocate', amount: usdc(99_999) })).toMatchObject({ reason: 'AgentSuspended', addsStrike: false });
  });

  it('requires an approved strategy', () => {
    expect(checkProposal({ ...base, strategyApproved: false }, { kind: 'allocate', amount: 1n }).reason).toBe('StrategyNotApproved');
  });

  it('cannot recall more than is allocated', () => {
    expect(checkProposal({ ...base, allocated: usdc(500) }, { kind: 'recall', amount: usdc(501) }).reason).toBe('InsufficientAllocation');
  });
});
