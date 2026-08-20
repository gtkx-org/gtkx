import { getHandle, registerWrapperClass, t } from "@gtkx/runtime";
import type { DeviceType, Status } from "./enums.js";
import { bindCairo, cairoGType, DEVICE_T } from "./lib.js";

const DEVICE_TYPE = cairoGType("cairo_gobject_device_get_type");
const cairoDeviceStatus = bindCairo("cairo_device_status", [DEVICE_T], t.int32);
const cairoDeviceGetType = bindCairo("cairo_device_get_type", [DEVICE_T], t.int32);
const cairoDeviceFinish = bindCairo("cairo_device_finish", [DEVICE_T], t.void);
const cairoDeviceFlush = bindCairo("cairo_device_flush", [DEVICE_T], t.void);
const cairoDeviceGetReferenceCount = bindCairo("cairo_device_get_reference_count", [DEVICE_T], t.int32);

/**
 * A cairo device (`cairo_device_t`): the backend-specific object behind a surface, such as a GL context or an
 * output stream. Instances come from bindings that hand one back.
 */
abstract class Device {
    static {
        registerWrapperClass(this, DEVICE_TYPE);
    }

    /** GType of `CairoDevice`, the boxed type this class is registered under. */
    declare __type__: bigint;

    /** Returns the error status of the device, `Status.SUCCESS` when it is usable. */
    status(): Status {
        return cairoDeviceStatus(getHandle(this)) as Status;
    }

    /** Returns the backend the device belongs to. */
    getType(): DeviceType {
        return cairoDeviceGetType(getHandle(this)) as DeviceType;
    }

    /** Finishes the device, dropping its resources; further drawing through it fails. */
    finish(): void {
        cairoDeviceFinish(getHandle(this));
    }

    /** Flushes any pending operations on the device. */
    flush(): void {
        cairoDeviceFlush(getHandle(this));
    }

    /** Returns the reference count of the device. */
    getReferenceCount(): number {
        return cairoDeviceGetReferenceCount(getHandle(this)) as number;
    }
}

export { Device };
