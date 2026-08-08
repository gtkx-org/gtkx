import type { ReactNode } from "react";
import { GtkBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";

const scrolledBox = (children: ReactNode): ReactNode => (
    <GtkScrolledWindow minContentHeight={200} minContentWidth={200}>
        <GtkBox>{children}</GtkBox>
    </GtkScrolledWindow>
);

export { scrolledBox };
