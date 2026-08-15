"use client";

import {
  ControlledActionFeedback,
  useControlledAction,
} from "@/components/controlled-action";
import { updateRoundDraft } from "@/actions/rounds";
import { getSundayChurchYellowBallConfig } from "@/lib/sunday-church-yellow-ball-skins";

export function SundayChurchYellowBallSetup({
  roundId,
  formatConfig,
  players,
  selectedPlayerCount,
  onConfigSaved,
}: {
  roundId: string;
  formatConfig: Record<string, unknown> | null | undefined;
  players: Array<{
    player: { fullName: string; nickname: string | null; handicapIndex: unknown };
  }>;
  selectedPlayerCount: number;
  onConfigSaved: (formatConfig: Record<string, unknown>) => void;
}) {
  const action = useControlledAction();
  const useHandicaps = getSundayChurchYellowBallConfig(formatConfig).useYellowBallHandicaps;
  const missingHandicapNames = players
    .filter((roundPlayer) => roundPlayer.player.handicapIndex === null)
    .map((roundPlayer) => roundPlayer.player.nickname || roundPlayer.player.fullName);
  const toggle = (enabled: boolean) => {
    void action.execute(async () => {
      const nextFormatConfig = { ...(formatConfig ?? {}), useYellowBallHandicaps: enabled };
      await updateRoundDraft(roundId, { formatConfig: nextFormatConfig });
      onConfigSaved(nextFormatConfig);
      return { message: enabled ? "Yellow-ball handicaps enabled." : "Yellow-ball handicaps disabled." };
    });
  };

  return (
    <section className="border-y border-yellow-300 bg-yellow-50 px-3 py-3 text-sm text-gray-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Yellow Ball Handicap Scoring</h3>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            Relative event handicaps apply only to the yellow-ball player. The lowest player receives zero strokes; the three-player scramble stays gross.
          </p>
        </div>
        <input
          aria-label="Use handicaps for yellow ball"
          type="checkbox"
          checked={useHandicaps}
          disabled={action.pending}
          onChange={(event) => toggle(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0"
        />
      </div>
      <div className="mt-3 text-xs">
        <p className={selectedPlayerCount >= 8 ? "text-green-700" : "text-red-700"}>
          {selectedPlayerCount}/8 minimum players selected; teams are fixed at four.
        </p>
        {useHandicaps && missingHandicapNames.length > 0 && (
          <p className="mt-1 font-medium text-red-700">
            Missing handicap: {missingHandicapNames.join(", ")}. Round start is blocked.
          </p>
        )}
      </div>
      <div className="mt-2">
        <ControlledActionFeedback state={action.state} />
      </div>
    </section>
  );
}
