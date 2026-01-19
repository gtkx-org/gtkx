# GTK Demo Comparison Findings

This document records the differences found between gtkx demos and official GTK4 demos.

## How to Read This Document

Each demo has its own section with:
- **Status**: Current comparison status
- **Files Compared**: The source files being compared
- **Differences Found**: List of differences with their severity
- **Required Changes**: What needs to be changed in gtkx

## Severity Legend
- 🔴 **Critical**: Missing core functionality or major visual differences
- 🟠 **Major**: Noticeable behavioral or visual differences
- 🟡 **Minor**: Small differences in behavior or appearance
- 🟢 **Trivial**: Cosmetic or negligible differences

---

## Advanced

### font-features.tsx
**Status**: ✅ FIXED (January 2026)
**Files Compared**: font-features.tsx ↔ font_features.c (+ font_features.ui)

**Previous Differences (All Resolved)**:
- ~~🔴 **Critical**: Official demo uses GtkFontDialogButton for font selection~~ ✅ Added x.FontDialogButton
- ~~🔴 **Critical**: Official demo dynamically reads OpenType features using HarfBuzz~~ ✅ Implemented HarfBuzz feature discovery
- ~~🔴 **Critical**: Official demo supports variable fonts with axis sliders~~ ✅ Added variable font axes with sliders
- ~~🔴 **Critical**: Official demo has script/language system dropdown~~ ✅ Added script/language selection
- ~~🔴 **Critical**: Official demo has waterfall view mode~~ ✅ Implemented waterfall view (7-90pt)
- ~~🔴 **Critical**: Official demo has size/letterspacing/line-height controls~~ ✅ Added appearance controls
- ~~🔴 **Critical**: Official demo has foreground/background color pickers~~ ✅ Added x.ColorDialogButton
- ~~🔴 **Critical**: Official demo has editable preview text~~ ✅ Added editable preview
- ~~🟠 **Major**: Demo title~~ ✅ Updated to "Pango/Font Explorer"

**Implementation Summary**:
Complete rewrite from ~200 lines to ~900+ lines with full GTK4 feature parity:
- Phase 0: Created x.FontDialogButton and x.ColorDialogButton reconciler nodes
- Phase 1: Core font selection with editable preview
- Phase 2: Dynamic OpenType feature discovery via HarfBuzz otLayoutTableGetFeatureTags()
- Phase 3: Variable font support with axis sliders via otVarGetAxisInfos()
- Phase 4: Appearance controls (colors, letter spacing, line height)
- Phase 5: Waterfall view mode with 17 font sizes
- Phase 6: Script/language selection via otLayoutTableGetScriptTags()

**Infrastructure Changes**:
- Added `packages/react/src/nodes/font-dialog-button.ts` - new reconciler node
- Added `packages/react/src/nodes/color-dialog-button.ts` - new reconciler node
- Updated GIR parser to whitelist Pango namespace for non-introspectable methods (getHbFont)

**Required Changes**: None - demo now matches official GTK4 Font Explorer.

### fontrendering.tsx
**Status**: ✅ Complete
**Files Compared**: fontrendering.tsx ↔ fontrendering.c (+ fontrendering.ui)

**Previous Differences (All Resolved)**:
- ~~🔴 **Critical**: Missing glyph-level inspection views~~ ✅ Feature matches official demo
- ~~🟠 **Major**: Missing show/hide options for pixels, outlines, extents, and grid~~ ✅ All overlay options implemented
- ~~🟡 **Minor**: Official uses single font description field~~ ✅ Uses GtkFontDialogButton
- ~~🟡 **Minor**: Official uses GtkBuilder for UI~~ ✅ Acceptable difference - declarative TSX

**Required Changes**: None - demo now matches official GTK4 fontrendering demo.

### markup.tsx
**Status**: Reviewed
**Files Compared**: markup.tsx ↔ markup.c (+ markup.txt)

**Differences Found**:
- 🟠 **Major**: Official demo allows editing source markup and re-rendering - gtkx only shows read-only views
- 🟡 **Minor**: Official demo uses checkbox in header bar to toggle views - gtkx uses stack switcher
- 🟡 **Minor**: Official demo loads markup from resource file (markup.txt) - gtkx uses inline constant
- 🟢 **Trivial**: Window titles and styling differ slightly

**Required Changes**: Add editable source view that re-renders on toggle. Load markup from external file.

### rotated-text.tsx
**Status**: ✅ FIXED (January 2026)
**Files Compared**: rotated-text.tsx ↔ rotated_text.c

**Previous Differences (All Resolved)**:
- ~~🔴 **Critical**: Shape renderer used hardcoded scaling~~ ✅ Now uses attr.inkRect dimensions
- ~~🔴 **Critical**: Hearts not properly sized relative to font~~ ✅ Scales using Pango.SCALE
- ~~🔴 **Critical**: Missing two-pane layout~~ ✅ DrawingArea + GtkLabel with hearts
- ~~🔴 **Critical**: Wrong gradient colors~~ ✅ Uses red-blue gradient matching official
- ~~🟠 **Major**: Wrong text count~~ ✅ Uses N_WORDS=5 copies of "I ♥ GTK"

**Implementation Summary**:
- Added manual Pango.AttrShape extension (`packages/ffi/src/pango/pango.ts`) with `inkRect` and `logicalRect` getters
- Uses module augmentation pattern (same as Cairo extensions)
- Shape renderer now uses `attr.inkRect.width / Pango.SCALE` for proper scaling
- Two-pane layout: DrawingArea (5 rotated texts in circle) + GtkLabel (with heart)

**Infrastructure Changes**:
- Created `packages/ffi/src/pango/pango.ts` - AttrShape field accessors via pointer arithmetic
- Created `packages/ffi/src/pango/index.ts` - re-exports generated types + imports extension
- Updated `packages/ffi/src/index.ts` - imports pango extension

**Required Changes**: None - demo now matches official GTK4 rotated_text demo.

### textmask.tsx
**Status**: Reviewed
**Files Compared**: textmask.tsx ↔ textmask.c

**Differences Found**:
- 🟠 **Major**: Official shows static "Pango power!" with simple rainbow gradient. gtkx has animated gradient movement, multiple presets, editable text.
- 🟡 **Minor**: Official is minimal; gtkx is more interactive and feature-rich.
- 🟢 **Trivial**: Different visual presentation.

**Required Changes**: None required - gtkx is a superset with additional interactive features.

### transparent.tsx
**Status**: ✅ FIXED (January 2026)
**Files Compared**: transparent.tsx ↔ transparent.c (+ transparent.css)

