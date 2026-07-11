# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris — no build step, no package manager, no dependencies. Three files: `index.html` (DOM/canvas structure), `style.css` (dark/light theming), `game.js` (all game logic, ~330 lines).

## Running / testing

There is no build, lint, or test tooling in this repo. To run the game:

```bash
open index.html                # macOS, works directly (no bundler needed)
# or, if browser file:// restrictions cause issues:
python3 -m http.server 8000    # then open http://localhost:8000
```

There are no automated tests. Verify changes manually in a browser: check piece movement/rotation, line clearing, scoring, level speed-up, pause, game over/restart, and the dark/light theme toggle.

## Architecture

All state lives in module-level `let` bindings in `game.js` (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) — there is no state container or framework, just global mutable variables driven by a `requestAnimationFrame` loop (`loop()`).

Key mechanics, in case a change touches them:

- **Board**: `ROWS × COLS` matrix; each cell is `0` (empty) or an index (1–8) into `COLORS`/`PIECES` identifying which piece color occupies it.
- **Pieces**: `PIECES` are square matrices (index 8 is a custom "Nut" piece with a hole in the middle, added on top of the 7 standard tetrominoes). Rotation (`rotateCW`) is a matrix transpose+reverse, not a lookup table — works for any square shape.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` until one doesn't collide, else the rotation is discarded.
- **Collision** (`collide`): the single source of truth for "can this shape sit at (ox, oy)" — used by movement, rotation, ghost piece, and spawn-collision (game over) checks alike.
- **Locking a piece** (`lockPiece`): merge → clearLines → spawn, always in that order.
- **Line clearing** (`clearLines`): scans bottom-up, splices full rows out and unshifts empty rows in; re-checks the same row index after a splice (`r++` before the loop's `r--`).
- **Scoring/level**: `LINE_SCORES` (`[0,100,300,500,800]`) × `level`; hard drop is 2 pts/row, soft drop 1 pt/row. Level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Ghost piece** (`ghostY`): projects `current` straight down via `collide` until it would hit, drawn at low alpha.
- **Theme**: persisted in `localStorage` under `tetris-theme`, applied via `data-theme` attribute on `<html>` plus a `THEME_COLORS` lookup used directly in canvas drawing (grid lines, block highlight) — CSS variables alone don't cover canvas-rendered elements, so canvas draw calls must consult `THEME_COLORS[theme]`.

If you change `COLS`, `ROWS`, or `BLOCK`, also update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS×BLOCK` and `ROWS×BLOCK`).
