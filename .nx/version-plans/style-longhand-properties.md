---
__default__: patch
---

The `style` prop now types the CSS longhands GTK accepts that it used to reject: per-side border colors, styles and widths (`borderTopColor`, `borderLeftWidth`), per-corner radii (`borderTopLeftRadius`), `borderImage` and its parts, `backgroundBlendMode`, and the font features (`fontVariantNumeric: "tabular-nums"` for a timer or counter, `fontFeatureSettings`, `fontVariationSettings`, `fontKerning`, `fontStretch` and the other `fontVariant*` longhands). They failed `tsc` although GTK applies them.
