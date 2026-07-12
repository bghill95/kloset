---
version: alpha
name: Kloset-design-system
description: |
  A photography-first personal closet system: true-white canvas, blush-tinted
  card surfaces, a single confident pink CTA, black ink for contrast moments,
  and a cursive script display face (Great Vibes) for the Kloset wordmark,
  page titles, and the full-screen menu. Garment cutout imagery is the
  load-bearing visual element in a masonry grid of 16px-radius cards with
  tight 8px gutters. Chrome stays quiet: Inter for all UI text, no shadows,
  no gradients.

colors:
  primary: "#e60070"
  on-primary: "#ffffff"
  primary-pressed: "#c4005f"
  ink: "#111111"
  body: "#383236"
  mute: "#6e6270"
  ash: "#a396a0"
  hairline: "#ecdfe6"
  canvas: "#ffffff"
  surface-soft: "#fdf9fb"
  surface-card: "#f9f1f5"
  secondary-bg: "#f1e4ea"
  secondary-pressed: "#e2cdd8"
  on-dark: "#ffffff"
  surface-dark: "#111111"
  error: "#9e0a0a"
  success-deep: "#103c25"
  success-pale: "#c7f0da"

typography:
  script-hero:      { fontFamily: Great Vibes, fontSize: 64px, fontWeight: 400, lineHeight: 1.1 }
  script-title:     { fontFamily: Great Vibes, fontSize: 40px, fontWeight: 400, lineHeight: 1.1 }
  script-menu:      { fontFamily: Great Vibes, fontSize: 48px, fontWeight: 400, lineHeight: 1.3 }
  heading-md:       { fontFamily: Inter, fontSize: 18px, fontWeight: 600, lineHeight: 1.3 }
  body-md:          { fontFamily: Inter, fontSize: 16px, fontWeight: 400, lineHeight: 1.4 }
  body-strong:      { fontFamily: Inter, fontSize: 16px, fontWeight: 600, lineHeight: 1.4 }
  body-sm:          { fontFamily: Inter, fontSize: 14px, fontWeight: 400, lineHeight: 1.4 }
  caption:          { fontFamily: Inter, fontSize: 12px, fontWeight: 500, lineHeight: 1.5 }
  button-md:        { fontFamily: Inter, fontSize: 14px, fontWeight: 700, lineHeight: 1 }

rounded: { none: 0px, card: 16px, big: 32px, full: 9999px }

spacing: { xxs: 4px, xs: 6px, sm: 8px, md: 12px, lg: 16px, xl: 24px, xxl: 32px, section: 64px }

