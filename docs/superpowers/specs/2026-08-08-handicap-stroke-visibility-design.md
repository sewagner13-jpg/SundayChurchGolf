# Handicap Stroke Visibility Design

## Goal

Make handicap-enabled scoring transparent before and during play. Every player in the selected physical group can see their complete 18-hole stroke allocation, while the current-hole score entry explicitly asks for gross score and shows the calculated net score.

## Scoring Contract

- Use each round player's locked event handicap, rounded to a whole playing handicap.
- Use relative handicaps without slope or tee adjustment: subtract the lowest playing handicap in the round from every player's playing handicap. The lowest player therefore plays from zero.
- Allocate the adjusted strokes by the course handicap rank, including multiple strokes when an adjusted handicap exceeds 18.
- Plus handicaps remain supported and give strokes on the hardest ranked holes when the relative calculation produces a negative value.
- Gross score remains the only score entered by a scorer. Net score is calculated as gross score minus strokes received.
- The relative allocation resolver is shared by Cross-Threesome and net-enabled Cross-Foursome scoring so displayed strokes and match results cannot diverge.

## Scoring Screen

- Show a compact Handicap Shots section only when the active format actually uses net handicap scoring.
- Show every player in the selected physical threesome or foursome and all 18 holes.
- Mark each cell with `1`, `2`, or the applicable stroke count; show a dash when no stroke applies and `+1` when a player gives one stroke.
- Highlight the current-hole column and keep the table horizontally scrollable on mobile.
- Beside each player score input, show the current-hole allocation and live gross/net values.
- Label the input instruction `Enter gross score`. Never imply that the scorer should enter net score.

## Architecture

Extend `src/lib/handicap-scoring.ts` with a pure relative-handicap resolver. Both cross-group scorers consume its adjusted player map before calculating hole strokes and net scores. A new `src/components/handicap-stroke-card.tsx` renders the table and current-hole score details from the same resolver.

Keep the legacy scoring page from growing by removing its format-specific preview helper and delegating the new presentation to the focused component.

## Verification

- Unit tests prove relative offsets, course-rank allocation, and net-score consistency.
- Cross-Threesome and Cross-Foursome regression tests prove the match scorer uses the relative allocation.
- Browser coverage verifies the full group table, current-hole highlight, explicit gross-score instruction, and live net display.
- Run the repository release gate and negative probes before completion.