**Previous Differences (All Resolved)**:
- ~~🔴 **Critical**: Missing backdrop-filter: blur() CSS property~~ ✅ Added via injectGlobal CSS
- ~~🟠 **Major**: Overly elaborate demo vs official's minimal design~~ ✅ Rewritten to match official
- ~~🟡 **Minor**: Missing portland-rose.jpg background image~~ ✅ Copied from GTK repo
- ~~🟡 **Minor**: Different structure and CSS approach~~ ✅ Now uses CSS classes

**Implementation Summary**:
Complete rewrite from ~390 lines to ~65 lines matching official GTK4 demo:
- Background: GtkPicture with portland-rose.jpg (Gdk.Texture.newFromFilename)
- Layout: GtkOverlay with image as main child, floating button box at bottom
- Blur: `.blur-overlay { backdrop-filter: blur(14px); }` CSS class
- Hover transition: Changes background-color with 1s transition while maintaining blur
- Graceful degradation: Works without blur on GTK < 4.21 (property silently ignored)

**Note**: `backdrop-filter: blur()` was added to GTK on November 20, 2025 (commit a476d94d43) and requires GTK 4.21+.

**Required Changes**: None - demo now matches official GTK4 transparent demo.

---

## Benchmark

### frames.tsx
**Status**: Reviewed
**Files Compared**: frames.tsx ↔ frames.c (+ frames.ui)

**Differences Found**:
- 🟠 **Major**: Animation timing uses Date.now() instead of GTK frame clock (gdk_frame_clock_get_frame_time).
- 🟠 **Major**: FPS measurement uses JavaScript setInterval instead of gdk_frame_clock_get_fps().
- 🟡 **Minor**: Different initial state - official opens immediately, gtkx requires button click.

**Required Changes**: Use GTK frame clock callbacks for timing and FPS measurement.

### themes.tsx
**Status**: Reviewed
**Files Compared**: themes.tsx ↔ themes.c (+ themes.ui)

**Differences Found**:
- 🟠 **Major**: Uses AdwStyleManager instead of GtkSettings theme API. Different theme management systems.
- 🟠 **Major**: Different theme sequence (color schemes vs. specific theme names).
- 🟠 **Major**: Missing visual demonstration content (button samples showing theme effects).
- 🟡 **Minor**: Missing warning dialog confirmation before starting benchmark.

**Required Changes**: Add visual demonstration content, implement warning dialog, consider using GtkSettings API.

---

## Buttons

### expander.tsx
**Status**: Reviewed
**Files Compared**: expander.tsx ↔ expander.c

**Differences Found**:
- 🟡 **Minor**: Animation behavior uses useEffect with manual state management vs signal-based triggers.
- 🟢 **Trivial**: Code organization differs but visual outcome matches.

**Required Changes**: None - functionality matches.

### scale.tsx
**Status**: Reviewed
**Files Compared**: scale.tsx ↔ scale.c (+ scale.ui)

**Differences Found**:
- 🟢 **Trivial**: Official uses GtkBuilder XML, gtkx uses declarative TSX. Identical visual appearance.
- 🟢 **Trivial**: Both show three scale variations (plain, with marks, discrete).

**Required Changes**: None - functionally equivalent.

### spinbutton.tsx
**Status**: Reviewed
**Files Compared**: spinbutton.tsx ↔ spinbutton.c (+ spinbutton.ui)

**Differences Found**:
- 🟠 **Major**: Missing bidirectional input validation callbacks (hex, time, month parsing with GTK_INPUT_ERROR handling).
- 🟡 **Minor**: Text property set directly from formatters vs. signal-based output callbacks.
- 🟡 **Minor**: Missing input validation for edge cases.

**Required Changes**: Add input validation callbacks for hex, time, and month spinbuttons.

### spinner.tsx
**Status**: Reviewed
**Files Compared**: spinner.tsx ↔ spinner.c

**Differences Found**:
- 🟢 **Trivial**: Essentially identical - both show sensitive and insensitive spinners with Play/Stop buttons
- 🟢 **Trivial**: Both start spinning automatically

**Required Changes**: None - this demo matches well.

---

## Constraints

### constraints.tsx
**Status**: Reviewed
**Files Compared**: constraints.tsx ↔ constraints.c

**Differences Found**:
- 🟢 **Trivial**: Code organization differs (TSX with refs vs GtkBuilder). Constraint logic identical.
- 🟢 **Trivial**: Both create three buttons with identical spacing and constraints.

**Required Changes**: None - layout and behavior match.

### constraints-interactive.tsx
**Status**: Reviewed
**Files Compared**: constraints-interactive.tsx ↔ constraints_interactive.c

**Differences Found**:
- 🟢 **Trivial**: Drag interaction implementation differs but behavior is identical.
- 🟢 **Trivial**: Both support dragging the vertical divider.

**Required Changes**: None - functionality matches.

### constraints-vfl.tsx
**Status**: Reviewed
**Files Compared**: constraints-vfl.tsx ↔ constraints_vfl.c

**Differences Found**:
- 🟠 **Major**: gtkx extends with live VFL editor - official only shows hardcoded VFL strings.
- 🟡 **Minor**: gtkx adds educational UI (VFL syntax reference panel).
- 🟢 **Trivial**: Core VFL parsing behavior identical.

**Required Changes**: If exact fidelity required, remove live editor and use hardcoded VFL.

---

## CSS

### css-accordion.tsx
**Status**: Reviewed
**Files Compared**: css-accordion.tsx ↔ css_accordion.c (+ css_accordion.css)

**Differences Found**:
- 🟠 **Major**: Different approach - gtkx uses GtkExpander/GtkRevealer, official uses CSS-only button transitions.
- 🟠 **Major**: Official is CSS-focused with complex gradient patterns; gtkx adds React state management.
- 🟡 **Minor**: gtkx uses @keyframes while official uses pure CSS selector animations.

**Required Changes**: Align button styling with original brick/pattern backgrounds if aiming for exact parity.

### css-basics.tsx
**Status**: Reviewed
**Files Compared**: css-basics.tsx ↔ css_basics.c (+ css_basics.css)

**Differences Found**:
- 🟢 **Trivial**: Implementations are functionally identical.
- 🟢 **Trivial**: Minor error handling differences (try/catch vs signal handlers).

**Required Changes**: None - implementation matches.

### css-blendmodes.tsx
**Status**: Reviewed
**Files Compared**: css-blendmodes.tsx ↔ css_blendmodes.c (+ css_blendmodes.css + blendmodes.ui)

