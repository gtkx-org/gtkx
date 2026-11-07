import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createStackNavigator, type StackScreenProps } from "@gtkx/navigation";

type NotesParams = { List: undefined; Note: { id: string } };

const Stack = createStackNavigator<NotesParams>();

const List = ({ navigation }: StackScreenProps<NotesParams, "List">) => (
    <GtkBox
        orientation={Gtk.Orientation.VERTICAL}
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
    >
        <GtkButton
            label="Open note 42"
            onClicked={() => navigation.navigate("Note", { id: "42" })}
        />
    </GtkBox>
);

const Note = ({ route, navigation }: StackScreenProps<NotesParams, "Note">) => (
    <GtkBox
        orientation={Gtk.Orientation.VERTICAL}
        spacing={12}
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
    >
        <GtkLabel>{`Showing note ${route.params.id}`}</GtkLabel>
        <GtkButton label="Done" onClicked={() => navigation.goBack()} />
    </GtkBox>
);

export const Notes = () => (
    <Stack.Navigator initialRouteName="List">
        <Stack.Screen
            name="List"
            component={List}
            options={{ title: "Notes" }}
        />
        <Stack.Screen
            name="Note"
            component={Note}
            options={({ route }) => ({ title: `Note ${route.params.id}` })}
        />
    </Stack.Navigator>
);
