---
title: "CSS"
description: "Apply widget styles and reusable classes in GTKX."
---

# CSS

GTKX provides a `style` prop for individual widgets and `@gtkx/css` for reusable styles. Use [Adwaita's style classes](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/style-classes.html) for standard widget styling. For custom rules, use [GTK's supported CSS properties](https://docs.gtk.org/gtk4/css-properties.html); layout stays in widget props.

## Style one widget

The `style` prop accepts an object with camelCase property names:

```tsx
import { GtkLabel } from "@gtkx/jsx/gtk";

<GtkLabel label="Overdue" style={{ color: "var(--error-color)", fontWeight: 700 }} />;
```

Numeric lengths use pixels: `minHeight: 48` becomes `min-height: 48px`. Pass other units as strings. Setting `style` to `undefined` or `null` removes its declarations.

Nested selectors start with `&`, which refers to the styled widget. Other parts of a selector match GTK's [CSS node names](https://docs.gtk.org/gtk4/css-overview.html#css-nodes), which each widget's API documentation lists, so `& label` matches the button's label:

```tsx
import { GtkButton } from "@gtkx/jsx/gtk";

<GtkButton
    label="Delete"
    style={{
        color: "var(--error-color)",
        "&:hover": { background: "alpha(var(--error-color), 0.1)" },
        "& label": { fontWeight: 700 },
    }}
/>;
```

Keys starting with `--` set CSS custom properties, which the widget and its descendants read through `var()`. Overriding Adwaita's variables recolors a subtree:

```tsx
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";

<GtkBox style={{ "--accent-bg-color": "#26a269", "--accent-color": "#1b8553" }}>
    <GtkButton label="Save" cssClasses={["suggested-action"]} />
</GtkBox>;
```

A declaration in `style` takes precedence over the same declaration supplied through `cssClasses`. GTKX adds a generated class to apply the style; leave that class under GTKX's control.

Use `style` for values specific to one widget, such as a color computed from props. GTKX batches these updates through a shared style provider, but frequent changes still make GTK recalculate styles. Prefer native animated properties or CSS transitions when they express the effect. See [Animations](/v2/guide/animations) for animated styles.

## Create reusable classes

`css` accepts a tagged template or style object and returns a class name for `cssClasses`:

```tsx
import { css } from "@gtkx/css";
import { GtkLabel } from "@gtkx/jsx/gtk";

const overdue = css`
    color: var(--error-color);
    font-weight: 700;

    &:hover {
        text-decoration: underline;
    }
`;

<GtkLabel label="Overdue" cssClasses={[overdue]} />;
```

Identical styles reuse the same class and are inserted once. Interpolating a generated class into another `css` call includes its declarations. Use these classes for styles shared by several widgets, or for rules such as `@media` and `@keyframes` that the `style` prop does not expose. Keyframe names are global, so give them an application or component prefix.

## Combine classes

`cx` returns the array that `cssClasses` expects. It keeps nonempty class names and ignores boolean, `null`, and `undefined` arguments:

```tsx
import { css, cx } from "@gtkx/css";
import { GtkButton } from "@gtkx/jsx/gtk";

const action = css({ minWidth: 96 });

<GtkButton label="Save" cssClasses={cx(action, canSave && "suggested-action")} />;
```

When several generated classes are combined, `cx` merges their declarations into one class. Later arguments win on conflicting declarations. As within one `css` call, nested selectors and `@media` blocks follow all plain declarations, so an earlier argument's `@media` rule still overrides a later argument's plain declaration while its query matches. Give the later class its own `@media` rule when it must win there too:

```ts
import { css, cx } from "@gtkx/css";

const chip = css`
    background: alpha(var(--accent-bg-color), 0.15);
    @media (prefers-color-scheme: dark) {
        background: alpha(var(--accent-bg-color), 0.35);
    }
`;

const warning = css`
    background: alpha(var(--warning-bg-color), 0.2);
    @media (prefers-color-scheme: dark) {
        background: alpha(var(--warning-bg-color), 0.35);
    }
`;

const unsaved = cx(chip, warning);
```

## Apply global rules

`injectGlobal` inserts selectors without a generated class:

```ts
import { injectGlobal } from "@gtkx/css";

injectGlobal`
    window {
        background: var(--window-bg-color);
    }
`;
```

### Import a stylesheet

A plain `.css` import also works: the GTKX CLI turns it into an `injectGlobal` call. Global rules remain installed for the application's lifetime.

Relative references in the file are bundled with the app. A relative `url()`, such as `background-image: url("../data/paper.png")`, becomes a [`?resource`](/v2/guide/assets#resources) file, and a relative `@import` loads that stylesheet before the file's own rules.

Other `url()` values reach GTK unchanged. A `resource://` or `file://` URI loads, but an absolute path such as `url("/com/example/Tasks/paper.png")` draws nothing, because the installed stylesheet has no location to resolve it against; `gtkx dev` and `gtkx build` warn about it. In `css` and `style`, interpolate a `?resource` import instead:

```ts
import { css } from "@gtkx/css";
import paperPath from "../data/paper.png?resource";

const paper = css`
    background-image: url("resource://${paperPath}");
`;
```

During `gtkx dev`, editing a stylesheet replaces the rules that file installed, so removed rules stop applying, and the app keeps its state. Editing a module's `injectGlobal` rules re-runs the module, which adds the edited rules after the earlier ones, as Emotion does: a changed value takes effect, but a removed rule or a selector you moved keeps applying until the app restarts.

### Load Adwaita's `style.css`

A stylesheet imported with [`?resource`](/v2/guide/assets#resources) is bundled unchanged rather than installed. Use this for the `style.css` that [Adwaita loads](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/class.Application.html#automatic-resources) from the application's resource base path, as in a ported GNOME application:

```ts
import "../data/style.css?resource=/com/example/Tasks/style.css";
import "../data/paper.png?resource=/com/example/Tasks/paper.png";
```

GTK resolves `url()` values in that file against its resource path, so `url("paper.png")` and `url("/com/example/Tasks/paper.png")` both load the image imported beside it. Import each image the stylesheet references at its matching path, since GTKX bundles only imported files. `gtkx build` warns about a `url()` or `@import` under the application's resource base path that names no bundled file.

## Follow appearance preferences

Media queries in `css`, `injectGlobal` and imported `.css` files follow the color scheme resolved by [Adw.StyleManager](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/class.StyleManager.html), including an application override. It also follows the system's contrast preference and, on GTK 4.22 or later, reduced-motion preference.

Use theme variables in custom styles so their colors follow the active appearance. When a rule needs to change by preference, place its `@media` block inside `css`:

```ts
import { css } from "@gtkx/css";

const card = css`
    background: var(--card-bg-color);
    box-shadow: 0 1px 3px var(--shade-color);

    @media (prefers-color-scheme: dark) {
        box-shadow: none;
    }
`;
```

See [Preferences and Theming](/v2/tutorial/preferences-and-theming) for an application preference that switches the scheme.

## Use a bundled font

A `?font` import bundles the font and returns its family name. Pass that name directly to `fontFamily`:

```tsx
import { GtkLabel } from "@gtkx/jsx/gtk";
import bodyFont from "../data/fonts/Inter-Regular.otf?font";

<GtkLabel label="Bundled" style={{ fontFamily: bodyFont }} />;
```

To add a font for fallback coverage without selecting it, use a side-effect import such as `import "../data/fonts/NotoSansKR.otf?font";`. See [Fonts](/v2/guide/assets#fonts) for font imports.

## Next

Continue with [Animations](/v2/guide/animations) to animate widget properties and `style` declarations with React Spring.
