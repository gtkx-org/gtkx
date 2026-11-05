---
__default__: patch
---

RPM packages no longer claim ownership of system directories that `deploy.extraFiles` installs into, such as `/usr/share/man/man1`, `/usr/share/bash-completion/completions`, `/usr/share/zsh/site-functions` or `/usr/share/locale/<language>/LC_MESSAGES`. Fedora's `filesystem` package owns them, and its packaging guidelines ask other packages not to.
