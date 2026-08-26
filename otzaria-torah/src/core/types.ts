export type OtzariaAction =
  | "search"
  | "read_ref"
  | "read_context"
  | "find_book"
  | "get_links"
  | "get_toc"
  | "db_status"

export type LinkDirection = "incoming" | "outgoing" | "both"
export type ConnectionType = "OTHER" | "COMMENTARY" | "SOURCE" | "TARGUM" | "REFERENCE" | string

export type OtzariaParams = {
  action?: OtzariaAction | string
  query?: string
  ref?: string
  lineId?: number | string
  bookId?: number | string
  lineIndex?: number | string
  radius?: number | string
  limit?: number | string
  heRefOnly?: boolean | string
  direction?: LinkDirection | string
  connectionType?: ConnectionType
  dbPath?: string
}

export type RawToolParams = OtzariaParams & {
  tool_arguments?: any
  toolArguments?: any
  arguments?: any
  args?: any
  input?: any
  payload?: any
  params?: any
  json?: any
  command?: any
}

export type LineResult = {
  lineId: number
  bookId: number
  bookTitle: string
  heRef: string | null
  lineIndex: number
  cleanContent: string
  noNikudPreview: string
  rank?: number
}

export type ToolEnvelope = {
  tool: "otzaria_torah"
  action: string
  dbPath: string | null
  result: any
}

export type OtzariaProgressPhase =
  | "start"
  | "opening_db"
  | "db_opened"
  | "action_start"
  | "search_prepare"
  | "search_attempt_start"
  | "search_attempt_done"
  | "search_attempt_error"
  | "search_partial_results"
  | "action_complete"
  | "error"

export type OtzariaProgressEvent = {
  phase: OtzariaProgressPhase
  title: string
  detail?: string
  action?: string
  query?: string
  dbPath?: string | null
  attemptIndex?: number
  match?: string
  returned?: number
  resultCount?: number
  results?: any[]
  error?: string
}

export type OtzariaProgressHandler = (event: OtzariaProgressEvent) => void
