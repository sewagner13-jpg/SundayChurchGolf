import {
  compute2BestBalls,
  compute3BestBalls,
  computeLoneRanger,
  computeMoneyBall,
  computeChaChaCha,
  computeShamble,
  computeChicagoPoints,
  computeChicagoTeamPoints,
  computeTrainGame,
  computeVegas,
  computeDriveMinimumStatus,
  computePar3ContestStandings,
  computeMoneyBallRoundTotals,
  getRotatingPlayerIndex,
  getRotatingDesignatedPlayerId,
  computeFormatScore,
  getIrishGolfSegmentFormatId,
  type PlayerInput,
} from '@/lib/scoring-engine'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mkPlayers(scores: (number | null)[], ids?: string[]): PlayerInput[] {
  return scores.map((grossScore, i) => ({
    playerId: ids?.[i] ?? `p${i + 1}`,
    playerName: `Player ${i + 1}`,
    grossScore,
  }))
}

// ── Rotation ─────────────────────────────────────────────────────────────────

describe('getRotatingPlayerIndex', () => {
  it('hole 1 = index 0', () => expect(getRotatingPlayerIndex(1, 4)).toBe(0))
  it('hole 2 = index 1', () => expect(getRotatingPlayerIndex(2, 4)).toBe(1))
  it('hole 4 = index 3', () => expect(getRotatingPlayerIndex(4, 4)).toBe(3))
  it('hole 5 wraps to index 0', () => expect(getRotatingPlayerIndex(5, 4)).toBe(0))
  it('hole 9 wraps correctly for 4-player team', () => expect(getRotatingPlayerIndex(9, 4)).toBe(0))
  it('works with 3-player team', () => {
    expect(getRotatingPlayerIndex(1, 3)).toBe(0)
    expect(getRotatingPlayerIndex(3, 3)).toBe(2)
    expect(getRotatingPlayerIndex(4, 3)).toBe(0)
  })
})

// ── 2 Best Balls ─────────────────────────────────────────────────────────────

describe('compute2BestBalls', () => {
  it('sums 2 lowest scores', () => {
    const result = compute2BestBalls(mkPlayers([3, 4, 4, 5]))
    expect(result.teamGrossScore).toBe(7) // 3 + 4
    expect(result.countedPlayerIds).toContain('p1')
    expect(result.countedPlayerIds).toContain('p2')
    expect(result.countedPlayerIds).toHaveLength(2)
  })

  it('returns null if fewer than 2 valid scores', () => {
    const result = compute2BestBalls(mkPlayers([3, null, null, null]))
    expect(result.teamGrossScore).toBeNull()
  })

  it('handles all nulls', () => {
    const result = compute2BestBalls(mkPlayers([null, null, null, null]))
    expect(result.teamGrossScore).toBeNull()
    expect(result.countedPlayerIds).toHaveLength(0)
  })
})

// ── 3 Best Balls ─────────────────────────────────────────────────────────────

describe('compute3BestBalls', () => {
  it('sums 3 lowest scores', () => {
    const result = compute3BestBalls(mkPlayers([3, 4, 4, 5]))
    expect(result.teamGrossScore).toBe(11) // 3 + 4 + 4
    expect(result.countedPlayerIds).toHaveLength(3)
    expect(result.countedPlayerIds).toContain('p1')
  })

  it('returns null if fewer than 3 valid scores', () => {
    const result = compute3BestBalls(mkPlayers([3, 4, null, null]))
    expect(result.teamGrossScore).toBeNull()
  })

  it('does not count the highest score', () => {
    const result = compute3BestBalls(mkPlayers([3, 4, 4, 10]))
    expect(result.teamGrossScore).toBe(11) // 3+4+4, not 3+4+4+10
    expect(result.countedPlayerIds).not.toContain('p4')
  })
})

// ── Lone Ranger ───────────────────────────────────────────────────────────────