components:
  button-primary:   { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", typography: "{typography.button-md}", rounded: "{rounded.full}", padding: 12px 20px, height: 44px }
  button-secondary: { backgroundColor: "{colors.secondary-bg}", textColor: "{colors.ink}", typography: "{typography.button-md}", rounded: "{rounded.full}", padding: 12px 20px, height: 44px }
  button-icon-circular: { backgroundColor: "{colors.surface-card}", textColor: "{colors.ink}", rounded: "{rounded.full}", size: 40px }
  filter-chip:      { backgroundColor: "{colors.surface-card}", textColor: "{colors.ink}", typography: "{typography.button-md}", rounded: "{rounded.full}", padding: 8px 16px }
  filter-chip-active: { backgroundColor: "{colors.ink}", textColor: "{colors.on-dark}", typography: "{typography.button-md}", rounded: "{rounded.full}" }
  pin-card:         { backgroundColor: "{colors.surface-card}", textColor: "{colors.ink}", rounded: "{rounded.card}", padding: 12px }
  pin-card-photo:   { backgroundColor: "{colors.surface-card}", textColor: "{colors.ink}", rounded: "{rounded.card}", padding: 0px }
  text-input:       { backgroundColor: "{colors.canvas}", textColor: "{colors.ink}", typography: "{typography.body-md}", rounded: "{rounded.card}", padding: 11px 15px, height: 44px }
  menu-overlay:     { backgroundColor: "{colors.canvas}", textColor: "{colors.ink}", typography: "{typography.script-menu}", rounded: "{rounded.none}" }
  page-header:      { backgroundColor: "{colors.canvas}", textColor: "{colors.ink}", typography: "{typography.script-title}", rounded: "{rounded.none}" }
---

## Overview

Kloset is a personal virtual closet, not a marketplace — the design system's
job is to get out of the way of two things: garment photography and the
wearer's own outfits. The chrome is a quiet, near-white palette
(`{colors.canvas}`, `{colors.surface-soft}`, `{colors.surface-card}`) carrying
Inter for every UI text role, with Kloset Pink (`{colors.primary}` —
`#e60070`) reserved for exactly one primary action per screen. Black ink
(`{colors.ink}`) supplies the system's only other high-contrast moment —
active filter chips, the menu overlay, headline text — so the palette reads
as white / blush / pink / black and nothing else.

The system has two visual registers that never blend: **quiet chrome** (white
canvas, blush card surfaces, Inter text, pill buttons, 16px-radius cards) and
**script moments** (Great Vibes cursive, reserved strictly for the "Kloset"
wordmark, page titles, and the full-screen menu's link list). Great Vibes
never appears in body copy, buttons, form labels, or captions — the instant
it shows up outside those three contexts, the hierarchy breaks. Garment
imagery is the load-bearing visual element in the Closet's masonry grid: each
cutout sits in a `{rounded.card}` (16px) tile with the standard
`{spacing.md}` (12px) `{component.pin-card}` inset — keeping irregular
cutout silhouettes off the rounded corners — and tight `{spacing.sm}` (8px)
gutters between tiles, exactly as pin photography does in a pin-grid system
— except the "pin" here is a photo of one item of clothing.

**Key Characteristics:**
- Single-accent CTA: Kloset Pink (`{colors.primary}`) carries at most one
  primary action per screen; everything else is white, blush, or ink
- Script/sans split: Great Vibes for wordmark + page titles + full-screen
  menu links only; Inter for every other text role, from headings down to
  captions
- Two-radius shape system plus pill: `{rounded.card}` (16px) for cards and
  inputs, `{rounded.big}` (32px) reserved for the menu overlay and large
  surfaces, `{rounded.full}` for buttons, chips, and circular controls
- Masonry garment grid as the load-bearing visual element — each cutout
  sits inset `{spacing.md}` (12px) inside its `{component.pin-card}`, off
  the rounded corners; true photographs stay full-bleed in
  `{component.pin-card-photo}`
- Flat elevation throughout: no card shadows anywhere; the only depth cue is
  the full-screen menu's scrim over the page it covers
- Blush-tinted neutral chrome (`{colors.surface-card}` — `#f9f1f5`) that
  recedes behind garment photography without competing with it

## Colors

### Brand & Accent
- **Kloset Pink** (`{colors.primary}` — `#e60070`): the only saturated color
  in the system. Reserved for the single primary CTA on a screen — "Add
  item", "Save outfit", "Generate look" — never decorative, never repeated
  twice on the same screen.
- **Kloset Pink Pressed** (`{colors.primary-pressed}` — `#c4005f`): pressed
  state for `{component.button-primary}` — one notch deeper than brand pink.

### Surface
- **Canvas** (`{colors.canvas}` — `#ffffff`): true white. Base surface for
  page backgrounds, the full-screen menu, modals, and text inputs.
- **Surface Soft** (`{colors.surface-soft}` — `#fdf9fb`): a faint blush wash,
  used where a page body needs to feel warmer than pure white without
  competing with garment photography.
- **Surface Card** (`{colors.surface-card}` — `#f9f1f5`): blush card and
  garment-tile background. Carries `{component.pin-card}`, filter chips, and
  the icon-circular button.
- **Secondary BG** (`{colors.secondary-bg}` — `#f1e4ea`): `{component.button-secondary}`
  fill — a notch deeper than `{colors.surface-card}`.
- **Secondary Pressed** (`{colors.secondary-pressed}` — `#e2cdd8`): pressed
  state for the secondary button.
- **Surface Dark** (`{colors.surface-dark}` — `#111111`): matches `{colors.ink}`;
  used only where a dark chrome block is required (rare — the menu overlay
  itself stays white).
- **Hairline** (`{colors.hairline}` — `#ecdfe6`): 1px dividers, list rows,
  input borders — the system's only border color.

### Text
- **Ink** (`{colors.ink}` — `#111111`): headlines, active filter-chip text,
  primary nav/menu text — the system's contrast moment, used deliberately and
  sparingly outside of default body copy.
- **Body** (`{colors.body}` — `#383236`): default paragraph and UI text on
  `{colors.canvas}`.
- **Mute** (`{colors.mute}` — `#6e6270`): metadata, secondary captions, helper
  text.
- **Ash** (`{colors.ash}` — `#a396a0`): disabled labels, least-emphasis
  utility text. Not used for placeholder text — `{colors.mute}` carries
  placeholders (contrast fix).
- **On Dark** (`{colors.on-dark}` — `#ffffff`): text on `{colors.ink}` /
  `{colors.surface-dark}`, e.g. `{component.filter-chip-active}`.

### Semantic
- **Error** (`{colors.error}` — `#9e0a0a`): validation messages, destructive
  confirmation copy.
- **Success Deep** (`{colors.success-deep}` — `#103c25`): in-product success
  messaging text.
- **Success Pale** (`{colors.success-pale}` — `#c7f0da`): pale success-pill
  background.

## Typography

### Font Family
**Great Vibes** is Kloset's cursive display face — used exclusively for the
"Kloset" wordmark, page titles (`{typography.script-title}`), the Today
hero (`{typography.script-hero}`), and the full-screen menu's link list
(`{typography.script-menu}`). It carries a single weight (400) and never
appears below 40px — at small sizes cursive script loses legibility, so it is
structurally excluded from body, buttons, labels, and captions.

**Inter** carries every other text role in the system: headings, body copy,
buttons, filter chips, captions. It falls back to `ui-sans-serif` →
`system-ui` → `sans-serif`.

### Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `{typography.script-hero}` | 64px | 400 | 1.1 | Today screen hero moment |
| `{typography.script-menu}` | 48px | 400 | 1.3 | Full-screen menu link list |
| `{typography.script-title}` | 40px | 400 | 1.1 | Page title (Closet, Studio, Stylist, Lookbook) |
| `{typography.heading-md}` | 18px | 600 | 1.3 | Card title, section heading |
| `{typography.body-strong}` | 16px | 600 | 1.4 | Form label, inline emphasis |
| `{typography.body-md}` | 16px | 400 | 1.4 | Default paragraph, modal body |
| `{typography.body-sm}` | 14px | 400 | 1.4 | Helper text, in-grid metadata |
| `{typography.caption}` | 12px | 500 | 1.5 | Caption text, timestamps |
| `{typography.button-md}` | 14px | 700 | 1 | Button and chip label |

### Principles
Great Vibes only ever appears at three fixed sizes (`script-hero`,
`script-title`, `script-menu`) — it is not a general-purpose display tier
that scales down; below 40px it is replaced outright by Inter
`{typography.heading-md}`. Body copy sits at a comfortable 1.4 line-height,
matching the "let it breathe" quality of the reference system while keeping
the working font single (Inter) so the UI never has to reconcile a second
sans-serif face.

## Layout

### Spacing System
- **Base unit:** 8px, with finer 4/6px steps for tight inline gaps in pill
  buttons and chips.
- **Tokens (front matter):** `{spacing.xxs}` (4px) · `{spacing.xs}` (6px) ·
  `{spacing.sm}` (8px) · `{spacing.md}` (12px) · `{spacing.lg}` (16px) ·
  `{spacing.xl}` (24px) · `{spacing.xxl}` (32px) · `{spacing.section}` (64px).
- **Garment grid gutters:** `{spacing.sm}` (8px) between masonry tiles — tight
  enough that cutout photography reads as a continuous wall of garments.

### Grid & Container
- **Phone-first:** the app is a single-column mobile viewport; the masonry
  garment grid runs 2 columns at phone width, widening to 3–4 columns only at
  tablet/desktop breakpoints if the PWA is used on a larger screen.
- **Closet masonry grid:** each tile preserves the garment cutout's natural
  aspect ratio — no forced square crop. Gutters are `{spacing.sm}` (8px)
  horizontal and vertical.
- **Full-screen menu:** covers the entire viewport on open — not a drawer,
  not a partial overlay. Script links stack vertically, generously spaced.

### Whitespace Philosophy
Section rhythm uses `{spacing.section}` (64px) between major page blocks on
the Today and Studio screens, while the Closet grid collapses to the tight
8px gutter so garment imagery tiles edge-to-edge. As in the reference system,
Kloset reads as two tools sharing one chrome: a calm single-item viewer
(Today / Studio / page headers) and a dense discovery grid (Closet).

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | No border, no shadow | Default for every card, including `{component.pin-card}` — the dominant treatment in the system |
| 1 — Hairline border | 1px solid `{colors.hairline}` | Inputs, list-row dividers, filter-chip default state |
| 2 — Modal scrim | Full-screen menu / modal sits over a scrim on the page content | Full-screen menu open, confirmation modals |

Kloset has **no card shadows anywhere** — this is a hard rule, not a
default that gets exceptions. Depth is communicated only by the modal/menu
scrim; every other surface, including garment cards, sits perfectly flat on
the canvas.

### Decorative Depth
Depth comes entirely from the garment photography itself:
- **Garment cutouts** carry their own depth through the product photography
  (studio lighting, natural drape) — the card adds no shadow, gradient, or
  border to reinforce it.
- **Menu scrim** — the only elevation gesture in the system: the full-screen
  menu covers the page content outright (not a translucent overlay), so there
  is no dual-layer shadow stack to maintain.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Full-screen menu, page headers — flat structural surfaces |
| `{rounded.card}` | 16px | Garment cards, text inputs — the dominant component radius |
| `{rounded.big}` | 32px | Reserved for large surfaces (e.g. a hero image block) |
| `{rounded.full}` | 9999px | Buttons, filter chips, icon-circular controls |

There are exactly **three radius values** in the system: 16px, 32px, and
pill. Nothing sits between 16px and 32px, and nothing is sharp-cornered
except the deliberately flat structural surfaces above.

### Photography Geometry
- **Garment cutouts:** natural aspect ratio preserved inside `{rounded.card}`
  (16px) corners, inset by the standard `{spacing.md}` (12px)
  `{component.pin-card}` padding — the blush surface reads as backdrop
  behind the cutout, not a frame around a photo.
- **True photographs** (avatar base photos, outfit renders): full-bleed,
  zero internal padding, in `{component.pin-card-photo}` — the photograph
  IS the card.
- **Avatar / profile renders:** circular at `{rounded.full}` where used in
  Studio.

## Components

### Buttons

**`button-primary`** — the single Kloset CTA
- Background `{colors.primary}`, text `{colors.on-primary}`, type
  `{typography.button-md}`, padding `12px 20px`, height `44px`, rounded
  `{rounded.full}`.
- Exactly one per screen: "Add item", "Save outfit", "Generate look". Never a
  secondary or tertiary pink button on the same screen.

**`button-secondary`** — blush alternative
- Background `{colors.secondary-bg}`, text `{colors.ink}`, type
  `{typography.button-md}`, padding `12px 20px`, height `44px`, rounded
  `{rounded.full}`.
- "Cancel", "Skip", second-tier actions paired with the pink primary.

**`button-icon-circular`**
- Background `{colors.surface-card}`, icon `{colors.ink}`, rounded
  `{rounded.full}`, size `40px`.
- Menu-open button, close buttons, small floating controls over imagery.

### Filter & Tab Chips

**`filter-chip`** + **`filter-chip-active`**
- Default: background `{colors.surface-card}`, text `{colors.ink}`, type
  `{typography.button-md}`, rounded `{rounded.full}`, padding `8px 16px`.
- Active: background `{colors.ink}`, text `{colors.on-dark}` — fully inverted
  on selection, matching the reference system's chip behavior.
- Used for category filters (`top | bottom | dress | jacket | shoes | hat |
  accessory`) atop the Closet grid.

### Inputs & Forms

**`text-input`**
- Background `{colors.canvas}`, text `{colors.ink}`, type
  `{typography.body-md}`, padding `11px 15px`, height `44px`, rounded
  `{rounded.card}`, 1px `{colors.hairline}` border.
- Used across passcode entry, item detail edit fields, settings.

### Cards & Containers

**`pin-card`** — the standard garment cutout tile
- Container: background `{colors.surface-card}`, rounded `{rounded.card}`
  (16px), padding `{spacing.md}` (12px).
- Layout: garment cutout at its natural aspect ratio, inset `{spacing.md}`
  (12px) on every side so the cutout's irregular silhouette never collides
  with the rounded corners — the blush card surface reads as the backdrop
  the garment sits on, not a photo frame. No shadow, ever. This is the
  Closet grid's card.

**`pin-card-photo`** — the full-bleed photographic tile
- Container: background `{colors.surface-card}`, rounded `{rounded.card}`
  (16px), padding `0px`.
- Layout: full-bleed photograph at its natural aspect ratio with **no
  internal padding** — the photograph IS the card, exactly as in the
  reference masonry system. No shadow, ever. Reserved for true photographs
  — avatar base photos, future outfit renders — never for garment cutouts.

### Overlays

**`menu-overlay`** — the full-screen navigation menu
- Background `{colors.canvas}`, text `{colors.ink}`, type
  `{typography.script-menu}`, rounded `{rounded.none}`.
- Covers the entire viewport; script links stack vertically. Replaces a
  conventional tab bar.

**`page-header`** — script page title
- Background `{colors.canvas}`, text `{colors.ink}`, type
  `{typography.script-title}`, rounded `{rounded.none}`.
- Sits at the top of Closet / Studio / Stylist / Lookbook / Settings; the
  only script text on those screens besides the wordmark.

## Do's and Don'ts

### Do
- Reserve `{colors.primary}` (Kloset Pink) for exactly one primary CTA per
  screen. It is never decorative and never doubled up.
- Use Great Vibes only for the Kloset wordmark, `{component.page-header}`
  page titles, and `{component.menu-overlay}` menu links. Every other text
  role — body, buttons, labels, captions — is Inter.
- Stage every garment cutout inside a `{component.pin-card}` with its
  standard `{spacing.md}` (12px) inset; stage true photographs (avatar base
  photos, outfit renders) inside `{component.pin-card-photo}` full-bleed —
  the photograph IS the card.
- Keep cards and surfaces flat: no shadows, ever. The full-screen menu scrim
  is the only elevation gesture in the system.
- Use only the three radii in the system: `{rounded.card}` (16px),
  `{rounded.big}` (32px), and `{rounded.full}` (pill). Nothing else.
- Build hierarchy from Inter's weight range (400 → 600 → 700) and size for
  UI text; reserve script exclusively for the three named contexts above.

### Don't
- Don't use Great Vibes in body copy, buttons, form labels, filter chips, or
  captions — script is a display face for three fixed contexts only.
- Don't introduce a second pink CTA on the same screen. If two actions
  compete, the second one is `{component.button-secondary}`.
- Don't add drop shadows to cards. There is no shadow token in this system —
  not even a soft one — cards are flat, and only the menu scrim reads as
  "above" the page.
- Don't exceed `{component.pin-card}`'s standard `{spacing.md}` (12px)
  inset — that padding is reserved for garment cutouts, to keep silhouettes
  off the rounded corners. Don't pad `{component.pin-card-photo}` at all;
  any label sits as an overlay, not as internal padding pushing the photo
  inward.
- Don't introduce a radius value between 16px and 32px, or any sharp corner
  on an interactive element. The vocabulary is exactly 16 / 32 / pill.
- Don't replace `{colors.primary}` with another pink or a gradient. The brand
  pink is precise — `#e60070`.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| phone | 375–430px | Default target — single-column layout, 2-column garment grid, full-screen menu |
| tablet | 768px | Garment grid widens to 3 columns; page content gains outer gutters |
| desktop | 1024px+ | Garment grid widens to 4 columns; content clamps to a centered column so the phone-first chrome doesn't stretch edge-to-edge |

### Touch Targets
All interactive elements meet WCAG AA (≥ 44×44px). `{component.button-primary}`
and `{component.button-secondary}` sit at 44px height. `{component.text-input}`
sits at 44px. `{component.filter-chip}` is ~36–40px with 16px horizontal
padding, extended to a 44px tappable area via parent padding.
`{component.button-icon-circular}` is 40×40 with hit-target padding to 48×48.

### Collapsing Strategy
- **Full-screen menu:** identical full-viewport takeover at every
  breakpoint — it does not become a sidebar or dropdown on wider screens.
- **Garment masonry grid:** 2-up → 3-up → 4-up at phone → tablet → desktop.
  Gutters hold at `{spacing.sm}` (8px) throughout — they never widen.
- **Page header:** `{typography.script-title}` holds its 40px size across
  breakpoints; only the surrounding page gutters grow.

### Image Behavior
- Garment cutouts preserve their natural aspect ratio at every breakpoint;
  the column count changes, the aspect never does.
- Cutouts are transparent-background PNGs composited onto
  `{colors.surface-card}` — no crop, no letterboxing.

## Iteration Guide

1. Focus on ONE component at a time. Pull its YAML entry and verify every
   property resolves against this file's front matter.
2. Reference tokens directly (`{colors.primary}`, `{component.pin-card}`,
   `{rounded.card}`) in code and PRs — do not paraphrase hex values or pixel
   sizes inline.
3. Before adding a new UI role, check whether an existing component
   (`button-primary`, `pin-card`, `filter-chip`, `text-input`) already covers
   it. This system is deliberately small — most new screens should compose
   existing tokens, not add new ones.
4. Keep `{colors.primary}` scarce — at most one Kloset-pink CTA per screen,
   counting header, body, and any sticky action together.
5. Keep Great Vibes scarce — at most the wordmark + one page title + the menu
   per screen. If a new text role feels like it wants script, default it to
   Inter `{typography.heading-md}` instead and revisit only if the product
   spec explicitly calls for a script moment.
6. When touching Tailwind classes, use the utilities this file backs
   (`bg-canvas`, `bg-blush`/`bg-card`, `bg-pink`, `bg-pink-deep`, `text-ink`,
   `text-body`, `text-mute`, `text-ash`, `border-hairline`, `font-script`,
   `font-sans`, `rounded-card`, `rounded-big`) — never hand-roll a hex color
   or arbitrary radius in a component.
