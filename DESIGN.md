---
version: velvet-boudoir
name: Kloset-design-system
description: |
  Velvet Boudoir: a photography-first personal closet system on a dark
  wine/aubergine canvas — a dressing room lined in velvet. Dusty-rose accents,
  light rose-tinted ink, Gloock (high-contrast display serif) for page titles
  and the full-screen menu, Great Vibes script reserved for the "Kloset"
  wordmark alone, Inter for all UI text. The full-screen menu is the system's
  one drenched surface: deep rose with white serif links. Garment cutout
  imagery is the load-bearing visual element in a masonry grid of
  16px-radius cards with tight 8px gutters. No shadows, no gradients.

colors:
  canvas: "#1c1017"
  surface-card: "#2b1b24"
  primary: "#e88fa6"
  primary-pressed: "#d97b95"
  on-primary: "#26101a"
  secondary-bg: "#3a2530"
  secondary-pressed: "#47303c"
  ink: "#f6ecf1"
  body: "#dcc9d3"
  mute: "#a88fa0"
  ash: "#7c6a74"
  hairline: "#3d2a34"
  menu: "#a85a72"
  menu-active: "#26101a"
  on-menu: "#ffffff"
  error: "#f79a9a"
  success: "#a9e4c4"

typography:
  script-wordmark:  { fontFamily: Great Vibes, fontSize: 30px+, fontWeight: 400, lineHeight: 1.1 }
  display-title:    { fontFamily: Gloock, fontSize: 36px, fontWeight: 400, lineHeight: 1.1 }
  display-heading:  { fontFamily: Gloock, fontSize: 30px, fontWeight: 400, lineHeight: 1.2 }
  display-menu:     { fontFamily: Gloock, fontSize: 48px, fontWeight: 400, lineHeight: 1.15 }
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
  filter-chip-active: { backgroundColor: "{colors.ink}", textColor: "{colors.canvas}", typography: "{typography.button-md}", rounded: "{rounded.full}" }
  pin-card:         { backgroundColor: "{colors.surface-card}", textColor: "{colors.ink}", rounded: "{rounded.card}", padding: 12px }
  pin-card-photo:   { backgroundColor: "{colors.surface-card}", textColor: "{colors.ink}", rounded: "{rounded.card}", padding: 0px }
  text-input:       { backgroundColor: "{colors.canvas}", textColor: "{colors.ink}", typography: "{typography.body-md}", rounded: "{rounded.card}", padding: 11px 15px, height: 44px }
  menu-overlay:     { backgroundColor: "{colors.menu}", textColor: "{colors.on-menu}", typography: "{typography.display-menu}", rounded: "{rounded.none}" }
  page-header:      { backgroundColor: "{colors.canvas}", textColor: "{colors.ink}", typography: "{typography.display-title}", rounded: "{rounded.none}" }
---

## Overview

Kloset is a personal virtual closet, not a marketplace — the design system's
job is to get out of the way of two things: garment photography and the
wearer's own outfits. Velvet Boudoir does that with a dark, deliberately
*tinted* chrome: the canvas (`{colors.canvas}` — `#1c1017`) is wine/aubergine,
not neutral black, and every neutral in the ramp (`{colors.surface-card}`,
`{colors.hairline}`, `{colors.body}`, `{colors.mute}`) carries the same rose
cast. Dusty rose (`{colors.primary}` — `#e88fa6`) is the single accent,
reserved for one primary action per screen — and because it is a *light*
rose, primary buttons carry dark text (`{colors.on-primary}`), not white.

The system has three type voices that never blend:

- **Script** (Great Vibes) — the "Kloset" wordmark ONLY. It no longer
  appears on page titles or menu links.
- **Display serif** (Gloock) — page titles and the full-screen menu links.
  High-contrast, romantic, and legible where script wasn't.
- **UI sans** (Inter) — every other text role: headings, body, buttons,
  chips, captions.

