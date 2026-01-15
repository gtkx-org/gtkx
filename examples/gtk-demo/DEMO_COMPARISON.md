# GTK Demo Comparison Report

This document compares GTKX demos with the official gtk4-demo implementations.

**Legend:**
- ✅ Match - Demo closely matches official implementation
- ⚠️ Partial - Demo exists but has significant differences
- ❌ Different - Demo takes a completely different approach
- 🔧 Missing Feature - Specific functionality not implemented

---

## Advanced

### markup.tsx vs markup.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Widget | GtkTextView + GtkTextBuffer.insert_markup | GtkLabel + useMarkup |
| Window size | 600x680 | Embedded panel |
| Key feature | Stack with Source/Formatted toggle | Entry for custom markup + examples list |
| Source editing | Editable TextView that applies to formatted view | Simple Entry preview |

**Missing in GTKX:**
- Stack-based source/formatted toggle (the key demo feature)
- GtkTextView + GtkTextBuffer usage
- Advanced markup: overlines, underline colors, OpenType features (`dlig`), hyphenation (`allow_breaks`, `insert_hyphens`), line height, text transforms

---

### font-features.tsx vs font_features.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~1870 | ~200 |
| HarfBuzz integration | ✅ Direct hb_* API calls | ❌ None |
| Font dialog | GtkFontDialogButton | ❌ None |
| Feature detection | Reads features from actual font | Static predefined list |
| Font variations | Animated axis sliders with play/stop | ❌ None |
| Waterfall mode | Multiple sizes display | ❌ None |
| Script/Language | Dropdown from font's GSUB/GPOS tables | ❌ None |
| Instance selection | Named instances from variable fonts | ❌ None |
| Font plane | 2D weight/width interactive widget | ❌ None |

**Missing in GTKX:**
- Entire HarfBuzz integration
- GtkFontDialogButton
- Font variation axes with animation
- Waterfall display mode
- Script/language selection
- Actual font feature application (just shows CSS syntax)

---

### transparent.tsx vs transparent.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Purpose | Blur overlay demonstration | Cairo RGBA concepts |
| Widget | GtkOverlay + GtkPicture | GtkDrawingArea |
| CSS feature | backdrop-filter blur | None |
| Content | Portland rose image with blurred button overlay | Checkerboard with alpha shapes |

**Missing in GTKX:**
- GtkOverlay usage
- CSS backdrop-filter blur effect
- Image background with floating controls
- The actual "transparent window" demonstration

---

### fontrendering.tsx vs fontrendering.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~466 | ~462 |
| Font selection | GtkFontDialogButton | ❌ None |
| Text/Positions toggle | 4x4 sub-pixel position grid | ❌ None |
| Glyph outlines | Extracted and rendered via Cairo path | ❌ None |
| Pixel/outline fade | Animated with ease_out_cubic | ❌ None |
| Visualization options | Grid, extents, pixels, outlines | Grid only |
| Zoom controls | Up/Down buttons with keyboard shortcuts | Magnification slider |
| Comparison views | ❌ None | Side-by-side hinting/antialiasing |

**Missing in GTKX:**
- GtkFontDialogButton for font selection
- Sub-pixel position grid (4x4 showing glyph placement at fractional positions)
- Glyph outline extraction and rendering
- Animated transitions between pixel/outline views
- Extents visualization (ink rect vs logical rect)
- Keyboard shortcuts for zoom

**Additional in GTKX:**
- Side-by-side comparison views for different rendering options
- Comprehensive font options reference panel

---

### rotated-text.tsx vs rotated_text.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~219 | ~186 |
| Text content | "I ♥ GTK" with custom heart | Multiple sample texts |
| Custom shape renderer | ✅ PangoCairo fancy_shape_renderer | ❌ None |
| Heart glyph | Cairo bezier curves (red filled) | ❌ None |
| Layout | DrawingArea + GtkLabel side-by-side | DrawingArea only |
| Interactivity | Static display | Rotation/font/spacing controls |
| Color | Red-to-purple gradient | HSL cycling rainbow |

**Missing in GTKX:**
- Custom PangoCairo shape renderer (the key demo feature)
- Heart character rendered with Cairo paths
- GtkLabel demonstration showing same renderer works on labels
- The "I ♥ GTK" signature text

**Different approach:**
- GTKX shows multiple texts in a circle with interactive controls
- Official shows the specific technique of custom shape rendering

---

### textmask.tsx vs textmask.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~81 | ~217 |
| Text | "Pango power!" x3 (static) | Editable input |
| Gradient | Rainbow (fixed stops) | Multiple presets |
| Outline stroke | Black 0.5px | White 30% alpha |
| Animation | ❌ None | ✅ TimedAnimation |
| Core technique | pango_cairo_layout_path + clip | Same |

**Missing in GTKX:**
- N/A - GTKX has more features

**Additional in GTKX:**
- Editable text input
- Multiple gradient presets (Rainbow, Ocean, Sunset, Forest, Fire)
- Font size control
- Animated gradient using TimedAnimation
- Dark background theme

**Note:** GTKX version is more feature-rich and interactive than the simple official demo

---

## Benchmark

### frames.tsx vs frames.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~168 | ~160 |
| Widget approach | Custom ColorWidget subclass (G_DEFINE_TYPE) | GtkDrawingArea with Cairo |
| Frame timing | gtk_widget_add_tick_callback (frame-synced) | setInterval (not frame-synced) |
| FPS measurement | gdk_frame_clock_get_fps() | Manual calculation |
| Rendering | GtkSnapshot | Cairo cr.setSourceRgb() |
| Window | Separate popup | createPortal popup |
| Color interpolation | ✅ Same 3-second lerp | ✅ Same |

**Minor differences:**
- GTKX uses setInterval instead of tick callback (not frame-synced)
- Official uses GtkSnapshot API, GTKX uses Cairo
- Core concept and functionality match well

---

### fishbowl.tsx vs fishbowl.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~358 + gtkfishbowl.h | ~186 |
| Widget types | 16 types (Icon, Button, Video, Gears, etc.) | 1 type (emoji label) |
| Custom widget | GtkFishbowl with physics simulation | FlowBox with static grid |
| Widget factory | Factory functions for each type | Fixed fish emoji |
| CSS effects | Blurred button shadow | ❌ None |
| Navigation | Prev/Next buttons to switch types | ❌ None |
| OpenGL | GtkGears integration | ❌ None |
| Custom rendering | Tiger node widget, graph widget | ❌ None |

**Missing in GTKX:**
- GtkFishbowl custom widget with bouncing animation
- Multiple widget types to benchmark different complexities
- Physics simulation (bouncing, velocities)
- Widget creation factory pattern
- OpenGL gears widget
- Custom node widget (tiger.node)
- Graph widget
- SVG/Symbolic icon variants
- CSS blur effects

**Note:** GTKX version is a vastly simplified demo that doesn't benchmark real widget rendering performance

---

### themes.tsx vs themes.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~139 | ~194 |
| Theme API | GtkSettings gtk-theme-name | AdwStyleManager.setColorScheme() |
| Themes | Adwaita, Adwaita dark, HighContrast, HighContrastInverse | FORCE_LIGHT, FORCE_DARK, PREFER_LIGHT, PREFER_DARK |
| Frame timing | gtk_widget_add_tick_callback (frame-synced) | setInterval (configurable) |
| Warning | Modal dialog before start | Inline warning panel |
| Window title | Shows current theme name | Static |
| Interval control | ❌ None | ✅ Slider 10-1000ms |

**Different approach:**
- Official changes actual GTK theme (including HighContrast)
- GTKX changes Adwaita color scheme only (no HighContrast support)
- GTKX is more user-friendly with configurable interval

---

## Buttons

### spinbutton.tsx vs spinbutton.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~256 | ~151 |
| Spin button types | 4 (Numeric, Hex, Time, Month) | 4 (Same) |
| Custom input/output | Signal handlers for parsing/formatting | format callbacks via text prop |
| Grid layout | GtkBuilder UI file | GtkGrid with x.GridChild |
| Value labels | GBinding property binding | React state + Label |
| Input validation | strtol for hex, string parsing for time/month | Simplified (no full input parsing) |

**Minor differences:**
- GTKX doesn't support custom input parsing (only output formatting)
- Official has full bi-directional parsing (e.g., type "Jan" → 1)
- Both have same visual layout and functionality for basic use

---

### spinner.tsx vs spinner.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~90 | ~47 |
| Layout | VBox with two HBoxes + buttons | Same structure |
| Sensitive/insensitive | ✅ | ✅ |
| Play/Stop buttons | ✅ | ✅ |
| Entry widgets | ✅ | ✅ |
| Auto-start | Starts spinning on load | Starts spinning (useState default) |

**Note:** Near-perfect functional match

---

### expander.tsx vs expander.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Structure | ✅ Same | ✅ Same |
| Error message + details | ✅ | ✅ |
| Expander + ScrolledWindow + TextView | ✅ | ✅ |
| GTK logo paintable insertion | ✅ | ✅ |
| Text tags (pixels-above-lines, justification) | ✅ | ✅ |
| **Window resizable on expand** | ✅ `expander_cb` | ❌ Missing |

**Missing in GTKX:**
- `notify::expanded` signal handler that toggles `gtk_window_set_resizable`
- This is the key demo feature showing window resize behavior

