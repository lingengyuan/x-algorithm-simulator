# X simulator redesign

Style: framed-sheet. Seed: 757754190. No redraws.
Face: cool blue-grey frame, white working sheet, IBM Plex Sans. Accent: teal on pipeline progress and scores.
Signature: a source → filtered posts → final timeline strip, calculated from the active pipeline.

Screen questions:
- Simulator: which stage changes the candidate set, and why?
- Outputs: which probabilities and continuous values did the fixture return?
- Weights: how does one weight change the resulting order?
- History: which fixture did I examine before?

Objects: candidate posts, retrieval sources, filter decisions, scorer outputs, final feed modules, weight presets, saved fixture analyses, pinned upstream commit.
Data ranges: 60–3,500 candidates; 2,800 scoring budget; 28 output fields; 0–1 probabilities; seconds for continuous outputs; mixed positive and negative weights.
Users: technical readers inspecting English and Chinese examples on desktop, tablet, and phone.
Main actions: play/step, inspect a stage, generate outputs, adjust/reset weights, export a trace.

Before findings: viewport-based nested grids squeeze candidate cards; metadata rows do not wrap; score labels and values compete for the same width; 24 radar labels collide; glass, gradients, and entrance motion obscure structure.

Layout arithmetic: 228px sidebar + remaining fluid sheet; sheet padding 24px each side. Three panes only when sheet content >= 1,040px. Each pane is >= 300px. Narrow screens use one selected pane.
