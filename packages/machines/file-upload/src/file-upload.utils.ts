import type { Params } from "@zag-js/core"
import { getEventTarget, getWindow } from "@zag-js/dom-query"
import { isValidFileSize, isValidFileType, type FileError } from "@zag-js/file-utils"
import type { FileRejection, FileUploadSchema } from "./file-upload.types"

export function isEventWithFiles(event: Pick<DragEvent, "dataTransfer" | "target">) {
  const target = getEventTarget<Element>(event)
  if (!event.dataTransfer) return !!target && "files" in target
  return event.dataTransfer.types.some((type) => {
    return type === "Files" || type === "application/x-moz-file"
  })
}

export function isFilesWithinRange(ctx: Params<FileUploadSchema>, incomingCount: number, currentAcceptedFiles: File[]) {
  const { prop, computed } = ctx
  if (!computed("multiple") && incomingCount > 1) return false
  if (!computed("multiple") && incomingCount + currentAcceptedFiles.length === 2) return true
  if (incomingCount + currentAcceptedFiles.length > prop("maxFiles")) return false
  return true
}

const getFileKey = (file: File) => JSON.stringify([file.name, file.size, file.type])

export function getEventFiles(
  ctx: Params<FileUploadSchema>,
  files: File[],
  currentAcceptedFiles: File[] = [],
  currentRejectedFiles: FileRejection[] = [],
) {
  const { prop, computed } = ctx
  const acceptedFiles: File[] = []
  const rejectedFiles: FileRejection[] = []

  const validateParams = {
    acceptedFiles: currentAcceptedFiles,
    rejectedFiles: currentRejectedFiles,
  }

  const seenKeys = new Set(currentAcceptedFiles.map(getFileKey))

  const multiple = computed("multiple")
  const capacity = multiple ? prop("maxFiles") : Infinity

  files.forEach((file) => {
    if (currentAcceptedFiles.length + acceptedFiles.length >= capacity) {
      rejectedFiles.push({ file, errors: ["TOO_MANY_FILES"] })
      return
    }

    const [accepted, acceptError] = isValidFileType(file, computed("acceptAttr"))
    const [sizeMatch, sizeError] = isValidFileSize(file, prop("minFileSize"), prop("maxFileSize"))

    const key = getFileKey(file)
    const isDuplicate = seenKeys.has(key)

    const validateErrors = prop("validate")?.(file, validateParams)

    const valid = validateErrors ? validateErrors.length === 0 : true

    if (accepted && sizeMatch && valid && !isDuplicate) {
      acceptedFiles.push(file)
      seenKeys.add(key)
    } else {
      const errors = [acceptError, sizeError]
      if (isDuplicate) errors.push("FILE_EXISTS")
      if (!valid) errors.push(...(validateErrors ?? []))
      rejectedFiles.push({ file, errors: errors.filter(Boolean) as FileError[] })
    }
  })

  if (!multiple && !isFilesWithinRange(ctx, acceptedFiles.length, currentAcceptedFiles)) {
    acceptedFiles.forEach((file) => {
      rejectedFiles.push({ file, errors: ["TOO_MANY_FILES"] })
    })
    acceptedFiles.splice(0)
  }

  return {
    acceptedFiles,
    rejectedFiles,
  }
}

export function setInputFiles(inputEl: HTMLInputElement, files: File[]) {
  const win = getWindow(inputEl)
  try {
    if ("DataTransfer" in win) {
      const dataTransfer = new win.DataTransfer()
      files.forEach((file) => {
        dataTransfer.items.add(file)
      })
      inputEl.files = dataTransfer.files
    }
  } catch {
    // do nothing
  }
}