**Differences Found**:
- 🟠 **Major**: gtkx uses reactive button grid; official uses GtkBuilder + GtkListBox popup.
- 🟠 **Major**: gtkx shows all blend modes in grid; official uses ListBox row activation.
- 🟡 **Minor**: Missing visual demo display - gtkx doesn't actually render blend modes.

**Required Changes**: Actually apply blend modes visually to demonstrate the effect.

### css-multiplebgs.tsx
**Status**: Reviewed
**Files Compared**: css-multiplebgs.tsx ↔ css_multiplebgs.c (+ css_multiplebgs.css)

**Differences Found**:
- 🟡 **Minor**: Layout approach differs (GtkPaned vs overlay with fixed position).
- 🟡 **Minor**: gtkx has hardcoded presets; official loads from resource CSS files.
- 🟢 **Trivial**: Live editing functionality identical.

**Required Changes**: Consider matching resource-based CSS approach.

### css-pixbufs.tsx
**Status**: Reviewed
**Files Compared**: css-pixbufs.tsx ↔ css_pixbufs.c (+ css_pixbufs.css)

**Differences Found**:
- 🟡 **Minor**: Demo title misleading - implements "Animated Backgrounds" not pixbuf-specific.
- 🟡 **Minor**: gtkx uses @keyframes; official references gtk.css from resources.
- 🟢 **Trivial**: Preset selection and live editing functionally equivalent.

**Required Changes**: The demo title is misleading. Original focuses on pixbufs.

### css-shadows.tsx
**Status**: Reviewed
**Files Compared**: css-shadows.tsx ↔ css_shadows.c (+ css_shadows.css)

**Differences Found**:
- 🟡 **Minor**: gtkx uses inline button creation; official uses create_toolbar function.
- 🟡 **Minor**: gtkx shows 3 buttons in horizontal box; official creates toolbar with icons.
- 🟢 **Trivial**: Live CSS editing and shadow application identical.

**Required Changes**: Minor UI presentation difference. Consider aligning toolbar style.

### errorstates.tsx
**Status**: Reviewed
**Files Compared**: errorstates.tsx ↔ errorstates.c (+ errorstates.ui)

**Differences Found**:
- 🟠 **Major**: gtkx implements comprehensive form validation with React state; official uses GtkBuilder with minimal callbacks.
- 🟠 **Major**: gtkx validates email/password/age/terms; official focuses on simpler entry validation.
- 🟡 **Minor**: gtkx uses error CSS classes + label; official uses tooltips and accessibility.
- 🟡 **Minor**: gtkx includes shake animation; official uses static error styling.

**Required Changes**: gtkx adds enhancements. Simplify to match if exact match required.

### theming-style-classes.tsx
**Status**: Reviewed
**Files Compared**: theming-style-classes.tsx ↔ theming_style_classes.c

**Differences Found**:
- 🟠 **Major**: gtkx demonstrates extensive CSS class system (40+ classes); official uses GtkBuilder with minimal UI.
- 🟠 **Major**: gtkx has category filtering, live previews; official shows static layout.
- 🟡 **Minor**: Official loads from resource file; gtkx hard-codes UI.

**Required Changes**: gtkx provides more comprehensive coverage. No changes needed unless aiming for minimal version.

---

## Dialogs

### dialog.tsx
**Status**: ✅ FIXED (January 2026)
**Files Compared**: dialog.tsx ↔ dialog.c

**Previous Differences (All Resolved)**:
- ~~🟠 **Major**: Official uses deprecated GtkMessageDialog~~ ✅ Uses modern AdwAlertDialog
- ~~🔴 **Critical**: Missing Interactive Dialog with form fields~~ ✅ Implemented with declarative x.Slot
- ~~🟠 **Major**: Official has counter with ngettext~~ ✅ Message dialog now shows click count
- ~~🟡 **Minor**: gtkx has more dialog variants~~ ✅ Simplified to match official layout

**Implementation Summary**:
- Fully declarative React pattern - dialogs rendered via conditional JSX
- Message Dialog: `<AdwAlertDialog>` with `heading`, `body`, and `<x.AlertDialogResponse>` children
- Interactive Dialog: Uses `<x.Slot for="AdwAlertDialog" id="extraChild">` for custom GtkGrid content
- DialogNode auto-presents on mount, auto-closes on unmount
- Bidirectional data flow: Entry values pre-populate from parent state, refs read values on OK
- Layout matches official: Button + Separator + Button with entry fields

**Required Changes**: None - demo now matches official GTK4 dialog demo.

### pagesetup.tsx
**Status**: Reviewed
**Files Compared**: pagesetup.tsx ↔ pagesetup.c

**Differences Found**:
- 🟠 **Major**: gtkx uses GtkPrintDialog.setupAsync() (modern GTK4 API) vs GtkPageSetupUnixDialog (older platform-specific). This is actually an improvement.
- 🟡 **Minor**: gtkx provides extensive preview rendering with margin visualization; official simply shows/hides dialog.
- 🟢 **Trivial**: Different educational content presentation.

**Required Changes**: None critical - uses modern GTK4 APIs correctly.

### pickers.tsx
**Status**: Reviewed
**Files Compared**: pickers.tsx ↔ pickers.c

**Differences Found**:
- 🟡 **Minor**: Missing drag-and-drop target for files (no GtkDropTarget equivalent).
- 🟡 **Minor**: Missing PDF file detection logic for conditional print button enabling.
- 🟡 **Minor**: Different layout approach (GtkBox vs GtkGrid).
- 🟢 **Trivial**: URI launcher uses editable field vs hardcoded URL.

**Required Changes**: Consider adding drag-and-drop support. Add PDF detection for print button.

### printing.tsx
**Status**: Reviewed
**Files Compared**: printing.tsx ↔ printing.c

**Differences Found**:
- 🟠 **Major**: Official loads source code from resource file (/sources/printing.c); gtkx uses hardcoded sample text.
- 🟡 **Minor**: Official uses fixed font size (12pt); gtkx provides font size controls (8-72px).
- 🟡 **Minor**: Official creates layouts dynamically within print callbacks; gtkx pre-renders preview pages.
- 🟢 **Trivial**: Different header rendering format.

**Required Changes**: Consider whether hardcoded demo text is appropriate or should pull from actual source files.

---

## Drawing

### drawingarea.tsx
**Status**: Reviewed
**Files Compared**: drawingarea.tsx ↔ drawingarea.c

**Differences Found**:
- 🟡 **Minor**: Scribble implementation uses React state arrays vs cairo_image_surface. Functionally equivalent.
- 🟢 **Trivial**: Minor context management differences.

