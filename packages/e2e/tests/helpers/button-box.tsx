import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { ScrollWrapper } from "./scroll-wrapper.js";

export const drawButtonBox = (n: number): ReactNode => (
    <ScrollWrapper>
        <GtkBox>
            {Array.from({ length: n }, (_, i) => `button-${i}`).map((name) => (
                <GtkButton key={name} label={name} onClicked={() => undefined} />
            ))}
        </GtkBox>
    </ScrollWrapper>
);
