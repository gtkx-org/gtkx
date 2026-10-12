# Adwaita demo implementation plan

Reimplement the official libadwaita 1.9.3 demo in GTKX, preserving its layouts, controls, native interactions, and adaptive behavior. The reference is GNOME/libadwaita commit `5789add99c79cee0fae624b56706c7c0bea7fb2b`. The community implementation mentioned in Discussion 791 is inspiration only; implementation follows the official C and UI sources.

## Milestones

- [x] Create `feat/adwaita-demo` and check out the pinned reference.
- [x] Prove native tab creation and transfer, animation allocation, and multi-layout identity.
- [x] Add workspace configuration, application shell, search, grouped sidebar, resources, and Welcome.
- [x] Implement controls, lists, feedback, and dialog pages.
- [x] Implement adaptive navigation, carousel, bottom sheet, multi-layout, preferences, and shortcuts.
- [x] Implement Avatar file workflows and the complete style gallery.
- [x] Complete timed and spring animation controls.
- [x] Complete tab operations, overview, transfer, and window lifecycle.
- [x] Verify the running application, production output, types, formatting, lint, and relevant integration suites.
- [x] Finish README, source and asset notices, and contributor documentation.

## Parity checklist

| Page              | Required observable behavior                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Welcome           | Native toolbar and introductory status page                                                                                                      |
| Navigation View   | Four tagged pages, branching navigation, native back                                                                                             |
| Split Views       | Navigation and overlay dialogs; collapse, show/hide, start/end placement                                                                         |
| View Switcher     | Four views; switcher moves below at 550sp without losing selection                                                                               |
| Tab View          | Editable tabs, overview, duplication, pinning, loading/attention/indicator, context actions, text drops, reordering and transfer between windows |
| Bottom Sheet      | Native drag/open/close; bottom margin follows bar height                                                                                         |
| Carousel          | Orientation, dots/lines, scroll-wheel and long-swipe controls; animated return                                                                   |
| Boxed Lists       | Action, entry, password, spin, switch, combo, expandable and button rows                                                                         |
| Toggle Groups     | Text, icon, alignment and camera-mode groups                                                                                                     |
| Buttons           | Six split-button variants and menus                                                                                                              |
| Banner            | Reveal, text, button label and style; action feedback                                                                                            |
| Toasts            | Simple, long, repeated action, undo, current/all dismissal                                                                                       |
| Spinner           | Native spinner paintable                                                                                                                         |
| Avatar            | Initials, text, size, image open/remove/export, 30 contacts                                                                                      |
| Alert Dialog      | Responses, default/cancel semantics, result toast                                                                                                |
| About Dialog      | Typeset sample metadata, release notes, links, credits and legal sections                                                                        |
| Clamp             | Maximum size, threshold, length unit                                                                                                             |
| Wrap Box          | Responsive tags with add/remove                                                                                                                  |
| Multi-Layout View | Shared child identity across layouts at 500sp                                                                                                    |
| Style Classes     | Complete gallery, responsive rows, nested status/sidebar dialogs                                                                                 |
| Animations        | Timed/spring parameters; play/pause/resume/reset/skip and state-sensitive controls                                                               |

The shell starts at 1000 by 720, collapses at 500sp, supports sidebar filtering and its empty state, and recreates page-local state when selecting a different page. Include preferences and subpages, shortcuts, Inspector, adaptive preview, and GTKX application About metadata.

## Implementation constraints

Use generated JSX and public native APIs. All widget trees are JSX and signal handlers are props. Keep page-specific components together. Native operations remain native; synchronize React state with user-driven changes. Avoid non-null assertions, double casts through unknown, and inline implementation comments.

Tab creation callbacks must return native objects synchronously. Transfers must preserve widget identity, page state, and cleanup after subsequent rerenders. Resolve any renderer gap in the framework with observable integration coverage rather than bypassing JSX ownership in the example.

## Validation

Use libadwaita 1.9.3 and GTK 4.22.4 as the initial tested environment. Verify CI's actual GIR availability before claiming compatibility. Inspect all pages through the running app and MCP, including matching reference screenshots, wide/narrow sizes, light/dark, high contrast, RTL, keyboard focus, and repeated open/close. Check real desktop gestures and file dialogs separately from direct signal-based integration tests.

Framework regressions belong in package integration suites. Keep native interface happy paths small; do not add an example test suite unless it teaches testing. Run example build/typecheck/lint, focused affected package tests, and production resource checks. Published framework changes require a version plan.

## Resources

Track copied artwork in `data/upstream-assets.json`, preserve source metadata, and retain individual license notices. The upstream stylesheet and any adapted upstream material retain their applicable notices. The Typeset artwork has a separate CC BY-SA 4.0 source notice.

## Validation results

Validated against the installed native libadwaita 1.9.3 demo and its pinned C/UI sources on GTK 4.22.4. All 21 pages were inspected live. Interaction checks covered native navigation and resizing, carousel wheel input, bottom-sheet opening, retained multi-layout child identity, editable controls, alerts and toast undo, preferences subpages, sidebar filtering, shortcuts, and adaptive preview. The shell was inspected in light, dark, high contrast, RTL, and phone preview modes.

Tab checks cover native overview creation, duplication, pinning, closing, editable state after transfer, source-window closure, and an actual desktop drag that tears off a tab. Framework integration coverage protects synchronous native callbacks and native widget identity across ownership changes. Timed and spring animations use a registered layout manager because GTK's `CustomLayout` GIR incorrectly marks its retained callbacks as call-scoped.

Avatar export, reopening the saved PNG, and image removal were verified with GL. The Cairo export fallback and the Style Classes check-button grid sizing warning were reproduced in native C independently of GTKX. The libadwaita 1.9.3 toast dismissal race was also reproduced in C; the example tracks and dismisses individual toasts to avoid it.

Local checks: affected example/framework typecheck and lint; eight code-generation tests; ten configuration tests; 130 related renderer integration tests. All 55 resource-manifest entries match the pinned upstream bytes. CI uses Ubuntu 26.04 packages from `.github/ci/Dockerfile`; no CI run has been submitted by this local work.

The final production bundle was launched and visually inspected on the isolated Wayland display, including its compiled icons and stylesheet. Build, typecheck, lint, and whitespace checks passed. Closing the main window preserves independent tab windows; closing the last tab exits the application.
