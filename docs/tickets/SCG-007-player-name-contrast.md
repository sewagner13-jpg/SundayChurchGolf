# SCG-007 — Dark player names on phones

Status: prepared and verified locally; publication/deployment pending authorization.

Read-only inspection of the deployed Players page at 390px reproduced the cause: player names inherited `rgb(237, 237, 237)` on white cards when the device preferred dark mode. The same page used `rgb(23, 23, 23)` in light mode. The app uses light cards and does not implement a matching dark palette.

The default foreground is now pure black and the app declares a light color scheme so native controls match its light surfaces. Explicit black, heavier player names cover score-entry rows, partner panels, team pickers/rosters, handicap tables, Yellow Ball order/carrier/picker/grid, drive selections, burger names and the Players list. Inactive Players rows retain their labeled section instead of fading the names. Selected amber/yellow player controls use black text; disabled Yellow Ball controls remain disabled and use a distinct gray background with readable black labels. White labels on genuinely dark action buttons are unchanged.

Four mounted browser regressions first failed against the previous styles, then passed at 320px and 390px under both light and dark device preferences. The checks measure actual computed black text, weight >=600, full opacity and >14:1 contrast on the tested white/emerald/yellow/gray surfaces, including real selected and disabled Yellow Ball controls. Black on white is 21:1. Selection is exercised only in a synthetic local fixture; no score-save action is invoked.

Full Node 20 verification passes with 202 unit tests, typecheck, lint (51 existing warnings and no errors), production build and 11 browser tests. The new fixture is protected by the existing `E2E_FIXTURES` gate.

This is a styling-only fix. No database data, schema, topology, connection strings, dependency versions or deployment configuration changed. Device checks use Chromium phone emulation; a physical phone/Safari session was not automated. Refresh the phone page after the separately authorized release.
