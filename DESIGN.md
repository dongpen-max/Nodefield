# Nodefield Design System

## Theme

An independent researcher works for hours at a bright desk, sorting evidence on a precise mapping table; the interface is quiet white space, dark legible ink, and a few deliberate color-pencil marks. The color strategy is restrained: neutral surfaces carry the product, the moss primary marks commands and selection, and coral appears only as a contrasting signal.

## Color

Use OKLCH values throughout.

```css
:root {
  --color-bg: oklch(1 0 0);
  --color-surface: oklch(0.972 0.006 150);
  --color-surface-raised: oklch(0.992 0.002 150);
  --color-ink: oklch(0.205 0.018 150);
  --color-muted: oklch(0.465 0.018 150);
  --color-subtle: oklch(0.64 0.012 150);
  --color-line: oklch(0.89 0.01 150);
  --color-line-strong: oklch(0.79 0.018 150);
  --color-primary: oklch(0.4 0.106 150);
  --color-primary-hover: oklch(0.345 0.106 150);
  --color-primary-soft: oklch(0.94 0.035 150);
  --color-on-primary: oklch(0.99 0 0);
  --color-accent: oklch(0.63 0.19 32);
  --color-accent-soft: oklch(0.945 0.035 32);
  --color-on-accent: oklch(0.99 0 0);
  --color-danger: oklch(0.55 0.2 25);
  --color-warning: oklch(0.73 0.14 82);
  --color-info: oklch(0.56 0.14 245);
  --color-focus: oklch(0.62 0.16 245);
}
```

Card types use small, meaningful swatches rather than full saturated fills: note uses warning, source uses info, insight uses accent, and task uses primary. Selected state combines a strong outline, a subtle tint, and an icon/label change so it is not color-only.

## Typography

- UI family: `"Segoe UI Variable", "Segoe UI", ui-sans-serif, system-ui, sans-serif`.
- Metadata family: `ui-monospace, "Cascadia Code", monospace` only for zoom, file format, and schema labels.
- Product scale: 12px metadata, 13px controls, 14px body, 16px card title, 18px inspector heading, 20px board title.
- Use fixed sizes, normal letter spacing, 1.4-1.6 body line height, and 600 weight for hierarchy.

## Layout

- Desktop: 56px top bar, 48px left tool dock, full-bleed canvas, and a 320px contextual inspector.
- Tablet: retain the top bar and dock; inspector overlays as a right sheet so the canvas does not collapse.
- Mobile: 52px top bar, 56px bottom tool dock, full-width canvas, and an inspector bottom sheet capped at 48vh.
- Canvas nodes have stable widths between 220px and 320px; node content never changes toolbar or viewport dimensions.
- Use 4px, 8px, 12px, 16px, 24px, and 32px spacing steps with denser values inside controls.

## Components

- Icon buttons: 34px desktop, 42px mobile, square, 6px radius, Lucide icon, tooltip and accessible label.
- Command buttons: icon plus short text only when the action is not familiar from its icon.
- Nodes: 6px radius, 1px border, restrained shadow only while selected or dragged. Nodes are the only repeated card surface.
- Inspector: unframed panel with section dividers; do not put cards inside it.
- Inputs: 6px radius, visible label, consistent focus ring, no custom scrollbars.
- Segmented controls: use for mutually exclusive card type or canvas mode; toggles only for binary state.
- Toasts: concise status feedback in a fixed live region, never required to understand persistent state.

## Motion

- Use 150-220ms ease-out transitions for panel entry, selection outline, and toast feedback.
- Animate opacity and transform, not layout dimensions.
- No page-load choreography, bouncing, elastic effects, or continuous decorative motion.
- Under `prefers-reduced-motion: reduce`, remove transforms and shorten transitions to effectively instant feedback.

## Responsive Behavior

- Preserve the canvas as the largest surface at every width.
- Collapse optional top-bar labels before hiding commands; move overflow commands into one menu.
- Prevent inspector and tool dock overlap by reserving safe-area insets on mobile.
- Long card titles wrap to two lines; bodies clamp in nodes and remain fully editable in the inspector.
- Test at 390x844, 768x1024, 1280x800, and 1440x900.
