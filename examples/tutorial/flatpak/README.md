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
   with the manifest, `generated-sources.json`, and the desktop/metainfo files.

## Adapting for your own app

The application ID `com.gtkx.tutorial` appears in the manifest (`id`, `command`),
the `.desktop` and `.metainfo.xml` files and their names, the gschema filename
under `data/`, and the install paths above. Replace it throughout with your own
reverse-DNS ID, and update the identity fields in the metainfo (developer,
homepage, screenshots) to point at your project.
