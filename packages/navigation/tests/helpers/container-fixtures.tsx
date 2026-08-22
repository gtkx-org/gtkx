import type { NavigationProp, ParamListBase, RouteProp, StaticScreenProps } from "@gtkx/navigation";
import type { ReactNode, RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import {
    createDrawerNavigator,
    createStackNavigator,
    createTabNavigator,
    useFocusEffect,
    useIsFocused,
    useNavigation,
    useRoute,
    useTheme,
} from "@gtkx/navigation";
import { screen } from "@gtkx/testing";
import { useCallback } from "react";
import { expect } from "vitest";

type RootParams = { Home: undefined; Details: { id: string } };
type NavigateButtonProps = { label: string; to: string; params?: object };
type FocusTrackerProps = { onFocus: () => void; onBlur: () => void };
type FocusLabelProps = { labelRef: RefObject<Gtk.Label | null> };
type DrawerWithStackProps = { collapsed?: boolean };

const Stack = createStackNavigator<RootParams>();
const InnerStack = createStackNavigator<RootParams>();
const OuterStack = createStackNavigator();
const Tabs = createTabNavigator();
const Drawer = createDrawerNavigator();

const NavigateButton = ({ label, to, params }: NavigateButtonProps): ReactNode => {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();

    return (
        <GtkButton
            label={label}
            onClicked={() => {
                navigation.navigate(to, params);
            }}
        />
    );
};

const Home = (): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkLabel>Home Content</GtkLabel>
        <NavigateButton label="Go to details" to="Details" params={{ id: "42" }} />
    </GtkBox>
);

const Details = (): ReactNode => {
    const route = useRoute<RouteProp<RootParams, "Details">>();

    return <GtkLabel>{`Details ${route.params.id}`}</GtkLabel>;
};

const DetailsWithTabLink = (): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <Details />
        <NavigateButton label="Go to second tab" to="Main" params={{ screen: "Second", params: { id: "5" } }} />
    </GtkBox>
);

const Page = ({ text }: { text: string }): ReactNode => <GtkLabel>{text}</GtkLabel>;

const SecondPage = (): ReactNode => {
    const route = useRoute<RouteProp<{ Second: { id: string } | undefined }, "Second">>();

    return <GtkLabel>{`Second ${route.params?.id ?? "none"}`}</GtkLabel>;
};

const ThemeLabel = (): ReactNode => {
    const theme = useTheme();

    return <GtkLabel>{`dark=${String(theme.dark)} highContrast=${String(theme.highContrast)}`}</GtkLabel>;
};

const NestedHome = (): ReactNode => {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const parent = navigation.getParent();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <Home />
            <GtkLabel>{`Parent: ${parent === undefined ? "none" : "present"}`}</GtkLabel>
            <GtkButton
                label="Switch to second"
                onClicked={() => {
                    parent?.navigate("Second");
                }}
            />
        </GtkBox>
    );
};

const FocusTracker = ({ onFocus, onBlur }: FocusTrackerProps): ReactNode => {
    useFocusEffect(
        useCallback(() => {
            onFocus();

            return onBlur;
        }, [onFocus, onBlur]),
    );

    return <Home />;
};

const FocusLabel = ({ labelRef }: FocusLabelProps): ReactNode => {
    const isFocused = useIsFocused();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel ref={labelRef} label={`Home focused: ${String(isFocused)}`} />
            <NavigateButton label="Go to details" to="Details" params={{ id: "42" }} />
        </GtkBox>
    );
};

const StaticHome = (): ReactNode => <Home />;
const FirstTabPage = (): ReactNode => <Page text="First Content" />;
const SecondTabPage = (): ReactNode => <NavigateButton label="Go to details" to="Details" params={{ id: "8" }} />;
const InboxPage = (): ReactNode => <Page text="Inbox Content" />;
const SettingsPage = (): ReactNode => <Page text="Settings Content" />;

const expectText = async (text: string): Promise<void> => {
    expect(await screen.findByText(text)).toBeVisible();
};

const StaticDetails = ({ route }: StaticScreenProps<{ id: string }>): ReactNode => (
    <GtkLabel>{`Details ${route.params.id}`}</GtkLabel>
);

const RootStack = (): ReactNode => (
    <Stack.Navigator>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Details" component={Details} options={{ title: "Details Page" }} />
    </Stack.Navigator>
);

const NestedStack = (): ReactNode => (
    <InnerStack.Navigator>
        <InnerStack.Screen name="Home" component={NestedHome} />
        <InnerStack.Screen name="Details" component={Details} />
    </InnerStack.Navigator>
);

const TabsWithStack = (): ReactNode => (
    <Tabs.Navigator>
        <Tabs.Screen name="First" component={NestedStack} options={{ title: "First Tab" }} />
        <Tabs.Screen name="Second" options={{ title: "Second Tab" }}>
            {() => <Page text="Second Content" />}
        </Tabs.Screen>
    </Tabs.Navigator>
);

const PlainTabs = (): ReactNode => (
    <Tabs.Navigator>
        <Tabs.Screen name="First" component={Home} options={{ title: "First Tab" }} />
        <Tabs.Screen name="Second" component={SecondPage} options={{ title: "Second Tab" }} />
    </Tabs.Navigator>
);

const StackWithTabs = (): ReactNode => (
    <OuterStack.Navigator>
        <OuterStack.Screen name="Main" component={PlainTabs} options={{ headerShown: false }} />
        <OuterStack.Screen name="Details" component={DetailsWithTabLink} />
    </OuterStack.Navigator>
);

const DrawerWithStack = ({ collapsed }: DrawerWithStackProps): ReactNode => (
    <Drawer.Navigator collapsed={collapsed}>
        <Drawer.Screen name="Inbox" component={NestedStack} options={{ drawerLabel: "Inbox Row" }} />
        <Drawer.Screen name="Settings" options={{ drawerLabel: "Settings Row" }}>
            {() => <Page text="Settings Content" />}
        </Drawer.Screen>
    </Drawer.Navigator>
);

export {
    Details,
    DrawerWithStack,
    expectText,
    FirstTabPage,
    FocusLabel,
    FocusTracker,
    Home,
    InboxPage,
    InnerStack,
    NestedStack,
    PlainTabs,
    RootStack,
    type RootParams,
    SecondTabPage,
    SettingsPage,
    Stack,
    StackWithTabs,
    StaticDetails,
    StaticHome,
    TabsWithStack,
    ThemeLabel,
};