---

### scale.tsx vs scale.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~37 + scale.ui | ~58 |
| Scale types | 3 (Plain, Marks, Discrete) | 3 (Same) |
| Grid layout | GtkBuilder UI file | GtkGrid with x.GridChild |
| Adjustment values | 0-4, value=2, step=0.1 | Same |
| Mark positions | Bottom, values 0-4 | Same |
| round-digits | 0 for discrete | Same |

**Note:** Nearly identical implementation

---

## Constraints

### constraints.tsx vs constraints.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~286 | ~238 |
| Widget approach | Custom SimpleGrid widget subclass | GtkBox with useEffect setup |
| Layout | 2 buttons top row + 1 full width bottom | Same |
| Guide | ✅ Space guide between buttons | ✅ Same |
| Constraints | Individual gtk_constraint_new() calls | Individual Gtk.Constraint() calls |

**Note:** Functionally equivalent. GTKX uses refs and useEffect instead of custom widget subclass.

---

### constraints-vfl.tsx vs constraints_vfl.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~161 | ~194 |
| VFL usage | ✅ gtk_constraint_layout_add_constraints_from_description | ❌ None |
| VFL strings | "H:\|-[button1(==button2)]-12-[button2]-\|" etc. | N/A |
| Constraint creation | Parsed from VFL | Manual individual constraints |

**Missing in GTKX:**
- **Actual VFL parsing (the entire point of the demo)**
- The demo is misleadingly named - it doesn't use VFL at all
- gtk_constraint_layout_add_constraints_from_description API

**Note:** GTKX version should either implement VFL support or be renamed/removed

---

### constraints-interactive.tsx vs constraints_interactive.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~238 | ~213 |
| Widget approach | Custom InteractiveGrid widget | GtkBox with refs |
| Drag gesture | GtkGestureDrag with drag-update | Same |
| Guide positioning | Constraint updated on drag | Same |
| Constraint removal/add | gtk_constraint_layout_remove_constraint | layout.removeConstraint |

**Note:** Functionally equivalent - both demonstrate dynamic constraint updates during interaction

---

## CSS

### css-basics.tsx vs css_basics.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~126 | ~99 |
| Core concept | Live CSS editing | Live CSS editing |
| Error highlighting | ✅ Text tags for warnings/errors | ❌ None |
| Parsing error signal | ✅ GtkCssProvider::parsing-error | ❌ None |
| Window | Separate 400x300 | Embedded panel |
| CSS cleanup | ✅ clear_provider on destroy | ✅ removeProviderForDisplay in cleanup |

**Missing in GTKX:**
- Error/warning highlighting with text tags on invalid CSS
- GtkCssProvider parsing-error signal handling
- Visual feedback when CSS is invalid

**Note:** Both implement the same core concept of live CSS editing. GTKX lacks the error highlighting feature.

---

### css-shadows.tsx vs css_shadows.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~153 | ~262 |
| Approach | Live CSS editing with paned view | Static showcase with presets |
| Layout | Paned (toolbar top, editor bottom) | Frames with elevation levels |
| Error highlighting | ✅ | ❌ |
| Interactive elements | Toolbar buttons (prev/next/Hello World) | Shadow selection buttons |
| Content | Editable CSS with toolbar preview | Showcase of shadow types |

**Different approach:**
- Official: Same pattern as css_basics with editable CSS and a toolbar to demonstrate shadows on buttons
- GTKX: Educational showcase of various shadow effects (subtle, medium, large, XL, inner, layered, glow, colored)

**Note:** GTKX version is more educational/reference-focused while official is about live CSS experimentation

---

### css-accordion.tsx vs css_accordion.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~77 | ~330 |
| Approach | CSS-only accordion with transitions | React state accordion + transitions education |
| Widgets | Frame + Box + 6 Buttons | Custom accordion with expandable panels |
| CSS source | External css_accordion.css resource | Inline @gtkx/css styles |
| Key feature | Pure CSS hover/transition effects | React-managed expand/collapse |
| Additional content | ❌ | Color transitions, native GtkExpander demo |

**Different approach:**
- Official: Simple demo of CSS transitions on button hover (width animation)
- GTKX: Comprehensive transitions tutorial with custom accordion, color transitions, and GtkExpander examples

**Note:** GTKX is more educational but doesn't match the original CSS-only accordion concept

---

### css-blendmodes.tsx vs css_blendmodes.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~148 | ~198 |
| Blend mode selection | GtkListBox with row-activated | Button grid |
| Preview | CSS applied to window with image backgrounds | Icon with color background |
| CSS generation | Template CSS with %s substitution | Dynamic @gtkx/css styles |
| UI | GtkBuilder .ui file with scrolled list | Frames with button controls |
| Blend modes | 16 modes (same list) | 16 modes (same list) |

**Missing in GTKX:**
- GtkBuilder UI file approach
- Multiple background image blending (the key demo feature)
- Real image blending preview

**Note:** Both have same blend modes list but GTKX doesn't demonstrate actual image blending as effectively

---

