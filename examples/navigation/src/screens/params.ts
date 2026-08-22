import type { NavigatorScreenParams } from "@gtkx/navigation";

type InboxParamList = {
    Messages: undefined;
    Message: { id: string };
    Compose: { id: string };
};

type SettingsParamList = {
    General: undefined;
    Appearance: undefined;
};

type RootParamList = {
    Inbox: NavigatorScreenParams<InboxParamList> | undefined;
    Settings: NavigatorScreenParams<SettingsParamList> | undefined;
    About: undefined;
};

export type { InboxParamList, RootParamList, SettingsParamList };
