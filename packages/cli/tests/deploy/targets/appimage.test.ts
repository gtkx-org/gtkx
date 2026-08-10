import { describe, expect, it } from "vitest";
import { renderAppRun } from "../../../src/deploy/targets/appimage.js";
import { tutorialSettings } from "../fixtures/settings.js";

describe("renderAppRun", () => {
    it("resolves the app from the mount point, which changes on every launch", () => {
        expect(renderAppRun(tutorialSettings())).toBe(
            [
                "#!/bin/sh",
                "set -e",
                'here=$(dirname "$(readlink -f "$0")")',
                'XDG_DATA_DIRS="$here/usr/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"',
                "export XDG_DATA_DIRS",
                'exec "$here/usr/bin/gtkx-tutorial" "$@"',
                "",
            ].join("\n"),
        );
    });

    it("prepends its own share directory rather than replacing the host's", () => {
        expect(renderAppRun(tutorialSettings())).toContain("${XDG_DATA_DIRS:-/usr/local/share:/usr/share}");
    });

    it("hardcodes no absolute install path", () => {
        expect(renderAppRun(tutorialSettings())).not.toContain("/project");
    });
});