Garment imagery is the load-bearing visual element in the Closet's masonry
grid: each cutout sits in a `{rounded.card}` (16px) tile with the standard
`{spacing.md}` (12px) `{component.pin-card}` inset and tight `{spacing.sm}`
(8px) gutters. The dark surface makes cutouts and renders read like garments
under boutique lighting.

**Key Characteristics:**
- Single-accent CTA: dusty rose (`{colors.primary}`) with dark
  `{colors.on-primary}` text; at most one per screen
- Script reduced to the wordmark; Gloock carries titles and the menu;
  Inter carries everything else
- The full-screen menu is the one drenched surface: deep rose
  (`{colors.menu}` — `#a85a72`) with white Gloock links; the current page's
  link drops to dark plum (`{colors.menu-active}`)
- Two-radius shape system plus pill: 16px cards/inputs, 32px large surfaces,
  pill buttons/chips
- Flat elevation throughout: no card shadows anywhere; the only depth cue is
  the full-screen menu covering the page
- One chrome for everything: the camera screens (scan, avatar capture) sit
  on the same `{colors.canvas}` as the rest of the app — there is no longer
  a separate "dark chrome" register, because the whole app is dark

## Colors

### Brand & Accent
- **Rose** (`{colors.primary}` — `#e88fa6`): the only saturated accent.
  Reserved for the single primary CTA on a screen — "Add item", "Save
  outfit", "Generate look" — never decorative, never repeated twice on the
  same screen. Because rose is light, CTA text is `{colors.on-primary}`
  (`#26101a`), never white.
- **Rose Pressed** (`{colors.primary-pressed}` — `#d97b95`): pressed state
  for `{component.button-primary}`.

### Surface
- **Canvas** (`{colors.canvas}` — `#1c1017`): dark wine/aubergine. Base
  surface for page backgrounds, text inputs, and the camera screens.
- **Surface Card** (`{colors.surface-card}` — `#2b1b24`): garment-tile and
  card background; also carries filter chips and the icon-circular button.
- **Secondary BG** (`{colors.secondary-bg}` — `#3a2530`) /
  **Secondary Pressed** (`{colors.secondary-pressed}` — `#47303c`):
  `{component.button-secondary}` fill and pressed state.
- **Menu** (`{colors.menu}` — `#a85a72`): deep rose, used ONLY as the
  full-screen menu overlay surface and the app icon background. Never a
  button, never a card.
- **Hairline** (`{colors.hairline}` — `#3d2a34`): 1px dividers, list rows,
  input borders — the system's only border color.

### Text
- **Ink** (`{colors.ink}` — `#f6ecf1`): headlines, page titles, emphasized
  UI text — and, inverted, the fill of `{component.filter-chip-active}`
  (light pill, `{colors.canvas}` text).
- **Body** (`{colors.body}` — `#dcc9d3`): default paragraph and UI text.
- **Mute** (`{colors.mute}` — `#a88fa0`): metadata, captions, helper text,
  placeholders.
- **Ash** (`{colors.ash}` — `#7c6a74`): disabled labels only — never body
  or placeholder text.
- **On Primary** (`{colors.on-primary}` — `#26101a`): text on rose fills.
- **On Menu** (`{colors.on-menu}` — `#ffffff`): menu wordmark and inactive
  menu links; **Menu Active** (`{colors.menu-active}` — `#26101a`, dark
  plum) marks the current page's link.

### Semantic
- **Error** (`{colors.error}` — `#f79a9a`): validation and destructive
  messaging text on dark surfaces; as a destructive button fill it carries
  `{colors.canvas}` text.
- **Success** (`{colors.success}` — `#a9e4c4`): success messaging text.

### White-alpha utilities (photography overlays)
On top of photographs and the camera feed, fixed white/black alphas are the
sanctioned exception to the token palette: `bg-white/10` (viewfinder well),
`bg-white/15` (secondary pill on camera screens and on the menu overlay),
`text-white/70`–`/80` (camera helper text), `bg-black/50`–`/60` (countdown
scrim, photo badges). These never appear on ordinary chrome.

