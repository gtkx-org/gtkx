import { propertyWriteComplete } from "@gtkx/runtime/internal";
import { TextView } from "../gtk.js";

const methods: {
    getBuffer: TextView["getBuffer"];
    setBuffer: TextView["setBuffer"];
    setProperty: TextView["setProperty"];
} = TextView.prototype;
const { getBuffer, setBuffer, setProperty } = methods;

function completePropertyWrite(this: TextView, propertyName: string): void {
    if (propertyName === "buffer") {
        getBuffer.call(this);
    }
}

/* TODO: Keep eager default-buffer creation until GTK safely handles nullable buffer writes.
 * https://github.com/gtkx-org/gtkx/issues/725
 */
TextView.prototype.setBuffer = function (buffer): void {
    setBuffer.call(this, buffer);

    if (buffer === null) {
        getBuffer.call(this);
    }
};
TextView.prototype.setProperty = function (propertyName, value): void {
    setProperty.call(this, propertyName, value);
    completePropertyWrite.call(this, propertyName);
};
Object.defineProperty(TextView.prototype, propertyWriteComplete, { value: completePropertyWrite });
