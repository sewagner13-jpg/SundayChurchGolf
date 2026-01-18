"use client";

import Link from "next/link";

interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  totalWinnings: number;
  roundsPlayed: number;
  topTeamAppearances: number;
}

interface MastersLeaderboardProps {
  entries: LeaderboardEntry[];
  year: number;
}

export function MastersLeaderboard({ entries, year }: MastersLeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div className="masters-board">
        <div className="masters-header">
          <span className="masters-title">LEADERS</span>
          <span className="masters-year">{year}</span>
        </div>
        <div className="masters-body">
          <p className="text-center py-8 text-gray-600">No rounds completed yet</p>
        </div>
        <style jsx>{mastersStyles}</style>
      </div>
    );
  }

  // Calculate net winnings (winnings - buy-ins)
  // Assuming $20 buy-in per round
  const BUY_IN = 20;

  return (
    <div className="masters-board">
      <div className="masters-header">
        <span className="masters-title">LEADERS</span>
        <span className="masters-year">{year}</span>
      </div>
      <div className="masters-body">
        <table className="masters-table">
          <thead>
            <tr>
              <th className="pos-col">POS</th>
              <th className="name-col">PLAYER</th>
              <th className="score-col">NET</th>
              <th className="rounds-col">RDS</th>
              <th className="wins-col">W</th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, 10).map((entry, index) => {
              const netWinnings = entry.totalWinnings - (entry.roundsPlayed * BUY_IN);
              const isPositive = netWinnings > 0;
              const isEven = netWinnings === 0;

              return (
                <tr key={entry.playerId}>
                  <td className="pos-col">{index + 1}</td>
                  <td className="name-col">
                    <Link
                      href={`/leaderboard/${entry.playerId}`}
                      className="player-link"
                    >
                      {entry.playerName.toUpperCase()}
                    </Link>
                  </td>
                  <td className={`score-col ${isPositive ? 'positive' : isEven ? 'even' : 'negative'}`}>
                    {isPositive ? '+' : ''}{Math.round(netWinnings)}
                  </td>
                  <td className="rounds-col">{entry.roundsPlayed}</td>
                  <td className="wins-col">{entry.topTeamAppearances}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="masters-footer">
        <Link href="/leaderboard" className="view-all">
          View Full Leaderboard
        </Link>
      </div>
      <style jsx>{mastersStyles}</style>
    </div>
  );
}

const mastersStyles = `
  .masters-board {
    background: linear-gradient(180deg, #f5f5dc 0%, #fffef0 100%);
    border: 3px solid #1a472a;
    border-radius: 12px 12px 4px 4px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5);
    font-family: 'Georgia', 'Times New Roman', serif;
  }

  .masters-header {
    background: linear-gradient(180deg, #1a472a 0%, #0d2818 100%);
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #0d2818;
  }

  .masters-title {
    color: #ffd700;
    font-size: 1.5rem;
    font-weight: bold;
    letter-spacing: 3px;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
  }

  .masters-year {
    color: #fff;
    font-size: 1rem;
    font-weight: normal;
    letter-spacing: 1px;
  }

  .masters-body {
    padding: 0;
    background: linear-gradient(180deg, #fffef0 0%, #f8f8e8 100%);
  }

  .masters-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
  }

  .masters-table th {
    background: #2d5a3d;
    color: #fff;
    padding: 8px 6px;
    text-align: center;
    font-weight: bold;
    font-size: 0.75rem;
    letter-spacing: 1px;
    border-bottom: 2px solid #1a472a;
  }

  .masters-table td {
    padding: 10px 6px;
    text-align: center;
    border-bottom: 1px solid #d4d4aa;
    color: #1a1a1a;
    font-weight: 500;
  }

  .masters-table tbody tr:hover {
    background: rgba(26, 71, 42, 0.08);
  }

  .masters-table tbody tr:last-child td {
    border-bottom: none;
  }

  .pos-col {
    width: 40px;
    font-weight: bold;
  }

  .name-col {
    text-align: left !important;
    padding-left: 12px !important;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .score-col {
    width: 60px;
    font-weight: bold;
    font-size: 1rem;
  }

  .score-col.positive {
    color: #b8860b;
  }

  .score-col.negative {
    color: #8b0000;
  }

  .score-col.even {
    color: #1a1a1a;
  }

  .rounds-col {
    width: 40px;
    color: #555;
    font-size: 0.85rem;
  }

  .wins-col {
    width: 40px;
    color: #1a472a;
    font-weight: bold;
  }

  .player-link {
    color: inherit;
    text-decoration: none;
  }

  .player-link:hover {
    color: #1a472a;
    text-decoration: underline;
  }

  .masters-footer {
    background: linear-gradient(180deg, #1a472a 0%, #0d2818 100%);
    padding: 10px 16px;
    text-align: center;
    border-top: 2px solid #2d5a3d;
  }

  .view-all {
    color: #ffd700;
    text-decoration: none;
    font-size: 0.85rem;
    letter-spacing: 1px;
    font-weight: 500;
  }

  .view-all:hover {
    text-decoration: underline;
  }
`;
