import type { StackHeaderProps, StackScreenProps } from "@gtkx/navigation";
import type { ReactNode } from "react";
import { GtkLabel } from "@gtkx/jsx/gtk";
import {
    createNavigationContainerRef,
    createStackNavigator,
    NavigationContainer,
    StackActions,
} from "@gtkx/navigation";
import { act, render, screen, waitFor } from "@gtkx/testing";
import { setImmediate } from "node:timers/promises";
import { useEffect } from "react";
import { expect, test } from "vitest";
import { getNavigationView } from "./helpers/stack-fixtures.js";

type Params = { Home: undefined; Details: undefined };
type Header = (props: StackHeaderProps) => ReactNode;
type DetailsProps = StackScreenProps<Params, "Details"> & { observe: (header: Header) => void };

const Stack = createStackNavigator<Params>();
const Home = (): ReactNode => <GtkLabel>Home Content</GtkLabel>;

const Details = ({ navigation, observe }: DetailsProps): ReactNode => {
    useEffect(() => {
        const header: Header = () => <GtkLabel>Details Header</GtkLabel>;
        observe(header);
        navigation.setOptions({ header });
    }, [navigation, observe]);

    return <GtkLabel>Details Content</GtkLabel>;
};

const collect = async (): Promise<void> => {
    expect(globalThis.gc).toBeTypeOf("function");
    for (let round = 0; round < 3; round += 1) {
        await setImmediate();
        globalThis.gc?.();
    }
};

type MountedDetails = {
    ref: ReturnType<typeof createNavigationContainerRef<Params>>;
    headers: WeakRef<Header>[];
    view: ReturnType<typeof getNavigationView>;
    key: string;
};

const renderDetails = async (): Promise<MountedDetails> => {
    const ref = createNavigationContainerRef<Params>();
    const headers: WeakRef<Header>[] = [];
    const observe = (header: Header): void => {
        headers.push(new WeakRef(header));
    };

    await render(
        <NavigationContainer ref={ref}>
            <Stack.Navigator>
                <Stack.Screen name="Home" component={Home} />
                <Stack.Screen name="Details">{(props) => <Details {...props} observe={observe} />}</Stack.Screen>
            </Stack.Navigator>
        </NavigationContainer>,
    );

    await act(() => {
        ref.navigate("Details");
    });
    await screen.findByText("Details Header");
    const route = ref.getCurrentRoute();
    if (route === undefined) {
        throw new Error("The details route is missing");
    }

    return { ref, headers, view: getNavigationView("Details Content"), key: route.key };
};

test.each(["pop", "replace", "reset"])("unregisters a removed page after %s", async (action) => {
    const { ref, view, key } = await renderDetails();

    await act(() => {
        if (action === "reset") {
            ref.resetRoot({ index: 0, routes: [{ name: "Home" }] });
        } else {
            ref.dispatch(action === "pop" ? StackActions.pop() : StackActions.replace("Home"));
        }
    });
    await screen.findByText("Home Content");
    expect(view.findPage(key)).toBeNull();
});

test("releases old headers across repeated navigation cycles", async () => {
    const { ref, headers } = await renderDetails();
    await collect();
    expect(headers).toHaveLength(1);
    expect(headers.map((header) => Boolean(header.deref()))).toEqual([true]);

    await act(() => {
        ref.goBack();
    });
    await screen.findByText("Home Content");
    await act(() => {
        ref.navigate("Details");
    });
    await screen.findByText("Details Header");
    await act(() => {
        ref.goBack();
    });
    await screen.findByText("Home Content");
    await waitFor(async () => {
        await collect();
        expect(headers.slice(0, 1).map((header) => Boolean(header.deref()))).toEqual([false]);
    });
});
