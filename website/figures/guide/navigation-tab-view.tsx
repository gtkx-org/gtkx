import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import {
    createTabViewNavigator,
    type TabViewScreenProps,
} from "@gtkx/navigation";

type DocumentParams = { Document: { title: string } };

const Tabs = createTabViewNavigator<DocumentParams>();

const Document = ({
    route,
    navigation,
}: TabViewScreenProps<DocumentParams, "Document">) => (
    <GtkBox
        orientation={Gtk.Orientation.VERTICAL}
        spacing={12}
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
    >
        <GtkLabel label={route.params.title} />
        <GtkButton
            label="Open related"
            onClicked={() =>
                navigation.openTab(
                    "Document",
                    { title: "Related" },
                    { parent: route.key },
                )
            }
        />
    </GtkBox>
);

export const Documents = () => (
    <Tabs.Navigator
        overview={{
            enableNewTab: true,
            onCreateTab: () => ({
                name: "Document",
                params: { title: "Untitled" },
            }),
        }}
        screenOptions={({ route }) => ({ title: route.params.title })}
    >
        <Tabs.Screen
            name="Document"
            component={Document}
            initialParams={{ title: "Untitled" }}
        />
    </Tabs.Navigator>
);
