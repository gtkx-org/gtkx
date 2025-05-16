module "@gtkx/native" {
  type ReturnType =
    | "void"
    | "string"
    | "number"
    | "boolean"
    | "gobject"
    | "string[]"
    | "number[]"
    | "boolean[]";

  type ReturnTypeMap = {
    void: void;
    string: string;
    number: number;
    boolean: boolean;
    gobject: gobject;
    "string[]": string[];
    "number[]": number[];
    "boolean[]": boolean[];
  };

  export function start(): void;
  export function call<T extends ReturnType>(
    name: string,
    args: any[],
    returnType: T
  ): ReturnTypeMap[T];
}
