# Publishing to Flathub

This directory packages the tutorial as a Flatpak, ready to submit to
[Flathub](https://flathub.org). The app is built entirely from source inside a
network-isolated sandbox: `npm` dependencies are vendored and checksummed ahead
of time, then installed offline and packed into a Node.js Single Executable
Application.

## Prerequisites

- `flatpak` and `flatpak-builder`, with the Flathub remote configured.
- [`flatpak-node-generator`](https://github.com/flatpak/flatpak-builder-tools/tree/master/node):
  `pipx install flatpak-node-generator`.
- `desktop-file-validate` and `appstreamcli` for linting.

The runtime (`org.gnome.Platform` 50) and the `node24` SDK extension are pulled
in automatically by `flatpak-builder`.

## Build and test locally

```sh
npm install                 # install app dependencies
npm run flatpak:sources     # vendor deps into flatpak/generated-sources.json
npm run flatpak:build       # build the flatpak in a sandbox
flatpak install --user flatpak-repo com.gtkx.tutorial
flatpak run com.gtkx.tutorial
```

`npm run flatpak:sources` writes `package-lock.json` and
`flatpak/generated-sources.json`; both are needed for the offline sandbox build
and are regenerated whenever dependencies change.

## Submit to Flathub

1. Swap the `dir` source in `com.gtkx.tutorial.yaml` for a pinned `git` source of
   your published release:

   ```yaml
   sources:
     - type: git
       url: https://github.com/you/your-app.git
       commit: <release commit sha>
     - generated-sources.json
   ```

2. Update the `<release>` entry in `com.gtkx.tutorial.metainfo.xml`.
3. Commit `package.json`, `package-lock.json` and `generated-sources.json`, then
   push so the manifest's `git` source resolves.
4. Open a pull request against [flathub/flathub](https://github.com/flathub/flathub)
   with the manifest and `generated-sources.json`; the desktop entry, the D-Bus
   service file and the metainfo ship in your app repository and are installed
   by the manifest's build commands.

## Adapting for your own app

The application ID `com.gtkx.tutorial` appears in the manifest's `id`, in
`applicationId` in `gtkx.config.ts`, in the `.desktop`, `.service` and
`.metainfo.xml` files and their names, in the `Name` key of the service file, in
the gschema filename under `data/`, and in the install paths of the manifest's
build commands. Replace it throughout with your own reverse-DNS ID, rename the
manifest's `command` (currently `gtkx-tutorial`) along with the `Exec` keys of
the desktop entry and the service file, and update the identity fields in the
metainfo (developer, homepage, screenshots) to point at your project.

`tests/flatpak.test.ts` takes the `id` and the `command` from the manifest and
checks the shipped files against them, so a rename you miss fails the app's
`npm test` rather than the sandbox build. It compares identities only: the
metainfo's developer, homepage and screenshots are yours to correct.

The service file is what makes `DBusActivatable=true` in the desktop entry true:
`flatpak build-export` refuses to export an app whose desktop entry claims D-Bus
activation without a matching `share/dbus-1/services/<app id>.service`, so both
files ship together or neither does. The export is where a half-finished rename
bites hardest. Files under `share/applications`, `share/dbus-1/services`,
`share/metainfo` and `share/icons` are exported only while their names start
with the application ID, and one left on the old ID is dropped without a word,
so the build succeeds and installs an app with no launcher and no activation.
The service file also has to exist under `~/.local/share/dbus-1/services/` for a
plain user-prefix install, where its `Exec` names the installed binary instead of
`/app/bin`.
