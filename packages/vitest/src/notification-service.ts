import { type InterfaceDescriptor, type ReplyError, sessionBus } from "@homebridge/dbus-native";
import packageManifest from "../package.json" with { type: "json" };

const NOTIFICATIONS_NAME = "org.freedesktop.Notifications";
const NOTIFICATIONS_PATH = "/org/freedesktop/Notifications";
const NAME_TIMEOUT_MS = 15_000;

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
        GetServerInformation: ["", "ssss", [], ["name", "vendor", "version", "spec_version"]],
    },
    signals: {
        NotificationClosed: ["uu", "id", "reason"],
        ActionInvoked: ["us", "id", "action_key"],
    },
};

const toError = (cause: ReplyError): Error => {
    if (cause instanceof Error) {
        return cause;
    }

    const name = cause.name ?? "Error";

    return new Error(cause.message === undefined || cause.message === "" ? name : `${name}: ${cause.message}`);
};

const startNotificationService = async (busAddress: string): Promise<() => void> => {
    const bus = sessionBus({ busAddress });
    bus.exportInterface(new NotificationService(), NOTIFICATIONS_PATH, DESCRIPTOR);
    let isReporting = true;

    await new Promise<void>((resolve, reject) => {
        let isPending = true;

        const wasPending = (): boolean => {
            const isFirst = isPending;
            isPending = false;

            return isFirst;
        };

        const timer = setTimeout(() => {
            if (wasPending()) {
                reject(new Error(`${NOTIFICATIONS_NAME} was not acquired within ${String(NAME_TIMEOUT_MS)}ms`));
            }
        }, NAME_TIMEOUT_MS);

        const fail = (cause: ReplyError): void => {
            const error = toError(cause);

            if (wasPending()) {
                clearTimeout(timer);
                reject(error);
            } else if (isReporting) {
                process.stderr.write(`[gtkx] the D-Bus session bus connection failed: ${error.message}\n`);
            }
        };

        bus.connection.on("error", fail);

        bus.connection.on("end", () => {
            fail(new Error(`the D-Bus session bus closed the connection to ${busAddress}`));
        });

        bus.requestName(NOTIFICATIONS_NAME, 0, (error) => {
            if (error) {
                fail(error);
            } else if (wasPending()) {
                clearTimeout(timer);
                resolve();
            }
        });
    });

    return () => {
        isReporting = false;
        bus.connection.stream.destroy();
    };
};

class NotificationService extends EventTarget {
    private lastId = 0;
    private readonly activeIds: Set<number> = new Set();

    CloseNotification(id: number): Error | undefined {
        if (!this.activeIds.delete(id)) {
            return new Error("Unknown notification");
        }

        this.emit("NotificationClosed", id, 3);

        return undefined;
    }

    emit(name: string, ...args: unknown[]): boolean {
        return this.dispatchEvent(new CustomEvent(name, { detail: args }));
    }

    Notify(_appName: string, replacesId: number): number {
        const id = replacesId === 0 ? this.lastId + 1 : replacesId;
        this.lastId = Math.max(this.lastId, id);
        this.activeIds.add(id);

        return id;
    }

    GetCapabilities(): string[] {
        return [];
    }

    GetServerInformation(): string[] {
        return ["GTKX Test Notifications", "GTKX", packageManifest.version, "1.3"];
    }
}

export { startNotificationService };
