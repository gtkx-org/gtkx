import { AdwApplication } from "@gtkx/jsx/adw";
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
            actionAccels={[{ detailedActionName: "win.new-note", accels: ["<Control>n"] }]}
        >
            <SettingsProvider>
                <Window />
            </SettingsProvider>
        </AdwApplication>
    );
}

export { App };
