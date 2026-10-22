# Adwaita demo implementation notes

This example reimplements the official [libadwaita 1.9.3 demo](https://github.com/GNOME/libadwaita/tree/5789add99c79cee0fae624b56706c7c0bea7fb2b/demo), pinned to commit `5789add99c79cee0fae624b56706c7c0bea7fb2b`. Use its C and UI sources when comparing behavior. See the [README](README.md) for run commands, known native-library differences, and licensing.

These notes describe the completed implementation and the checks to repeat when changing it. The [page registry](src/page-registry.ts) defines the sidebar's categories and order.

## Behavior to preserve

| Page              | Observable behavior                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Welcome           | Native toolbar and introductory status page                                                                                                      |
| Navigation View   | Tagged pages, branching navigation, native back                                                                                                  |
| Split Views       | Navigation and overlay dialogs; collapse, show/hide, start/end placement                                                                         |
| View Switcher     | Switcher moves below the views at 550sp without losing selection                                                                                 |
| Tab View          | Editable tabs, overview, duplication, pinning, loading/attention/indicator, context actions, text drops, reordering and transfer between windows |
| Bottom Sheet      | Native drag/open/close; bottom margin follows bar height                                                                                         |
| Carousel          | Orientation, dots/lines, scroll-wheel and long-swipe controls; animated return                                                                   |
| Boxed Lists       | Action, entry, password, spin, switch, combo, expandable and button rows                                                                         |
| Toggle Groups     | Text, icon, alignment and camera-mode groups                                                                                                     |
| Buttons           | Split-button variants and menus                                                                                                                  |
| Banner            | Reveal, text, button label and style; action feedback                                                                                            |
| Toasts            | Basic and long toasts, repeated actions, undo, current/all dismissal                                                                             |
| Spinner           | Native spinner paintable                                                                                                                         |
| Avatar            | Initials, text, size, image open/remove/export, contact gallery                                                                                  |
| Alert Dialog      | Responses, default/cancel semantics, result toast                                                                                                |
| About Dialog      | Typeset sample metadata, release notes, links, credits and legal sections                                                                        |
| Clamp             | Maximum size, threshold, length unit                                                                                                             |
| Wrap Box          | Responsive tags with add/remove                                                                                                                  |
| Multi-Layout View | Shared child identity across layouts at 500sp                                                                                                    |
| Style Classes     | Upstream gallery, responsive rows, nested status/sidebar dialogs                                                                                 |
| Animations        | Timed/spring parameters; play/pause/resume/reset/skip and state-sensitive controls                                                               |

The shell starts at 1000 by 720, collapses at 500sp, supports sidebar filtering and its empty state, and recreates page-local state when selecting a different page. Its menu provides preferences and subpages, shortcuts, Inspector, adaptive preview, and GTKX application About metadata.

## Implementation boundaries

Keep widget trees in JSX and signals in props, using generated bindings and public native APIs. Keep page-specific components together and synchronize React state with native user interactions. Independent tab windows remain open after the main window closes; closing the last window exits the application.

The [tab demo](src/pages/tab-view.tsx) uses the tab view navigator from `@gtkx/navigation`: each window runs its own navigation container, tab data lives in route params, and `create-window` hands a native view to the next window's navigator. Transfers between windows move the native page and render its screen again in the receiving window. Window creation, focus, close decisions, and animation playback remain event-driven native operations.

The [animation demo](src/pages/animations.tsx) uses `GtkCustomLayout`. Its callbacks must remain valid for the layout's lifetime, including after garbage collection. Text direction, About metadata, tab drop targets, and pinning use declarative props. Imported CSS uses the standard GTKX build pipeline.

If a change exposes a renderer limitation, add observable regression coverage in the relevant framework package. Preserve JSX ownership in the example. Existing package tests cover tab transfers and cleanup, native callback ownership, object slots, selection and adjustment initialization, and stylesheet updates.

## Validation

The original implementation was checked with libadwaita 1.9.3 and GTK 4.22.4. Recheck compatibility when changing GTK or libadwaita versions. CI's packages are defined in [the CI image](../../.github/ci/Dockerfile).

For changes to the demo:

- Run the affected example and framework build, typecheck, lint, and integration checks described in [CONTRIBUTING.md](../../CONTRIBUTING.md).
- Inspect affected pages in the running app through MCP, using the same native-library versions as the reference for screenshot comparisons.
- Check wide and narrow layouts, light and dark themes, high contrast, RTL, and keyboard focus when the change affects layout or input.
- Exercise desktop gestures and file dialogs directly. Signal-driven integration tests do not verify those paths.
- Launch the production bundle and check its compiled icons and stylesheet.

For tab changes, check overview creation, duplication, pinning, closing, dragging a tab into another window, tearing off a tab, and editing after the source window closes. For animation changes, check playback controls and callback lifetime. For Avatar changes, export, reopen, and remove an image using a supported renderer.

The original live checks covered these flows, including the production bundle and adaptive preview. The native Cairo avatar-export limitation, style-gallery measurement warning, and toast-dismissal race are documented in the README with their tested library versions. Repeat the relevant checks after changes; historical results do not replace current validation.

## Upstream resources

Track reused artwork in [data/upstream-assets.json](data/upstream-assets.json), preserve its source metadata, and retain each license notice under `data/licenses`. The stylesheet and other adapted material retain their applicable notices. The Typeset artwork has a separate CC BY-SA 4.0 notice. Check resource paths and packaged bytes when changing assets.