**Required Changes**: None - implementation is correct.

### image-scaling.tsx
**Status**: Reviewed
**Files Compared**: image-scaling.tsx ↔ image_scaling.c

**Differences Found**:
- 🟡 **Minor**: Official demo doesn't exist in GTK. This is a gtkx-specific enhancement.

**Required Changes**: None - gtkx enhancement.

### images.tsx
**Status**: Reviewed
**Files Compared**: images.tsx ↔ images.c

**Differences Found**:
- 🟠 **Major**: Missing SVG with state management, GtkVideo with looping, GtkWidgetPaintable, animation from resource.
- gtkx only shows symbolic icons and basic image display.

**Required Changes**: Add SVG, video playback, and GtkWidgetPaintable examples.

### mask.tsx
**Status**: Reviewed
**Files Compared**: mask.tsx ↔ mask.c

**Differences Found**:
- 🟢 **Trivial**: Implementation matches - uses Cairo textPath with clip masking.

**Required Changes**: None.

### paint.tsx
**Status**: Reviewed
**Files Compared**: paint.tsx ↔ paint.c

**Differences Found**:
- 🟠 **Major**: Missing GtkPadController for drawing tablet pad support.
- 🟠 **Major**: Missing eraser tool, stylus tool detection, complex pressure handling.
- gtkx supports basic stylus events but lacks advanced tablet features.

**Required Changes**: Implement GtkPadController and enhance stylus tool detection.

### paintable.tsx
**Status**: Reviewed
**Files Compared**: paintable.tsx ↔ paintable.c

**Differences Found**:
- 🟡 **Minor**: Official shows custom "Nuclear Icon" paintable with GSK path building. gtkx demonstrates GdkMemoryTexture.
- 🟢 **Trivial**: gtkx has better UI and explanations.

**Required Changes**: None required, but could add custom GdkPaintable example.

### paintable-animated.tsx
**Status**: Reviewed
**Files Compared**: paintable-animated.tsx ↔ paintable_animated.c

**Differences Found**:
- 🟡 **Minor**: gtkx uses frame-clock callbacks (better) vs official's timeout-based animation.
- 🟢 **Trivial**: gtkx includes extra animations (plasma, wave, spiral).

**Required Changes**: None - gtkx is actually improved.

### paintable-svg.tsx
**Status**: Reviewed
**Files Compared**: paintable-svg.tsx ↔ paintable_svg.c

**Differences Found**:
- 🟡 **Minor**: Official uses GtkSvg objects with state/animation. gtkx generates SVG strings programmatically.

**Required Changes**: Add GtkSvg objects and state-based animations.

---

## Games

### listview-minesweeper.tsx
**Status**: ✅ FIXED (January 2026)
**Files Compared**: listview-minesweeper.tsx ↔ listview_minesweeper.c

**Previous Differences (All Resolved)**:
- ~~🔴 **Critical**: gtkx implements flood-fill reveal~~ ✅ Removed - now reveals only clicked cell
- ~~🟡 **Minor**: Board size differs (10x10 with 15 mines)~~ ✅ Changed to 8×8 with 10 mines
- ~~🟡 **Minor**: UI presentation differs~~ ✅ Simplified to match official layout
- ~~🟡 **Minor**: Cell display labels differ~~ ✅ Changed to "?" for unrevealed, "💣" for mines

**Implementation Summary**:
- Removed flood-fill algorithm from `revealCell` - now reveals only the clicked cell
- Changed grid from 10×10 to 8×8, mines from 15 to 10
- Updated cell display: "?" for hidden cells, "💣" for mines (was "" and "X")
- Simplified UI: removed status panel, instructions, implementation notes
- Added trophy icon display on win
- Kept sound effects (victory/explosion via useSound hook)
- Switched from GtkButton to GtkLabel for cells (matches official)

**Required Changes**: None - demo now matches official GTK4 Minesweeper demo.

### peg-solitaire.tsx
**Status**: Reviewed
**Files Compared**: peg-solitaire.tsx ↔ peg_solitaire.c

**Differences Found**:
- 🔴 **Critical**: Official uses drag-and-drop to move pegs. gtkx uses click-to-select and click-to-move.
- 🟡 **Major**: Official uses custom painted brown pegs (GdkPaintable). gtkx uses styled buttons.
- 🟡 **Major**: Cell appearance differs (32x32 paintable vs 40x40 buttons).

**Required Changes**: Reimplement using drag-and-drop with drag source/drop target controllers.

### sliding-puzzle.tsx
**Status**: Reviewed
**Files Compared**: sliding-puzzle.tsx ↔ sliding_puzzle.c

**Differences Found**:
- 🟡 **Major**: Official supports clicking any tile in row/column to slide multiple tiles. gtkx only allows adjacent clicks.
- 🟡 **Major**: Missing keyboard shortcuts (arrow keys).
- 🟢 **Trivial**: Official has customizable grid size and image selection. gtkx uses fixed 4x4 with numbers.

**Required Changes**: Extend click handling for multi-tile sliding. Add keyboard event handling.

---

## Gestures

### clipboard.tsx
**Status**: Reviewed
**Files Compared**: clipboard.tsx ↔ clipboard.c (+ clipboard.ui)

**Differences Found**:
- 🟡 **Minor**: Different architectural approach. Official uses GtkStack with dropdown; gtkx uses GtkFrame-based sections.
- 🟡 **Minor**: gtkx includes additional sections (Clipboard Status, Built-in Widget Support) not in official.
- 🟡 **Minor**: Missing file/folder selection dialogs with GtkFileDialog.
- 🟢 **Trivial**: Different state management (React hooks vs GTK callbacks).

**Required Changes**: Consider implementing file/folder selection support using GTK file dialogs.

### cursors.tsx
**Status**: Reviewed
**Files Compared**: cursors.tsx ↔ cursors.c (+ cursors.ui)

**Differences Found**:
- 🟠 **Major**: Missing custom cursor creation from callback. Official demonstrates gdk_cursor_new_from_callback() with PNG resource.
- 🟡 **Minor**: gtkx shows cursor names with descriptions (better UX) vs static list from .ui file.
- 🟡 **Minor**: gtkx includes Cursor Preview Area with interactive buttons.

**Required Changes**: Add support for custom cursors via gdk_cursor_new_from_callback().

### dnd.tsx
**Status**: Reviewed
**Files Compared**: dnd.tsx ↔ dnd.c (+ dnd.css)

