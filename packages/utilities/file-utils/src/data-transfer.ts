const getItemEntry = (item: any): FileSystemEntry | null =>
  typeof item.getAsEntry === "function"
    ? item.getAsEntry()
    : typeof item.webkitGetAsEntry === "function"
      ? item.webkitGetAsEntry()
      : null

const isDirectoryEntry = (entry: FileSystemEntry): entry is FileSystemDirectoryEntry => entry.isDirectory

const isFileEntry = (entry: FileSystemEntry): entry is FileSystemFileEntry => entry.isFile

const setRelativePath = (file: File, path: string) => {
  Object.defineProperty(file, "relativePath", { value: path, configurable: true })
  return file
}

const entryPath = (entry: FileSystemEntry) => entry.fullPath.replace(/^\//, "")

export interface FileEntryInfo {
  name: string
  path: string
  isDirectory: boolean
}

export interface GetFileEntriesOptions {
  maxFiles?: number | undefined
  ignore?: ((entry: FileEntryInfo) => boolean) | undefined
}

const readAllEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> => {
  const entries: FileSystemEntry[] = []
  return new Promise((resolve, reject) => {
    const read = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) return resolve(entries)
        entries.push(...batch)
        read()
      }, reject)
    read()
  })
}

export const getFileEntries = async (
  items: DataTransferItemList,
  traverseDirectories: boolean | undefined,
  options: GetFileEntriesOptions = {},
): Promise<File[]> => {
  const { maxFiles = Number.POSITIVE_INFINITY, ignore } = options
  const files: File[] = []

  const shouldIgnore = (entry: FileSystemEntry) =>
    ignore?.({ name: entry.name, path: entryPath(entry), isDirectory: entry.isDirectory }) ?? false

  const walk = async (entry: FileSystemEntry | null): Promise<void> => {
    if (!entry || files.length >= maxFiles || shouldIgnore(entry)) return

    if (isDirectoryEntry(entry) && traverseDirectories) {
      const children = await readAllEntries(entry.createReader())
      for (const child of children) {
        if (files.length >= maxFiles) break
        await walk(child)
      }
      return
    }

    if (isFileEntry(entry)) {
      const file = await new Promise<File | null>((resolve) => entry.file(resolve, () => resolve(null)))
      if (file) files.push(setRelativePath(file, entryPath(entry)))
    }
  }

  for (const item of Array.from(items)) {
    if (item.kind !== "file" || files.length >= maxFiles) continue
    await walk(getItemEntry(item))
  }

  return files
}
