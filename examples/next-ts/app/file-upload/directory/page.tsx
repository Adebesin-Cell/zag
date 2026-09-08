"use client"

import * as fileUpload from "@zag-js/file-upload"
import { normalizeProps, useMachine } from "@zag-js/react"
import { useId } from "react"
import { StateVisualizer } from "@/components/state-visualizer"
import { Toolbar } from "@/components/toolbar"
import "@styles/file-upload.css"

const IGNORED = /^(node_modules|\.git|dist|\.next|\.nuxt|\.output|coverage|build)$/

export default function Page() {
  const service = useMachine(fileUpload.machine, {
    id: useId(),
    directory: true,
    maxFiles: 20_000,
    ignoreEntry: (entry) => entry.isDirectory && IGNORED.test(entry.name),
    syncInputElement: false,
  })

  const api = fileUpload.connect(service, normalizeProps)

  return (
    <>
      <main className="file-upload">
        <p>
          Drop or choose a folder (e.g. a repo containing <code>node_modules</code>).
        </p>

        <div {...api.getRootProps()}>
          <input data-testid="input" {...api.getHiddenInputProps()} />
          <div {...api.getDropzoneProps()}>Drag your folder here</div>

          <button {...api.getTriggerProps()}>Choose Folder...</button>

          <div data-testid="stats" style={{ marginTop: 8 }}>
            Accepted: <b>{api.acceptedFiles.length}</b>
          </div>

          <ul {...api.getItemGroupProps()}>
            {api.acceptedFiles.slice(0, 200).map((file) => (
              <li className="file" key={`${file.name}-${file.size}`} {...api.getItemProps({ file })}>
                <div>
                  <b>{file.name}</b>
                </div>
                <div {...api.getItemSizeTextProps({ file })}>{api.getFileSize(file)}</div>
                <button {...api.getItemDeleteTriggerProps({ file })}>X</button>
              </li>
            ))}
          </ul>
          {api.acceptedFiles.length > 200 && <p>…and {api.acceptedFiles.length - 200} more (list truncated)</p>}
        </div>
      </main>

      <Toolbar>
        <StateVisualizer state={service} omit={["acceptedFiles", "rejectedFiles"]} />
      </Toolbar>
    </>
  )
}
