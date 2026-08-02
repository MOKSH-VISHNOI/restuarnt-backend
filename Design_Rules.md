# YATHARTH DESIGN SYSTEM (YDS)

**Version:** 1.0

# 1. Design Philosophy

## Core Principles

- Mobile First
- Adaptive First (avoid unnecessary media queries)
- Simplicity over decoration
- Fast interactions
- Large touch targets
- Accessibility first
- Consistency over creativity
- Performance is a design feature

# 2. Color System

## Brand

```
Primary Accent
Primary Hover
Accent Light
```

## Semantic Colors

```
Success
Warning
Danger
Information
```

## Backgrounds

```
Background
Surface
Secondary Surface
Card Background
```

## Text

```
Primary Text
Secondary Text
Disabled Text
Inverse Text
```

## Borders

```
Primary Border
Secondary Border
Focus Border
```

# 3. Typography

## Font Family

```
Poppins
```

---

## Font Scale


| Token    | Usage           |
| -------- | --------------- |
| text-xs  | Labels          |
| text-sm  | Small Text      |
| text-md  | Body            |
| text-lg  | Description     |
| text-xl  | Section Heading |
| text-2xl | Hero            |
| text-3xl | Marketing       |


## Font Weight

```
300 Light
400 Regular
500 Medium
600 Semi Bold
700 Bold
800 Black
```

---

## Line Height

```
Titles → 1.1

Body → 1.5

Description → 1.6
```

# 4. Spacing System

Never use random spacing.

Use only the design scale.

```
4
8
12
16
20
24
32
40
48
64
80
96
```

Every padding, gap and margin should come from this scale.

---

# 5. Border Radius


| Token  | Radius |
| ------ | ------ |
| Small  | 12px   |
| Medium | 18px   |
| Large  | 24px   |
| XL     | 30px   |
| Pill   | 999px  |


---

# 6. Elevation

Only four shadows are allowed.

```
XS

SM

MD

LG
```

Never create component-specific shadows unless absolutely necessary.

---

# 7. Buttons

## Primary

- Accent background 
- White text 
- Filled

---

## Secondary

- Border only 
- Surface background

---

## Ghost

- Transparent

---

## Danger

- Red

---

### Button Height

```
54px
```

---

### Button Radius

```
18px
```

---

# 8. Cards

Every card must have

- Background 
- Radius 
- Shadow 
- Padding 
- Hover state

No exceptions.

---

# 9. Layout Rules

Always use

```
Flexbox

Grid

Clamp()

Min()

Max()

rem

%

vw

vh
```

Avoid fixed values whenever possible.

---

## Container

Single max width.

```
540px
```

---

# 10. Responsive Rules

Priority

```
Adaptive

↓

Fluid

↓

Media Queries
```

Media queries are only allowed when

- layout changes 
- navigation changes 
- usability requires it

Never for changing 4px or 8px spacing.

---

# 11. Animation Rules

Animation should

- feel natural 
- be under 450ms 
- never block interaction

Allowed speeds

```
Fast

Normal

Slow
```

---

# 12. Motion Principles

Prefer

```
Opacity

Transform

Scale

Translate
```

Avoid

```
Animating width

Animating height

Animating top

Animating left
```

---

# 13. Icons

Rules

- Same icon family 
- Same stroke width 
- Same visual weight

---

# 14. Images

Always

```
object-fit: contain
```

Never stretch images.

---

# 15. Touch Targets

Minimum

```
44 × 44 px
```

Recommended

```
48 × 48 px
```

---

# 16. Accessibility

Minimum

```
Contrast

Keyboard Navigation

Focus States

Readable Font Sizes

Large Touch Targets
```

---

# 17. Naming Convention

Prefer

```
component

component-title

component-image

component-footer

component-button
```

Avoid

```
card2

box

wrapper1

leftBox
```

---

# 18. CSS Architecture

```
variables.css

↓

theme.css

↓

layout.css

↓

components.css

↓

animations.css
```

Each file has one responsibility.

---

# 19. Performance Rules

Avoid

- Duplicate CSS 
- Deep nesting 
- Inline styles 
- Unused classes 
- Duplicate animations

---

# 20. Code Style

Every section begins with

```
/* ==========================================
   HEADER
========================================== */
```

One blank line between selectors.

Properties grouped logically

```
Position

Display

Size

Spacing

Typography

Visual

Animation
```

---

# 21. Component Checklist

Before creating a new component ask:

```
✓ Adaptive?

✓ Accessible?

✓ Reusable?

✓ Theme Compatible?

✓ Uses Variables?

✓ Uses Existing Tokens?

✓ Mobile Friendly?

✓ Keyboard Friendly?
```

---

# 22. Yatharth Product Principles

Every screen in Yatharth should feel:

- Fast 
- Calm 
- Premium 
- Minimal 
- Predictable 
- Friendly 
- Consistent

The interface should never distract from the user's task. Every interaction should reduce effort, not add to it.

---

## I would also add one final section that many teams miss:

# 23. Non-Negotiable Rules

These are rules we **never** break unless there's a compelling technical reason.

1. Never hardcode colors. Use design tokens.
2. Never duplicate component styles.
3. Never duplicate animations.
4. Never create random spacing values.
5. Prefer adaptive layouts over media queries.
6. One component = one responsibility.
7. Every new component must support both light and dark themes.
8. JavaScript must never depend on visual styling.
9. Design consistency is more important than individual screen perfection.
10. If a pattern already exists in YDS, reuse it instead of inventing a new one.

