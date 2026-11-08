import {
    createNavigationContainerRef,
    createSplitViewNavigator,
    useNavigationState,
} from "@gtkx/navigation";

type RootParamList = {
    Notes: undefined;
    Note: { name: string };
};

const Split = createSplitViewNavigator<RootParamList>();

const navigationRef = createNavigationContainerRef<RootParamList>();

type RootNavigatorType = typeof Split;

declare module "@react-navigation/core" {
    interface RootNavigator extends RootNavigatorType {}
}

const useOpenNoteName = (): string | null =>
    useNavigationState<RootParamList, string | null>((state) => {
        const route = state.routes.at(-1);

        return route?.name === "Note" ? (route.params?.name ?? null) : null;
    });

const openNote = (name: string): void => {
    navigationRef.navigate("Note", { name });
};

export { navigationRef, openNote, type RootParamList, Split, useOpenNoteName };
