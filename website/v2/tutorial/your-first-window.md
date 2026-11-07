---
description: "Scaffold the Notes project and replace the starter counter with an Adwaita window."
---

# Create a Window

Replace the starter counter with the Notes window: an Adwaita window with a header bar and an empty state. Its strings go through `t()` from the start, so translating the app later needs no changes to the components.

## The project

The project from [Check your setup](/v2/tutorial/#check-your-setup) has these files to start from:

- `gtkx.config.ts` holds the application ID, `dev.gtkx.Notes`, and the packaging metadata. GTKX reads it for codegen, development and builds.
- `src/index.tsx` creates a React root without a DOM container and renders `<App />` into it. It stays the same throughout the tutorial.
- `src/app.tsx` holds the counter. This chapter replaces it.

`npm run dev` runs the app from `src/index.tsx` and applies your saves to the open window. [Project structure](/v2/guide/getting-started#project-structure) describes the other files.

The scaffold's starter test, `tests/app.test.tsx`, looks for the counter's Increment button and imports a default export that the new `src/app.tsx` doesn't have, so `npm run typecheck` would fail. Delete it; [Test the App](/v2/tutorial/testing) writes the app's tests.

```bash
rm tests/app.test.tsx
```

## Mark strings for translation

Install `@gtkx/i18n`:

```bash
npm install @gtkx/i18n@beta
```

`useTranslation()` from `@gtkx/i18n` returns `t`, which looks up the translation of its source string and falls back to the string itself. Until [Translate the App](/v2/tutorial/internationalization) adds catalogs, every `t("…")` shows its source text. Pass `t` a string literal, as every chapter does, so that GTKX can extract the message; [Keep messages extractable](/v2/guide/internationalization#keep-messages-extractable) lists the forms it reads.

## The application window

Replace `src/app.tsx`:

<<< @/figures/tutorial/your-first-window/src/app.tsx [src/app.tsx]

Elements come from `@gtkx/jsx/<namespace>`, one module per library, and take the native class's properties and signals as camelCase props; [JSX Elements](/v2/guide/jsx-elements) has the rules.

- `AdwApplication` creates the application with the ID from `gtkx.config.ts` and renders its children once it activates. [The application element](/v2/guide/application-lifecycle#the-application-element) explains when the app ends.
- `AdwApplicationWindow` is the main window. `widthRequest` and `heightRequest` set the smallest size it shrinks to, 360 by 294, the size the [GNOME HIG](https://developer.gnome.org/hig/guidelines/adaptive.html) asks phone-friendly apps to support. `quit()` from `@gtkx/react` unmounts the app and quits when the window closes.
- `AdwToolbarView` places bars around its content. Its `top` slot holds an `AdwHeaderBar`, which shows the window title and the close button.
- `AdwStatusPage` is the empty state, a [placeholder page](https://developer.gnome.org/hig/patterns/feedback/placeholders.html) with a symbolic icon, a title and a description. [List the Notes](/v2/tutorial/the-notes-folder) shows it only while the folder has no notes.

## Run it

Save `src/app.tsx`. Its imports changed, so `gtkx dev` restarts the app instead of refreshing it, and the window shows the empty state.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-your-first-window-light.png" width="360" height="343" loading="lazy" alt="The Notes window: a header bar titled Notes above a status page with a new-document icon, the title No Notes, and the description Notes are Markdown files in your notes folder." />
    <img class="result-dark" src="/figures/tutorial-your-first-window-dark.png" width="360" height="343" loading="lazy" alt="The Notes window: a header bar titled Notes above a status page with a new-document icon, the title No Notes, and the description Notes are Markdown files in your notes folder." />
    <figcaption>Captured from <a href="#the-application-window"><code>src/app.tsx</code></a> above.</figcaption>
</figure>

Run `npm run typecheck`. It passes once the starter test is gone.
