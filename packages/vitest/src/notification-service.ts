import { type InterfaceDescriptor, sessionBus } from "@homebridge/dbus-native";

const NOTIFICATIONS_NAME = "org.freedesktop.Notifications";
const NOTIFICATIONS_PATH = "/org/freedesktop/Notifications";

const DESCRIPTOR: InterfaceDescriptor = {
    name: NOTIFICATIONS_NAME,
    methods: {
        Notify: [
            "susssasa{sv}i",
            "u",
            ["app_name", "replaces_id", "app_icon", "summary", "body", "actions", "hints", "expire_timeout"],
            ["id"],
        ],
        CloseNotification: ["u", "", ["id"], []],
        GetCapabilities: ["", "as", [], ["capabilities"]],
    },
    signals: {
        NotificationClosed: ["uu", "id", "reason"],
        ActionInvoked: ["us", "id", "action_key"],
    },
};

const startNotificationService = async (busAddress: string): Promise<() => void> => {
    const bus = sessionBus({ busAddress });
    bus.exportInterface(new NotificationService(), NOTIFICATIONS_PATH, DESCRIPTOR);

    await new Promise<void>((resolve, reject) => {
        bus.requestName(NOTIFICATIONS_NAME, 0, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

    return () => bus.connection.stream.destroy();
};

class NotificationService extends EventTarget {
    private lastId = 0;

    CloseNotification = (): void => undefined;

    Notify(): number {
        this.lastId += 1;

        return this.lastId;
    }

    GetCapabilities(): string[] {
        return ["body", "actions"];
    }
}

export { startNotificationService };
