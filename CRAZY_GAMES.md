# Crazy Games build

Get Off the Train! ships two static builds:

| | GitHub Pages / other hosts | Crazy Games |
| --- | --- | --- |
| Command | `npm run build` | `npm run build:crazygames` |
| Output | `dist/` | `dist-crazygames/`, copied to `artifacts/crazygames/` |
| Upload zip | — | `artifacts/get-off-the-train-crazygames.zip` (`index.html` at the zip root) |
| Asset paths | relative (`./`) | relative (`./`), safe for iframe hosting |
| AlterU / Aigram | optional; active when the host shell or `api_origin` + `telegram_id` establish a session | **off**. Guests play immediately. No login wall and no AlterU / App Store link |

## Guest play

Crazy Games requires that guests can play and that the game does not add its own login (including AlterU / Aigram) before play. This build:

- Starts a run on load. There is no account screen.
- Strips `https://images.aiwaves.tech/alteru/guest-shell.js` from `index.html`. The default `npm run build` still includes that script.
- Saves the best score and the character collection in `localStorage` on the device.
- Opens the leaderboard as a local note (“best score stays on this device”) instead of “Open in AlterU” / “GET ALTERU”.
- Does not treat Crazy Games query parameters as an Aigram session.
- Drops the in-game `AIGRAM // EN` HUD mark. The default build still shows it.
- Serves `<html lang="en" class="cg-guest">` with `<title>Get Off the Train!</title>` and `./favicon.svg` (no `vite.svg`). In-game copy is English only.
- Desktop landscape (including 800×450) is a full-bleed 16:9 view. The carriage fills the frame; there is no 500px portrait column and no decorative side posters. Phone portrait stays full-bleed.
- Keyboard: WASD and arrows move, Space or Enter confirms (resume, next car, try again), P pauses, M mutes. Escape is not used.
- The first run is a four-step coach (move, let go on sway, get up, exit). Skip writes `get-off-the-train.cg.tutorial`. Replay tips is on the result card.
- Car 01 is the tutorial car: holding forward follows the exit, and the clock is 15 seconds so a first clear still has time to spare. Cars 02–05 step down to 14, 13, 12.5, and 12 seconds. Car 06 is 11 seconds, and each car after that loses another half second, down to an 8 second floor. Door steer fades by about a tenth each car. A clear saves the highest car finished (`get-off-the-train.cg.best-clear`). The result card shows that ladder, the coins just earned, and the three upgrades.
- Coins buy three persistent ranks — grip (harder to fall), hustle (faster walk), pocket (more coins next run) — at 40, then 90, then 160, saved in `get-off-the-train.cg.upgrades`. The same coins still unlock heroes. After the first clear, RIDE starts a later car you have opened.
- Music is a CC0 loop plus clear and miss stings (see `doc/audio.md` for each file, source URL, and licence). Effects stay synthesized. Mute and volume persist. Audio starts after the first gesture.

UI spec for this build (see `src/ui/cg-theme.less`): space 4/8/12/16/24; type 11/13/16/22/32; strokes 2px chips, 3px controls, 4px panels; ink `#1a1612`, paper `#fff8ee`, sand `#f3e7cf`, yellow `#f5c518` for actions, red `#d4534a` for danger, teal `#2f7f76` for progress. Nunito ExtraBold (SIL OFL) is the UI face.

The default `npm run build` path is unchanged for GitHub Pages and any AlterU/Aigram embed.

The Pages workflow publishes this guest build next to the root site, without replacing it:

https://yinxinghuan.github.io/get-off-the-train/crazygames/

Progress sync through the Crazy Games SDK Data module is not wired up. Local best score and collection saves are enough for this version.

## Build the upload package

```bash
npm ci
npm run build:crazygames
```

Upload `artifacts/get-off-the-train-crazygames.zip` in the Crazy Games developer portal. Do not submit from this repository’s automation.

`artifacts/crazygames/` is the same unpacked folder (`index.html` plus `./assets/...`) if you need to preview it:

```bash
npx --yes serve artifacts/crazygames
```
