import type { ReactNode } from "react";
import { GtkButton } from "@gtkx/jsx/gtk";
import { scrolledBox } from "./scrolled-box.js";

const drawButtonBox = (n: number): ReactNode =>
    scrolledBox(
        Array.from({ length: n }, (_, i) => `button-${String(i)}`).map((name) => (
            <GtkButton key={name} label={name} onClicked={(): void => undefined} />
        )),
    );

export { drawButtonBox };
