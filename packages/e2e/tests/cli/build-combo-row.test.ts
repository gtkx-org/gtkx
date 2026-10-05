import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

const APP_SOURCE = `import type * as Adw from "@gtkx/gi/adw";
import { AdwApplication, AdwApplicationWindow, AdwComboRow, AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkStringList } from "@gtkx/jsx/gtk";
import { createRoot, quit } from "@gtkx/react";
import { useEffect, useState } from "react";

const App = () => {
    const [row, setRow] = useState<Adw.ComboRow | null>(null);

    useEffect(() => {
        if (row === null) {
            return;
        }

        process.stdout.write(row.getSubtitle() + "\\n");
        row.setSelected(1);
        process.stdout.write(row.getSubtitle() + "\\n");
        quit();
    }, [row]);

    return (
        <AdwApplication>
            <AdwApplicationWindow title="ComboRow production regression">
                <AdwPreferencesGroup>
                    <AdwComboRow
                        ref={setRow}
                        title="Pick"
                        useSubtitle
                        model={<GtkStringList strings={["alpha", "beta"]} />}
                    />
                </AdwPreferencesGroup>
            </AdwApplicationWindow>
        </AdwApplication>
    );
};

createRoot(undefined, {
    onUncaughtError: (error) => {
        process.stderr.write(String(error));
        process.exitCode = 1;
        quit();
    },
}).render(<App />);
`;

it("renders and changes a ComboRow selection in a production bundle", () => {
    using project = createCliProject({
        prefix: "gtkx-build-combo-row-",
        config: 'export default { applicationId: "org.gtkx.comborowbuild", codegen: false };\n',
        files: { "src/index.tsx": APP_SOURCE },
        hasStore: true,
        shouldShareStore: true,
    });

    runCliOrThrow(project, ["build"]);
    const output = join(project.root, "dist");
    const result = spawnSync(process.execPath, [join(output, "bundle.mjs")], {
        cwd: output,
        encoding: "utf8",
        timeout: 60_000,
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("alpha\nbeta\n");
});
