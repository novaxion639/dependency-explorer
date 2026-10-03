import { createContext } from 'react'
import type { DiagramRef } from '../model'

export const DiagramSelectContext = createContext<(ref: DiagramRef) => void>(() => {})
