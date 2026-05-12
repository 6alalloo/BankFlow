# Frontend Theme Direction

Bankflow is now set up to pivot around the Raycast-inspired theme.

The active foundation lives in:

- `src/index.css`
- `src/styles/themes/raycast.tokens.css`
- `src/styles/themes/raycast.tokens.json`
- `src/styles/themes/raycast.DESIGN.md`
- `../docs/design/raycast-style-bankflow.md`

## What Is Active Now

- Global CSS variables now default to the Raycast dark palette.
- `src/index.css` imports the Raycast token CSS.
- Tailwind theme aliases include Raycast colors, shadows, and mono font choices.
- Geist and Geist Mono are loaded from Google Fonts.

## What Still Needs Implementation

- Replace remaining Bootstrap classes and inherited light-theme assumptions.
- Restyle app shell, sidebar, pages, forms, tables, cards, builder nodes, and modals.
- Convert high-volume banking data to mono numeric treatment.
- Use `#ff6363` only for risk, exception, rejection, destructive, and validation states.
- Prefer command bars, shortcuts, compact rows, and split panes over generic cards.
