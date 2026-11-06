---
__default__: patch
---

The tab view navigator takes a `renderMenu` prop for its tab context menu: it receives a ref to attach to a `GMenu` anywhere in the JSX it returns, and the navigator renders that JSX outside the widget tree and uses the menu. Building the menu no longer needs a `createPortal` into `rootElement` and a state variable holding the menu. `menuModel` still takes an existing `Gio.MenuModel`; a navigator given both throws.
