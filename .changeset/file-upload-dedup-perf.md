---
"@zag-js/file-upload": patch
---

Fixed an `O(n²)` slowdown when ingesting a large number of files (e.g. dropping a directory containing
`node_modules`). Deduplication now uses a `Set` lookup instead of rescanning the growing accepted list per
file, and `maxFiles` is enforced incrementally so processing stops once the limit is reached.

As part of this, the multiple-file case now accepts files up to `maxFiles` and rejects the rest as
`TOO_MANY_FILES`, instead of rejecting the entire batch when it overflows. Single-select behavior is unchanged.
