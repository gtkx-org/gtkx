---
__default__: patch
---

`gtkx deploy` no longer lists appstreamcli's pedantic hints, such as `cid-contains-uppercase-letter` for an application ID like `com.example.Tasks`, when AppStream validation fails. They never failed a deployment, but the failure message showed them beside the real problems, suggesting the application ID had to change. appstreamcli hides them by default too.
