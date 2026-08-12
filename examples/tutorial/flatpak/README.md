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
   with the manifest and `generated-sources.json`; the desktop and metainfo
   files ship in your app repository and are installed by the manifest's
   build commands.

## Adapting for your own app

The application ID `com.gtkx.tutorial` appears in the manifest's `id`, the
`.desktop`, `.service` and `.metainfo.xml` files and their names, the `Name` key
of the service file, the gschema filename under `data/`, and the install paths
in the manifest's build commands. Replace it throughout with your own
reverse-DNS ID, rename the manifest's `command` (currently `gtkx-tutorial`)
along with the `Exec` keys of the desktop entry and the service file, and update
the identity fields in the metainfo (developer, homepage, screenshots) to point
at your project.

The service file is what makes `DBusActivatable=true` in the desktop entry true:
`flatpak build-export` refuses to export an app whose desktop entry claims D-Bus
activation without a matching `share/dbus-1/services/<app id>.service`, so both
files ship together or neither does.
