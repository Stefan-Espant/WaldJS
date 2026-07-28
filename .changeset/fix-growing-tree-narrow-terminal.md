---
"@waldjs/cli": patch
---

Fix the growing-tree loading animation (shown during `wald grow`/`wald build`) leaving stacked, duplicate frames on screen instead of redrawing in place. The animation is 70 columns wide but never checked the terminal's actual width — in a narrower terminal, lines wrap and the cursor-up redraw math no longer lines up with what's on screen. Now falls back to a plain text label when the terminal is too narrow, same as it already did for non-TTY output.