**Differences Found**:
- 🔴 **Critical**: Missing GtkGestureRotate support for two-finger rotation on canvas items.
- 🔴 **Critical**: Missing right-click context menu for creating/editing/deleting items.
- 🔴 **Critical**: Missing item editing interface (text input, rotation angle).
- 🟠 **Major**: Fundamentally different scope. Official has comprehensive canvas system; gtkx is simplified GtkFixed-based.
- 🟠 **Major**: Missing visual feedback during drag operations (opacity, icon state).

**Required Changes**: Implement GtkGestureRotate, context menus, item editing interface, and visual drag feedback.

### gestures.tsx
**Status**: Reviewed
**Files Compared**: gestures.tsx ↔ gestures.c

**Differences Found**:
- 🔴 **Critical**: Official is minimal - single drawing area with visual feedback. gtkx has elaborate UI with separate sections.
- 🟠 **Major**: Official draws swipe as red line, long press as green circle, zoom/rotate as gradient rectangle. gtkx uses text labels.
- 🟠 **Major**: Official has 3-finger touchpad swipe - gtkx doesn't.
- 🟡 **Minor**: gtkx is more educational but visually different.

**Required Changes**: Simplify to single drawing area with visual feedback.

### links.tsx
**Status**: Reviewed
**Files Compared**: links.tsx ↔ links.c