describe('computeLoneRanger', () => {
  it('uses designated player + best of rest', () => {
    const players = mkPlayers([5, 3, 4, 4])
    // p1 is Lone Ranger, best of rest is p2 (3)
    const result = computeLoneRanger(players, 'p1')
    expect(result.teamGrossScore).toBe(8) // 5 + 3
    expect(result.countedPlayerIds).toContain('p1')
    expect(result.countedPlayerIds).toContain('p2')
  })

  it('returns null if lone ranger has no score', () => {
    const players = mkPlayers([null, 3, 4, 4])
    const result = computeLoneRanger(players, 'p1')
    expect(result.teamGrossScore).toBeNull()
  })

  it('does not use lone ranger as best-of-rest', () => {
    const players = mkPlayers([3, 5, 5, 5])
    // p1 is designated; rest is p2/p3/p4 (all 5), best = 5
    const result = computeLoneRanger(players, 'p1')
    expect(result.teamGrossScore).toBe(8) // 3 + 5
    expect(result.countedPlayerIds).not.toContain('p1', 'p1') // counted once, not twice
    expect(result.countedPlayerIds).toHaveLength(2)
  })
})

// ── Money Ball ────────────────────────────────────────────────────────────────

describe('computeMoneyBall', () => {
  it('returns correct team score and MB scores without loss', () => {
    const players = mkPlayers([4, 3, 5, 5])
    // p1 is money ball
    const result = computeMoneyBall(players, 'p1', false, 4)
    expect(result.teamGrossScore).toBe(7)        // 4 (MB) + 3 (best of rest)
    expect(result.moneyBallRawScore).toBe(4)
    expect(result.moneyBallPenalty).toBe(0)
    expect(result.moneyBallAdjustedScore).toBe(4)
  })

  it('adds 4-stroke penalty to MB score only when ball is lost', () => {
    const players = mkPlayers([4, 3, 5, 5])
    const result = computeMoneyBall(players, 'p1', true, 4)
    // Team score is unchanged (no penalty on team score)
    expect(result.teamGrossScore).toBe(7)
    expect(result.moneyBallRawScore).toBe(4)
    expect(result.moneyBallPenalty).toBe(4)
    expect(result.moneyBallAdjustedScore).toBe(8) // 4 + 4
  })

  it('MB loss does NOT affect the team competition score', () => {
    const players = mkPlayers([5, 4, 6, 6])
    const withLoss = computeMoneyBall(players, 'p1', true, 4)
    const withoutLoss = computeMoneyBall(players, 'p1', false, 4)
    expect(withLoss.teamGrossScore).toBe(withoutLoss.teamGrossScore)
  })

  it('handles custom penalty strokes', () => {
    const players = mkPlayers([3, 4, 5, 5])
    const result = computeMoneyBall(players, 'p1', true, 2)
    expect(result.moneyBallPenalty).toBe(2)
    expect(result.moneyBallAdjustedScore).toBe(5) // 3 + 2
  })
})

describe('computeMoneyBallRoundTotals', () => {
  it('sums team competition total and money ball total separately', () => {
    const holes = [
      { teamGrossScore: 7, moneyBallAdjustedScore: 4, moneyBallPenalty: 0, moneyBallLost: false },
      { teamGrossScore: 8, moneyBallAdjustedScore: 8, moneyBallPenalty: 4, moneyBallLost: true },
      { teamGrossScore: 6, moneyBallAdjustedScore: 5, moneyBallPenalty: 0, moneyBallLost: false },
    ]
    const totals = computeMoneyBallRoundTotals(holes)
    expect(totals.teamCompetitionTotal).toBe(21)   // 7+8+6
    expect(totals.moneyBallTotalScore).toBe(17)    // 4+8+5
    expect(totals.moneyBallLossCount).toBe(1)
    expect(totals.moneyBallPenaltyTotal).toBe(4)
  })
})

// ── Cha Cha Cha ───────────────────────────────────────────────────────────────

