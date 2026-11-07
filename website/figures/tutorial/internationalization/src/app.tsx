import { AdwApplication } from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { quit } from "@gtkx/react";
import { Window } from "./components/window.js";
import { SettingsProvider } from "./settings.js";

function App() {
    return (
        <AdwApplication
            actionAccels={[
                { detailedActionName: "win.new-note", accels: ["<Control>n"] },
                { detailedActionName: "win.rename-note", accels: ["F2"] },
                {
                    detailedActionName: "win.preview",
                    accels: ["<Control><Shift>p"],
                },
                {
                    detailedActionName: "win.preferences",
                    accels: ["<Control>comma"],
                },
                {
                    detailedActionName: "win.shortcuts",
                    accels: ["<Control>question"],
                },
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
