# Ninja Ops

A top-down GBA-style action game built with Phaser 4 and TypeScript. Fight waves of Oni and a tough Oni Brute in a single arena, using attacks, dodges, blocks, jumps and a spinning signature move.

**Play in the browser:** https://erioluwa-dev.github.io/ninja-ops/ (opens the monastery hub; `?hub=city`, `?story` and `?sandbox` for the rest — live once the repo is public and GitHub Pages is enabled)

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrow keys | D-pad / left stick |
| Attack | A | A |
| Dodge | Q | B |
| Jump | X | X |
| Block (hold) | D | L |
| Spin (hold) | W | R |
| Pause | Esc | Start |

Press **Attack** on the title screen to start a run, and again on the result screen to restart.

### Dev keys

| Key | Action |
|---|---|
| `` ` `` | Debug overlay (hitboxes, states) |
| F1 | Tuning panel (dev builds only) |
| F2 | Toggle the training dummy's scripted attack |
| F3 | Spawn a wave |
| F4 | Spawn the Oni Brute |
| F5 | Cycle element (fire / earth) |
| F6 | Toggle sandbox mode |

## Development

Requires [bun](https://bun.sh).

```bash
bun install
bun run dev      # local dev server
bun run ci       # typecheck + lint + tests
bun run build    # static build in dist/
```

Pushes to `main` run CI and deploy `dist/` to GitHub Pages.

## Credits

Art from the [Ninja Adventure asset pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack) by pixel-boy, released under CC0.