## Typography

### Font Family
**Great Vibes** survives in exactly one role: the "Kloset" wordmark (menu
header and app icon). It never appears in titles, links, body, or labels.

**Gloock** is the display face — `{typography.display-title}` for page
titles (Today, Closet, Studio, Stylist, Lookbook, Settings),
`{typography.display-heading}` for in-page section headings and empty-state
hero lines ("Today's outfit", "Your closet awaits"), and
`{typography.display-menu}` for the full-screen menu links. Single weight
(400); its high stroke contrast does the work bolding would.

**Inter** carries every other text role. Falls back to `ui-sans-serif` →
`system-ui` → `sans-serif`.

### Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `{typography.display-menu}` | 48px | 400 | 1.15 | Full-screen menu link list (Gloock) |
| `{typography.display-title}` | 36px | 400 | 1.1 | Page title (Gloock) |
| `{typography.display-heading}` | 30px | 400 | 1.2 | Section heading, empty-state hero (Gloock) |
| `{typography.script-wordmark}` | 30px+ | 400 | 1.1 | "Kloset" wordmark only (Great Vibes) |
| `{typography.heading-md}` | 18px | 600 | 1.3 | Card title, section heading |
| `{typography.body-strong}` | 16px | 600 | 1.4 | Form label, inline emphasis |
| `{typography.body-md}` | 16px | 400 | 1.4 | Default paragraph, modal body |
| `{typography.body-sm}` | 14px | 400 | 1.4 | Helper text, in-grid metadata |
| `{typography.caption}` | 12px | 500 | 1.5 | Caption text, timestamps |
| `{typography.button-md}` | 14px | 700 | 1 | Button and chip label |

### Principles
Gloock appears at exactly three fixed sizes (48 / 36 / 30px) and never
below 30px — below that, hierarchy is built from Inter's weight range
(400 → 600 → 700). Script never appears outside the wordmark, at any size.
Body copy sits at 1.4 line-height.

## Layout

### Spacing System
- **Base unit:** 8px, with finer 4/6px steps for tight inline gaps.
- **Tokens (front matter):** `{spacing.xxs}` (4px) · `{spacing.xs}` (6px) ·
  `{spacing.sm}` (8px) · `{spacing.md}` (12px) · `{spacing.lg}` (16px) ·
  `{spacing.xl}` (24px) · `{spacing.xxl}` (32px) · `{spacing.section}` (64px).
- **Garment grid gutters:** `{spacing.sm}` (8px) between masonry tiles.

### Grid & Container
- **Phone-first:** single-column mobile viewport; the garment grid runs 2
  columns at phone width, 3–4 at tablet/desktop.
- **Closet masonry grid:** each tile preserves the cutout's natural aspect
  ratio — no forced square crop.
- **Full-screen menu:** covers the entire viewport on open — not a drawer,
  not a partial overlay. Gloock links stack vertically, generously spaced.

### Whitespace Philosophy
Section rhythm uses `{spacing.section}` (64px) between major page blocks on
Today and Studio; the Closet grid collapses to the tight 8px gutter so
garment imagery tiles edge-to-edge. Kloset reads as two tools sharing one
chrome: a calm single-item viewer and a dense discovery grid.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | No border, no shadow | Default for every card — the dominant treatment |
| 1 — Hairline border | 1px solid `{colors.hairline}` | Inputs, list-row dividers |
| 2 — Menu takeover | Full-screen menu covers the page outright | Menu open, confirmation modals |

Kloset has **no card shadows anywhere** — a hard rule. On a dark canvas,
separation comes from the surface step (`{colors.canvas}` →
`{colors.surface-card}`), not from shadow. Depth otherwise comes entirely
from the garment photography itself.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Full-screen menu, page headers |
| `{rounded.card}` | 16px | Garment cards, text inputs — dominant radius |
| `{rounded.big}` | 32px | Reserved for large surfaces |
| `{rounded.full}` | 9999px | Buttons, filter chips, circular controls |