### css-multiplebgs.tsx vs css_multiplebgs.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~153 | ~190 |
| Approach | Live CSS editing | Preset gradient showcase |
| Layout | Overlay with canvas + bricks button + paned editor | Frames with preset buttons |
| Key feature | Named widgets (#canvas, #bricks-button) styled via CSS | Predefined gradient patterns |
| Interactivity | Edit CSS to see changes | Select presets, adjust opacity |
| Error highlighting | ✅ | ❌ |

**Missing in GTKX:**
- Live CSS editing capability
- GtkOverlay with named widgets
- The actual "multiple backgrounds" CSS editing experience

**Additional in GTKX:**
- Preset gradient patterns (Gradient Stack, Radial Layers, Striped Pattern, Spotlight, Mesh)
- Opacity slider
- CSS code display

---

### css-pixbufs.tsx vs css_pixbufs.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~135 | ~222 |
| Title | "Animated Backgrounds" | "CSS with Icons" |
| Approach | Live CSS editing | Icon theme showcase |
| Key feature | Animated gradient backgrounds | -gtk-icontheme() function demo |
| Animation | CSS gradient animation (the classic pixbufs demo) | ❌ None |
| Error highlighting | ✅ | ❌ |
| Interactivity | Edit CSS | Select icons, filters, size |

**Missing in GTKX:**
- The actual animated gradient background (the classic pixbufs demo feature)
- CSS animation with moving gradients

**Different concept:**
- Official: Recreation of classic GTK pixbufs demo with animated CSS gradients
- GTKX: Showcase of -gtk-icontheme() function with filters

---

### errorstates.tsx vs errorstates.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~137 | ~274 |
| UI | GtkBuilder dialog | React form |
| Validation example | Entry + details cross-validation, Switch + Scale | Email, password, age, terms |
| Accessibility | ✅ GTK_ACCESSIBLE_STATE_INVALID, ERROR_MESSAGE | ❌ None |
| Error class | .error added/removed dynamically | .error via cssClasses |
| Tooltip | ✅ gtk_widget_set_tooltip_text | ❌ None |
| GtkBuilderScope | ✅ Demonstrates expose_object | ❌ N/A |

**Missing in GTKX:**
- Accessibility state management (GTK_ACCESSIBLE_STATE_INVALID)
- Accessible error message relations
- Tooltip-based error hints
- GtkBuilderScope demonstration

**Additional in GTKX:**
- More comprehensive form validation (email, password strength, age)
- Success state display
- Error CSS classes reference section

---

### theming-style-classes.tsx vs theming_style_classes.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~44 | ~296 |
| Purpose | Demonstrate style classes | Comprehensive style class reference |
| UI | GtkBuilder with grid | Interactive list with categories |
| Classes shown | Linked buttons, toolbar | 30+ classes across categories |
| Categories | ❌ | Typography, Buttons, Containers, Colors, Special |
| Live preview | ❌ Static | ✅ Dynamic preview per class |

**Note:** GTKX version is significantly more comprehensive and educational than the minimal official demo

---

## Dialogs

### dialog.tsx vs dialog.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Widget | GtkMessageDialog + GtkDialog (deprecated) | AdwAlertDialog (modern) |
| Message dialog | Click counter with ngettext | Simple alert |
| Interactive dialog | Entry fields copy back to main | Not implemented |
| Header bar | GTK_DIALOG_USE_HEADER_BAR | Adwaita default |

**Missing in GTKX:**
- GtkMessageDialog with click counter and ngettext pluralization
- Interactive dialog with entry fields that sync to main window
- GtkGrid layout in dialog content area

**Note:** GTKX uses modern AdwAlertDialog which is arguably better, but doesn't match the official demo's functionality

---

### pickers.tsx vs pickers.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~381 | ~251 |
| Color picker | GtkColorDialogButton | ✅ GtkColorDialogButton |
| Font picker | GtkFontDialogButton | ✅ GtkFontDialogButton |
| File picker | GtkFileDialog.open | ✅ GtkFileDialog.openAsync |
| File launchers | ✅ GtkFileLauncher, GtkUriLauncher | ❌ None |
| Print button | ✅ GtkPrintDialog for PDF | ❌ None |
| Drag and drop | ✅ GtkDropTarget for file | ❌ None |
| Cancellation | ✅ 20-second timeout with GCancellable | ❌ None |
| Accessibility | ✅ Accessible labels and has_popup | ❌ None |

**Missing in GTKX:**
- GtkFileLauncher (open file in default app)
- GtkUriLauncher (open http://www.gtk.org)
- Open containing folder functionality
- Print PDF file functionality
- Drag and drop file support
- Cancellation timeout
- Accessible labels

**Note:** Both implement the core picker dialogs well. GTKX lacks launcher functionality and advanced features.

---

### pagesetup.tsx vs pagesetup.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~37 | ~401 |
| Dialog | GtkPageSetupUnixDialog | GtkPrintDialog.setupAsync |
| Preview | ❌ None | ✅ Cairo drawing area |
| Manual controls | ❌ None | ✅ Paper size/orientation/margin spinbuttons |
| Interactive | Response handler only | Full page preview with margin visualization |
| API platform | Unix-specific | Cross-platform |

**Different approach:**
- Official: Minimal wrapper around GtkPageSetupUnixDialog (37 lines)
- GTKX: Comprehensive page setup demo with live preview, margin controls, and API reference

**Note:** GTKX is significantly more educational but uses different dialog API

---

### printing.tsx vs printing.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~191 | ~427 |
| Core API | GtkPrintOperation | ✅ GtkPrintOperation |
| Signals | begin-print, draw-page, end-print | ✅ Same plus status-changed |
| Page rendering | Cairo + Pango | ✅ Cairo + PangoCairo |
| Content | Print own source code | Sample text document |
| Header | Gray bar with filename + page number | Blue line with title |
| Preview action | ❌ None | ✅ Built-in preview |
| PDF export | ❌ None | ✅ GtkFileDialog + EXPORT action |
| Page navigation | ❌ None | ✅ In-app preview with prev/next |

**Additional in GTKX:**
- Print preview action button
- PDF export functionality
- In-app page preview with navigation
- Signal documentation
- Configuration options reference

**Note:** Both use the same GtkPrintOperation API. GTKX is more feature-rich with preview and export.

---

## Drawing

### paintable.tsx vs paintable.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~192 | ~249 |
| Key feature | Custom GdkPaintable subclass (GtkNuclearIcon) | GdkMemoryTexture showcase |
| Implementation | G_DEFINE_TYPE with GdkPaintableInterface | No custom paintable class |
| Visual | Nuclear radiation symbol with rotation | Checkerboard/gradient/noise patterns |
| Drawing | GskPathBuilder with circle, stroke, dash | Pixel data in RGBA format |
| Flags | GDK_PAINTABLE_STATIC_CONTENTS/SIZE | N/A (uses built-in textures) |

**Different approach:**
- Official: Demonstrates creating a custom GdkPaintable class with GObject type system, snapshot method, and flags
- GTKX: Shows GdkMemoryTexture for programmatic pixel data, ContentFit options, no custom paintable

**Missing in GTKX:**
- Custom GdkPaintable subclass implementation
- GskPathBuilder for vector graphics
- Paintable flags (static contents/size)

---

### paintable-symbolic.tsx vs paintable_symbolic.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~210 | ~247 |
| Key feature | Custom GtkSymbolicPaintable implementation | Icon browser showcase |
| Interface | GdkPaintable + GtkSymbolicPaintable | GtkImage with iconName |
| Color handling | GTK_SYMBOLIC_COLOR_FOREGROUND/WARNING/ERROR | CSS theming only |
| Warning levels | ✅ None/Alert/Emergency with color changes | ❌ None |
| Click behavior | Cycle warning levels, random window close | Category/icon selection |

**Different concept:**
- Official: Demonstrates implementing GtkSymbolicPaintable interface with custom color mapping based on warning states
- GTKX: Educational icon browser showing symbolic icons in different button contexts

**Missing in GTKX:**
- GtkSymbolicPaintable interface implementation
- snapshot_symbolic method with color array
- Warning level state management
- gdk_paintable_invalidate_contents on state change

---

### paintable-emblem.tsx vs paintable_emblem.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~189 | ~309 |
| Emblem implementation | Custom DemoIcon paintable | GtkOverlay with two GtkImages |
| Composite paintable | ✅ GdkPaintable compositing | ❌ Widget overlay |
| Animated emblem | ✅ gtk_nuclear_animation_new as emblem | ❌ Static icons only |
| invalidate-contents | ✅ Signal forwarding for animated emblems | ❌ N/A |
| Emblem position | Top-right quadrant | Configurable corners |

**Different concept:**
- Official: Custom composite GdkPaintable that layers icon + emblem paintables, supports animated emblems
- GTKX: Widget-based overlay using GtkOverlay with two GtkImage children

**Missing in GTKX:**
- Custom composite GdkPaintable implementation
- Animated paintable as emblem
- Signal forwarding for content invalidation

---

### paintable-mediastream.tsx vs paintable_mediastream.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~315 | ~251 |
| Architecture | Custom GtkNuclearMediaStream (GtkMediaStream subclass) | Video file playback demo |
| Paintable | Custom GdkPaintable with cairo drawing | GtkVideo widget |
| Animation | Frame-by-frame with timestamp | Native video codec |
| Progress | Custom progress via percentage property | GtkMediaControls |
| Play/pause | Via custom prepared/ended signals | Native controls |

**Different concept:**
- Official: Demonstrates custom GtkMediaStream implementation with cairo drawing
- GTKX: Shows video file playback using GtkVideo and GtkMediaControls

**Missing in GTKX:**
- Custom GtkMediaStream subclass
- Manual frame rendering with cairo
- Custom progress/prepared/ended signal handling

---

### paintable-svg.tsx vs paintable_svg.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~132 | ~272 |
| SVG handling | GtkSvg class with states | GdkTexture.newFromBytes |
| File loading | ✅ GtkFileDialog with SVG filter | ❌ Inline SVG strings |
| State support | ✅ gtk_svg_get_n_states, set_state | ❌ None |
| Animation | ✅ .gpa path animation format | ❌ None |
| Click interaction | ✅ Cycle through SVG states | Shape/color selection |

**Different concept:**
- Official: Demonstrates GtkSvg class with stateful/animated SVG support and file loading
- GTKX: Generates SVG strings programmatically and converts to texture

**Missing in GTKX:**
- GtkSvg class
- SVG state cycling
- .gpa path animation format
- File open dialog for SVG files

---

### paintable-animated.tsx vs paintable_animated.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~224 | ~357 |
| Animation method | Custom GdkPaintable with g_timeout_add | Texture swapping with tick callback |
| Paintable class | GtkNuclearAnimation (G_DEFINE_TYPE) | ❌ None |
| get_current_image | ✅ Returns static snapshot | ❌ N/A |
| invalidate_contents | ✅ gdk_paintable_invalidate_contents | ❌ setPaintable each frame |
| Animation type | Rotating nuclear icon | Plasma/wave/spiral effects |
| Controls | None | Play/pause, speed, resolution |

**Different concept:**
- Official: Demonstrates custom animated GdkPaintable with proper interface methods
- GTKX: Swaps GdkMemoryTexture each frame (inefficient but works)

**Missing in GTKX:**
- Custom GdkPaintable implementation for animation
- gdk_paintable_invalidate_contents for efficient updates
- get_current_image for static snapshots

---

### image-filtering.tsx vs image_filtering.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~182 | ~259 |
| Image source | tiger.svg from resource | Sample images (tiger, mandrill, pattern) |
| Filters | GskBlurNode (10px gaussian blur) | Multiple (blur, grayscale, sepia, invert, brightness, contrast) |
| Implementation | GskRenderNode transformation | CSS filters |
| Animation | ❌ None | ❌ None |
| Blur radius | Fixed 10px | Adjustable slider |

**Similar concept:**
- Both demonstrate image filtering
- Official uses GSK render nodes
- GTKX uses CSS filter property

**Missing in GTKX:**
- GskBlurNode/GskRenderNode API usage
- Direct snapshot manipulation

---

### image-scaling.tsx vs image_scaling.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~341 | ~282 |
| Scaling modes | ✅ GDK_TEXTURE_TRANSFORM_ filters | ✅ LINEAR/NEAREST via CSS |
| Image sources | Multiple from resources | GTK logo, sample patterns |
| Comparison | Side-by-side nearest vs linear | Side-by-side with picker |
| Zoom | GtkScale for zoom factor | GtkScale |
| Custom texture | Custom GdkPaintable with pattern | ❌ None |

**Similar concept:**
- Both demonstrate scaling quality differences
- Both show nearest-neighbor vs linear interpolation

**Missing in GTKX:**
- GdkTexture transform constants
- Custom GdkPaintable for pattern generation

---

### images.tsx vs images.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~231 | ~84 |
| Image from resource | ✅ gtk_image_new_from_resource (SVG) | ❌ None |
| Animation | ✅ pixbuf_paintable_new (GIF) | ❌ None |
| Symbolic icon | ✅ g_themed_icon_new_with_default_fallbacks | ✅ iconName prop |
| Stateful icon | ✅ GtkSvg with state binding (.gpa) | ❌ None |
| Path animation | ✅ GtkSvg animated (.gpa) | ❌ None |
| Video | ✅ gtk_video_new_for_resource | ❌ None |
| Widget paintable | ✅ gtk_widget_paintable_new | ❌ None |
| Insensitive toggle | ✅ | ✅ |

**Missing in GTKX:**
- GtkImage from resource
- Animated GIF via PixbufPaintable
- GtkSvg for stateful/animated icons
- Video display
- GtkWidgetPaintable

**Note:** GTKX version is minimal, showing only themed icons

---

### paint.tsx vs paint.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~472 | ~129 |
| Widget type | Custom DrawingArea subclass | GtkDrawingArea with callbacks |
| Stylus support | ✅ GtkGestureStylus with pressure/backlog | ❌ GtkGestureDrag only |
| Eraser tool | ✅ GDK_DEVICE_TOOL_TYPE_ERASER | ❌ None |
| Pad controller | ✅ GtkPadController with button/strip/dial actions | ❌ None |
| Brush size | ✅ Adjustable via pad controls | ❌ Fixed size |
| Stylus only mode | ✅ Checkbox toggle | ❌ None |
| Color picker | ✅ GtkColorDialogButton | ✅ GtkColorDialogButton |
| Clear button | ✅ | ✅ |

**Missing in GTKX:**
- GtkGestureStylus for tablet support
- Pressure sensitivity
- Eraser tool detection
- GtkPadController for drawing tablet buttons/strips
- Brush size control
- Stylus-only mode toggle

---

### mask.tsx vs mask.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~54 | ~63 |
| Widget | demo4_widget (custom) | GtkDrawingArea |
| Mask effect | Text mask with gradient | Same (cairo text path) |
| Animation | Progress slider with property binding | Progress slider with state |
| Gradient | Linear gradient | Linear gradient with rainbow colors |

**Note:** Both demonstrate the same concept - text masking with animated gradient. GTKX uses direct cairo drawing.

---

### drawingarea.tsx vs drawingarea.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~392 | ~228 |
| Knockout groups | ✅ Cairo compositing with 3 surfaces | ✅ Same compositing |
| Scribble area | ✅ Cairo surface with drag gesture | ✅ React state with drag gesture |
| Gesture | GtkGestureDrag with begin/update/end | ✅ Same via callbacks |
| Accessibility | ✅ GTK_ACCESSIBLE_ROLE_IMG, labelled_by | ❌ None |
| Surface management | cairo_image_surface_create | createSimilar |

**Note:** Both implement same functionality. GTKX uses React state for strokes instead of cairo_surface, and lacks accessibility attributes.

---

## Games

### sliding-puzzle.tsx vs sliding_puzzle.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~524 | ~220 |
| Puzzle pieces | Custom GtkPuzzlePiece paintable (clips image regions) | GtkButtons with numbers |
| Image source | Texture from resource, nuclear animation, or video | Numbers only (1-15) |
| Grid size | Configurable (2-10) via spin button | Fixed 4x4 |
| Keyboard | ✅ GtkShortcutController for arrow keys | ❌ None |
| Sound effects | ✅ GtkMediaStream for win/error sounds | ❌ None |
| Aspect ratio | ✅ GtkAspectFrame | ❌ None |
| Settings popover | ✅ Image selection, size config | ❌ None |

**Missing in GTKX:**
- Custom GtkPuzzlePiece paintable for image slicing
- Configurable grid size
- Image-based puzzles (resource images, video)
- Keyboard navigation with arrow keys
- Sound effects on completion
- Settings popover with image/size selection

**Note:** GTKX is a basic numeric 15-puzzle; official is a full image-slicing puzzle game

---

### listview-minesweeper.tsx vs listview_minesweeper.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~392 | ~364 |
| Architecture | Custom SweeperCell/SweeperGame GObjects | Plain TS interfaces + React state |
| Grid display | GtkGridView with GListModel | x.GridView with array |
| Cell display | Emoji (💣) for mines | Text ("X") for mines |
| Hidden cells | "?" character | Empty buttons |
| Flag support | ❌ None in code | ✅ Flag counter (UI only) |
| Sound effects | ❌ None | ✅ System sounds for click/win/lose |
| Single-press | ✅ GtkGestureSingle single-click-only | ✅ onClicked + onActivate |
| Game state | playing property | React useState |

**Missing in GTKX:**
- Custom GObject cell model
- GListModel implementation

**Additional in GTKX:**
- Sound effects (click, explosion, victory)
- Progress tracking UI
- How-to-play instructions

---

### peg-solitaire.tsx vs peg_solitaire.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~392 | ~337 |
| Architecture | Custom SolitairePeg GdkPaintable | Plain React state |
| Grid display | GtkGrid with GtkPicture | GtkGrid with GtkButton |
| Peg visualization | GdkPaintable (brown rectangle) | Circular buttons |
| Interaction | Drag-and-drop (GtkDragSource/GtkDropTarget) | Click-based selection/move |
| Sound effects | ✅ System sounds (complete/error) | ✅ System sounds |
| Valid moves | Calculated during DND | Calculated on click |
| Board pattern | English solitaire (cross shape) | Same |

**Missing in GTKX:**
- GdkPaintable peg implementation
- Drag-and-drop mechanics
- Visual peg dragging feedback

**Different in GTKX:**
- Click-to-select then click-to-move instead of drag-and-drop
- Button-based pegs instead of painted images

---

## Gestures

### links.tsx vs links.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~75 | ~202 |
| Component | GtkLabel with markup links | GtkLinkButton components |
| Link display | Inline hyperlinks in text | Separate button widgets |
| Custom handling | activate-link signal on label | onActivateLink callback |
| Markup | Pango markup in label text | None (button labels) |
| Alert dialog | ✅ GtkAlertDialog for "keynav" | ❌ None |
| Visited state | CSS :visited pseudo-class | visited prop |

**Different approach:**
- Official: GtkLabel with Pango markup hyperlinks inline in text
- GTKX: Standalone GtkLinkButton components

---

### cursors.tsx vs cursors.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~98 + .ui file + .css | ~198 |
| Architecture | GtkBuilder + CSS provider | React component |
| Cursor types | CSS cursors + image + callback | CSS cursors only |
| Custom cursor | gdk_cursor_new_from_callback | ❌ None |
| Image cursor | GTK logo from resource | ❌ None |
| Fallback cursor | ✅ GdkCursor with fallback | ❌ None |
| Display | Grid from .ui file | Programmatic boxes |

**Missing in GTKX:**
- gdk_cursor_new_from_callback for dynamic cursors
- Image-based cursors from resources
- Cursor fallback chain

**Additional in GTKX:**
- More cursor type demonstrations
- Interactive preview area
- Detailed descriptions for each cursor

---

### shortcut-triggers.tsx vs shortcut_triggers.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~96 | ~308 |
| Trigger types | KeyvalTrigger only (Ctrl+G, X) | Keyval, Alternative, Mnemonic, Never |
| UI | Simple list with 2 shortcuts | Comprehensive educational demo |
| Scope | GLOBAL | LOCAL |
| Visual feedback | Console print | UI state update |
| Menu accels | ❌ None | ✅ Demonstrated |

**Different approach:**
- Official: Minimal demo showing shortcut controller basics
- GTKX: Comprehensive educational demo covering all trigger types

**Additional in GTKX:**
- Alternative triggers (multiple key combos)
- Mnemonic triggers
- NeverTrigger (disabled state)
- Menu accelerators
- Best practices documentation

---

### clipboard.tsx vs clipboard.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~414 + clipboard.ui | ~296 |
| Text clipboard | ✅ | ✅ |
| Image clipboard | ✅ | ✅ |
| Color clipboard | ✅ GdkRGBA | ❌ None |
| File clipboard | ✅ GFile | ❌ None |
| Drag-and-drop | ✅ GtkDragSource/GtkDropTarget | ❌ None |
| UI definition | GtkBuilder .ui file | React JSX |
| Source switching | ✅ GtkStack with multiple types | Separate frames |
| Async paste | ✅ gdk_clipboard_read_value_async | ✅ readTextAsync/readTextureAsync |

**Missing in GTKX:**
- Color (GdkRGBA) clipboard support
- File (GFile) clipboard support
- Drag-and-drop between source and destination
- GtkBuilder .ui file integration

---

### gestures.tsx vs gestures.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~217 | ~453 |
| Gestures | Swipe, LongPress, Rotate, Zoom | Same + Click, Drag |
| Presentation | Single drawing area with cairo | Multiple interactive areas |
| Visual feedback | Cairo drawing (line, rectangle, circle) | State-based UI updates |
| 3-finger swipe | ✅ n-points=3 for touchpads | ❌ None |
| Educational info | Basic | ✅ Detailed with gesture list |

**Different approach:**
- Official: Minimal single-area demo with visual cairo feedback
- GTKX: Educational multi-area demo showing each gesture type separately with detailed explanations

**Note:** GTKX is more comprehensive for learning but lacks touchpad-specific 3-finger swipe support

---

### shortcuts.tsx vs shortcuts.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~104 + multiple .ui files | ~359 |
| Dialog | GtkShortcutsWindow from .ui | AdwShortcutsDialog programmatic |
| Multiple apps | Builder, Gedit, Clocks, Boxes examples | Single generic example |
| View filtering | ✅ view-name property | ❌ None |
| Sections | From .ui XML | Programmatic AdwShortcutsSection |
| Menu accels | ❌ None | ✅ Demonstrated |
| Mnemonics | ❌ None | ✅ Button mnemonics |

**Missing in GTKX:**
- GtkShortcutsWindow (uses AdwShortcutsDialog instead)
- Multiple application examples
- View filtering for context-specific shortcuts
- GtkBuilder .ui file integration

**Additional in GTKX:**
- Menu with accelerators demonstration
- Button mnemonics example
- Accelerator syntax documentation

---

### dnd.tsx vs dnd.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~609 | ~358 |
| Architecture | Custom CanvasItem widget (GObject) | React state + GtkFixed |
| Item features | Drag, rotate, recolor, CSS class, expand | Drag, select, z-order |
| Color source | GdkRGBA drag from color wells | No color DND |
| CSS class DND | ✅ Drag CSS classes | ❌ None |
| Rotation | ✅ Rotation gesture + slider | ❌ None |
| Menu | GtkPopover for item editing | Button actions when selected |
| Widget DND | ✅ Drag widgets between containers | Item positioning only |
| Trash zone | ❌ None | ✅ Delete on drop |

**Missing in GTKX:**
- Custom widget DND implementation
- Color DND (GdkRGBA)
- CSS class DND
- Rotation gesture and slider
- Context menu (GtkPopover)
- Widget creation by drag from palette

**Additional in GTKX:**
- Trash zone for item deletion
- Z-order controls (bring to front, send to back)
- Educational documentation

---

## Input

### entry-undo.tsx vs entry_undo.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~59 | ~31 |
| Entry | GtkEntry with enableUndo=TRUE | Same |
| Label | "Use Control+z or Control+Shift+z..." | Same |
| Margins | 18px all sides | Same |
| Accessibility | ✅ LABELLED_BY relation | ❌ None |

**Note:** Nearly identical implementation. GTKX lacks accessibility relation.

---

### password-entry.tsx vs password_entry.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~105 | ~31 |
| Entries | Two with peek icon | Same |
| Validation | ✅ Done button enabled when matching | ❌ None |
| HeaderBar | ✅ Custom with Done button | ❌ None |
| Accessibility | ✅ ACCESSIBLE_PROPERTY_LABEL | ❌ None |
| activatesDefault | ✅ | ✅ |

**Missing in GTKX:**
- Password match validation
- Done button with suggested-action style
- HeaderBar integration
- Accessibility labels

---

### search-entry.tsx vs search_entry.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~100 | ~41 |
| SearchBar | ✅ | ✅ |
| SearchEntry | ✅ | ✅ |
| Key capture | ✅ gtk_search_bar_set_key_capture_widget | ❌ None |
| Toggle button | ✅ In HeaderBar with binding | ❌ None |
| Result display | ✅ | ✅ |

**Missing in GTKX:**
- Key capture widget (type anywhere to search)
- Toggle button in HeaderBar
- Property binding between button and search mode

---

### tabs.tsx vs tabs.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~67 | ~48 |
| Tab array | PangoTabArray(3, TRUE) | Same |
| Tab positions | 0 (LEFT), 150 (DECIMAL), 290 (RIGHT) | Same |
| Decimal point | '.' | Same |
| Sample text | "one\t2.0\tthree\n..." | Same |
| Margins | 20px all sides | Same |

**Note:** Nearly identical implementation

---

### textundo.tsx vs textundo.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~79 | ~53 |
| Undo support | gtk_text_buffer_set_enable_undo(TRUE) | buffer.setEnableUndo(true) |
| Initial text | Irreversible action | Same via beginIrreversibleAction |
| Margins | 20px all sides | Same |
| Pixels below lines | 10 | Same |

**Note:** Nearly identical implementation

---

### textscroll.tsx vs textscroll.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~204 | ~83 |
| Two views | scroll-to-end (right gravity) + scroll-to-bottom (left gravity) | Same |
| Mark names | "end" and "scroll" | Same |
| Intervals | 50ms / 100ms | Same |
| Count limits | 150 / 40 | Same |
| Homogeneous box | ✅ | ✅ |

**Note:** Nearly identical implementation demonstrating GtkTextMark gravity

---

### read-more.tsx vs read_more.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~240 | ~50 |
| Widget | Custom ReadMore widget subclass (G_DEFINE_TYPE) | React state toggle |
| Truncated view | GtkInscription with min_lines=3 | GtkLabel with lines=3, ellipsize |
| Full view | GtkLabel with wrap | Same |
| Measure/allocate | Custom size negotiation logic | N/A |
| Text content | GNU/Linux text | Same |

**Different approach:**
- Official: Custom composite widget with complex measure/allocate logic to automatically show/hide based on available space
- GTKX: Simple state toggle between truncated and full views

**Missing in GTKX:**
- Custom widget subclass with size negotiation
- GtkInscription for truncated text
- Automatic expand based on available space

---

### textview.tsx vs textview.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~611 | ~81 |
| Multiple views | ✅ Two views sharing buffer | ✅ Same |
| Text tags | ✅ Many (heading, italic, bold, monospace, colors, etc.) | ✅ Subset |
| Embedded widgets | ✅ Button, DropDown, Scale, Entry | ✅ Same |
| Text formatting | ✅ Comprehensive | ⚠️ Subset of features |
| Images | ✅ Icon + nuclear animation | ❌ None |
| Internationalization | ✅ Multi-language examples | ❌ None |
| Easter egg | ✅ Nested views popup | ❌ None |

**Missing in GTKX:**
- Images in buffer
- Internationalization examples (German, Greek, Hebrew, Japanese, RTL)
- Easter egg nested views
- Some text tags (superscript, subscript, no_wrap, center, right_justify, etc.)

**Note:** Core concept matches well - two views sharing a buffer with embedded widgets

---

### tagged-entry.tsx vs tagged_entry.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~104 + demotaggedentry.h/c | ~65 |
| Entry widget | DemoTaggedEntry (custom composite) | GtkEntry in GtkBox |
| Tags location | INSIDE entry area | NEXT TO entry (separate buttons) |
| Tag widget | DemoTaggedEntryTag with close button | GtkButton with "×" |
| Insert position | insert_tag_after (before spinner) | Array append |
| Custom widgets | ✅ Two custom widget classes | ❌ None |

**Different concept:**
- Official: Custom composite entry widget with tags embedded inside the text entry area
- GTKX: Tags as separate buttons next to a standard entry

**Missing in GTKX:**
- DemoTaggedEntry custom widget (tags inside entry)
- DemoTaggedEntryTag with close button callback
- Proper tag insertion ordering
- Composite widget pattern with GtkText

---

### hypertext.tsx vs hypertext.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~408 | ~152 |
| Clickable links | ✅ | ✅ |
| Link styling | Blue underline | Blue underline |
| Cursor change | ✅ Pointer on hover | ✅ Same |
| Pages | 3 pages with navigation | Same |
| Embedded widgets | ✅ GtkLevelBar, GtkLabel (ghost replacement) | ❌ None |
| Icons/emoji | ✅ 👻 with widget replacement | ❌ None |
| Audio | ✅ espeak-ng pronunciation | ❌ None |
| Keyboard navigation | ✅ Tab between links, Enter to activate | ❌ None |
| Link discovery | Tags iterator search | Manual position tracking |

**Missing in GTKX:**
- Embedded widgets (GtkLevelBar for volume)
- GtkTextChildAnchor with replacement text (👻 → ghost label)
- Audio pronunciation via espeak-ng
- Keyboard navigation (Tab to move, Enter to follow)
- Programmatic link traversal via tags

**Note:** Core hypertext concept matches well. GTKX has basic clickable links but lacks the advanced features showing embedded widgets and accessibility.

---

## Layout

### panes.tsx vs panes.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~91 | ~74 |
| Layout | Nested VPaned + HPaned | Same |
| Labels | "Hi there", "Hello", "Goodbye" | Same |
| shrinkChild | FALSE for all panes | Same |
| Margins | 4px all sides | Same |

**Note:** Nearly identical implementation

---

### layoutmanager.tsx vs layoutmanager.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~64 + demowidget.h/demochild.h | ~254 |
| Animation | Grid ↔ Circle transition | Same |
| Colors | 16 colors (red, orange, yellow, etc.) | Same colors |
| Click action | Starts transition | Same |
| Custom layout | DemoWidget/DemoChild classes | GtkFixed with position calculation |

**Note:** GTKX implements the layout manager logic inline rather than as a separate GtkLayoutManager subclass, but achieves the same visual result

---

### layoutmanager2.tsx vs layoutmanager2.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~135 + demo2widget.h/demo2layout.h/demochild.h | ~293 |
| Concept | Icons on sphere with arrow key rotation | Same |
| Icons | 100+ freedesktop symbolic icons | Same icon set |
| Animation | Arrow keys rotate theta/phi | Same |
| Layout | Custom Demo2Layout GtkLayoutManager | GtkFixed with position calculation |
| Transform | GskTransform for scale/rotation | Same (via x.FixedChild transform) |
| Z-ordering | Based on sphere Z coordinate | Same (via opacity and scale) |

**Note:** GTKX achieves the same visual effect without implementing a custom GtkLayoutManager subclass. Uses GtkFixed with calculated transforms instead.

---

### headerbar.tsx vs headerbar.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~70 | ~41 |
| Layout | HeaderBar with linked back/forward buttons | Same |
| Switch | ✅ | ✅ |
| Send button | ✅ mail-send-receive-symbolic | Same |
| Tooltips | ✅ Back, Forward, Check out | Same |
| Accessibility | ✅ ACCESSIBLE_PROPERTY_LABEL | ❌ None |
| Content | GtkTextView | Same |

**Missing in GTKX:**
- Accessibility labels for switch and content

---

### overlay.tsx vs overlay.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~93 | ~79 |
| Grid | 5x5 number buttons | Same |
| Blue title | "Numbers" with Pango markup | Same |
| Entry | Center overlay, "Your Lucky Number" | Same |
| canTarget | FALSE for decorative overlay | Same |
| Click action | Sets entry text to button number | Same |

**Note:** Nearly identical implementation

---

### overlay-decorative.tsx vs overlay_decorative.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~104 | ~99 |
| Base widget | GtkScrolledWindow + GtkTextView | Same |
| Decorative images | decor1.png, decor2.png from resources | starred-symbolic icons |
| Corner decorations | Top-left, bottom-right | Same positions |
| canTarget | FALSE for images | Same |
| Interactive control | GtkScale for margin | Same |
| Margin adjustment | Left margin + pixels-above-lines tag | Left margin only |
| Initial text | "Dear diary..." | Same |

**Minor difference:**
- Official uses PNG images from resources
- GTKX uses symbolic icons (starred-symbolic)
- Official also adjusts text tag pixels-above-lines

---

### aspect-frame.tsx vs aspect_frame.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~81 | ~49 |
| Scale | 0.2-5.0 range, step 0.1, digits 2 | Same |
| Label aspect | Controlled by scale | Same |
| Image aspect | obeyChild=TRUE for natural ratio | Same |
| Initial ratio | 1.5 | Same |
| Label text | Same long wrapping text | Same |
| Image | ducky.png resource | org.gtk.Demo4 icon |

**Minor difference:**
- Official uses ducky.png resource image
- GTKX uses org.gtk.Demo4 icon

---

### flowbox.tsx vs flowbox.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~751 | ~186 |
| Color count | 665 colors (with variants like gray0-99) | ~148 colors |
| Color rendering | GtkDrawingArea with Cairo | CSS background-color |
| Selection mode | NONE | Same |
| maxChildrenPerLine | 30 | Same |
| ScrolledWindow | NEVER horizontal policy | Same |

**Difference:**
- Official has full X11 color names with all variants (665 total)
- GTKX has base color names only (~148)
- Both achieve the same visual demonstration of FlowBox reflow

---

### sizegroup.tsx vs sizegroup.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~149 | ~126 |
| Layout | VBox with two Frames + CheckButton | Same |
| SizeGroup | GTK_SIZE_GROUP_HORIZONTAL | Same |
| Frames | Color Options, Line Options | Same |
| Options | Red/Green/Blue, Solid/Dashed/Dotted, Square/Round/Double Arrow | Same |
| Toggle | CheckButton to enable/disable grouping | Same |
| Mnemonic labels | ✅ | ✅ |

**Note:** Nearly identical implementation. Perfect functional match.

---

### fixed.tsx vs fixed.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~171 | ~137 |
| 3D cube | ✅ 6 faces with transforms | ✅ Same |
| Face colors | RGB (red, green, blue) | Same |
| Transform | GskTransform perspective/rotate3d/translate3d | Same using Gsk.Transform |
| Container | Nested GtkFixed with overflow visible | Same |
| CSS | External fixed.css resource | @gtkx/css inline |

**Note:** Both create the same 3D cube effect using GtkFixed transforms

---

### fixed2.tsx vs fixed2.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~96 | ~73 |
| Concept | Rotating + scaling label animation | Same |
| Label | "All fixed?" | Same |
| Animation | tick_callback with frame clock | setInterval (16ms) |
| Transform | gsk_transform_translate/rotate/scale | Gsk.Transform methods |
| Angle | duration * 90 degrees | Same |
| Scale | 2 + sin(duration * π) | Same |
| Container | GtkScrolledWindow + GtkFixed | Same |
| Overflow | GTK_OVERFLOW_VISIBLE | Same |

**Note:** Perfect functional match. GTKX uses setInterval instead of GTK tick callback but achieves same smooth animation.

---

## Lists

### listview-applauncher.tsx vs listview_applauncher.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~205 | ~346 |
| Data source | g_app_info_get_all() (real system apps) | Hardcoded 24 fake apps |
| Widget | GtkListView (horizontal list) | GtkGridView with categories |
| App launching | ✅ g_app_info_launch with GdkAppLaunchContext | ❌ Selection only |
| Error handling | ✅ GtkAlertDialog on launch failure | ❌ None |
| Factory | GtkSignalListItemFactory (setup/bind) | renderItem callback |
| Accessibility | ✅ ACCESSIBLE_PROPERTY_LABEL | ❌ None |
| Search/filter | ❌ | ✅ Search + category buttons |

**Different concept:**
- Official: Actually launches real system applications from GAppInfo, demonstrates listview basics
- GTKX: Showcase of GridView with categories and search filtering using fake app data

**Missing in GTKX:**
- Real system application listing via GAppInfo
- Actual app launching functionality
- GdkAppLaunchContext for launch context
- Error handling with GtkAlertDialog
- Accessibility labels

---

### listview-clocks.tsx vs listview_clocks.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~509 | ~283 |
| Clock display | Custom GdkPaintable analog clock face | Text time display |
| Widget | GtkGridView | GtkListView |
| GtkClock class | ✅ G_DEFINE_TYPE_WITH_CODE implementing GdkPaintable | ❌ None |
| Clock rendering | GskRoundedRect for hour/minute/second hands | String formatting |
| Update mechanism | GtkExpression bindings | useEffect setInterval |
| Cities | 16 timezones | 16 cities with UTC offsets |
| Visual | Analog clock faces with rotating hands | Text "HH:MM:SS" labels |

**Different concept:**
- Official: Demonstrates custom GdkPaintable implementation with GtkClock class that draws analog clock faces using GskRoundedRect for hands
- GTKX: Text-based time display with 12/24 hour toggle

**Missing in GTKX:**
- Custom GdkPaintable subclass (GtkClock)
- GObject type system (G_DEFINE_TYPE_WITH_CODE)
- GskRoundedRect rendering for clock hands
- GtkExpression for automatic property updates
- GtkGridView (uses ListView instead)
- Analog clock visualization

---

### listview-colors.tsx vs listview_colors.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~1133 | ~250 |
| Color count | Up to 16,777,216 (256³) | ~24 colors |
| Color class | GtkColor (GdkPaintable + RGB/HSV properties) | Plain object |
| List model | GtkColorList (custom GListModel with lazy creation) | Array |
| Sorting | GtkSortListModel with incremental sorting | useMemo sort |
| Sorters | 7 (Name, Red, Green, Blue, Hue, Saturation, Value) | Search by name only |
| Selection | GtkMultiSelection with average color display | ❌ None |
| Selection filter | ✅ Filtered view of selected colors | ❌ None |
| Size dropdown | 8 to 16M colors configurable | Fixed 24 colors |
| Color swatch | Custom GdkPaintable | CSS background-color |

**Different concept:**
- Official: Demonstrates GtkSortListModel incremental sorting, GtkMultiSelection, and custom GListModel on millions of items with custom GdkPaintable swatches
- GTKX: Simple GNOME color palette browser with ~24 colors

**Missing in GTKX:**
- GtkColor (custom GdkPaintable for color swatches)
- GtkColorList (lazy GListModel for millions of colors)
- GtkSortListModel with incremental mode
- Multiple sorters (by RGB components, HSV values)
- GtkMultiSelection with selection tracking
- Selection filter model showing average color
- Configurable list size (8 to 16M)

---

### listview-settings.tsx vs listview_settings.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~312 + settings-key.h + .ui | ~346 |
| Data source | Real GSettings schemas (system-wide) | Fake 20 toggle settings |
| Widget | GtkTreeListModel + GtkColumnView | GtkListView with GtkSwitch |
| Tree support | ✅ Hierarchical schema navigation | ❌ Flat categories |
| Columns | Name, Type, Default, Summary, Description | Title + description only |
| Value editing | ✅ GtkEditableLabel with validation | ❌ Toggle only |
| Style classes | .navigation-sidebar, .data-table | None |
| Sorting/filtering | ✅ GtkSortListModel, GtkFilterListModel | ❌ None |
| Column visibility | ✅ GPropertyAction toggles | ❌ None |

**Different concept:**
- Official: Real GSettings schema browser with tree navigation, editable values, multiple columns with sorters and filters
- GTKX: Settings-style UI with toggle switches but no actual GSettings integration

**Missing in GTKX:**
- GSettings integration (reading/writing real settings)
- GtkTreeListModel for hierarchical data
- GtkColumnView with multiple columns
- GtkEditableLabel for inline value editing
- Column sorting and filtering
- .navigation-sidebar and .data-table CSS classes
- GPropertyAction for column visibility

---

### listview-settings2.tsx vs listview_settings2.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~407 + settings-key.c/h | ~384 |
| Data source | Real GSettings with GSettingsSchemaSource | Mock settings data |
| List type | GtkListView with GtkSectionModel | TreeListView |
| Sections | GtkListHeaderFactory | Categories as tree parents |
| Value editing | GtkEntry with GVariant parsing | GtkSwitch toggles |
| Custom GObject | SettingsKey (schema, key, value) | Plain TypeScript objects |
| Flattening | GtkFlattenListModel + GtkMapListModel | Direct declarative tree |
| Section headers | ✅ Schema path headers | Category rows |
| Range validation | ✅ g_settings_schema_key_range_check | ❌ None |
| Search/filter | ✅ Flattened for filtering | ❌ None |

**Different concept:**
- Official: Real GSettings browser with value editing, GtkSectionModel for grouped display, schema introspection
- GTKX: Mock settings tree with expandable categories and boolean switches

**Missing in GTKX:**
- GSettings integration
- GtkSectionModel + GtkListHeaderFactory
- GtkFlattenListModel for search
- Variant value editing with validation
- Schema path display

---

### listview-ucd.tsx vs listview_ucd.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~487 + unicode-names.h + script-names.h | ~320 |
| Data source | 33,796 items from UCD resource | ~64 chars per block (limited) |
| Widget | GtkColumnView with sections | GtkGridView/ListView toggle |
| Columns | Codepoint, Char, Name, Type, Break Type, Combining Class | Char, codepoint only |
| Section headers | ✅ GtkListHeader by script | ❌ Manual block selection |
| Custom GObject | UcdItem (codepoint, name, script) | Plain object |
| Sorting | GtkNumericSorter + section_sorter | ❌ None |
| Character preview | ✅ Large label (80px font) | Small preview card |
| UCD properties | Type, break type, combining class | ❌ None |

**Different concept:**
- Official: Comprehensive UCD viewer with 33k characters, GtkColumnView sections, multiple Unicode properties, large character preview
- GTKX: Simple block browser with limited characters per block and basic codepoint info

**Missing in GTKX:**
- Full UCD dataset (33,796 characters)
- GtkColumnView with multiple columns
- Section headers (GtkListHeader)
- Unicode type, break type, combining class info
- GtkSortListModel with section sorter
- script-names.h and unicode-names.h data
- Large character preview (80px font)

---

### listview-weather.tsx vs listview_weather.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~326 | ~286 |
| Data source | 70,000 items from METAR CSV resource | 14 random days |
| Orientation | ✅ Horizontal GtkListView | Vertical ListView |
| Custom GObject | GtkWeatherInfo (timestamp, temp, type) | Plain object |
| Selection | GtkNoSelectionModel | React state |
| Data parsing | CSV with cloud/precip codes | Random generation |
| Separators | ✅ show_separators=TRUE | ✅ Same |
| Time range | Hourly data spanning years | 14-day forecast |

**Different concept:**
- Official: Demonstrates horizontal GtkListView with 70,000 items, parsing real METAR weather data, GtkNoSelectionModel
- GTKX: Standard vertical weather forecast with 14 random days and temperature unit toggle

**Missing in GTKX:**
- Horizontal list orientation
- GtkNoSelectionModel
- Large dataset (70k items) handling
- Custom GObject type (GtkWeatherInfo)
- Real METAR data parsing
- Hourly granularity

---

### listview-words.tsx vs listview_words.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~257 | ~340 |
| Data source | `/usr/share/dict/words` file | Inline dictionary array (~26 words) |
| List model | GtkFilterListModel | useMemo filtering |
| Incremental filtering | ✅ gtk_filter_list_model_set_incremental | ❌ None |
| Progress indicator | ✅ Progress bar during filtering | ❌ None |
| File operations | ✅ Open button, GBufferedInputStream async | ❌ None |
| Filter mechanism | GtkStringFilter + GtkPropertyExpression | JavaScript string matching |
| Words count | ~100k+ (system dictionary) | ~26 words |

**Different concept:**
- Official: Demonstrates GtkFilterListModel's incremental filtering on large datasets (100k+ words from system dictionary) with progress indication and async file loading
- GTKX: Simple dictionary browser with part-of-speech filtering on a small inline word list

**Missing in GTKX:**
- GtkFilterListModel with incremental mode
- Progress bar showing filtering progress
- File open dialog for custom word lists
- GtkPropertyExpression for filter binding
- Large dataset handling

---

### listbox.tsx vs listbox.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~397 | ~262 |
| Widget | Custom GtkMessageRow subclass | React component |
| Data | messages.txt resource file | Inline array |
| Layout | GtkBuilder .ui template | JSX |
| Features | Expand, Reply, Reshare, Favorite | Same |
| Sorting | gtk_list_box_set_sort_func | useMemo sort |
| Hover effects | state_flags_changed override | onStateFlagsChanged callback |
| Revealer | ✅ Details expand | ✅ Same |

**Note:** Both implement the same social media message list with expand/favorite/reshare functionality

---

### listbox-controls.tsx vs listbox_controls.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~70 + .ui file | ~251 |
| Architecture | GtkBuilder .ui file | React component |
| Controls | Switch, CheckButton, Image opacity | Switch, CheckButton, Scale |
| Rich list style | .rich-list CSS class | .boxed-list CSS class |
| Row activation | Toggles control on row click | ❌ Separate control interaction |
| Task list | ❌ None | ✅ Task list with delete |

**Similar concept:**
- Both show list rows with interactive controls
- Both use non-selectable mode

**Additional in GTKX:**
- Task list demonstration
- Slider controls
- Multiple sections

---

### listview-selections.tsx vs listview_selections.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~614 | ~397 |
| Selection models | GtkSingleSelection, GtkMultiSelection, GtkNoSelection | Same via React state |
| Architecture | Custom GObject for color items | Plain objects |
| Item rendering | GtkBuilderListItemFactory with .ui | renderItem callback |
| Expressions | GtkPropertyExpression for binding | Direct prop access |
| Focus/selection tracking | GtkEventControllerFocus + selection-changed | onSelectionChanged |
| Drag-and-drop | ❌ None | ❌ None |

**Similar concept:**
- Both demonstrate ListView selection modes
- Both use colored rectangles for items

**Missing in GTKX:**
- Custom GObject for list items
- GtkBuilderListItemFactory
- GtkExpression binding

---

### listview-filebrowser.tsx vs listview_filebrowser.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~283 | ~341 |
| Data source | GtkDirectoryList (GIO) | Mock file data |
| Sorting | GtkSorter with multi-column | Sort button with enum |
| File info | ✅ Real GFileInfo (size, date, type) | Mock data |
| Column view | ✅ GtkColumnView | ❌ ListView |
| Double-click | Navigate into folder | Navigate into folder |
| Icon theme | GtkFileInfo icon | iconName strings |

**Similar concept:**
- Both show file browser interface
- Both support folder navigation

**Missing in GTKX:**
- GtkDirectoryList (real filesystem)
- GtkColumnView with sortable columns
- GFileInfo integration

---

## Media

### video-player.tsx vs video_player.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~201 | ~236 |
| Widget | GtkVideo | Same |
| Controls | GtkMediaControls | Same |
| File dialog | GtkFileDialog with filters | Same |
| File filters | Video, Images, All Files | Same |
| Header bar | GtkHeaderBar with open button | Same |
| Default file | None | None |

**Note:** Nearly identical implementation. Both provide simple video player with file selection.

---

## Navigation

### stack.tsx vs stack.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~37 | ~41 |
| Layout | GtkBuilder .ui file | JSX |
| Pages | 3 pages (Page 1, Page 2, icon) | Same |
| Page content | Image, CheckButton, Spinner | Same |
| Transition | CROSSFADE | Same |
| StackSwitcher | ✅ | ✅ |

**Note:** Same structure, just different approaches (GtkBuilder vs JSX)

---

### sidebar.tsx vs sidebar.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~82 | ~58 |
| Widget | GtkStackSidebar + GtkStack | Same |
| Pages | 9 pages (Welcome, Widget, Navigation...) | 5 pages |
| Transition | SLIDE_UP_DOWN | Same |
| First page | 256px org.gtk.Demo4 icon | Icon image |
| Other pages | GtkLabel with page title | GtkLabel |
| Header bar | ✅ | ❌ None (embedded in demo) |

**Note:** Same concept with fewer pages in GTKX version

---

### revealer.tsx vs revealer.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~102 | ~87 |
| Layout | 3x3 grid of revealers | 2x2 grid |
| Transitions | All 4 directions | All 4 directions |
| Animation | Auto-cycling with timeout | Manual toggle buttons |
| child-revealed | ✅ Signal connection | ❌ None |
| Sequential reveal | ✅ One-by-one timing | Simultaneous |

**Similar concept:**
- Both demonstrate GtkRevealer transitions
- Different UX (auto-cycling vs manual toggle)

**Missing in GTKX:**
- Auto-cycling animation
- Sequential reveal timing
- child-revealed signal handling

---

## OpenGL

### glarea.tsx vs glarea.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~448 | ~274 |
| Triangle | ✅ Colored vertices | ✅ Solid color uniform |
| Rotation | ✅ X/Y/Z axis sliders | ❌ None |
| MVP matrix | ✅ Rotation matrix | ❌ Identity |
| Color control | ❌ | ✅ Cycle buttons |
| Clear color | ✅ Gray | ✅ Configurable |
| Error handling | ✅ | ✅ |
| Shader source | External resource files | Inline ES 3.0 |

**GTKX advantages:**
- Color cycling buttons
- Configurable background

**Missing in GTKX:**
- Rotation controls (X/Y/Z axis sliders)
- MVP matrix transformation
- Per-vertex coloring

---

### gears.tsx vs gears.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~133 + gtkgears.c/h | ~573 |
| Widget | GtkGears (custom GtkGLArea subclass) | GtkGLArea with inline GL code |
| Rendering | Classic 3 interlocking gears | Same 3 gears |
| Rotation | X/Y/Z axis sliders (0-360) | Same |
| Animation | gtk_widget_add_tick_callback | AdwTimedAnimation |
| Gear geometry | Calculated vertices with normals | Same calculations |
| Lighting | GL lighting model | Same |

**Note:** Both implement the classic OpenGL gears demo. GTKX has the GL code inline rather than in separate files.

---

### shadertoy.tsx vs shadertoy.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~202 | ~578 |
| Shader source | File dialog + resource examples | Built-in shader collection |
| Fragment shaders | User-loadable | Seascape, clouds, fractal, plasma |
| Uniforms | iTime, iResolution, iMouse | Same |
| Error handling | Shader compilation errors | ✅ Error display |
| Tick callback | gtk_gl_area_queue_render | AdwTimedAnimation |
| Example shaders | cogs.glsl from resource | Multiple built-in |

**Similar concept:**
- Both render Shadertoy-style fragment shaders
- Both pass time/resolution/mouse uniforms

**Missing in GTKX:**
- File dialog for loading custom shaders
- Resource-based shader examples

**Additional in GTKX:**
- Multiple built-in shader demonstrations
- Shader source code display

---

## Paths

### path-text.tsx vs path_text.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~590 | ~302 |
| Path API | GskPath + GskPathMeasure | Manual bezier calculation |
| Text rendering | Path transformation via GskPathMeasure | Cairo character-by-character placement |
| Path types | Single cubic bezier | Multiple (Bezier, Wave, Circle, Spiral) |
| Control points | Interactive drag-to-edit | Static |
| Background | Frosted glass blur effect | None |
| Text effects | Emboss effect | None |
| Architecture | Custom GtkPathWidget GObject | React functional component |

**Missing in GTKX:**
- GskPath API usage
- GskPathMeasure for accurate path positioning
- Interactive drag-to-edit control points
- Frosted glass blur background effect
- Emboss text effect
- Path transformation (text follows path shape properly)

**Different in GTKX:**
- Uses manual bezier point calculation instead of GskPath
- Multiple path type demonstrations vs single interactive path
- No interactivity (static displays)

---

### path-spinner.tsx vs path_spinner.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~326 | ~394 |
| Architecture | Custom GtkSpinnerPaintable (GdkPaintable) | React component with Cairo |
| Path API | GskPath segments | Cairo arcs |
| Animation | Frame clock tick callback | AdwTimedAnimation |
| Spinner styles | Single style with completion | Multiple styles (arc, gradient, dotted, pulsing, segmented) |
| Completion property | ✅ 0.0-1.0 range | ❌ None |
| Configuration UI | None | Speed, segments, reverse toggles |

**Missing in GTKX:**
- GskPath API usage
- GdkPaintable implementation pattern
- Completion property for progress indication
- Frame clock direct integration

**Additional in GTKX:**
- Multiple spinner style variations
- Configurable UI for speed and segments
- Reverse direction toggle
- Richer visual demonstrations

---

### path-maze.tsx vs path_maze.c
**Status:** ❌ Different

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~370 | ~486 |
| Purpose | Mouse tracking game | Pathfinding visualization |
| Path API | GskPath + gsk_path_get_closest_point | None (Cairo drawing) |
| Architecture | Custom GtkMaze widget | React component |
| Maze generation | Recursive backtracker (GskPathBuilder) | Recursive backtracker (2D array) |
| Gameplay | Follow maze path with mouse, detect leaving | Generate and solve with BFS/A* |
| Animation | None (instant feedback) | Animated exploration/solution |
| Sound | Win/lose sound effects | None |
| Background | Video/gradient fill inside path stroke | Static cell colors |

**Missing in GTKX:**
- GskPath usage
- gsk_path_get_closest_point for collision detection
- Mouse-follow gameplay mechanic
- Sound effects
- Animated background (video stream)

**Different in GTKX:**
- Educational focus (pathfinding algorithms) vs game focus
- BFS/A* visualization vs mouse tracking
- Static display vs interactive follow-the-path

---

### path-explorer.tsx vs path_explorer_demo.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~897 (widget) + ~98 (demo) | ~552 |
| Path API | GskPath + GskPathMeasure + GskPathPoint | Cairo path primitives |
| Architecture | Custom PathExplorer widget (GObject) | React component |
| Path editing | Text entry → gsk_path_parse | Interactive drag handles |
| Features | Tangent vectors, curvature circle, closest point | Segment add/remove, stroke options |
| Stroke options | Line width, cap, join, miter, dashes | Line width, cap, join, dashes |
| Fill options | Color, fill rule | Color, fill rule |
| Show bounds | ✅ | ❌ |
| Show points | ✅ Path operation points | ✅ Control handles only |
| Segment range | Start/end slider (0-1) | ❌ |
| Curvature display | Circle at center of curvature | ❌ |

**Missing in GTKX:**
- GskPath API usage
- GskPathMeasure for path segmentation
- Tangent vector visualization
- Curvature circle display
- Closest point detection
- Path bounds display
- Path text serialization (gsk_path_to_string)

**Additional in GTKX:**
- Interactive drag-to-edit control points
- Add/remove segment UI
- Segment type selection (line, quadratic, cubic)

---

### path-fill.tsx vs path_fill.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~358 | ~388 |
| Path API | GskPath (gsk_path_parse) | Cairo paths |
| GTK Logo | ✅ SVG path strings | ✅ Cairo relLineTo |
| GdkPaintable | Custom GtkLogoPaintable | None |
| Print support | GtkPrintDialog + cairo-pdf | GtkFileDialog + PdfSurface |
| Context menu | GtkPopoverBin | None |
| Fill demonstrations | Logo only | Solid, linear gradient, radial gradient |
| Fill rules | ❌ | ✅ Even-odd vs winding demos |

**Missing in GTKX:**
- GskPath API usage
- GdkPaintable implementation
- GtkPopoverBin context menu
- GtkPrintDialog integration

**Additional in GTKX:**
- Multiple fill type demonstrations (solid, gradients)
- Fill rule comparison (even-odd vs winding)
- Hexagon with gradient example
- Direct PDF export via Cairo

---

### path-walk.tsx vs path_walk.c
**Status:** ⚠️ Partial

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~374 | ~381 |
| Path API | GskPath + GskPathMeasure | Manual bezier calculation |
| Path data | World map SVG (211 lines, 1569 curves) | 3 cubic bezier segments |
| Architecture | Custom GtkPathWalk widget | React component |
| Animation | Frame clock tick callback | Tick callback via React |
| Arrow count | Configurable (n-points property) | Configurable (UI) |
| Arrow shape | GskPath for arrow | Cairo path |
| Color | HSL rainbow per arrow | Orange with depth fade |
| Rotation | gsk_path_point_get_rotation | Manual atan2(dy, dx) |

**Missing in GTKX:**
- GskPath API usage
- GskPathMeasure for arc-length parameterization
- World map path (complex demonstration)
- GskPathPoint for position/rotation

**Different in GTKX:**
- Custom bezier path vs world map
- Manual arc-length table vs GskPathMeasure
- Speed/spacing UI controls

---

### path-sweep.tsx vs path_sweep.c
**Status:** ✅ Match

| Aspect | Official | GTKX |
|--------|----------|------|
| Lines | ~320 | ~338 |
| Path API | GskPath + gsk_path_foreach_intersection | Gsk.Path + foreachIntersection |
| Path data | World map from resources | World map from file import |
| Sweep line | Horizontal at mouse Y | Horizontal at mouse Y |
| Intersection display | Red circles at intersection points | Red circles at intersection points |
| Mouse tracking | GtkEventControllerMotion | onMotion/onEnter/onLeave props |
| Architecture | Custom GtkPathSweep widget | React component |

**GTKX matches official implementation:**
- Uses actual GskPath API
- gsk_path_foreach_intersection for finding intersections
- GskPathPoint.getPosition for coordinates
- Same world map data
- Same visual presentation

---

## Summary Statistics

| Category | Total | ✅ Match | ⚠️ Partial | ❌ Different | 🔄 Pending |
|----------|-------|----------|------------|--------------|------------|
| Advanced | 6 | 0 | 3 | 3 | 0 |
| Benchmark | 3 | 1 | 1 | 1 | 0 |
| Buttons | 4 | 3 | 1 | 0 | 0 |
| Constraints | 3 | 2 | 0 | 1 | 0 |
| CSS | 8 | 1 | 4 | 3 | 0 |
| Dialogs | 4 | 1 | 2 | 1 | 0 |
| Drawing | 12 | 1 | 5 | 6 | 0 |
| Games | 3 | 0 | 2 | 1 | 0 |
| Gestures | 7 | 0 | 6 | 1 | 0 |
| Input | 10 | 5 | 4 | 1 | 0 |
| Layout | 11 | 10 | 1 | 0 | 0 |
| Lists | 12 | 1 | 3 | 8 | 0 |
| Media | 1 | 1 | 0 | 0 | 0 |
| Navigation | 3 | 2 | 1 | 0 | 0 |
| OpenGL | 3 | 1 | 2 | 0 | 0 |
| Paths | 7 | 1 | 4 | 2 | 0 |
| **Total** | **97** | **31** | **38** | **28** | **0** |
