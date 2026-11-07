import { createSplitViewNavigator, useNavigationState } from "@gtkx/navigation";

type RootParamList = {
    Notes: undefined;
    Note: { name: string };
};

const Split = createSplitViewNavigator<RootParamList>();

type RootNavigatorType = typeof Split;

declare module "@react-navigation/core" {
    interface RootNavigator extends RootNavigatorType {}
}

const useOpenNoteName = (): string | null =>
    useNavigationState<RootParamList, string | null>((state) => {
        const route = state.routes.at(-1);

        return route?.name === "Note" ? (route.params?.name ?? null) : null;
    });

export { type RootParamList, Split, useOpenNoteName };
