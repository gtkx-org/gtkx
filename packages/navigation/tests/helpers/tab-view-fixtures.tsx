import type { InitialState, NavigationAction, NavigationState } from "@react-navigation/core";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { screen, userEvent } from "@gtkx/testing";
import {
    createTabViewNavigator,
    NavigationContainer,
    type TabViewNavigationOptions,
    type TabViewScreenProps,
} from "@gtkx/navigation";
import { getAncestor } from "./widget-ancestors.js";

type DocumentParams = { Document: { title: string; kind?: string } };

type DocumentsAppProps = {
    navigator?: Partial<Omit<ComponentProps<typeof Documents.Navigator>, "children">>;
    options?: TabViewNavigationOptions;
    screen?: ComponentType<TabViewScreenProps<DocumentParams, "Document">>;
    getId?: (options: { params: Readonly<DocumentParams["Document"]> }) => string | undefined;
    navigationKey?: string;
    initialState?: InitialState;
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
            label={`Navigate from ${route.params.title}`}
            onClicked={() => {
                navigation.navigate("Document", { title: "Navigated" });
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
    getId,
    navigationKey,
    initialState,
    onStateChange,
    onUnhandledAction,
    prefix = "First",
}: DocumentsAppProps): ReactNode => (
    <NavigationContainer
        initialState={initialState}
        onStateChange={onStateChange}
        onUnhandledAction={onUnhandledAction}
    >
        <Documents.Navigator {...navigator}>
            <Documents.Screen
                name="Document"
                component={screen}
                getId={getId}
                navigationKey={navigationKey}
                initialParams={{ title: prefix, kind: "note" }}
                options={({ route }) => ({ title: route.params.title, headerShown: false, ...options })}
            />
        </Documents.Navigator>
    </NavigationContainer>
);

const routeTitle = (route: { params?: object } | undefined): string | undefined => {
    const params = route?.params;

    return params !== undefined && "title" in params && typeof params.title === "string" ? params.title : undefined;
};

const focusedTitle = (state: NavigationState | undefined): string | undefined => routeTitle(state?.routes[state.index]);

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name }));
};

const viewOf = (text: string): Adw.TabView => getAncestor(screen.getByText(text), Adw.TabView);

const pageTitles = (view: Adw.TabView): string[] =>
    Array.from({ length: view.getNPages() }, (_, index) => view.getNthPage(index).getTitle());

export { clickButton, type DocumentParams, DocumentsApp, focusedTitle, pageTitles, routeTitle, viewOf };