Exactly **three radius values**: 16px, 32px, and pill. Nothing between.

### Photography Geometry
- **Garment cutouts:** natural aspect ratio inside `{rounded.card}` corners,
  inset by the standard `{spacing.md}` `{component.pin-card}` padding — the
  dark card surface reads as backdrop, not frame.
- **True photographs** (avatar base photos, outfit renders): full-bleed,
  zero internal padding, in `{component.pin-card-photo}`.
- **Overlay labels on photos:** `{colors.canvas}` pill with `{colors.ink}`
  text (e.g. item-name badges on grid tiles).

## Components

### Buttons

**`button-primary`** — the single Kloset CTA
- Background `{colors.primary}`, text `{colors.on-primary}` (dark — never
  white on rose), type `{typography.button-md}`, padding `12px 20px`, height
  `44px`, rounded `{rounded.full}`. Pressed: `{colors.primary-pressed}`.
- Exactly one per screen.

**`button-secondary`**
- Background `{colors.secondary-bg}`, text `{colors.ink}`, pressed
  `{colors.secondary-pressed}`; same geometry as primary.
- "Cancel", "Skip", second-tier actions.

**`button-icon-circular`**
- Background `{colors.surface-card}`, icon `{colors.ink}`, rounded
  `{rounded.full}`, size `40px`. Menu-open trigger, small controls.
- On the menu overlay itself, the close button runs `bg-white/15` +
  white icon instead (rose context).

### Filter & Tab Chips

**`filter-chip`** + **`filter-chip-active`**
- Default: background `{colors.surface-card}`, text `{colors.ink}`.
- Active: **inverted to light** — background `{colors.ink}`, text
  `{colors.canvas}`. This is the system's selected-state signature
  everywhere, including the camera screens.

### Inputs & Forms

**`text-input`**
- Background `{colors.canvas}`, text `{colors.ink}`, placeholder
  `{colors.mute}`, 1px `{colors.hairline}` border, height 44px, rounded
  `{rounded.card}`.

### Cards & Containers

**`pin-card`** — the standard garment cutout tile: `{colors.surface-card}`,
16px radius, `{spacing.md}` inset. No shadow, ever.

**`pin-card-photo`** — the full-bleed photographic tile: same surface, zero
padding — the photograph IS the card. Labels sit as overlays.

### Overlays

**`menu-overlay`** — the full-screen navigation menu
- Background `{colors.menu}` (deep rose) — the one drenched surface in the
  system. Wordmark: Great Vibes, `{colors.on-menu}` white. Links:
  `{typography.display-menu}` Gloock, white; the current page's link is
  `{colors.menu-active}` dark plum. Close button: `bg-white/15`, white icon.
- Covers the entire viewport; replaces a conventional tab bar.

**`page-header`** — Gloock page title
- Background `{colors.canvas}`, text `{colors.ink}`,
  `{typography.display-title}`. Sits at the top of every tab screen; the
  menu trigger (icon-circular) sits opposite.

### Camera screens (scan, avatar capture)

The camera screens share the app chrome — `{colors.canvas}` background —
with photography-specific overlays:
- Viewfinder / photo wells: `bg-white/10`, `{rounded.card}`.
- Primary action per camera screen: ONE light pill — `{colors.ink}` fill
  with `{colors.canvas}` text (the filter-chip-active inversion at button
  size). The rose CTA never appears on camera screens.
- Secondary actions: `bg-white/15` + white text, pill radius.
- Helper text: `text-white/70`–`/80`. Countdown scrim: `bg-black/50`.
- The shutter ring keeps its `{colors.hairline}` border on an
  `{colors.ink}` fill.

## Do's and Don'ts

### Do
- Reserve `{colors.primary}` (rose) for exactly one primary CTA per screen,
  always with `{colors.on-primary}` dark text.
