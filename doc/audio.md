# Audio (Crazy Games guest build)

The guest build synthesizes every sound in the browser with the Web Audio API. Nothing is a sampled recording, so no third-party license applies.

- **Music.** An original low-volume loop: a soft A-minor pentatonic motif, a quiet bass pulse, and a filtered-noise “wheel clack” on the eighth notes (about 92 BPM). It is scheduled ahead on a lookahead clock and loops for the whole session.
- **Effects.** Each gameplay event (step, bump, sway, fall, doors, coins, win, lose) is a short stack of filtered oscillators plus a noise burst, mixed on one effects bus so the peaks sit at a similar level. These replace the single raw oscillator beeps used by the AlterU build.
- **Mute.** `M` and the speaker button persist in `localStorage` under `get-off-the-train.cg.muted`.
- **Gesture.** The audio context is created only after the first pointer or key. Until then the guest build stays silent.

The AlterU host build still uses the original oscillator tones and does not start this music.

UI type is [Nunito](https://github.com/googlefonts/nunito) (SIL Open Font License 1.1). The license is in `src/ui/cg/fonts/OFL.txt`.
