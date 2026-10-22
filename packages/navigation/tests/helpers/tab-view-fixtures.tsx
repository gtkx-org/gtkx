import type { NavigationAction, NavigationState } from "@react-navigation/core";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import {
    createTabViewNavigator,
    NavigationContainer,
    type TabViewNavigationOptions,
    type TabViewScreenProps,
} from "@gtkx/navigation";

type DocumentParams = { Document: { title: string } };

type DocumentsAppProps = {
    navigator?: Partial<Omit<ComponentProps<typeof Documents.Navigator>, "children">>;
    options?: TabViewNavigationOptions;
    screen?: ComponentType<TabViewScreenProps<DocumentParams, "Document">>;
    onStateChange?: (state: NavigationState | undefined) => void;
    onUnhandledAction?: (action: NavigationAction) => void;
    prefix?: string;
};

const Documents = createTabViewNavigator<DocumentParams>();

const DocumentScreen = ({ route, navigation }: TabViewScreenProps<DocumentParams, "Document">): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkLabel>{`${route.params.title} content`}</GtkLabel>
        <GtkButton
            label={`Open child of ${route.params.title}`}
            onClicked={() => {
                navigation.openTab("Document", { title: `${route.params.title} child` }, { parent: route.key });
            }}
        />
        <GtkButton
            label={`Open sibling of ${route.params.title}`}
            onClicked={() => {
                navigation.openTab("Document", { title: `${route.params.title} sibling` });
            }}
        />
        <GtkButton
            label={`Open background sibling of ${route.params.title}`}
            onClicked={() => {
                navigation.openTab("Document", { title: `${route.params.title} background` }, { select: false });
            }}
        />
        <GtkButton
            label={`Close ${route.params.title}`}
            onClicked={() => {
                navigation.closeTab();
            }}
        />
        <GtkButton
            label={`Pin ${route.params.title}`}
            onClicked={() => {
                navigation.pinTab(route.key, true);
            }}
        />
        <GtkButton
            label={`Close others of ${route.params.title}`}
            onClicked={() => {
                navigation.closeOtherTabs();
            }}
        />
        <GtkButton
            label={`Move ${route.params.title} first`}
            onClicked={() => {
                navigation.reorderTab(route.key, 0);
            }}
        />
    </GtkBox>
);

const DocumentsApp = ({
    navigator,
    options,
    screen = DocumentScreen,
    onStateChange,
    onUnhandledAction,
    prefix = "First",
}: DocumentsAppProps): ReactNode => (
    <NavigationContainer onStateChange={onStateChange} onUnhandledAction={onUnhandledAction}>
        <Documents.Navigator {...navigator}>
            <Documents.Screen
                name="Document"
                component={screen}
                initialParams={{ title: prefix }}
                options={({ route }) => ({ title: route.params.title, headerShown: false, ...options })}
            />
        </Documents.Navigator>
    </NavigationContainer>
);

const focusedTitle = (state: NavigationState | undefined): string | undefined => {
    const route = state?.routes[state.index];
    const params = route?.params;

    return params !== undefined && "title" in params && typeof params.title === "string" ? params.title : undefined;
};

const pageTitles = (view: Adw.TabView): string[] =>
    Array.from({ length: view.getNPages() }, (_, index) => view.getNthPage(index).getTitle());

export { DocumentsApp, focusedTitle, pageTitles };
