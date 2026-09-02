import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataHome = mkdtempSync(join(tmpdir(), "gtkx-gio-unix-search-"));
const applications = join(dataHome, "applications");

try {
    mkdirSync(applications);
    writeFileSync(
        join(applications, "org.gtkx.SearchProbe.desktop"),
        [
            "[Desktop Entry]",
            "Type=Application",
            "Name=GTKX Search Probe",
            "Exec=/usr/bin/true",
            "NoDisplay=false",
            "",
        ].join("\n"),
    );
    process.env.XDG_DATA_HOME = dataHome;

    const { DesktopAppInfo } = await import("@gtkx/gi/giounix");
    const matches = DesktopAppInfo.search("GTKX Search Probe");

    if (matches.length === 0 || matches.some((group) => group.some((id) => typeof id !== "string"))) {
        process.exitCode = 1;
    } else {
        process.stdout.write("NESTED STRINGS\n");
    }
} finally {
    rmSync(dataHome, { recursive: true, force: true });
}
