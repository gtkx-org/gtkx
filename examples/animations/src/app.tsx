import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkApplication,
    GtkApplicationWindow,
    GtkBox,
    GtkLabel,
    GtkScrolledWindow,
    GtkStack,
    GtkStackPage,
    GtkStackSidebar,
} from "@gtkx/jsx/gtk";
import { quit } from "@gtkx/react";
import { useState } from "react";
import { demos } from "./demos/index.js";

type AppProps = {
    applicationId?: string;
};

const Showcase = () => {
    const [stack, setStack] = useState<Gtk.Stack | null>(null);

    return (
        <GtkApplicationWindow title="GTKX Animations" defaultWidth={920} defaultHeight={640} onCloseRequest={quit}>
            <GtkBox>
                {stack && <GtkStackSidebar name="sidebar" stack={stack} />}
                <GtkStack ref={setStack} transitionType={Gtk.StackTransitionType.CROSSFADE} hexpand vexpand>
                    {demos.map(({ id, title, description, component: DemoComponent }) => (
                        <GtkStackPage key={id} name={id} title={title}>
                            <GtkScrolledWindow hexpand vexpand>
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={12}
                                    marginTop={24}
                                    marginBottom={24}
                                    marginStart={24}
                                    marginEnd={24}
                                >
                                    <GtkLabel cssClasses={["title-2"]} halign={Gtk.Align.START}>
                                        {title}
                                    </GtkLabel>
                                    <GtkLabel cssClasses={["dim-label"]} halign={Gtk.Align.START} wrap>
                                        {description}
                                    </GtkLabel>
                                    <DemoComponent />
                                </GtkBox>
                            </GtkScrolledWindow>
                        </GtkStackPage>
                    ))}
                </GtkStack>
            </GtkBox>
        </GtkApplicationWindow>
    );
};

const App = ({ applicationId }: AppProps) => (
    <GtkApplication applicationId={applicationId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
        <Showcase />
    </GtkApplication>
);

export { App };