describe('computeChaChaCha', () => {
  const players = mkPlayers([3, 4, 5, 6])

  it('hole 1 counts 1 best score', () => {
    const result = computeChaChaCha(players, 1)
    expect(result.teamGrossScore).toBe(3)
    expect(result.countedPlayerIds).toHaveLength(1)
    expect(result.extraData.countMode).toBe(1)
  })

  it('hole 2 counts 2 best scores', () => {
    const result = computeChaChaCha(players, 2)
    expect(result.teamGrossScore).toBe(7) // 3+4
    expect(result.countedPlayerIds).toHaveLength(2)
    expect(result.extraData.countMode).toBe(2)
  })

  it('hole 3 counts 3 best scores', () => {
    const result = computeChaChaCha(players, 3)
    expect(result.teamGrossScore).toBe(12) // 3+4+5
    expect(result.countedPlayerIds).toHaveLength(3)
    expect(result.extraData.countMode).toBe(3)
  })

  it('hole 4 resets to count 1', () => {
    const result = computeChaChaCha(players, 4)
    expect(result.extraData.countMode).toBe(1)
    expect(result.teamGrossScore).toBe(3)
  })

  it('hole 6 uses count mode 3', () => {
    const result = computeChaChaCha(players, 6)
    expect(result.extraData.countMode).toBe(3)
  })
})

// ── Shamble ───────────────────────────────────────────────────────────────────

describe('computeShamble', () => {
  const players = mkPlayers([3, 4, 5, 6])

  it('count_best_1 uses lowest score', () => {
    const result = computeShamble(players, 'count_best_1')
    expect(result.teamGrossScore).toBe(3)
    expect(result.countedPlayerIds).toHaveLength(1)
  })

  it('count_best_2 uses 2 lowest scores', () => {
    const result = computeShamble(players, 'count_best_2')
    expect(result.teamGrossScore).toBe(7)
    expect(result.countedPlayerIds).toHaveLength(2)
  })

  it('count_best_3 uses 3 lowest scores', () => {
    const result = computeShamble(players, 'count_best_3')
    expect(result.teamGrossScore).toBe(12)
  })

  it('count_all sums every score', () => {
    const result = computeShamble(players, 'count_all')
    expect(result.teamGrossScore).toBe(18) // 3+4+5+6
    expect(result.countedPlayerIds).toHaveLength(4)
  })

  it('tracks selected drive player', () => {
    const withDrive = players.map((p, i) => ({ ...p, driveSelected: i === 1 }))
    const result = computeShamble(withDrive, 'count_best_2')
    expect(result.extraData.selectedDrivePlayerId).toBe('p2')
  })
})

// ── Chicago Points ────────────────────────────────────────────────────────────

describe('computeChicagoPoints', () => {
  it('double eagle = 8 points', () => expect(computeChicagoPoints(1, 4)).toBe(8))
  it('eagle = 4 points', () => expect(computeChicagoPoints(2, 4)).toBe(4))
  it('birdie = 2 points', () => expect(computeChicagoPoints(3, 4)).toBe(2))
  it('par = 1 point', () => expect(computeChicagoPoints(4, 4)).toBe(1))
  it('bogey = 0 points', () => expect(computeChicagoPoints(5, 4)).toBe(0))
  it('double bogey = 0 points', () => expect(computeChicagoPoints(6, 4)).toBe(0))
  it('albatross on par 5 = 8 points', () => expect(computeChicagoPoints(2, 5)).toBe(8))
  it('birdie on par 3 = 2 points', () => expect(computeChicagoPoints(2, 3)).toBe(2))
})

describe('computeChicagoTeamPoints', () => {
  it('sums points across all players', () => {
    // birdie, par, bogey, eagle on par 4
    const players = mkPlayers([3, 4, 5, 2])
    const result = computeChicagoTeamPoints(players, 4)
    expect(result.totalPoints).toBe(7) // 2+1+0+4
    expect(result.playerPoints['p1']).toBe(2) // birdie
    expect(result.playerPoints['p2']).toBe(1) // par
    expect(result.playerPoints['p3']).toBe(0) // bogey
    expect(result.playerPoints['p4']).toBe(4) // eagle
  })

  it('null scores earn 0 points', () => {
    const players = mkPlayers([null, 4, null, null])
    const result = computeChicagoTeamPoints(players, 4)
    expect(result.totalPoints).toBe(1)
  })
})

// ── Train Game ────────────────────────────────────────────────────────────────

