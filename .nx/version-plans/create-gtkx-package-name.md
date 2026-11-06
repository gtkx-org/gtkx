---
__default__: patch
---

`create-gtkx` now accepts any project directory name, such as `Unit Converter`, `café` or `unit_converter`. When the directory's name is not a valid package name, the scaffold derives one by lowercasing it, removing accents and replacing other characters with hyphens, and asks for it in the interactive flow with that suggestion, as `create-vite` does. The suggested display name and application ID also come from the directory's name, so `Unit Converter` gets the display name "Unit Converter" and the application ID `com.UnitConverter.app`.