- Use Great Vibes ONLY for the "Kloset" wordmark; Gloock ONLY for page
  titles, section headings/empty states, and menu links; Inter for
  everything else.
- Keep cards and surfaces flat: separation is the canvas→card surface step,
  never a shadow.
- Use only the three radii: 16px, 32px, pill.
- Use `{colors.ink}`-fill + `{colors.canvas}`-text as the universal
  selected/active inversion (chips, camera action pills).
- On stacked form screens (Settings), apply the one-rose-CTA rule per
  section card, not per screen.

### Don't
- Don't put white text on rose fills — rose is light; `{colors.on-primary}`
  is the pair. (White is correct on `{colors.menu}` deep rose only.)
- Don't use script anywhere but the wordmark — not titles, not the menu,
  not headings. That was the old system.
- Don't add drop shadows. No shadow token exists.
- Don't introduce neutral grays: every neutral in this system carries the
  wine cast. A `#222`-style gray reads as dirt against this canvas.
- Don't use `{colors.menu}` outside the menu overlay and app icon.
- Don't hand-roll hex values in components — if a color isn't backed by a
  token in `app/globals.css`, it doesn't ship (white/black alphas over
  photography excepted).

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| phone | 375–430px | Default target — single-column, 2-column garment grid, full-screen menu |
| tablet | 768px | Garment grid 3 columns; outer gutters grow |
| desktop | 1024px+ | Garment grid 4 columns; content clamps to a centered column |

### Touch Targets
All interactive elements meet WCAG AA (≥ 44×44px effective). Buttons and
inputs sit at 44px; chips extend to 44px via parent padding; the 40px
icon-circular button pads to 48×48.

### Collapsing Strategy
- **Full-screen menu:** identical full-viewport takeover at every breakpoint.
- **Garment masonry grid:** 2-up → 3-up → 4-up; gutters hold at 8px.
- **Page header:** `{typography.display-title}` holds its size; only
  gutters grow.

### Image Behavior
- Garment cutouts preserve natural aspect ratio at every breakpoint.
- Cutouts are transparent-background PNGs composited onto
  `{colors.surface-card}` — no crop, no letterboxing.

## Accessibility

Verified contrast (WCAG AA) on the shipped pairs: body on canvas 11.7:1,
body on card 10.4:1, mute on canvas 6.3:1, on-primary on rose 7.6:1, white
on menu 4.8:1, menu-active on menu 3.7:1 (48px display text — large-text
threshold applies), error on canvas 8.4:1, ink-fill chips 15:1. When adding
a new pair, hold body text to ≥ 4.5:1 and large display text to ≥ 3:1.

## Iteration Guide

1. Focus on ONE component at a time. Pull its YAML entry and verify every
   property resolves against this file's front matter.
2. Reference tokens directly (`{colors.primary}`, `{component.pin-card}`)
   in code and PRs — do not paraphrase hex values inline.
3. Before adding a new UI role, check whether an existing component already
   covers it. This system is deliberately small.
4. Keep rose scarce — at most one rose CTA per screen (per section card on
   Settings).
5. Keep the type voices separate — script = wordmark, Gloock = titles+menu,
   Inter = everything else. If a new role feels like it wants display type,
   default it to Inter `{typography.heading-md}` and revisit.
6. When touching Tailwind classes, use the utilities this file backs
   (`bg-canvas`, `bg-card`, `bg-pink`, `bg-pink-deep`, `text-on-pink`,
   `bg-menu`, `text-menu-active`, `text-ink`, `text-body`, `text-mute`,
   `text-ash`, `border-hairline`, `text-error`, `text-success`,
   `bg-secondary`, `font-script`, `font-display`, `font-sans`,
   `rounded-card`, `rounded-big`) — never hand-roll a hex color or
   arbitrary radius in a component. (The Tailwind token names `pink` /
   `pink-deep` / `on-pink` map to this file's `primary` roles.)
