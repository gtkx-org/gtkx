import { Device } from "../generated/cairo/device.js";
import type { DeviceType, Status } from "../generated/cairo/enums.js";
import { call } from "../native.js";
import { DEVICE_T, INT_TYPE, LIB } from "./common.js";

declare module "../generated/cairo/device.js" {
    interface Device {
        status(): Status;
        finish(): void;
        flush(): void;
        getType(): DeviceType;
        acquire(): Status;
        release(): void;
    }
}

Device.prototype.status = function (): Status {
    return call(LIB, "cairo_device_status", [{ type: DEVICE_T, value: this.handle }], INT_TYPE) as Status;
};

Device.prototype.finish = function (): void {
    call(LIB, "cairo_device_finish", [{ type: DEVICE_T, value: this.handle }], { type: "undefined" });
};

Device.prototype.flush = function (): void {
    call(LIB, "cairo_device_flush", [{ type: DEVICE_T, value: this.handle }], { type: "undefined" });
};

Device.prototype.getType = function (): DeviceType {
    return call(LIB, "cairo_device_get_type", [{ type: DEVICE_T, value: this.handle }], INT_TYPE) as DeviceType;
};

Device.prototype.acquire = function (): Status {
    return call(LIB, "cairo_device_acquire", [{ type: DEVICE_T, value: this.handle }], INT_TYPE) as Status;
};

Device.prototype.release = function (): void {
    call(LIB, "cairo_device_release", [{ type: DEVICE_T, value: this.handle }], { type: "undefined" });
};