describe('computeTrainGame', () => {
  it('produces correct train number from 4 scores', () => {
    // [3,4,4,5] → sort 3 best = 3,4,4 → 344
    const result = computeTrainGame(mkPlayers([3, 4, 4, 5]))
    expect(result.trainNumber).toBe(344)
    expect(result.teamGrossScore).toBe(344)
    expect(result.teamDisplayScore).toBe('344')
    expect(result.countedPlayerIds).toHaveLength(3)
  })

  it('example from spec: 3,4,4,5 → 344', () => {
    const result = computeTrainGame(mkPlayers([5, 4, 3, 4]))
    expect(result.trainNumber).toBe(344)
  })

  it('returns null if fewer than 3 valid scores', () => {
    const result = computeTrainGame(mkPlayers([3, 4, null, null]))
    expect(result.trainNumber).toBeNull()
    expect(result.teamGrossScore).toBeNull()
  })

  it('correctly orders digits ascending', () => {
    const result = computeTrainGame(mkPlayers([5, 3, 4, 6]))
    expect(result.teamDisplayScore).toBe('345') // sorted 3,4,5
  })
})

// ── Vegas ─────────────────────────────────────────────────────────────────────

describe('computeVegas', () => {
  it('team1 wins when their number is lower', () => {
    // Team1: 3,5 → 35. Team2: 4,4 → 44. Diff = 9. Team1 wins.
    const result = computeVegas([3, 5], [4, 4], 4)
    expect(result.team1Number).toBe(35)
    expect(result.team2Number).toBe(44)
    expect(result.holePoints).toBe(9)
    expect(result.winner).toBe('team1')
  })

  it('tie when numbers are equal', () => {
    const result = computeVegas([3, 5], [3, 5], 4)
    expect(result.winner).toBe('tie')
    expect(result.holePoints).toBe(0)
  })

  it('returns null numbers if fewer than 2 scores per team', () => {
    const result = computeVegas([3, null], [4, 4], 4)
    expect(result.team1Number).toBeNull()
    expect(result.holePoints).toBe(0)
  })

  it('birdie flip reverses opposing team number when enabled', () => {
    // Team1 has birdie (3 on par 4), so team2 number gets flipped
    // Team2: 4,5 → normally 45, after flip 54
    const result = computeVegas([3, 5], [4, 5], 4, { enableBirdieFlip: true })
    expect(result.team1Number).toBe(35)
    expect(result.team2Number).toBe(54) // flipped because team1 birdied
  })

  it('birdie flip does not activate when no birdie', () => {
    const result = computeVegas([4, 5], [4, 5], 4, { enableBirdieFlip: true })
    expect(result.team1Number).toBe(45) // no flip
    expect(result.team2Number).toBe(45)
  })
})

// ── Drive Minimums ────────────────────────────────────────────────────────────

describe('computeDriveMinimumStatus', () => {
  const playerIds = ['p1', 'p2', 'p3', 'p4']

  it('counts drives correctly', () => {
    const log = [
      { holeNumber: 1, drivingPlayerId: 'p1' },
      { holeNumber: 2, drivingPlayerId: 'p2' },
      { holeNumber: 3, drivingPlayerId: 'p1' },
    ]
    const status = computeDriveMinimumStatus(log, playerIds, 3, 18)
    expect(status.driveCounts['p1']).toBe(2)
    expect(status.driveCounts['p2']).toBe(1)
    expect(status.driveCounts['p3']).toBe(0)
  })

  it('produces warnings when minimum cannot be met', () => {
    const log = [{ holeNumber: 1, drivingPlayerId: 'p1' }]
    // p2,p3,p4 have 0 drives, need 4, only 1 hole played so 17 remain
    const status = computeDriveMinimumStatus(log, playerIds, 4, 18)
    expect(status.warnings).toHaveLength(0) // 17 remaining holes, still achievable
  })

  it('warns when impossible', () => {
    // 17 holes played, p2 still has 0 drives, needs 4 more but only 1 hole left
    const log = Array.from({ length: 17 }, (_, i) => ({
      holeNumber: i + 1,
      drivingPlayerId: 'p1',
    }))
    const status = computeDriveMinimumStatus(log, playerIds, 4, 18)
    expect(status.warnings.some((w) => w.includes('p2'))).toBe(true)
  })
})

// ── Par 3 Contest ─────────────────────────────────────────────────────────────

