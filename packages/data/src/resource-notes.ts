export interface ResourceNote { description?: string; retention?: string; pii?: string }

export const resourceNotes: Record<string, ResourceNote> = {}
