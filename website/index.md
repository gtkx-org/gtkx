---
layout: home

hero:
  name: GTKX
  text: Native Linux apps, written in React
  tagline: A Node.js runtime and React reconciler for GTK4 — real widgets, real Libadwaita, real HMR. No Electron, no WebView.
  actions:
    - theme: brand
      text: Get started
      link: /docs/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/gtkx-org/gtkx

features:
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M12 6c4.97 0 9 2.69 9 6s-4.03 6-9 6-9-2.69-9-6 4.03-6 9-6z M8.94 7.5c2.49-4.3 6.05-6.3 7.93-4.39 1.88 1.9 0 5.95-2.49 10.25-2.5 4.3-6.05 6.3-7.93 4.4-1.88-1.9 0-5.96 2.49-10.26z M15.06 7.5c2.5 4.3 4.37 8.35 2.49 10.26-1.88 1.9-5.44-.1-7.93-4.4-2.49-4.3-4.37-8.35-2.49-10.25 1.88-1.91 5.43.09 7.93 4.39z"/></svg>'
    title: React 19, exactly
    details: Hooks, concurrent rendering, and Suspense. Your component model, untouched — the reconciler renders to real GTK4 widgets.
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'
    title: No Electron
    details: Runs on vanilla Node.js with a Rust napi-rs native module. No Chromium, no WebView, no second runtime.
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'
    title: Complete GTK4 + Adwaita
    details: Every GTK4 class, signal, and property is generated from GIR. Libadwaita widgets and the GNOME look out of the box.
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3-9 9 9-3 3"/><path d="M14 7l-9 9 4 4 9-9"/></svg>'
    title: CSS-in-JS for GTK
    details: Emotion compiled to GTK CSS. Nesting, prop interpolation, and global styles — write what you already know.
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6"/><path d="M10 3v6L4 21h16L14 9V3"/></svg>'
    title: Real testing
    details: A Testing Library-style API and a Vitest plugin drive real GTK widgets under Xvfb. Not mocked, not headless.
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2"/></svg>'
    title: MCP for AI agents
    details: A built-in MCP server lets agents inspect the live widget tree, click, type, fire signals, and take screenshots.
---
