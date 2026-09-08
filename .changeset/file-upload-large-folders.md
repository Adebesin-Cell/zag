---
"@zag-js/file-upload": minor
"@zag-js/file-utils": minor
---

Add configuration for ingesting large folders without freezing the main thread:

- **`ignoreEntry`** — called for each entry while traversing a dropped directory. Return `true` to skip a
  file, or an entire subtree when it's a directory (e.g. `node_modules`). Skipped subtrees are never
  enumerated.
- **`getFilesFromEvent`** — override how files are extracted from the drop/select event (return `File[]`,
  optionally async), as an escape hatch for custom traversal, pruning, or capping.
- **`syncInputElement`** (default `true`) — set to `false` to skip mirroring accepted files back into the
  hidden `<input>`. The sync rebuilds a `DataTransfer` on every change, which is costly for very large sets.

For directory uploads, `maxFiles` now also bounds directory traversal so it stops early instead of reading
the whole tree.

`getFileEntries` (from `@zag-js/file-utils`) gains an options argument (`{ maxFiles, ignore }`) and now sets
`relativePath` from the entry's full path (previously nested paths were concatenated without separators).
