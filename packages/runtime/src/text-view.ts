import { propertyWriteComplete } from "./property-brand.js";

type TextView<TBuffer, TValue> = {
    getBuffer: (this: TextView<TBuffer, TValue>) => TBuffer;
    setBuffer: (this: TextView<TBuffer, TValue>, buffer: TBuffer | null) => void;
    setProperty: (this: TextView<TBuffer, TValue>, propertyName: string, value: TValue) => void;
};

/* TODO: Keep eager default-buffer creation until GTK safely handles nullable buffer writes.
 * https://github.com/gtkx-org/gtkx/issues/725
 */
function installTextViewBufferOverride<TBuffer, TValue>(prototype: TextView<TBuffer, TValue>): void {
    const { getBuffer, setBuffer, setProperty } = prototype;
    const completePropertyWrite = function (this: TextView<TBuffer, TValue>, propertyName: string): void {
        if (propertyName === "buffer") {
            getBuffer.call(this);
        }
    };

    prototype.setBuffer = function (this: TextView<TBuffer, TValue>, buffer): void {
        setBuffer.call(this, buffer);

        if (buffer === null) {
            getBuffer.call(this);
        }
    };
    prototype.setProperty = function (this: TextView<TBuffer, TValue>, propertyName, value): void {
        setProperty.call(this, propertyName, value);
        completePropertyWrite.call(this, propertyName);
    };
    Object.defineProperty(prototype, propertyWriteComplete, { value: completePropertyWrite });
}

export { installTextViewBufferOverride };
