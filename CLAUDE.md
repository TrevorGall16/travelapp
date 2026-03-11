# NOMADMEET: THE SOVEREIGN ROOT

## 1. Documentation Map (READ THESE BEFORE CODING)
- Architecture & Database: Read `realtime_architecture.md` and `data_schema.md`.
- Coding Standards: Read `ai_coding_guideline.md`.
- UI & Tone: Read `copy_guidelines.md`.
- App Store Rules: Read `deployement_and_appstore.md`.

## 2. Immediate Architectural Quirks (DO NOT OVERRIDE)
- **The Samsung Keyboard Lock:** Android `adjustResize` is failing due to `translucent: true`. 
  - *Fix:* We use manual container height calculations (shrinking the View) combined with `Keyboard.addListener` in Chat screens. Do not rely on OS resize.
- **Map Tile API:** Google Cloud API key restrictions (SHA-1) are the ONLY reason for black map tiles. Do not attempt to fix black tiles with CSS.

## 3. Workflow Protocol (MANDATORY)
1. Always check `ROADMAP.md` to understand your current objective.
2. When you complete a task, you MUST automatically update `ROADMAP.md` to check it off and list the next step. Do not wait for the user to ask you to update it.