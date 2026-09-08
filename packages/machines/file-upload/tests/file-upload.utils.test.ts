import { describe, expect, test } from "vitest"
import { getEventFiles } from "../src/file-upload.utils"

interface CtxOptions {
  maxFiles?: number
  minFileSize?: number
  maxFileSize?: number
  accept?: string
  validate?: (file: File) => string[] | null
}

// getEventFiles only reads `prop` and `computed` off the params.
function createCtx(options: CtxOptions = {}) {
  const { maxFiles = 1, minFileSize = 0, maxFileSize = Infinity, accept, validate } = options
  const props: Record<string, any> = { maxFiles, minFileSize, maxFileSize, validate }
  const computed: Record<string, any> = {
    acceptAttr: accept,
    multiple: maxFiles > 1,
  }
  return {
    prop: (key: string) => props[key],
    computed: (key: string) => computed[key],
  } as any
}

function makeFile(name: string, { size = 4, type = "text/plain" }: { size?: number; type?: string } = {}) {
  return new File(["x".repeat(size)], name, { type })
}

describe("@zag-js/file-upload getEventFiles", () => {
  test("dedupes within a single batch (FILE_EXISTS)", () => {
    const ctx = createCtx({ maxFiles: 10 })
    const a = makeFile("a.txt")
    const dup = makeFile("a.txt")
    const b = makeFile("b.txt")

    const { acceptedFiles, rejectedFiles } = getEventFiles(ctx, [a, dup, b])

    expect(acceptedFiles.map((f) => f.name)).toEqual(["a.txt", "b.txt"])
    expect(rejectedFiles).toHaveLength(1)
    expect(rejectedFiles[0].errors).toContain("FILE_EXISTS")
  })

  test("dedupes against currentAcceptedFiles", () => {
    const ctx = createCtx({ maxFiles: 10 })
    const existing = makeFile("a.txt")
    const dup = makeFile("a.txt")
    const b = makeFile("b.txt")

    const { acceptedFiles, rejectedFiles } = getEventFiles(ctx, [dup, b], [existing])

    expect(acceptedFiles.map((f) => f.name)).toEqual(["b.txt"])
    expect(rejectedFiles[0].errors).toContain("FILE_EXISTS")
  })

  test("files differing only by size or type are not duplicates", () => {
    const ctx = createCtx({ maxFiles: 10 })
    const files = [
      makeFile("a.txt", { size: 4 }),
      makeFile("a.txt", { size: 8 }),
      makeFile("a.txt", { size: 4, type: "text/markdown" }),
    ]
    const { acceptedFiles, rejectedFiles } = getEventFiles(ctx, files)
    expect(acceptedFiles).toHaveLength(3)
    expect(rejectedFiles).toHaveLength(0)
  })

  test("enforces maxFiles incrementally (partial accept)", () => {
    const ctx = createCtx({ maxFiles: 3 })
    const files = Array.from({ length: 5 }, (_, i) => makeFile(`f${i}.txt`))

    const { acceptedFiles, rejectedFiles } = getEventFiles(ctx, files)

    expect(acceptedFiles.map((f) => f.name)).toEqual(["f0.txt", "f1.txt", "f2.txt"])
    expect(rejectedFiles).toHaveLength(2)
    expect(rejectedFiles.every((r) => r.errors.includes("TOO_MANY_FILES"))).toBe(true)
  })

  test("counts currentAcceptedFiles toward maxFiles", () => {
    const ctx = createCtx({ maxFiles: 3 })
    const current = [makeFile("a.txt"), makeFile("b.txt")]
    const files = [makeFile("c.txt"), makeFile("d.txt")]

    const { acceptedFiles, rejectedFiles } = getEventFiles(ctx, files, current)

    expect(acceptedFiles.map((f) => f.name)).toEqual(["c.txt"])
    expect(rejectedFiles[0].errors).toContain("TOO_MANY_FILES")
  })

  test("non-multiple: too many at once rejects all", () => {
    const ctx = createCtx({ maxFiles: 1 })
    const { acceptedFiles, rejectedFiles } = getEventFiles(ctx, [makeFile("a.txt"), makeFile("b.txt")])
    expect(acceptedFiles).toHaveLength(0)
    expect(rejectedFiles.every((r) => r.errors.includes("TOO_MANY_FILES"))).toBe(true)
  })

  test("non-multiple: single file replaces existing one", () => {
    const ctx = createCtx({ maxFiles: 1 })
    const current = [makeFile("a.txt")]
    const { acceptedFiles } = getEventFiles(ctx, [makeFile("b.txt")], current)
    expect(acceptedFiles.map((f) => f.name)).toEqual(["b.txt"])
  })

  test("preserves size and type errors", () => {
    const ctx = createCtx({ maxFiles: 10, maxFileSize: 5, accept: "text/plain" })
    const tooBig = makeFile("big.txt", { size: 100 })
    const wrongType = makeFile("img.png", { type: "image/png" })
    const ok = makeFile("ok.txt", { size: 2 })

    const { acceptedFiles, rejectedFiles } = getEventFiles(ctx, [tooBig, wrongType, ok])

    expect(acceptedFiles.map((f) => f.name)).toEqual(["ok.txt"])
    const byName = Object.fromEntries(rejectedFiles.map((r) => [r.file.name, r.errors]))
    expect(byName["big.txt"]).toContain("FILE_TOO_LARGE")
    expect(byName["img.png"]).toContain("FILE_INVALID_TYPE")
  })

  test("handles large N without O(n^2) blowup", () => {
    const ctx = createCtx({ maxFiles: Number.MAX_SAFE_INTEGER })
    const N = 20_000
    // Half unique, half duplicates of the first unique file.
    const files: File[] = []
    for (let i = 0; i < N; i++) files.push(makeFile(`f${i}.txt`))
    for (let i = 0; i < N; i++) files.push(makeFile("f0.txt"))

    const start = performance.now()
    const { acceptedFiles, rejectedFiles } = getEventFiles(ctx, files)
    const elapsed = performance.now() - start

    expect(acceptedFiles).toHaveLength(N)
    expect(rejectedFiles).toHaveLength(N)
    expect(rejectedFiles.every((r) => r.errors.includes("FILE_EXISTS"))).toBe(true)
    // Generous ceiling; the old O(n^2) path takes seconds-to-minutes at this size.
    expect(elapsed).toBeLessThan(2000)
  })
})
