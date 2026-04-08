# Adinkra Design System
## AbrempongHMS — Default UI/UX Framework
### Version 1.0

> **Named after Adinkra** — the visual symbols of the Akan people of Ghana, where each symbol
> carries a specific meaning, concept, or proverb. Like those symbols, every token and component
> in this system carries precise, intentional meaning. The system speaks clearly so the product
> does not have to shout.

---

## TABLE OF CONTENTS

1.  [Design Philosophy & Principles](#1-design-philosophy--principles)
2.  [Brand Identity — AbrempongHMS Default](#2-brand-identity--abrempong-hms-default)
3.  [Color System — Token Architecture](#3-color-system--token-architecture)
4.  [Typography System](#4-typography-system)
5.  [Spacing System](#5-spacing-system)
6.  [Shape System (Border Radius)](#6-shape-system)
7.  [Elevation System (Shadows)](#7-elevation-system)
8.  [Iconography](#8-iconography)
9.  [Component Library](#9-component-library)
10. [Layout System](#10-layout-system)
11. [Motion & Animation](#11-motion--animation)
12. [Dark Mode](#12-dark-mode)
13. [Role-Specific UI Patterns](#13-role-specific-ui-patterns)
14. [Tenant Theme Override System](#14-tenant-theme-override-system)
15. [Implementation Guide](#15-implementation-guide)

---

## 1. DESIGN PHILOSOPHY & PRINCIPLES

### 1.1 The Five Laws

```
LAW 1 — CLARITY OVER CLEVERNESS
  Every interface element must communicate its purpose instantly.
  A receptionist handling a queue cannot afford to think.
  An owner checking revenue at midnight cannot afford to squint.
  If a user needs to figure out what something does, we failed.

LAW 2 — TRUST IS EARNED VISUALLY
  Ghanaian business owners are cautious adopters of technology.
  The product must look serious, stable, and professional from
  the first second. No playful gradients, no cartoon illustrations
  in the management interface, no interface that looks like a game.
  Trust is built through consistency, precision, and calm.

LAW 3 — SPEED IS A DESIGN FEATURE
  3G connectivity. Mid-range Android. Every pixel costs bandwidth.
  Beautiful and fast are not opposites — they require the same
  discipline: restraint. No decorative animations. No heavy images
  in the app shell. Every interaction under 100ms perceived.

LAW 4 — DESIGN FOR THE LEAST TECHNICAL USER
  The housekeeping staff member may never have used a management app.
  The gate security officer may be 60 years old.
  The student portal must feel like Instagram, not SAP.
  Role-appropriate simplicity is not dumbing down — it is respect.

LAW 5 — GHANAIAN WARMTH IN A PROFESSIONAL SHELL
  The product serves a Ghanaian market. The palette, the language,
  the iconography — all carry subtle warmth and cultural familiarity.
  Not Kente patterns on every card. But a product that feels like it
  was made for here, by people who understand here.
```

### 1.2 Visual Personality

```
AbrempongHMS feels:
  ✓ Authoritative — clear hierarchy, confident typography
  ✓ Warm — not cold blue-gray enterprise, but human and approachable
  ✓ Precise — every element is where it should be, nothing is random
  ✓ Modern — but timeless, not trend-chasing
  ✓ Ghanaian — unmistakably rooted in the context it serves

AbrempongHMS does NOT feel:
  ✗ Playful or childish (not a consumer social app)
  ✗ Cold or clinical (not a hospital ERP)
  ✗ Generic (not another SaaS template clone)
  ✗ Overwhelming (not a Bloomberg terminal)
  ✗ Western corporate (not PwC or Deloitte)
```

---

## 2. BRAND IDENTITY — ABREMPONG HMS DEFAULT

### 2.1 Brand Palette

The default AbrempongHMS palette before any tenant customisation.
Named after places and cultural references that carry meaning in Ghana.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PRIMARY — "Volta Blue"
 Named after Ghana's Volta River and Lake Volta — the largest
 man-made lake in the world, a source of power and calm.
 Conveys trust, stability, depth, and quiet authority.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Base:    #1B5276   HSL: 207° 58% 28%
 Hover:   #154460   HSL: 207° 58% 23%
 Light:   #EBF4FC   HSL: 207° 58% 96%
 Dark:    #0D2B3E   HSL: 207° 58% 15%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ACCENT — "Kente Gold"
 Named after the royal Kente cloth of the Ashanti and Ewe people.
 Gold threads run through every Kente weave — prestige, wisdom,
 royalty. Ghana was known as the Gold Coast for a reason.
 Conveys warmth, prestige, call-to-action energy.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Base:    #C9880A   HSL: 38° 93% 41%
 Hover:   #A87008   HSL: 38° 93% 34%
 Light:   #FEF6E7   HSL: 38° 93% 95%
 Dark:    #7A5006   HSL: 38° 93% 25%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUCCESS — "Kakum Green"
 Named after Kakum National Park — tropical, lush, life-affirming.
 Used for: room available, payment received, task complete, online.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Base:    #1A7A4C   HSL: 150° 64% 29%
 Light:   #E8F7EF   HSL: 150° 64% 94%
 Text:    #0F4D30   HSL: 150° 64% 18%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DANGER — "Harmattan Red"
 Named after the Harmattan wind — the dry, dusty wind from the
 Sahara that disrupts normal life across Ghana. A warning signal.
 Used for: overdue, error, occupied, blocked, delete actions.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Base:    #C0392B   HSL: 5° 62% 46%
 Light:   #FDEDEC   HSL: 5° 62% 96%
 Text:    #7B2318   HSL: 5° 62% 29%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WARNING — "Savanna Amber"
 Named after Ghana's northern savannas — warm, dry, alert.
 Used for: pending, unread, cleaning, unverified, caution.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Base:    #D97706   HSL: 33° 95% 44%
 Light:   #FFF8E7   HSL: 33° 95% 96%
 Text:    #7C4A04   HSL: 33° 95% 25%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 INFO — "Densu Blue"
 Named after the Densu River — lighter, calmer than Volta Blue.
 Used for: informational alerts, tooltips, help text.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Base:    #2980B9   HSL: 204° 64% 44%
 Light:   #EBF5FB   HSL: 204° 64% 95%
 Text:    #1A5276   HSL: 204° 64% 28%
```

### 2.2 Neutral Palette — "Harmattan Grays"

Warm-toned, not cold blue-gray. The warmth echoes the Ghanaian climate.

```
 neutral-50:   #FAFAF8   ← Page backgrounds (warm white, not pure white)
 neutral-100:  #F4F4F0   ← Sidebar items hover, zebra table rows
 neutral-200:  #E8E8E2   ← Input borders (default), dividers
 neutral-300:  #D4D4CC   ← Disabled borders, muted separators
 neutral-400:  #A8A89E   ← Placeholder text, disabled icons
 neutral-500:  #7A7A72   ← Caption text, helper text
 neutral-600:  #5A5A54   ← Secondary body text
 neutral-700:  #3C3C38   ← Primary body text (body copy)
 neutral-800:  #282824   ← Headings
 neutral-900:  #1A1A18   ← Strong headings, important data
 neutral-950:  #0F0F0E   ← App shell sidebar background

 USAGE RULE: For text on white backgrounds, never go lighter
 than neutral-500 (contrast ratio < 4.5:1 fails WCAG AA).
```

---

## 3. COLOR SYSTEM — TOKEN ARCHITECTURE

The color system has three layers. Components reference only Layer 2.
Layer 1 never appears in component code. Layer 3 is optional.
This separation is what makes tenant theming work without touching any component.

```
LAYER 1: PRIMITIVE TOKENS
  Raw color values. Named by hue-shade. Never used in components.
  Examples:
    --primitive-volta-700: #1B5276
    --primitive-gold-500:  #C9880A
    --primitive-neutral-800: #282824

LAYER 2: SEMANTIC TOKENS
  Mapped from primitives. Express purpose, not color.
  These are what components use. These are what tenants can override.
  Examples:
    --color-brand:          var(--primitive-volta-700)
    --color-brand-hover:    var(--primitive-volta-800)
    --color-brand-fg:       #FFFFFF
    --color-accent:         var(--primitive-gold-500)
    --color-success:        var(--primitive-green-700)
    --color-surface:        var(--primitive-neutral-50)
    --color-text-primary:   var(--primitive-neutral-800)

LAYER 3: COMPONENT TOKENS (optional overrides)
  Allow per-component customisation without changing semantics.
  Examples:
    --btn-primary-bg:       var(--color-brand)
    --sidebar-bg:           var(--primitive-neutral-950)
    --card-border:          var(--primitive-neutral-200)
```

### 3.1 Full Semantic Token Map

```css
:root {
  /* ── BRAND ── */
  --color-brand:            207 58% 28%;   /* HSL components for Volta Blue */
  --color-brand-hover:      207 58% 23%;
  --color-brand-active:     207 58% 18%;
  --color-brand-subtle:     207 58% 96%;
  --color-brand-fg:         0 0% 100%;     /* text on brand bg = white */

  /* ── ACCENT ── */
  --color-accent:           38 93% 41%;    /* Kente Gold */
  --color-accent-hover:     38 93% 34%;
  --color-accent-subtle:    38 93% 95%;
  --color-accent-fg:        0 0% 100%;

  /* ── SEMANTIC STATUS ── */
  --color-success:          150 64% 29%;
  --color-success-subtle:   150 64% 94%;
  --color-success-fg:       0 0% 100%;

  --color-danger:           5 62% 46%;
  --color-danger-hover:     5 62% 40%;
  --color-danger-subtle:    5 62% 96%;
  --color-danger-fg:        0 0% 100%;

  --color-warning:          33 95% 44%;
  --color-warning-subtle:   33 95% 96%;
  --color-warning-fg:       33 95% 15%;    /* dark text on warning bg */

  --color-info:             204 64% 44%;
  --color-info-subtle:      204 64% 95%;
  --color-info-fg:          0 0% 100%;

  /* ── SURFACES ── */
  --color-bg:               50 10% 98%;   /* #FAFAF8 page bg */
  --color-surface:          0 0% 100%;    /* #FFFFFF cards */
  --color-surface-raised:   50 10% 97%;   /* slightly elevated surfaces */
  --color-surface-sunken:   50 6% 95%;    /* inputs, code blocks */

  /* ── BORDERS ── */
  --color-border:           60 5% 88%;    /* #E8E8E2 default border */
  --color-border-muted:     60 5% 93%;    /* subtle border */
  --color-border-strong:    60 5% 78%;    /* strong/focused border */

  /* ── TEXT ── */
  --color-text-primary:     30 5% 16%;    /* #282824 main text */
  --color-text-secondary:   30 3% 35%;    /* #5A5A54 secondary text */
  --color-text-tertiary:    30 3% 48%;    /* #7A7A72 captions, helpers */
  --color-text-disabled:    30 3% 65%;    /* disabled labels */
  --color-text-inverse:     0 0% 100%;    /* text on dark backgrounds */
  --color-text-on-brand:    0 0% 100%;    /* text directly on brand color */

  /* ── FIXED SURFACES (never change with tenant theme) ── */
  --color-sidebar-bg:       0 0% 6%;      /* #0F0F0E — always dark */
  --color-sidebar-text:     0 0% 80%;
  --color-sidebar-text-active: 0 0% 100%;
  --color-sidebar-item-active: 207 58% 28%;  /* brand color in sidebar */
  --color-sidebar-item-hover:  0 0% 12%;
}
```

### 3.2 Room & Booking Status Colors

These are a critical UI pattern used across the application.

```
STATUS             COLOR          BG TOKEN              TEXT TOKEN
─────────────────────────────────────────────────────────────────
Available          Kakum Green    --color-success-subtle  --success-text
Reserved           Densu Blue     --color-info-subtle     --info-text
Occupied           Volta Blue     --color-brand-subtle    --brand-text
Checkout Pending   Savanna Amber  --color-warning-subtle  --warning-text
Cleaning           Purple         #F3F0FF                 #5B21B6
Under Maintenance  Harmattan Red  --color-danger-subtle   --danger-text
Inspecting         Kente Gold     --color-accent-subtle   --accent-text
```

```
INVOICE STATUS     COLOR
──────────────────────────────────
Draft              neutral-400
Unpaid             Savanna Amber
Partially Paid     Densu Blue
Paid               Kakum Green
Overdue            Harmattan Red
Voided             neutral-400 (strikethrough)
```

---

## 4. TYPOGRAPHY SYSTEM

### 4.1 Font Stack

```
DISPLAY / HEADINGS: "Plus Jakarta Sans"
  → Google Font (free, self-hostable)
  → Warm, modern, slight personality — not sterile
  → Excellent at large sizes for hero headings
  → Supports Latin Extended (covers Twi diacritics)
  → Weights used: 500 (Medium), 600 (SemiBold), 700 (Bold), 800 (ExtraBold)
  → Loading: only weights 500–800, only latin + latin-ext subsets

UI / BODY: "Inter"
  → The gold standard for UI text
  → Optimised for screen legibility at 12–18px
  → Exceptional number rendering (crucial for financial data)
  → Features: tabular-nums for aligned amounts, slashed-zero
  → Weights used: 400 (Regular), 500 (Medium), 600 (SemiBold)

MONOSPACE: "JetBrains Mono"
  → Booking references (BK-2025-04821)
  → Invoice numbers (HMS-2024-00001)
  → Phone numbers, Ghana Card numbers
  → Code snippets (API keys, embed snippets)
  → Weights used: 400, 500

SYSTEM FALLBACK STACK:
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui,
               -apple-system, BlinkMacSystemFont,
               'Segoe UI', sans-serif;
```

### 4.2 Type Scale

```
TOKEN          SIZE    LINE HEIGHT   LETTER SPACING   WEIGHT    USAGE
──────────────────────────────────────────────────────────────────────
text-xs        12px    16px  (1.33)  +0.02em          400/500   Captions, legal, meta
text-sm        14px    20px  (1.43)  +0.01em          400/500   Helper text, table data
text-base      16px    24px  (1.50)  0                400/500   Body copy (default)
text-lg        18px    28px  (1.56)  -0.01em          400/500   Intro paragraphs
text-xl        20px    28px  (1.40)  -0.01em          500/600   Card headings
text-2xl       24px    32px  (1.33)  -0.02em          600       Section headings
text-3xl       30px    36px  (1.20)  -0.03em          600/700   Page headings
text-4xl       36px    40px  (1.11)  -0.04em          700       Display (dashboard KPIs)
text-5xl       48px    52px  (1.08)  -0.05em          700/800   Hero (website templates)
text-6xl       60px    64px  (1.07)  -0.06em          800       Max display (landing hero)

RULE: Display font (Plus Jakarta Sans) is used for text-2xl and above.
      Inter is used for text-xl and below.
```

### 4.3 Semantic Text Styles

Named styles that map to the scale and carry purpose.

```
STYLE NAME          SIZE   WEIGHT   USE CASE
──────────────────────────────────────────────────────────
.display-xl         60px   800      Website hero headline
.display-lg         48px   700      Website section headline
.display-md         36px   700      Dashboard KPI figures
.heading-page       30px   600      Page title (e.g., "Occupants")
.heading-section    24px   600      Section header
.heading-card       20px   600      Card title
.heading-table      14px   600      Table column header
.body-lg            18px   400      Long-form intro text
.body-base          16px   400      General body copy
.body-sm            14px   400      Secondary text, table cells
.label-lg           16px   500      Form labels
.label-sm           14px   500      Input helper labels
.caption            12px   400      Metadata, timestamps
.mono               14px   400      References, IDs, codes
.mono-lg            16px   500      Invoice amounts, balances
```

### 4.4 Financial Typography Rules

Financial data needs special treatment for precision and legibility.

```css
/* All monetary amounts: tabular numerals, consistent width */
.amount {
  font-family: 'Inter', monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

/* Currency symbol slightly smaller and superscripted */
.currency-symbol {
  font-size: 0.75em;
  vertical-align: super;
  font-weight: 500;
  margin-right: 0.1em;
}

/* Negative amounts = Harmattan Red */
.amount-negative { color: hsl(var(--color-danger)); }

/* Overdue = bold Harmattan Red */
.amount-overdue  { color: hsl(var(--color-danger)); font-weight: 600; }

/* All reference numbers: monospaced, letter-spaced */
.ref-number {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875em;
  letter-spacing: 0.03em;
}
```

---

## 5. SPACING SYSTEM

### 5.1 Scale

Base unit: **4px**. All spacing is a multiple of 4.

```
TOKEN    VALUE    PX       USAGE
──────────────────────────────────────────────────────────────
space-0   0        0px     Zero
space-0.5 0.125rem 2px     Micro (icon-to-label gap)
space-1   0.25rem  4px     Tight (badge padding, small gaps)
space-2   0.5rem   8px     Input padding (horizontal), icon margin
space-3   0.75rem  12px    Button padding (vertical), form row gap
space-4   1rem     16px    Default padding, base component gap
space-5   1.25rem  20px    Card inner padding (tight)
space-6   1.5rem   24px    Card inner padding (default)
space-7   1.75rem  28px    —
space-8   2rem     32px    Section gap (tight)
space-10  2.5rem   40px    —
space-12  3rem     48px    Section gap (default)
space-14  3.5rem   56px    —
space-16  4rem     64px    Section gap (large)
space-20  5rem     80px    Between major page sections
space-24  6rem     96px    Page top padding
space-32  8rem     128px   Hero section padding
```

### 5.2 Component Spacing Defaults

```
INPUT HEIGHT:           40px (md), 36px (sm), 48px (lg)
BUTTON HEIGHT:          40px (md), 32px (sm), 48px (lg), 56px (xl — housekeeping)
SIDEBAR ITEM HEIGHT:    40px
TABLE ROW HEIGHT:       48px (data), 56px (comfortable), 40px (compact)
CARD PADDING:           24px (default), 16px (compact), 32px (spacious)
MODAL PADDING:          32px
PAGE HORIZONTAL PAD:    24px (mobile), 32px (tablet), 48px (desktop)
SECTION GAP:            48px between major sections
FORM FIELD GAP:         20px between form fields
SIDEBAR WIDTH:          280px (expanded), 72px (collapsed)
```

---

## 6. SHAPE SYSTEM

### 6.1 Border Radius Scale

```
TOKEN          VALUE    USAGE
──────────────────────────────────────────────────────────────
radius-none    0px      Sharp (data tables, full-bleed images)
radius-xs      2px      Very subtle rounding (progress bars)
radius-sm      4px      Chips, tags, small badges, code spans
radius-md      6px      Buttons (default size), input fields
radius-lg      8px      Cards, dropdowns, modals, tooltips
radius-xl      12px     Large cards, panels, popovers
radius-2xl     16px     Bottom sheets, large modals
radius-3xl     24px     Hero cards (website templates)
radius-full    9999px   Avatars, pill badges, toggle switches

RULE: Never mix more than 2 radius sizes on a single view.
The sidebar/app shell uses radius-none for nav items — they
should feel structural, not card-like.
```

---

## 7. ELEVATION SYSTEM

Shadows use warm shadow colors (not cold gray) to complement the warm neutral palette.
Each level has a dual shadow: a tight, sharp one for depth + a diffuse one for ambient glow.

```css
:root {
  /* Level 0 — Flat, no elevation (data tables, inline elements) */
  --shadow-none: none;

  /* Level 1 — Subtly lifted (cards at rest, input fields on focus) */
  --shadow-xs: 0 1px 2px rgba(15, 20, 30, 0.06);

  /* Level 2 — Lifted (cards default, dropdowns) */
  --shadow-sm:
    0 1px 3px rgba(15, 20, 30, 0.08),
    0 1px 2px rgba(15, 20, 30, 0.06);

  /* Level 3 — Floating (modals, popovers, sticky headers on scroll) */
  --shadow-md:
    0 4px 8px rgba(15, 20, 30, 0.08),
    0 2px 4px rgba(15, 20, 30, 0.05);

  /* Level 4 — High (drawers, command palette, overlay panels) */
  --shadow-lg:
    0 10px 20px rgba(15, 20, 30, 0.10),
    0 4px 8px  rgba(15, 20, 30, 0.06);

  /* Level 5 — Maximum (full-screen modals, dialogs) */
  --shadow-xl:
    0 20px 40px rgba(15, 20, 30, 0.12),
    0 8px  16px rgba(15, 20, 30, 0.06);

  /* Focus ring — brand-colored, used on all interactive elements */
  --shadow-focus:
    0 0 0 3px hsl(var(--color-brand) / 0.25);

  /* Danger focus ring — for destructive action inputs */
  --shadow-focus-danger:
    0 0 0 3px hsl(var(--color-danger) / 0.25);
}
```

### 7.1 Elevation Usage Rules

```
LEVEL   SHADOW      USE CASES
──────────────────────────────────────────────────────────────
0       none        Flat tables, inline content, sidebar nav items
1       xs          KPI stat cards (owner dashboard), subtle panels
2       sm          Standard cards, form panels, dropdown menus
3       md          Modals, sticky top bar on scroll, date pickers
4       lg          Drawers, right panels, command palette
5       xl          Full overlay dialogs, critical action modals

RULE: Elevation increases as content becomes more "on top of"
the page. Never skip levels (a modal must be higher than a card).
```

---

## 8. ICONOGRAPHY

### 8.1 Icon Library: Lucide Icons

```
PRIMARY:  Lucide (lucide.dev)
  → 1,000+ icons, consistent 24x24 grid
  → Stroke-based (not filled) — cleaner at small sizes
  → Tree-shakeable — import only what you use
  → Matches the Inter personality: clean, precise, neutral
  → Stroke width: 1.75px (default) — feels refined, not heavy

CUSTOM ICONS (SVG, added to packages/ui/icons/):
  → GhanaCard icon (national ID card shape)
  → MoMo icon (mobile money symbol)
  → MTN MoMo variant
  → Vodafone Cash variant
  → AirtelTigo Money variant
  → Kente pattern avatar placeholder
  → GhanaPost GPS pin variant
  → SSNIT logo mark
  → GRA logo mark
```

### 8.2 Icon Sizes

```
SIZE    PX    USAGE
────────────────────────────────────────────────────────
xs      12px  Inline text icons, table cell indicators
sm      16px  Button icons (small), tab icons, badges
md      20px  Button icons (default), input prefix/suffix
lg      24px  Navigation icons, card action icons
xl      32px  Empty state icons, feature icons
2xl     48px  Illustration icons (onboarding, empty states)
3xl     64px  Large empty state, 404 pages
```

### 8.3 Icon Usage Rules

```
1. Never use icons alone for critical actions — always pair
   with a text label (or tooltip at minimum).

2. Navigation icons: always 24px, always with a label.

3. In tables: 16px, always neutral-500 color (never brand).

4. Loading state: use an icon spinner (Lucide 'Loader2') 
   with a 1s linear spin animation.

5. Status icons in status badges: always 12px to keep
   the badge compact.

6. Icon buttons (no text): must always have aria-label 
   and a visible tooltip on hover.
```

---

## 9. COMPONENT LIBRARY

### 9.1 Button

The most-used component. Every variant must look intentional and match its context.

```
VARIANTS:
  primary       Brand bg, white text — the ONE main action per page
  secondary     White bg, brand border + text — secondary actions
  outline       Transparent bg, neutral border — tertiary actions
  ghost         Transparent, no border — inline actions, table rows
  destructive   Danger bg, white text — delete, void, remove
  accent        Kente Gold bg — high-visibility CTAs (booking page)
  link          Text only, brand color, underline on hover

SIZES:
  xs    height: 28px    padding: 8px 10px    text: 12px/500
  sm    height: 32px    padding: 10px 14px   text: 13px/500
  md    height: 40px    padding: 10px 18px   text: 14px/500  ← DEFAULT
  lg    height: 48px    padding: 12px 24px   text: 15px/500
  xl    height: 56px    padding: 14px 28px   text: 16px/500  ← Housekeeping staff

STATES:
  default       Base styles
  hover         bg darkens by 8% lightness (auto-computed)
  active        bg darkens by 12% + scale(0.98) — tactile press feel
  focus         + focus ring shadow
  loading       Replace content with spinner; pointer-events: none
  disabled      opacity: 0.45; cursor: not-allowed; no hover effect

ICON BUTTONS:
  Always square. Width = height.
  Ghost variant by default.
  Tooltip required when no visible label.

BUTTON GROUP:
  Buttons share a border; middle items have no outer border-radius.
  Used for: room status filter, date range quick selects.
```

```tsx
/* Tailwind class composition examples */

// Primary default
"inline-flex items-center justify-center gap-2 rounded-md
 bg-brand text-brand-foreground h-10 px-[18px] text-[14px]
 font-medium transition-colors duration-150
 hover:bg-brand-hover active:scale-[0.98]
 focus-visible:outline-none focus-visible:ring-2
 focus-visible:ring-brand/40 focus-visible:ring-offset-2
 disabled:opacity-45 disabled:pointer-events-none"

// Destructive default
"... bg-danger text-white hover:bg-danger-hover ..."

// Accent (booking CTA)
"... bg-accent text-white hover:bg-accent-hover ..."
```

---

### 9.2 Form Controls

#### Text Input
```
DEFAULT STATE:
  Height:        40px
  Border:        1px solid neutral-200 (--color-border)
  Border-radius: radius-md (6px)
  Background:    neutral-50 (surface-sunken)
  Padding:       10px 14px
  Font:          text-sm / Inter / 400

STATES:
  focus:    border-color: brand, + focus shadow ring
  error:    border-color: danger, + focus shadow ring (danger)
            Error message below: text-danger, text-sm, mt-1.5
  disabled: bg neutral-100, opacity 0.6, cursor not-allowed
  readonly: bg neutral-50, no focus ring, visual indicator

WITH PREFIX/SUFFIX:
  Prefix: GHS 0.00 → "GHS" prefix in neutral-500, text-sm
  Phone:  +233 prefix (flag icon + code)
  Search: magnifying glass icon (16px, neutral-400)

HELPER TEXT: text-sm, neutral-500, mt-1.5
LABEL:       text-sm / 500 / neutral-700, mb-1.5
REQUIRED:    red asterisk (*) after label
ERROR MSG:   text-sm / Harmattan Red, mt-1.5, with warning icon
```

#### Select
```
Same height/border as text input.
Custom chevron icon (16px, neutral-500).
Option list: radius-lg shadow-md, 4px padding per option.
Selected item: brand-subtle bg, brand text.
Searchable variant: input + filtered list (Combobox pattern).
```

#### Checkbox & Radio
```
Size:      18px × 18px
Checked:   brand bg, white checkmark/dot
Border:    1.5px solid neutral-300 (unchecked)
Focus:     + focus ring
Disabled:  opacity 0.5

Label:     text-sm / 400, ml-2, cursor pointer
Alignment: Always vertically centered with label
```

#### Toggle / Switch
```
Track:       44px × 24px, radius-full
Thumb:       20px × 20px, white, shadow-sm, radius-full
Off state:   neutral-200 track
On state:    brand track, thumb slides right
Transition:  200ms ease-in-out

Size variants: sm (36×20), md (44×24), lg (52×28)
```

---

### 9.3 Card

```
VARIANTS:

  default     bg-white, shadow-sm, radius-lg, border: none
              → Most card usage

  outlined    bg-white, no shadow, border: 1px solid neutral-200
              → When many cards are stacked (less visual weight)

  elevated    bg-white, shadow-md, radius-lg
              → Feature callouts, important panels

  flat        bg-neutral-50, no shadow, no border
              → Subtle grouping, sidebar panels

  stat        Specific to KPI cards on the owner dashboard
              See 13.1 Owner Dashboard Patterns

CARD ANATOMY:
  Card Header    24px padding, border-bottom (optional)
  Card Body      24px padding
  Card Footer    16px 24px padding, border-top (optional), bg-neutral-50

CARD INTERACTION:
  Clickable cards get: cursor-pointer, hover: shadow-md, 
  transition 150ms. Active: scale(0.995).
  
  Room cards on housekeeping view: 
    larger (full-width), taller thumbnail, swipe-to-complete gesture.
```

---

### 9.4 Navigation — App Shell

```
SIDEBAR (Management App)
  Width (expanded):  280px
  Width (collapsed): 72px — icon only
  Background:        ALWAYS neutral-950 (#0F0F0E) — NEVER changes with tenant theme
  Transition:        width 200ms ease-in-out (smooth collapse)

  STRUCTURE:
    ┌─────────────────────────────────┐
    │  [Tenant Logo] Hostel Name      │  ← 72px tall logo section
    │  Current User Name              │
    ├─────────────────────────────────┤
    │  OPERATIONS                     │  ← Section label (10px, UPPERCASE, neutral-500)
    │  ◉ Dashboard                   │  ← Active: brand bg, white text, radius-sm
    │  ○ Occupants                   │  ← Inactive: neutral-500 text, icon + label
    │  ○ Rooms                       │
    │  ○ Bookings                    │
    ├─────────────────────────────────┤
    │  FINANCE                        │
    │  ○ Invoices                    │
    │  ○ Payments                    │
    │  ○ Accounting                  │
    ├─────────────────────────────────┤
    │  OPERATIONS                     │
    │  ○ Housekeeping                │
    │  ○ Maintenance                 │
    │  ○ Security                    │
    ├─────────────────────────────────┤
    │  PEOPLE                         │
    │  ○ Staff / HR                  │
    │  ○ Payroll                     │
    └─────────────────────────────────┘
    │  [Avatar] Kwame Asante  [...]   │  ← Bottom: user menu
    └─────────────────────────────────┘

  NAV ITEM STATES:
    Default:   icon neutral-400, text neutral-300, height 40px
    Hover:     bg neutral-800, text neutral-100
    Active:    bg brand (hsl(var(--color-brand)/0.15)), 
               icon + text brand-light, left border 3px brand

  COLLAPSED MODE:
    Shows icon only. Active item: brand-colored icon.
    Tooltip on hover: item label (left side, shadow-lg).
    Logo section: shows favicon/icon only.

TOP BAR (Header)
  Height:        64px
  Background:    white (light) / neutral-900 (dark)
  Border-bottom: 1px solid neutral-100
  Contains:
    Left:   Page title (heading-page) + breadcrumbs
    Right:  Search (cmd+K), notifications bell, user avatar

BREADCRUMBS
  text-sm, neutral-500
  Current page: neutral-800, font-medium
  Separator: / (16px, neutral-300)
  Max depth: 3 levels

MOBILE BOTTOM NAVIGATION (Housekeeping / Student)
  Height:          64px + safe-area-inset-bottom
  Background:      white (light) / neutral-900 (dark)
  Border-top:      1px solid neutral-100
  Items:           4 max (icon + label, 12px/500)
  Active:          brand icon + text
  Inactive:        neutral-400 icon + text
```

---

### 9.5 Data Table

Used everywhere in the management app. Performance and clarity are paramount.

```
TABLE ANATOMY:
  Header row:       bg neutral-50, border-bottom 2px brand
                    text: heading-table (14px/600/neutral-700)
                    sortable columns: chevron icon (12px)

  Data rows:        48px height (default), 40px (compact), 56px (comfortable)
                    border-bottom: 1px neutral-100
                    Hover: bg neutral-50
                    Selected: bg brand-subtle

  Cells:            padding: 12px 16px
                    text: text-sm / neutral-700
                    First column (name/identifier): font-medium, neutral-800
                    Amounts: mono-lg, text-right, tabular-nums
                    Dates: text-sm, neutral-600

STATUS BADGE IN TABLE:
  Height: 22px, radius-full, padding: 2px 10px
  Font: 12px / 500
  Icon: 8px colored dot + text

ACTIONS COLUMN:
  Appears on row hover (ghost icon buttons, 32px)
  Common: View (eye), Edit (pencil), More (...) 

BULK ACTIONS TOOLBAR:
  Appears above table when rows selected
  bg neutral-900, text white, radius-lg, shadow-lg
  Content: "X rows selected" + action buttons (ghost/white)

EMPTY STATE (inline):
  Centered in table body, minimum 200px height
  Illustration (2xl icon), heading-card, body-sm, optional CTA

PAGINATION:
  Previous/Next buttons (outline variant, sm)
  Page numbers: neutral-600, active: brand
  Items per page select (sm)
  "Showing X-Y of Z records" text

SKELETON LOADING:
  Pulse animation (bg neutral-100 → neutral-200)
  Each row: 3-4 skeleton bars of varying widths
  Duration: 1.5s per pulse cycle
```

---

### 9.6 Modal & Dialog

```
STANDARD MODAL:
  Backdrop:     rgba(0,0,0,0.5), blur(2px)
  Panel:        bg white, radius-xl, shadow-xl
  Max-width:    480px (sm), 600px (md), 800px (lg), 1000px (xl)
  Padding:      32px
  Enter:        opacity 0→1 + scale 0.95→1, 200ms ease-out
  Exit:         opacity 1→0 + scale 1→0.95, 150ms ease-in

  HEADER:       heading-section + optional subtitle + close (X) button
  BODY:         content area, max-height 60vh, overflow-y auto
  FOOTER:       32px pt, border-top, flex justify-end, gap-3
                Always: primary action + cancel button

DRAWER (Detail Panel):
  Enters from RIGHT side of screen
  Width: 480px (sm), 600px (md), 100vw on mobile
  Height: full viewport height
  Backdrop: same as modal
  Animation: translateX(100%) → translateX(0), 300ms ease-out
  Use for: occupant detail, booking detail, room detail

BOTTOM SHEET (Mobile):
  Enters from bottom, handles drag-to-dismiss
  Border-radius: radius-2xl top corners only
  Max-height: 90vh
  Drag handle: 36px × 4px neutral-300 centered at top
  Use for: filters, sort options, quick actions on mobile

ALERT DIALOG (Confirmations):
  Same as modal sm, but NOT dismissable by clicking backdrop
  Destructive action dialogs: icon in Harmattan Red circle
  Action button: destructive variant
  Body text explains the consequence clearly
```

---

### 9.7 Toast / Notification

```
POSITION:  Top-center (desktop), bottom-center (mobile)
WIDTH:     360px (desktop), calc(100vw - 32px) (mobile)
RADIUS:    radius-lg
SHADOW:    shadow-lg

VARIANTS:
  success   Kakum Green left border (4px) + check icon
  error     Harmattan Red left border + alert icon
  warning   Savanna Amber left border + warning icon
  info      Densu Blue left border + info icon
  loading   Spinner + neutral left border

ANATOMY:
  [Icon] [Title (text-sm/600)] [Description (text-sm/400)] [Close X]
  Auto-dismiss: 4s (success/info), 6s (warning), manual (error)
  Progress bar: thin line at bottom showing time remaining

STACKING:
  Max 3 visible at once. Newest at top. Older shrink slightly.
  Exit animation: slide up + fade out, 200ms.
```

---

### 9.8 Badge & Status Indicator

```
BADGE (text + optional icon):
  Height:      22px (sm), 26px (md)
  Padding:     2px 10px (sm), 4px 12px (md)
  Radius:      radius-full
  Font:        12px / 600 (sm), 13px / 600 (md)
  Variants:    All semantic colors (success, danger, warning, info,
               brand, accent, neutral)

COLORED DOT:
  8px circle, radius-full, no text — used in tables for quick scan

COUNT BADGE (notification bubble):
  Overlays an avatar or icon, top-right corner
  Height/Width: 18px (min), expands for 10+
  Background: danger (unread) or brand (general count)
  Font: 11px / 700 / white, tabular-nums

ROLE BADGE:
  Uses brand-subtle bg + brand text
  Icon prefix (e.g., crown for owner)
  height: 24px

PAYMENT BADGE — CRITICAL COMPONENT:
  Paid:             success-subtle bg, success text, "✓ Paid"
  Partially Paid:   info-subtle bg, info text, "⟳ Partial"
  Unpaid:           warning-subtle bg, warning text, "! Unpaid"
  Overdue:          danger-subtle bg, danger text, "⚠ Overdue"
  Voided:           neutral-100 bg, neutral-400 text, strike-through
```

---

### 9.9 Avatar

```
SIZES:
  xs    24px    Inline mentions, compact lists
  sm    32px    Table rows, comments
  md    40px    Navigation user chip, list items
  lg    48px    Profile headers, cards
  xl    64px    Full profile pages
  2xl   96px    Occupant profile hero

VARIANTS:
  Image:    circular, object-cover
  Initials: bg auto-generated from name hash → brand palette
            max 2 initials (first + last name)
  Icon:     default user icon (neutral-400 on neutral-100)

STATUS INDICATOR (overlays bottom-right of avatar):
  8px dot (xs/sm), 12px dot (md/lg), 14px dot (xl)
  Online: Kakum Green
  Away: Savanna Amber
  Offline: neutral-300

AVATAR GROUP (stacked):
  Avatars overlap by 8px, border 2px white
  Max visible: 3-5, rest shown as "+N" circle
  Used in: booking attendees, housekeeping assignment
```

---

### 9.10 Ghana-Specific Components

These are unique to AbrempongHMS and not in any standard library.

```
SEMESTER PICKER:
  Replaces standard date-range picker for semester-based bookings
  Shows: [SEM 1 2024] [SEM 2 2024] [LONG VAC 2024] [Custom dates]
  Academic year configurable in tenant settings
  Active semester highlighted in brand color
  "X rooms available" shown per semester option

MOBILE MONEY SELECTOR:
  3 provider buttons in a row: [MTN] [Vodafone] [AirtelTigo]
  Each with provider logo, branded color on selection:
    MTN:       #FFD700 (Yellow)
    Vodafone:  #E60000 (Red)
    AirtelTigo:#009900 (Green)
  Phone number input below, with +233 flag prefix
  "Send GHS X to your phone" confirmation copy

GHANA CARD INPUT:
  Format: GHA-XXXXXXXXX-X
  Auto-formats as user types (adds dashes)
  Validation: pattern check + optional NIA API verify button

GHANAPOST GPS INPUT:
  Format: XX-XXXX-XXXX (e.g., AK-039-5028)
  Validate on blur → show map pin if valid
  "Use my location" button (geolocation API)

OCCUPANCY BAR:
  Width: 100%, height: 8px, radius-full
  Empty: neutral-100 bg
  Fill: Kakum Green (< 80%), Savanna Amber (80-95%), Harmattan Red (> 95%)
  Transition: width 400ms ease-in-out on data change
  Shows tooltip: "47 / 50 rooms occupied (94%)"
```

---

## 10. LAYOUT SYSTEM

### 10.1 Breakpoints

```
BREAKPOINT   MIN-WIDTH    DEVICE CONTEXT
──────────────────────────────────────────
xs           0px          Small phones (most Ghana budget devices)
sm           480px        Large phones (Samsung Galaxy A series)
md           768px        Tablets (iPad mini, small laptops)
lg           1024px       Laptops (Chromebook, standard)
xl           1280px       Desktop monitors
2xl          1536px       Large/wide desktop monitors

MOBILE-FIRST: All styles written for xs first, override up.
TARGET: xs through md must be flawless — this is where most users are.
```

### 10.2 Application Layouts

```
LAYOUT A — MANAGEMENT APP (lg and above)
  ┌────────┬──────────────────────────────────────┐
  │        │  TOP BAR (64px)                      │
  │ SIDE   ├──────────────────────────────────────┤
  │ BAR    │                                      │
  │ 280px  │  PAGE CONTENT                        │
  │        │  (max-w-screen-xl mx-auto            │
  │        │   px-8 py-6)                         │
  │        │                                      │
  └────────┴──────────────────────────────────────┘

LAYOUT A — COLLAPSED (md, or user collapses sidebar)
  ┌──────┬────────────────────────────────────────┐
  │ 72px │  TOP BAR (64px)                        │
  │      ├────────────────────────────────────────┤
  │ SIDE │  PAGE CONTENT                          │
  │ BAR  │                                        │
  └──────┴────────────────────────────────────────┘

LAYOUT B — MOBILE MANAGEMENT (xs–sm)
  ┌──────────────────────────────────────────────┐
  │  TOP BAR (56px) — menu icon, title, actions  │
  ├──────────────────────────────────────────────┤
  │                                              │
  │  PAGE CONTENT (full width, px-4)             │
  │                                              │
  ├──────────────────────────────────────────────┤
  │  BOTTOM NAV (64px + safe area)               │
  └──────────────────────────────────────────────┘

LAYOUT C — STUDENT PORTAL (all sizes)
  Same as Layout B but bottom nav always visible
  Consumer-app style: no sidebar at any size

LAYOUT D — PUBLIC WEBSITE (all sizes)
  ┌──────────────────────────────────────────────┐
  │  STICKY TOP NAV (72px)                       │
  │  Hostel logo left, nav links centre, CTA right│
  ├──────────────────────────────────────────────┤
  │  HERO SECTION (full viewport height)         │
  ├──────────────────────────────────────────────┤
  │  CONTENT SECTIONS (max-w-6xl mx-auto)        │
  ├──────────────────────────────────────────────┤
  │  FOOTER                                      │
  └──────────────────────────────────────────────┘
```

### 10.3 Dashboard Grid Patterns

```
OWNER DASHBOARD — 4-COLUMN KPI ROW
  ┌──────────┬──────────┬──────────┬──────────┐
  │ Occ. %   │ Today Rev│ Overdue  │ Staff On │
  └──────────┴──────────┴──────────┴──────────┘
  Desktop: 4 equal columns
  Tablet:  2×2 grid
  Mobile:  2×2 grid (compact)

MAIN CONTENT PATTERNS:
  Full-width table:    w-full
  Card grid (rooms):  grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
  Two-column (form + preview):  lg:grid-cols-[1fr_400px]
  Three-column:       lg:grid-cols-3

PAGE STRUCTURE RULE:
  Page title + actions (top, always sticky on scroll)
  Filter/search bar (below title)
  Content (table or card grid)
  Pagination (bottom, sticky on long tables)
```

---

## 11. MOTION & ANIMATION

### 11.1 Duration Scale

```
TOKEN         DURATION   USE CASE
──────────────────────────────────────────────────────────
motion-micro  75ms       Icon state changes, color transitions
motion-fast   150ms      Button hover/active, checkbox tick
motion-base   200ms      Dropdown open, tab switch, tooltip
motion-smooth 300ms      Modal enter, drawer slide, accordion
motion-slow   400ms      Page transitions, complex reveals
motion-lazy   600ms      Skeleton → content fade-in
```

### 11.2 Easing Functions

```css
:root {
  /* Standard ease — smooth feel */
  --ease-standard:    cubic-bezier(0.4, 0, 0.2, 1);

  /* Decelerate — elements entering the screen */
  --ease-enter:       cubic-bezier(0.0, 0.0, 0.2, 1);

  /* Accelerate — elements leaving the screen */
  --ease-exit:        cubic-bezier(0.4, 0.0, 1, 1);

  /* Spring — interactive feedback, button press, toggle snap */
  --ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 11.3 Core Animation Patterns

```css
/* Fade-in for content loading */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fadeIn var(--motion-base) var(--ease-enter);
}

/* Slide in from right (drawer) */
@keyframes slideInRight {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

/* Scale in (modal) */
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

/* Spinner — loading state */
@keyframes spin {
  to { transform: rotate(360deg); }
}
.animate-spin { animation: spin 1s linear infinite; }

/* Pulse — skeleton loading */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
```

### 11.4 Reduced Motion

```css
/* MANDATORY — do not ship without this */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration:   0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration:  0.01ms !important;
  }
}
```

### 11.5 Animation Rules

```
DO:
  ✓ Animate opacity and transform only (GPU composited)
  ✓ Use exit animations to confirm destructive actions
  ✓ Use enter animations to confirm data loads
  ✓ Keep all animations under 400ms total
  ✓ Stagger list items entering (30ms between each — max 8 items)

DO NOT:
  ✗ Animate width, height, margin, padding (causes layout thrash)
  ✗ Use animations to add perceived time to fast operations
  ✗ Animate on the housekeeping staff interface (distraction)
  ✗ Loop animations except spinners and progress indicators
  ✗ Add hover animations to table rows (too much movement)
```

---

## 12. DARK MODE

### 12.1 Dark Surface Palette

Warm dark — not cold blue-gray. Reflects the warmth of the main palette.

```css
/* Applied with .dark class on <html> */
.dark {
  --color-bg:              12 10% 8%;     /* #141210 — very dark warm */
  --color-surface:         12 8% 11%;     /* #1C1A18 — cards */
  --color-surface-raised:  12 8% 14%;     /* #242220 — elevated cards */
  --color-surface-sunken:  12 6% 7%;      /* #0F0E0D — inputs */

  --color-border:          30 6% 20%;     /* #342F2C — borders */
  --color-border-muted:    30 6% 16%;     /* #2A2624 — subtle borders */
  --color-border-strong:   30 6% 28%;     /* #48413C — strong borders */

  --color-text-primary:    30 10% 92%;    /* #EDE8E4 — warm near-white */
  --color-text-secondary:  30 6% 62%;     /* #A09890 — secondary */
  --color-text-tertiary:   30 4% 44%;     /* #726C68 — tertiary */
  --color-text-disabled:   30 4% 35%;     /* #5C5754 — disabled */

  /* Status colors shift to lighter/desaturated in dark mode */
  --color-success:         150 45% 38%;   /* lighter kakum green */
  --color-danger:          5 55% 52%;     /* lighter harmattan red */
  --color-warning:         33 75% 52%;    /* lighter savanna amber */
}
```

### 12.2 Dark Mode Rules

```
1. SIDEBAR: always dark-950, unchanged in both modes.
   The sidebar is a fixed dark anchor point.

2. CHARTS: axes text neutral-500 (dark mode), gridlines neutral-800.
   Chart fill colors are slightly desaturated in dark mode.

3. SHADOWS: reduced or hidden in dark mode.
   Elevation is indicated by background lightness, not shadow depth.

4. BRAND COLORS: stay the same in dark mode.
   Volta Blue and Kente Gold look equally good on dark backgrounds.

5. IMAGES: no automatic darkening filter. Preserve natural colors.

6. CODE BLOCKS: deeper background (surface-sunken) + Volta Blue 
   syntax highlighting.

7. SKELETON LOADING: neutral-800 → neutral-700 pulse in dark mode.
```

---

## 13. ROLE-SPECIFIC UI PATTERNS

### 13.1 Owner View — "The Control Room"

```
VISUAL LANGUAGE: Data-dense, serious, dark sidebar anchor
INFORMATION HIERARCHY: Numbers first, then context

KPI STAT CARD:
  ┌────────────────────────────┐
  │  OCCUPANCY RATE            │  ← 12px / 600 / neutral-500 / uppercase
  │                            │
  │  94%                       │  ← 36px / 700 / neutral-900 — the main number
  │                            │
  │  ↑ 4% vs last week         │  ← 13px / 500 / success (green) with arrow icon
  │  ▁▂▄▆█ (sparkline)         │  ← 24px tall, brand color
  └────────────────────────────┘
  Border-radius: radius-lg
  Shadow: shadow-xs
  Hover: shadow-sm + slight lift

ACTIVITY FEED:
  Compact timeline. Each entry: 40px row height.
  Icon (16px, colored by action type) + text + timestamp
  Infinite scroll (virtual list for performance)
  Real-time: new entries slide in from top, 300ms

ANOMALY ALERTS:
  Positioned above activity feed.
  Each alert: danger-subtle bg, left border danger, compact 40px height.
  Pulsing dot for unread.
  "Mark as read" on hover.
```

### 13.2 Receptionist View — "The Front Desk"

```
VISUAL LANGUAGE: Fast, action-oriented, minimal cognitive load
PRIMARY TASK: Check-in a guest in under 30 seconds

ROOM AVAILABILITY GRID:
  Each room: a tile (80px × 80px min, responsive)
  Status color fills the tile background (muted — 10% opacity)
  Room number: large (18px / 700) in center
  Status dot: 8px circle, bottom-right
  Click: opens booking/check-in drawer

SEARCH BAR:
  Full-width at top of page — the first element seen
  54px height (easier click target)
  Placeholder: "Search by name, room number, or booking ref..."
  Keyboard shortcut hint: (Ctrl+K) shown in placeholder

QUICK ACTIONS BAR:
  Below search: [+ Check In] [+ New Booking] [+ Record Payment]
  Accent-colored, large (48px height), most common actions

PAYMENT RECORDING:
  3-step wizard — no page navigation, stays in a drawer
  Step 1: Select invoice (auto-shown from occupant selection)
  Step 2: Select amount + payment method (MoMo / Cash)
  Step 3: Confirm + print receipt
  Max 4 taps from search to receipt generated.
```

### 13.3 Housekeeping Staff View — "The Task Board"

```
VISUAL LANGUAGE: Maximum simplicity, large targets, zero distraction
DEVICE: Shared staff phone or low-cost Android
RULE: If a housekeeper needs training to use this view, we failed.

TASK CARD:
  ┌─────────────────────────────────────────────────┐
  │  ROOM 204 — Block B                  [ROUTINE]  │  ← 20px / 700
  │  Standard Cleaning                             │  ← 16px / 400
  │  Assigned by: Supervisor Abena                 │  ← 14px / neutral-500
  │                                                │
  │  ████████████████████████████████████████████  │
  │  [        START CLEANING         ]             │  ← 56px height button (XL)
  └─────────────────────────────────────────────────┘
  Full-width card, 120px min height.
  Swipe right gesture also triggers "Start".
  Green checkmark animates when task marked done.

TASK STATES (visual-first, text-second):
  Assigned:    White card, blue border-left (4px brand)
  In Progress: Amber bg (warning-subtle), timer showing
  Done:        Green bg (success-subtle), checkmark overlay
  Needs Review:Red border-left — supervisor flagged

NAVIGATION:
  Bottom nav only. 3 items: [Tasks] [Done] [Report Issue]
  No sidebar ever on this view.
  No financial data, no occupant personal data visible.

PHOTO UPLOAD (for room condition):
  Large camera icon button (64px)
  Taps to open native camera app
  Photo thumbnails shown below
  Max 4 photos per task (storage conscious)
```

### 13.4 Student Portal — "My Hostel"

```
VISUAL LANGUAGE: Consumer app, friendly, branded per hostel
FEEL: Instagram meets banking app — visual but trustworthy

HOME SCREEN:
  ┌─────────────────────────────────────────┐
  │  [Hostel Logo]  ACACIA HOSTEL           │
  │                                         │
  │  Good morning, Kofi 👋                  │  ← personalised, warm
  │  Room 204, Block B                      │
  │                                         │
  │  ┌─────────────────────────────────┐    │
  │  │  BALANCE DUE                    │    │
  │  │  GHS 450.00                     │    │  ← large, clear
  │  │  Due in 12 days                 │    │
  │  │  [  Pay via MoMo  ]             │    │  ← accent button, prominent
  │  └─────────────────────────────────┘    │
  │                                         │
  │  QUICK ACTIONS:                         │
  │  [📢 Announcements] [🔧 Report Issue]   │
  │  [📄 My Receipts]   [📞 Contact Us]    │
  └─────────────────────────────────────────┘

KEY DIFFERENCES FROM MANAGEMENT:
  → No sidebar — bottom nav only
  → Emojis allowed in student-facing text (warmth, approachability)
  → Larger text sizes throughout (more breathing room)
  → Card-based, not table-based
  → WhatsApp button always visible
  → No financial jargon — "Balance Due" not "Invoice Outstanding"
```

---

## 14. TENANT THEME OVERRIDE SYSTEM

### 14.1 Architecture

The override system has three levels of control, in order of specificity:

```
LEVEL 1 — BRAND COLOR (every hostel)
  Owner sets: primary_color (hex) in tenant_config
  System computes: HSL components, hover, active, light, dark variants
  Result: buttons, active nav items, focus rings, badges all update

LEVEL 2 — FULL PALETTE (Growth+ plan)
  Owner sets: primary_color + secondary_color (accent)
  System computes: full semantic token set for both colors

LEVEL 3 — FONT (Enterprise plan)
  Owner can choose from a curated list of 6 Google Fonts
  (Plus Jakarta Sans, Inter, Poppins, Nunito, Lato, Outfit)
  Applied to display headings only — body text remains Inter
```

### 14.2 Color Computation Algorithm

When a hostel sets `primary_color = "#8B1A1A"` (a dark red):

```typescript
// lib/tenant/theme.ts
function generateTenantTheme(primaryHex: string, accentHex?: string) {
  const primary = hexToHsl(primaryHex);
  // primary = { h: 0, s: 68, l: 32 }

  return {
    // CSS variables injected into <html style="...">
    '--color-brand':           `${primary.h} ${primary.s}% ${primary.l}%`,
    '--color-brand-hover':     `${primary.h} ${primary.s}% ${primary.l - 6}%`,
    '--color-brand-active':    `${primary.h} ${primary.s}% ${primary.l - 10}%`,
    '--color-brand-subtle':    `${primary.h} ${primary.s}% 95%`,
    '--color-brand-subtle-hover': `${primary.h} ${primary.s}% 92%`,

    // Foreground: white if primary is dark, dark if primary is light
    '--color-brand-fg': getLuminance(primaryHex) > 0.4
      ? '30 5% 16%'   // dark text
      : '0 0% 100%',  // white text
  };
}
```

### 14.3 CSS Injection

```typescript
// app/layout.tsx — Next.js Root Layout
export default async function RootLayout({ children }) {
  const tenantId = headers().get('x-tenant-id');
  const config   = await getTenantConfig(tenantId);

  const theme = generateTenantTheme(
    config.primary_color,
    config.secondary_color,
  );

  // CSS variables injected inline — no FOUC, no CLS
  const cssVars = Object.entries(theme)
    .map(([key, val]) => `${key}: ${val}`)
    .join('; ');

  return (
    <html style={cssVars}>
      <head>
        <title>{config.hostel_name}</title>
        {/* Preload only the fonts this tenant uses */}
        {config.font_family !== 'Plus Jakarta Sans' && (
          <link rel="preconnect" href="https://fonts.googleapis.com" />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### 14.4 What Tenants CAN Override

```
CAN OVERRIDE                      CANNOT OVERRIDE
──────────────────────────────────────────────────────────────────
Primary brand color               Sidebar background (always dark)
Secondary accent color            Semantic status colors (success/danger/
Font (from curated list)            warning/info — must stay recognisable)
Logo                              Component shapes (radius scale)
Favicon                           Typography scale / sizes
Hostel name in UI                 Shadow system
Dark/light mode default           Focus ring pattern (accessibility)
                                  Motion timing
                                  Spacing system
```

This constraint is intentional. Tenants customise identity, not structure.
A hostel with a terrible color combination cannot break the usability of the app.

---

## 15. IMPLEMENTATION GUIDE

### 15.1 Tailwind CSS Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand — reads CSS variable HSL components
        brand: {
          DEFAULT:   'hsl(var(--color-brand))',
          hover:     'hsl(var(--color-brand-hover))',
          active:    'hsl(var(--color-brand-active))',
          subtle:    'hsl(var(--color-brand-subtle))',
          fg:        'hsl(var(--color-brand-fg))',
        },
        accent: {
          DEFAULT:   'hsl(var(--color-accent))',
          hover:     'hsl(var(--color-accent-hover))',
          subtle:    'hsl(var(--color-accent-subtle))',
          fg:        'hsl(var(--color-accent-fg))',
        },
        success: {
          DEFAULT:   'hsl(var(--color-success))',
          subtle:    'hsl(var(--color-success-subtle))',
          fg:        'hsl(var(--color-success-fg))',
        },
        danger: {
          DEFAULT:   'hsl(var(--color-danger))',
          hover:     'hsl(var(--color-danger-hover))',
          subtle:    'hsl(var(--color-danger-subtle))',
          fg:        'hsl(var(--color-danger-fg))',
        },
        warning: {
          DEFAULT:   'hsl(var(--color-warning))',
          subtle:    'hsl(var(--color-warning-subtle))',
          fg:        'hsl(var(--color-warning-fg))',
        },
        // Surfaces
        surface:     'hsl(var(--color-surface))',
        'surface-raised': 'hsl(var(--color-surface-raised))',
        'surface-sunken': 'hsl(var(--color-surface-sunken))',
        // Text
        'text-primary':   'hsl(var(--color-text-primary))',
        'text-secondary': 'hsl(var(--color-text-secondary))',
        'text-tertiary':  'hsl(var(--color-text-tertiary))',
        // Sidebar (fixed, never changes)
        sidebar: {
          bg:     'hsl(var(--color-sidebar-bg))',
          text:   'hsl(var(--color-sidebar-text))',
          active: 'hsl(var(--color-sidebar-text-active))',
          hover:  'hsl(var(--color-sidebar-item-hover))',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Plus Jakarta Sans', 'sans-serif'],
        sans:    ['var(--font-sans)',    'Inter',             'sans-serif'],
        mono:    ['var(--font-mono)',    'JetBrains Mono',    'monospace'],
      },
      fontSize: {
        xs:   ['0.75rem',   { lineHeight: '1rem',    letterSpacing: '0.02em'  }],
        sm:   ['0.875rem',  { lineHeight: '1.25rem', letterSpacing: '0.01em'  }],
        base: ['1rem',      { lineHeight: '1.5rem',  letterSpacing: '0'       }],
        lg:   ['1.125rem',  { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        xl:   ['1.25rem',   { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        '2xl':['1.5rem',    { lineHeight: '2rem',    letterSpacing: '-0.02em' }],
        '3xl':['1.875rem',  { lineHeight: '2.25rem', letterSpacing: '-0.03em' }],
        '4xl':['2.25rem',   { lineHeight: '2.5rem',  letterSpacing: '-0.04em' }],
        '5xl':['3rem',      { lineHeight: '3.25rem', letterSpacing: '-0.05em' }],
        '6xl':['3.75rem',   { lineHeight: '4rem',    letterSpacing: '-0.06em' }],
      },
      borderRadius: {
        xs:   '2px',
        sm:   '4px',
        md:   '6px',
        lg:   '8px',
        xl:   '12px',
        '2xl':'16px',
        '3xl':'24px',
      },
      boxShadow: {
        xs:    '0 1px 2px rgba(15, 20, 30, 0.06)',
        sm:    '0 1px 3px rgba(15, 20, 30, 0.08), 0 1px 2px rgba(15, 20, 30, 0.06)',
        md:    '0 4px 8px rgba(15, 20, 30, 0.08), 0 2px 4px rgba(15, 20, 30, 0.05)',
        lg:    '0 10px 20px rgba(15, 20, 30, 0.10), 0 4px 8px rgba(15, 20, 30, 0.06)',
        xl:    '0 20px 40px rgba(15, 20, 30, 0.12), 0 8px 16px rgba(15, 20, 30, 0.06)',
        focus: '0 0 0 3px hsl(var(--color-brand) / 0.25)',
        'focus-danger': '0 0 0 3px hsl(var(--color-danger) / 0.25)',
      },
      transitionDuration: {
        micro:  '75ms',
        fast:   '150ms',
        base:   '200ms',
        smooth: '300ms',
        slow:   '400ms',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),  // for rich text in website CMS
  ],
};

export default config;
```

### 15.2 Component Architecture with shadcn/ui

```
packages/ui/
├── components/
│   ├── core/                  ← Override shadcn components with Adinkra tokens
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── toast.tsx
│   │   └── tooltip.tsx
│   ├── ghana/                 ← Ghana-specific components
│   │   ├── semester-picker.tsx
│   │   ├── momo-selector.tsx
│   │   ├── ghana-card-input.tsx
│   │   ├── ghanapost-input.tsx
│   │   └── occupancy-bar.tsx
│   ├── layout/                ← Layout components
│   │   ├── sidebar.tsx
│   │   ├── top-bar.tsx
│   │   ├── bottom-nav.tsx
│   │   └── page.tsx
│   ├── data/                  ← Data display
│   │   ├── data-table.tsx
│   │   ├── stat-card.tsx
│   │   ├── activity-feed.tsx
│   │   └── chart-wrapper.tsx
│   └── status/                ← Status display
│       ├── room-status-badge.tsx
│       ├── payment-status-badge.tsx
│       ├── role-badge.tsx
│       └── sync-indicator.tsx
├── styles/
│   ├── globals.css            ← CSS variable definitions (Layer 1 & 2)
│   ├── dark.css               ← Dark mode overrides
│   └── typography.css         ← prose styles for CMS content
└── theme/
    ├── tokens.ts              ← Token definitions (TypeScript)
    ├── compute.ts             ← Tenant color computation
    └── fonts.ts               ← Font loading strategy
```

### 15.3 Global CSS File Structure

```css
/* styles/globals.css */

/* ── 1. Font imports (subset only) ─────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap&subset=latin,latin-ext');

/* ── 2. Primitive tokens ────────────────────────────── */
:root {
  /* Volta Blue scale */
  --primitive-volta-50:  210 100% 97%;
  --primitive-volta-100: 210 90%  92%;
  /* ... full scale ... */
  --primitive-volta-700: 207 58%  28%;
  --primitive-volta-800: 207 58%  22%;
  --primitive-volta-900: 207 58%  16%;
  --primitive-volta-950: 207 58%  10%;

  /* ... all other primitive scales ... */
}

/* ── 3. Semantic tokens (light mode) ────────────────── */
:root {
  --color-brand:         var(--primitive-volta-700);
  /* ... all semantic mappings ... */
}

/* ── 4. Dark mode semantic overrides ────────────────── */
.dark {
  --color-bg:            12 10% 8%;
  /* ... dark mode overrides ... */
}

/* ── 5. Base styles ─────────────────────────────────── */
* { @apply border-border; }
body {
  @apply bg-[hsl(var(--color-bg))] text-text-primary;
  font-family: var(--font-sans), sans-serif;
  -webkit-font-smoothing: antialiased;
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
  /* cv11 = slashed zero — critical for financial data */
}

/* ── 6. Financial data helpers ──────────────────────── */
.tabular-nums { font-variant-numeric: tabular-nums; }
.slashed-zero { font-variant-numeric: slashed-zero; }
.currency-amount { @apply font-mono tabular-nums slashed-zero; }
```

---

## QUICK REFERENCE

### Color Cheat Sheet

```
PRIMARY (Volta Blue)    #1B5276   Use: buttons, links, active states, focus rings
ACCENT (Kente Gold)     #C9880A   Use: CTAs, highlights, pricing, booking button
SUCCESS (Kakum Green)   #1A7A4C   Use: available, paid, online, complete, positive
DANGER (Harmattan Red)  #C0392B   Use: overdue, error, occupied, delete, alert
WARNING (Savanna Amber) #D97706   Use: pending, cleaning, partial, unread
INFO (Densu Blue)       #2980B9   Use: informational, help text, neutral highlights
SIDEBAR                 #0F0F0E   Use: ONLY sidebar background — fixed, never changes
```

### Component Quick Decisions

```
Which button variant?
  One primary action per screen → primary
  Secondary action → secondary or outline
  Deleting or voiding → destructive (always confirm with dialog)
  Table row action → ghost

Which card variant?
  Standard content → default
  Many cards together → outlined
  Key stats → stat card (custom)

Which nav?
  Management app → sidebar (desktop) + mobile drawer
  Housekeeping/Student → bottom nav only

Modal vs Drawer?
  Creating/editing → modal
  Viewing details → drawer (from right)
  Confirming action → alert dialog
  Mobile filter/sort → bottom sheet
```

---

*Adinkra Design System — v1.0 — AbrempongHMS — April 2026*
*"Bi nka bi" — an Adinkra symbol of harmony, peace, and unity through design*
