export type Json = Record<string, unknown>

const isJson = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
export const obj = (v: unknown): Json => (isJson(v) ? v : {})
export const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
export const text = (v: unknown): string | null => (typeof v === 'string' ? v : null)
export const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)
export const present = <T>(v: T | null): v is T => v !== null
