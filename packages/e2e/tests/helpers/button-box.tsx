import type { ReactNode } from "react";
import { GtkBox, GtkButton, GtkScrolledWindow } from "@gtkx/jsx/gtk";

const drawButtonBox = (n: number): ReactNode => (
    <GtkScrolledWindow minContentHeight={200} minContentWidth={200}>
        <GtkBox>
            {Array.from({ length: n }, (_, i) => `button-${String(i)}`).map((name) => (
                <GtkButton key={name} label={name} onClicked={(): void => undefined} />
            ))}
        </GtkBox>
    </GtkScrolledWindow>
);

export { drawButtonBox };
