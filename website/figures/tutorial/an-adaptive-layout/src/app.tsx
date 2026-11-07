import { AdwApplication } from "@gtkx/jsx/adw";
import { Window } from "./components/window.js";

export function App() {
    return (
        <AdwApplication>
            <Window />
        </AdwApplication>
    );
}