describe('computePar3ContestStandings', () => {
  it('ranks by total ascending (lower is better)', () => {
    const input = [
      { playerId: 'p1', playerName: 'Alice', par3GrossScores: [3, 2, 4] },
      { playerId: 'p2', playerName: 'Bob', par3GrossScores: [2, 2, 2] },
      { playerId: 'p3', playerName: 'Carol', par3GrossScores: [4, 4, 4] },
    ]
    const standings = computePar3ContestStandings(input)
    expect(standings[0].playerId).toBe('p2') // total 6
    expect(standings[1].playerId).toBe('p1') // total 9
    expect(standings[2].playerId).toBe('p3') // total 12
  })

  it('handles null scores (incomplete rounds)', () => {
    const input = [
      { playerId: 'p1', playerName: 'Alice', par3GrossScores: [3, null, null] },
      { playerId: 'p2', playerName: 'Bob', par3GrossScores: [] },
    ]
    const standings = computePar3ContestStandings(input)
    expect(standings[0].total).toBe(3)
    expect(standings[1].total).toBeNull()
  })
})

// ── Irish Golf segment format dispatch ────────────────────────────────────────

describe('getIrishGolfSegmentFormatId', () => {
  const config = {
    segment1FormatId: 'two_best_balls_of_four',
    segment2FormatId: 'train_game',
    segment3FormatId: 'money_ball',
  }

  it('holes 1-6 use segment 1 format', () => {
    expect(getIrishGolfSegmentFormatId(1, config)).toBe('two_best_balls_of_four')
    expect(getIrishGolfSegmentFormatId(6, config)).toBe('two_best_balls_of_four')
  })

  it('holes 7-12 use segment 2 format', () => {
    expect(getIrishGolfSegmentFormatId(7, config)).toBe('train_game')
    expect(getIrishGolfSegmentFormatId(12, config)).toBe('train_game')
  })

  it('holes 13-18 use segment 3 format', () => {
    expect(getIrishGolfSegmentFormatId(13, config)).toBe('money_ball')
    expect(getIrishGolfSegmentFormatId(18, config)).toBe('money_ball')
  })

  it('returns null for out-of-range holes', () => {
    expect(getIrishGolfSegmentFormatId(19, config)).toBeNull()
  })
})

// ── Central dispatch (computeFormatScore) ────────────────────────────────────

describe('computeFormatScore', () => {
  const players = mkPlayers([3, 4, 5, 6])
  const par = 4

  it('dispatches 2BB correctly', () => {
    const result = computeFormatScore('two_best_balls_of_four', players, 1, par)
    expect(result?.teamGrossScore).toBe(7)
  })

  it('dispatches 3BB correctly', () => {
    const result = computeFormatScore('three_best_balls_of_four', players, 1, par)
    expect(result?.teamGrossScore).toBe(12)
  })

  it('dispatches cha_cha_cha with correct hole number', () => {
    const result = computeFormatScore('cha_cha_cha', players, 2, par)
    expect(result?.teamGrossScore).toBe(7) // 2 best on hole 2
  })

  it('dispatches train_game', () => {
    const result = computeFormatScore('train_game', players, 1, par)
    expect(result?.teamGrossScore).toBe(345) // 3+4+5
  })

  it('dispatches Irish Golf by segment', () => {
    const config = {
      segment1FormatId: 'two_best_balls_of_four',
      segment2FormatId: 'train_game',
      segment3FormatId: 'three_best_balls_of_four',
    }
    // Hole 1 → 2BB
    const res1 = computeFormatScore('irish_golf_6_6_6', players, 1, par, {}, config)
    expect(res1?.teamGrossScore).toBe(7)

    // Hole 7 → Train Game
    const res7 = computeFormatScore('irish_golf_6_6_6', players, 7, par, {}, config)
    expect(res7?.teamGrossScore).toBe(345)

    // Hole 13 → 3BB
    const res13 = computeFormatScore('irish_golf_6_6_6', players, 13, par, {}, config)
    expect(res13?.teamGrossScore).toBe(12)
  })

  it('returns null for skins format (handled separately)', () => {
    const result = computeFormatScore('default-sunday-church', players, 1, par)
    expect(result).toBeNull()
  })
})
