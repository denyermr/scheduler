# Schedule Board — Handoff Package

Hand this whole folder to Claude Code. It contains everything needed to build v1.

## Files

| File | Purpose | Read order |
|---|---|---|
| `Schedule Board — Original Brief.md` | The starting product brief — concept, scope, what v1 is and isn't. | 1 (orientation) |
| `Schedule Board — Build Spec.md` | The implementation spec — design tokens, data shapes, interactions, file layout. **Source of truth for behavior.** | 2 (build from this) |
| `Schedule Board — Visual Spec.html` | Single-file visual reference — design system + all screens + workflow storyboards. **Source of truth for look.** | 3 (open in a browser as you build) |

## Suggested prompt for Claude Code

> Build the Schedule Board app per `Schedule Board — Build Spec.md`. Use the visual spec (open `Schedule Board — Visual Spec.html` in a browser) as the look-and-feel reference. Stack: React + TypeScript + Vite, with a small Node/Express + SQLite (or JSON file) backend. Implement v1 only — do not build anything from §11 "Out of scope".

## When the docs conflict

The build spec wins for behavior. The visual spec wins for look. The original brief wins for scope.
