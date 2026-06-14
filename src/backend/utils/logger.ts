type TLogMeta = Record<string, unknown>

const formatMeta = (meta?: TLogMeta): string => {
  if (!meta) {
    return ''
  }

  return ` ${JSON.stringify(meta)}`
}

export const logger = {
  info(message: string, meta?: TLogMeta): void {
    console.info(`[info] ${message}${formatMeta(meta)}`)
  },
  warn(message: string, meta?: TLogMeta): void {
    console.warn(`[warn] ${message}${formatMeta(meta)}`)
  },
  error(message: string, meta?: TLogMeta): void {
    console.error(`[error] ${message}${formatMeta(meta)}`)
  }
}