**Differences Found**:
- 🟡 **Minor**: Different UI organization. Official uses simple window with one label; gtkx uses GtkFrame-based sections.
- 🟡 **Minor**: gtkx includes additional features (click counter, visited state control, use cases section).
- 🟡 **Minor**: Different custom URI handling (keynav vs app:// scheme).
- 🟢 **Trivial**: Both implement same functionality with different presentation.

**Required Changes**: Functionally complete. Ensure onActivateLink returns proper boolean values.

### shortcuts.tsx
**Status**: Reviewed
**Files Compared**: shortcuts.tsx ↔ shortcuts.c

**Differences Found**:
- 🟠 **Major**: Scope mismatch. Official uses GtkShortcutsWindow from .ui resources; gtkx uses AdwShortcutsDialog (Adwaita 5+).
- 🟡 **Minor**: gtkx uses modern AdwShortcutsDialog vs deprecated GtkShortcutsWindow.
- 🟡 **Minor**: gtkx includes additional sections (Menu with Accelerators, Button Mnemonics).
- 🟡 **Minor**: Different data structures (JavaScript arrays vs .ui resources).

**Required Changes**: Consider using GtkShortcutsWindow for GTK4 baseline compatibility.

### shortcut-triggers.tsx
**Status**: Reviewed
**Files Compared**: shortcut-triggers.tsx ↔ shortcut_triggers.c

**Differences Found**:
- 🟡 **Minor**: Drastically different complexity. Official is minimal (96 lines, 2 shortcuts); gtkx is comprehensive (308 lines).
- 🟢 **Trivial**: gtkx demonstrates multiple trigger types, menu accelerators, interactive testing, documentation.
- 🟢 **Trivial**: Both implement core functionality correctly.

**Required Changes**: None critical - gtkx is a superset of GTK functionality.

---

## Input

### entry-undo.tsx
**Status**: Reviewed
**Files Compared**: entry-undo.tsx ↔ entry_undo.c

**Differences Found**:
- 🟢 **Trivial**: Label uses plain text instead of markup.
- 🟡 **Minor**: Missing accessibility relation between entry and label.
- 🟡 **Minor**: Missing window properties (title, resizable, display).

**Required Changes**: Add accessibility label-entry relation and window properties.

### hypertext.tsx
**Status**: Reviewed
**Files Compared**: hypertext.tsx ↔ hypertext.c

**Differences Found**:
- 🔴 **Critical**: Missing comprehensive page navigation system. Official has 3 pages; gtkx has partial content.
- 🔴 **Critical**: Missing embedded widget functionality (GtkLevelBar, custom labels).
- 🟠 **Major**: Missing Tab/Shift+Tab keyboard navigation for links.
- 🟠 **Major**: Missing pronunciation/accessibility features (espeak-ng integration).

**Required Changes**: Expand page content, add Tab navigation, add pronunciation icons, set window properties.

### password-entry.tsx
**Status**: Reviewed
**Files Compared**: password-entry.tsx ↔ password_entry.c

**Differences Found**:
- 🟠 **Major**: Missing header bar with title button management.
- 🟠 **Major**: Button placement differs - gtkx at bottom, official in header bar.
- 🟡 **Minor**: Missing accessibility labels for password fields.

**Required Changes**: Use header bar for button placement, add window title and accessibility labels.

### search-entry.tsx
**Status**: Reviewed
**Files Compared**: search-entry.tsx ↔ search_entry.c

**Differences Found**:
- 🟠 **Major**: Search bar icon placement differs - official uses header bar, gtkx uses top margin box.
- 🟡 **Minor**: Missing search-changed visual update callback.
- 🟡 **Minor**: Window properties incomplete.

**Required Changes**: Integrate toggle button into header bar.

### tabs.tsx
**Status**: Reviewed
**Files Compared**: tabs.tsx ↔ tabs.c

**Differences Found**:
- 🟢 **Trivial**: No functional differences. Pango.TabArray with proper alignment.
- 🟡 **Minor**: Window properties not set (title, size, resizable).

**Required Changes**: Add window properties.

### textscroll.tsx
**Status**: Reviewed
**Files Compared**: textscroll.tsx ↔ textscroll.c

**Differences Found**:
- 🟢 **Trivial**: No functional differences. Text mark gravity and scrolling correct.
- 🟡 **Minor**: Window properties not set.

**Required Changes**: Add window properties.

### textundo.tsx
**Status**: Reviewed
**Files Compared**: textundo.tsx ↔ textundo.c

**Differences Found**:
- 🟢 **Trivial**: No functional differences. Undo enabled, initial text irreversible.
- 🟡 **Minor**: Window properties incomplete.

**Required Changes**: Add window properties.

### textview.tsx
**Status**: Reviewed
**Files Compared**: textview.tsx ↔ textview.c

**Differences Found**:
- 🟠 **Major**: Missing comprehensive text formatting features. Official has 20+ tags; gtkx has 5.
- 🟠 **Major**: Missing images/paintables (icon paintables, nuclear animation).
- 🟠 **Major**: Missing advanced spacing/layout tags.
- 🟠 **Major**: Missing internationalization (German, Greek, Hebrew, Japanese, Arabic).
- 🟡 **Minor**: Missing RTL text, editing constraints, widget embedding.

**Required Changes**: Expand significantly with all formatting features, images, and i18n samples.

---

## Layout

### aspect-frame.tsx
**Status**: Reviewed
**Files Compared**: aspect-frame.tsx ↔ aspect_frame.c (+ aspect_frame.css)

**Differences Found**:
- 🔴 **Critical**: Missing GtkPicture widget. Official uses `gtk_picture_new_for_resource()` with ducky.png; gtkx uses GtkImage with icon name.
- 🟠 **Major**: Missing CSS theme loading from resource.
- 🟡 **Minor**: Scale spacing configuration differs slightly.

**Required Changes**: Consider implementing GtkPicture widget or ensure current approach renders equivalently.

### fixed.tsx
**Status**: Reviewed
**Files Compared**: fixed.tsx ↔ fixed.c (+ fixed.css)

**Differences Found**:
- 🟢 **Trivial**: CSS inline style format differs but both achieve identical visual results.
- 🟢 **Trivial**: Transform API structure differs but logic is identical.

**Required Changes**: None - demo implements cube 3D transform correctly.

### fixed2.tsx
**Status**: Reviewed
**Files Compared**: fixed2.tsx ↔ fixed2.c

**Differences Found**:
- 🟠 **Major**: Animation timing uses setInterval/Date.now() instead of gtk_widget_add_tick_callback/g_get_monotonic_time().
- 🟠 **Major**: Default window size missing (should be 400x300).
- 🟡 **Minor**: Animation timing precision may differ slightly.

**Required Changes**: Add explicit window size configuration (400x300). Consider using tick callbacks for timing.

### flowbox.tsx
**Status**: Reviewed
**Files Compared**: flowbox.tsx ↔ flowbox.c

**Differences Found**:
- 🟠 **Major**: Dataset size mismatch - official has 665 colors, gtkx has only 143.
- 🟡 **Minor**: Color rendering approach differs (GtkDrawingArea with cairo vs CSS-styled GtkBox).
- 🟡 **Minor**: ScrolledWindow policy differences.

**Required Changes**: Expand color dataset from 143 to 665 colors to match official demo.

### headerbar.tsx
**Status**: Reviewed
**Files Compared**: headerbar.tsx ↔ headerbar.c

**Differences Found**:
- 🔴 **Critical**: Missing window titlebar setup. Official uses gtk_window_set_titlebar() to make header bar the window titlebar; gtkx nests it in a box.
- 🟡 **Minor**: Missing accessibility attributes on buttons.
- 🟡 **Minor**: Button spacing may differ in padding.

**Required Changes**: Implement proper window titlebar integration - header bar should replace system titlebar.

### overlay.tsx
**Status**: Reviewed
**Files Compared**: overlay.tsx ↔ overlay.c

**Differences Found**:
- 🟡 **Minor**: Event connection approach differs (React onClicked vs g_signal_connect) but identical functionality.
- 🟡 **Minor**: Box spacing configuration differs.
- 🟢 **Trivial**: Label styling matches with markup support.

**Required Changes**: Minor spacing/padding adjustments for exact visual match.

### overlay-decorative.tsx
**Status**: Reviewed
**Files Compared**: overlay-decorative.tsx ↔ overlay_decorative.c

**Differences Found**:
- 🔴 **Critical**: Decorative image source differs. Official uses PNG resources (decor1.png, decor2.png); gtkx uses starred-symbolic icon.
- 🟠 **Major**: Text tag margin implementation missing. Official modifies pixels-above-lines; gtkx only changes left_margin.
- 🟡 **Minor**: Initial margin value matches (100).

**Required Changes**: Replace symbolic icon with PNG image resources. Implement text tag modification.

### panes.tsx
**Status**: Reviewed
**Files Compared**: panes.tsx ↔ panes.c

**Differences Found**:
- 🟢 **Trivial**: Essentially identical - nested panes with "Hi there", "Hello", "Goodbye" labels
- 🟢 **Trivial**: Same shrink-child settings, same margins

**Required Changes**: None - this demo matches well.

### sizegroup.tsx
**Status**: Reviewed
**Files Compared**: sizegroup.tsx ↔ sizegroup.c

**Differences Found**:
- 🟡 **Minor**: Label baseline alignment missing (GTK_ALIGN_BASELINE_FILL).
- 🟢 **Trivial**: SizeGroup creation and management correct.
- 🟢 **Trivial**: Grid layout matches with identical spacing.
- 🟢 **Trivial**: Option arrays match exactly.

**Required Changes**: Add baseline alignment hints to labels and dropdowns.

---

## Lists

### listbox.tsx
**Status**: Reviewed
**Files Compared**: listbox.tsx ↔ listbox.c (+ listbox.ui)

**Differences Found**:
- 🟠 **Major**: Missing runtime sort functionality. gtkx sorts in JavaScript with useMemo; official uses gtk_list_box_set_sort_func().
- 🟡 **Minor**: Time formatting differs (toLocaleString vs g_date_time_format).
- 🟢 **Trivial**: Data source and row activation behavior differ slightly.

**Required Changes**: Implement proper sort function binding for runtime sorting.

### listbox-controls.tsx
**Status**: Reviewed
**Files Compared**: listbox-controls.tsx ↔ listbox_controls.c (+ listbox_controls.ui)

**Differences Found**:
- 🟠 **Major**: Missing .rich-list style class behavior.
- 🟠 **Major**: Selection mode handling differs.
- 🟡 **Minor**: Row activation logic differs.

**Required Changes**: Apply .rich-list CSS style class appropriately.

### listview-applauncher.tsx
**Status**: Reviewed
**Files Compared**: listview-applauncher.tsx ↔ listview_applauncher.c

**Differences Found**:
- 🟠 **Major**: gtkx uses GridView while official uses GtkListView with horizontal orientation.
- 🟡 **Minor**: Model creation differs (direct vs GListStore wrap).

**Required Changes**: Consider using ListView for consistency.

### listview-colors.tsx
**Status**: Reviewed
**Files Compared**: listview-colors.tsx ↔ listview_colors.c

**Differences Found**:
- 🔴 **Critical**: gtkx uses ListView while official uses GtkGridView.
- 🟠 **Major**: Static 23-color palette vs up to 16.7M dynamic colors.
- 🟠 **Major**: Single selection vs multi-selection with grid display.
- 🟠 **Major**: No sort options; official has comprehensive multi-column sorting.

**Required Changes**: Switch to GridView, implement sorting, expand color model.

### listview-filebrowser.tsx
**Status**: Reviewed
**Files Compared**: listview-filebrowser.tsx ↔ listview_filebrowser.c (+ listview_filebrowser.ui)

**Differences Found**:
- 🟠 **Major**: Uses setTimeout polling vs native async notification.
- 🟡 **Minor**: File filtering in React state vs model filtering.

**Required Changes**: Replace polling with proper async notification.

### listview-selections.tsx
**Status**: Reviewed
**Files Compared**: listview-selections.tsx ↔ listview_selections.c

**Differences Found**:
- 🟠 **Major**: gtkx emphasizes GtkDropDown; official focuses on ListView selection modes.
- 🟠 **Major**: Missing suggestion entries and advanced dropdown features.

**Required Changes**: Add suggestion entry examples.

### listview-settings.tsx
**Status**: Reviewed
**Files Compared**: listview-settings.tsx ↔ listview_settings.c (+ listview_settings.ui)

**Differences Found**:
- 🟠 **Major**: gtkx groups by category with separate ListViews; official uses tree structure.
- 🟠 **Major**: Flat ListView vs GTreeListModel with hierarchical navigation.

**Required Changes**: Implement tree model navigation.

### listview-settings2.tsx
**Status**: Reviewed
**Files Compared**: listview-settings2.tsx ↔ listview_settings2.c (+ listview_settings2.ui)

**Differences Found**:
- 🟠 **Major**: gtkx uses TreeListView; official uses GtkTreeListModel with .navigation-sidebar.
- 🟡 **Minor**: Missing column view with editable values.
- 🟡 **Minor**: Missing search/filtering.

**Required Changes**: Add column view with editable cells, implement search.

### listview-ucd.tsx
**Status**: Reviewed
**Files Compared**: listview-ucd.tsx ↔ listview_ucd.c

**Differences Found**:
- 🟠 **Major**: gtkx generates ~64 chars per block; official supports full Unicode (33,796 items).
- 🟠 **Major**: Missing section headers with script grouping.

**Required Changes**: Load full Unicode database with sections/headers.

### listview-weather.tsx
**Status**: Reviewed
**Files Compared**: listview-weather.tsx ↔ listview_weather.c

**Differences Found**:
- 🟠 **Major**: gtkx shows vertical 14-day forecast; official uses mixed vertical/horizontal layouts.
- 🟠 **Major**: Model size: gtkx 14 items vs official 70,000+.

**Required Changes**: Add horizontal ListView for hourly forecast.

### listview-words.tsx
**Status**: Reviewed
**Files Compared**: listview-words.tsx ↔ listview_words.c

**Differences Found**:
- 🟡 **Minor**: Synchronous loading vs async streaming.
- 🟡 **Minor**: JavaScript debouncing vs GtkFilterListModel.

**Required Changes**: Implement async loading with streaming reader.

---

## Media

### video-player.tsx
**Status**: Reviewed
**Files Compared**: video-player.tsx ↔ video_player.c

**Differences Found**:
- 🟠 **Major**: gtkx has full file dialog with format filtering and sample buttons. Official has minimal UI.
- 🟡 **Minor**: gtkx adds Requirements section explaining GStreamer.
- 🟡 **Minor**: gtkx includes Autoplay and Loop checkboxes.

**Required Changes**: Simplify UI if exact fidelity required, or keep as enhanced UX.

---

## Navigation

### revealer.tsx
**Status**: Reviewed
**Files Compared**: revealer.tsx ↔ revealer.c (+ revealer.ui)

**Differences Found**:
- 🟠 **Major**: Animation sequencing differs. Official waits for transition completion; gtkx uses fixed setTimeout delays.
- 🟡 **Minor**: Official reveals 9 items then reverses; gtkx reveals/hides sequentially.

**Required Changes**: Align timing with transition duration, wait for completion before next item.

### sidebar.tsx
**Status**: Reviewed
**Files Compared**: sidebar.tsx ↔ sidebar.c

**Differences Found**:
- 🟢 **Trivial**: UI structure matches (GtkStackSidebar + GtkStack with 9 pages).
- 🟢 **Trivial**: First page shows icon with dropshadow, remaining show labels.

**Required Changes**: None - functionality matches exactly.

### stack.tsx
**Status**: Reviewed
**Files Compared**: stack.tsx ↔ stack.c (+ stack.ui)

**Differences Found**:
- 🟢 **Trivial**: gtkx uses JSX; official uses GtkBuilder XML. Visual result identical.
- 🟢 **Trivial**: Both show three pages with GtkStackSwitcher and crossfade.

**Required Changes**: None - functionally equivalent.

---

## OpenGL

### gears.tsx
**Status**: Reviewed
**Files Compared**: gears.tsx ↔ gears.c

**Differences Found**:
- 🔴 **Critical**: Missing FPS display overlay in top-left corner.
- 🟠 **Major**: Official uses vertical axis sliders in side panel; gtkx uses horizontal sliders below.
- 🟡 **Minor**: Official uses GtkGears custom widget; gtkx implements geometry from scratch.

**Required Changes**: Add FPS display overlay, reorganize layout for vertical sliders.

### glarea.tsx
**Status**: Reviewed
**Files Compared**: glarea.tsx ↔ glarea.c

**Differences Found**:
- 🟢 **Trivial**: gtkx uses embedded shaders; official loads from resources. Both render identical triangle.
- 🟢 **Trivial**: Slider layout differs but interaction equivalent.

**Required Changes**: None - functionally equivalent.

### shadertoy.tsx
**Status**: Reviewed
**Files Compared**: shadertoy.tsx ↔ shadertoy.c

**Differences Found**:
- 🟢 **Trivial**: This is a gtkx-specific extension with live GLSL editing, presets, and Shadertoy uniforms.

**Required Changes**: None - intentional gtkx extension.

---

## Paths

### path-explorer.tsx
**Status**: Reviewed
**Files Compared**: path-explorer.tsx ↔ path_explorer_demo.c (+ path_explorer.c + path_explorer_demo.ui)

**Differences Found**:
- 🟠 **Major**: Uses Cairo-based drawing instead of GSK Path API. gtkx uses cr.moveTo/lineTo/curveTo; official uses GskPath.parse().
- 🟠 **Major**: Manual React hook state management vs custom PathExplorer widget.
- 🟡 **Minor**: Different point labeling and control point colors.

**Required Changes**: Migrate from Cairo to GSK Path API using Gsk.Path and Gsk.PathBuilder.

### path-fill.tsx
**Status**: Reviewed
**Files Compared**: path-fill.tsx ↔ path_fill.c

**Differences Found**:
- 🟠 **Major**: gtkx uses Cairo (Pattern.createLinear/createRadial); official uses gsk_path_parse() from SVG.
- 🟡 **Minor**: gtkx draws GTK logo procedurally; official uses pre-defined SVG path strings.
- 🟢 **Trivial**: Both achieve same visual result.

**Required Changes**: Switch to GSK Path using Gsk.Path.parse().

### path-maze.tsx
**Status**: Reviewed
**Files Compared**: path-maze.tsx ↔ path_maze.c

**Differences Found**:
- 🔴 **Critical**: gtkx uses TypeScript algorithm (recursive carving, BFS, A*); official uses gsk_path_get_closest_point() for collision.
- 🔴 **Critical**: gtkx renders as grid cells with cairo rectangles, not continuous GSK Path.
- 🟠 **Major**: Missing gsk_path_get_closest_point() integration.

**Required Changes**: Completely refactor to use Gsk.Path for maze, use Gsk.Path.getClosestPoint() for collision.

### path-spinner.tsx
**Status**: Reviewed
**Files Compared**: path-spinner.tsx ↔ path_spinner.c

**Differences Found**:
- 🟠 **Major**: gtkx uses Cairo cr.arc/cr.stroke; official uses GSK paths with segment extraction.
- 🟠 **Major**: gtkx creates separate draw functions per variant; official uses single path with arc segment manipulation.

**Required Changes**: Refactor to use Gsk.Path with Gsk.PathBuilder.addCircle/addSegment.

### path-sweep.tsx
**Status**: Reviewed
**Files Compared**: path-sweep.tsx ↔ path_sweep.c (+ path_sweep.ui)

**Differences Found**:
- 🔴 **Critical**: gtkx parses SVG manually with regex; official uses gsk_path_parse() and gsk_path_foreach_intersection().
- 🔴 **Critical**: gtkx manually computes intersections; official uses native gsk_path_foreach_intersection().

**Required Changes**: Replace custom parser with Gsk.Path.parse(). Use Gsk.Path.foreachIntersection().

### path-text.tsx
**Status**: Reviewed
**Files Compared**: path-text.tsx ↔ path_text.c (+ path_text.ui)

**Differences Found**:
- 🟠 **Major**: gtkx uses manual Bezier interpolation; official uses gsk_path_measure_get_point() and gsk_path_point_get_tangent().
- 🟠 **Major**: gtkx implements interactive Bezier editor; official uses gsk_path_transform() with gsk_path_foreach().
- 🟡 **Minor**: Official uses gsk_path_builder_add_layout() for text path.

**Required Changes**: Migrate to Gsk.PathMeasure for point/tangent extraction.

### path-walk.tsx
**Status**: Reviewed
**Files Compared**: path-walk.tsx ↔ path_walk.c (+ path_walk.ui)

**Differences Found**:
- 🟠 **Major**: gtkx builds arc-length lookup table with 100 samples + binary search; official uses gsk_path_measure_get_point() for O(1).
- 🟠 **Major**: gtkx uses addTickCallback with frame time tracking; official uses simpler frame clock progress.

**Required Changes**: Replace custom table with Gsk.PathMeasure.getPoint().

---

## Removed Demos (require GObject subclassing)

The following demos were removed because they require custom GObject subclasses that cannot be implemented in GTKX:
- fishbowl.tsx - requires custom GtkFishbowl widget
- image-filtering.tsx - requires custom GtkFilterPaintable
- paintable-emblem.tsx - requires custom DemoIcon GdkPaintable
- paintable-mediastream.tsx - requires custom GtkNuclearMediaStream
- paintable-symbolic.tsx - requires custom GtkNuclearSymbolic
- read-more.tsx - requires custom ReadMore widget
- tagged-entry.tsx - requires custom DemoTaggedEntry widget
- layoutmanager.tsx - requires custom DemoLayout manager
- layoutmanager2.tsx - requires custom Demo2Layout manager
- listview-clocks.tsx - requires custom GtkClock GdkPaintable

---

## Summary Statistics

| Category | Total | Critical | Major | Minor | Trivial |
|----------|-------|----------|-------|-------|---------|
| Advanced | 6 | 0 | 4 | 4 | 2 | *(font-features, rotated-text, transparent FIXED)*
| Benchmark | 2 | 0 | 4 | 1 | 0 |
| Buttons | 4 | 0 | 1 | 2 | 4 |
| Constraints | 3 | 0 | 1 | 1 | 4 |
| CSS | 8 | 0 | 8 | 7 | 4 |
| Dialogs | 4 | 1 | 3 | 4 | 2 |
| Drawing | 8 | 0 | 3 | 4 | 3 |
| Games | 3 | 1 | 4 | 2 | 2 | *(minesweeper FIXED)*
| Gestures | 7 | 4 | 5 | 12 | 4 |
| Input | 8 | 2 | 5 | 8 | 3 |
| Layout | 9 | 3 | 4 | 5 | 6 |
| Lists | 11 | 1 | 16 | 3 | 1 |
| Media | 1 | 0 | 1 | 2 | 0 |
| Navigation | 3 | 0 | 1 | 1 | 4 |
| OpenGL | 3 | 1 | 1 | 1 | 3 |
| Paths | 7 | 4 | 10 | 2 | 1 |
| **Total** | **77** | **17** | **70** | **55** | **43** |

## Priority Fixes by Severity

### Critical (Must Fix - 12 issues remaining)
- ~~**font-features**: Complete rewrite~~ ✅ **FIXED** - full feature parity achieved
- ~~**rotated-text**: Missing heart shape renderer, two-pane layout~~ ✅ **FIXED** - shape renderer scaling
- ~~**transparent**: Missing backdrop-filter blur~~ ✅ **FIXED** - backdrop blur implementation
- ~~**minesweeper**: Flood-fill behavior differs~~ ✅ **FIXED** - removed flood-fill, 8×8 grid, matches official
- **listview-colors**: Wrong view type (ListView vs GridView)
- **dnd**: Missing GtkGestureRotate, context menus, item editing
- **gestures**: Too elaborate - needs simplification
- **hypertext**: Missing pages, embedded widgets
- **headerbar**: Missing window titlebar integration
- **aspect-frame**: Missing GtkPicture widget
- **overlay-decorative**: Wrong decorative images
- **peg-solitaire**: Click-to-move vs drag-and-drop
- **gears**: Missing FPS display overlay
- **path-maze, path-sweep**: Grid-based vs GSK Path

### Major (Should Fix - 73 issues)
Most common patterns:
- Animation timing (frame clock vs setInterval)
- Dataset sizes (colors, icons smaller than official)
- Different APIs (Cairo vs GSK Path, CSS vs native)
- Missing advanced features (tablet support, sorting, tree models)
