# Audio (Crazy Games guest build)

Gameplay music is a recorded loop. Result stings are short recordings. Effects stay synthesized. Every file below is the original Ogg from the author, CC0, and safe to ship in a commercial build.

| File | What it plays | Source | Author | Licence |
| --- | --- | --- | --- | --- |
| `src/audio/music/urban-loop.ogg` | Looping background during a run (about 88 seconds, then loops) | [Urban Theme](https://opengameart.org/content/urban-theme) · [file](https://opengameart.org/sites/default/files/urban_theme_bpm115.ogg) | MintoDog | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/audio/music/clear-sting.ogg` | Short sting when a car is cleared (about 8 seconds) | [Victory sting](https://opengameart.org/content/victory-sting) · [file](https://opengameart.org/sites/default/files/victory%20sting.ogg) | congusbongus | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/audio/music/miss-sting.ogg` | Short sting when the doors close (about 3 seconds) | [Better luck next time](https://opengameart.org/content/better-luck-next-time) · [file](https://opengameart.org/sites/default/files/betterluck.ogg) | congusbongus | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |

- **Playback.** The loop and the stings are decoded with `decodeAudioData` and played through a music bus. The loop uses `AudioBufferSourceNode.loop`. A sting stops the loop; the next run starts the loop again. Effects (step, bump, sway, fall, coins) stay on a separate bus as filtered oscillators and noise, so their level does not follow the music file.
- **Volume and mute.** `M` and the speaker button persist mute in `localStorage` under `get-off-the-train.cg.muted`. The − and + buttons persist volume under `get-off-the-train.cg.volume` (default 0.8, clamped from 0.15 to 1). Master gain is zero while muted.
- **Gesture.** The audio context and the file fetch start only after the first pointer or key. Until then the guest build stays silent.

The AlterU host build still uses the original oscillator tones. It does not fetch these files.

UI type is [Nunito](https://github.com/googlefonts/nunito) (SIL Open Font License 1.1). The license is in `src/ui/cg/fonts/OFL.txt`.
