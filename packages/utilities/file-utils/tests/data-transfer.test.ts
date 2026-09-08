import { describe, expect, test } from "vitest"
import { getFileEntries } from "../src/data-transfer"

type Entry = FileSystemEntry

function fileEntry(name: string, fullPath: string): Entry {
  return {
    isFile: true,
    isDirectory: false,
    name,
    fullPath,
    file: (cb: (f: File) => void) => cb(new File([name], name)),
  } as unknown as Entry
}

function dirEntry(name: string, fullPath: string, children: Entry[]): Entry {
  return {
    isFile: false,
    isDirectory: true,
    name,
    fullPath,
    createReader: () => {
      let done = false
      return {
        readEntries: (cb: (e: Entry[]) => void) => {
          if (done) return cb([])
          done = true
          cb(children)
        },
      }
    },
  } as unknown as Entry
}

// Minimal DataTransferItemList stand-in: an array of items exposing webkitGetAsEntry.
function items(entries: Entry[]): DataTransferItemList {
  return entries.map((entry) => ({ kind: "file", webkitGetAsEntry: () => entry })) as unknown as DataTransferItemList
}

describe("getFileEntries", () => {
  test("traverses directories and sets relativePath from fullPath", async () => {
    const tree = items([
      dirEntry("app", "/app", [
        fileEntry("index.ts", "/app/index.ts"),
        dirEntry("src", "/app/src", [fileEntry("a.ts", "/app/src/a.ts")]),
      ]),
    ])

    const files = await getFileEntries(tree, true)

    expect(files.map((f) => f.name)).toEqual(["index.ts", "a.ts"])
    expect(files.map((f) => (f as any).relativePath)).toEqual(["app/index.ts", "app/src/a.ts"])
  })

  test("ignore prunes an entire subtree without reading it", async () => {
    let nodeModulesRead = false
    const nm = dirEntry("node_modules", "/app/node_modules", [])
    // Fail loudly if the pruned subtree is ever enumerated.
    ;(nm as any).createReader = () => ({
      readEntries: () => {
        nodeModulesRead = true
        throw new Error("node_modules should not be read")
      },
    })

    const tree = items([dirEntry("app", "/app", [fileEntry("index.ts", "/app/index.ts"), nm])])

    const files = await getFileEntries(tree, true, {
      ignore: (entry) => entry.isDirectory && entry.name === "node_modules",
    })

    expect(files.map((f) => f.name)).toEqual(["index.ts"])
    expect(nodeModulesRead).toBe(false)
  })

  test("maxFiles stops traversal early", async () => {
    const tree = items([
      dirEntry(
        "app",
        "/app",
        Array.from({ length: 100 }, (_, i) => fileEntry(`f${i}.ts`, `/app/f${i}.ts`)),
      ),
    ])

    const files = await getFileEntries(tree, true, { maxFiles: 10 })

    expect(files).toHaveLength(10)
  })

  test("does not traverse directories when disabled", async () => {
    const tree = items([dirEntry("app", "/app", [fileEntry("index.ts", "/app/index.ts")])])
    const files = await getFileEntries(tree, false)
    expect(files).toHaveLength(0)
  })
})
