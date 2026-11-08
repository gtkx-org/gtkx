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

const openNote = (name: string): void => {
    navigationRef.navigate("Note", { name });
};

const openNoteName = (): string | null => {
    const route = navigationRef.isReady()
        ? navigationRef.getCurrentRoute()
        : undefined;

    return route?.name === "Note" ? route.params.name : null;
};

const closeNoteIfOpen = (name: string): void => {
    if (openNoteName() === name) {
        navigationRef.goBack();
    }
};

const useOpenNoteName = (): string | null =>
    useNavigationState<RootParamList, string | null>((state) => {
        const route = state.routes.at(-1);

        return route?.name === "Note" ? (route.params?.name ?? null) : null;
    });

export {
    closeNoteIfOpen,
    navigationRef,
    openNote,
    openNoteName,
    type RootParamList,
    Split,
    useOpenNoteName,
};
