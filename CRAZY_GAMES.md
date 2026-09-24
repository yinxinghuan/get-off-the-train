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
- Serves `<html lang="en" class="cg-guest">` with `<title>Get Off the Train!</title>`. `?lang=zh` and a saved `game_locale` still switch the in-game strings; with neither set, the guest build defaults to English.
- On desktop (viewport at least 700px wide) the portrait play column stays 500px. The side gutters are a station wall — halftone, hazard stripes, and route posters — instead of empty black bars. Phone portrait is full-bleed, same as before.

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
