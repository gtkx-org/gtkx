import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog } from "@gtkx/jsx/adw";
import { useState } from "react";
import { NotesSplitShell } from "../notes-split-shell.js";

export const Chapter8 = () => {
    const [window, setWindow] = useState<Adw.ApplicationWindow | null>(null);

    return (
        <>
            <NotesSplitShell windowRef={setWindow} />
            {window && (
                <AdwAboutDialog
                    parent={window}
                    applicationName="Notes"
                    applicationIcon="document-edit-symbolic"
                    version="1.0.0"
                    developerName="GTKX Tutorial"
                    website="https://gtkx.dev"
                    issueUrl="https://github.com/gtkx-org/gtkx/issues"
                    copyright="© 2026 GTKX Contributors"
                    licenseType={Gtk.License.MPL_2_0}
                    developers={["GTKX Contributors"]}
                />
            )}
        </>
    );
};
