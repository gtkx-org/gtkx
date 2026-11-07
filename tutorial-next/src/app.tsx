import { AdwApplication } from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { quit } from "@gtkx/react";
import { useState } from "react";
import type * as Adw from "@gtkx/gi/adw";
import { Window } from "./components/window.js";
import { SettingsProvider } from "./settings.js";

function App() {
    const [application, setApplication] = useState<Adw.Application | null>(null);

    return (
        <AdwApplication
            ref={setApplication}
            onActivate={() => application?.getActiveWindow()?.present()}
            actionAccels={[
                { detailedActionName: "win.new-note", accels: ["<Control>n"] },
                { detailedActionName: "win.rename-note", accels: ["F2"] },
                { detailedActionName: "win.preferences", accels: ["<Control>comma"] },
                { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
                { detailedActionName: "app.quit", accels: ["<Control>q"] },
            ]}
            actions={<GSimpleAction name="quit" onActivate={() => quit()} />}
        >
            <SettingsProvider>
                <Window />
            </SettingsProvider>
        </AdwApplication>
    );
}

export { App };
