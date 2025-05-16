import { call } from "@gtkx/native";

const getMajorVersion = () => {
  return call("gtk_get_major_version", [], "number");
};

const getMinorVersion = () => {
  return call("gtk_get_minor_version", [], "number");
};

const getMicroVersion = () => {
  return call("gtk_get_micro_version", [], "number");
};

export { getMajorVersion, getMinorVersion, getMicroVersion };
