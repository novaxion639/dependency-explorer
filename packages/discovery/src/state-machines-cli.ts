import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectivityMap } from '@dependency-explorer/data'
import { checkStateMachines } from './state-machine-check'
import { machineSection } from './state-machines-report'

const PINNED_BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.pinned')
const result = checkStateMachines(connectivityMap, PINNED_BASE)
console.log(machineSection(result))
process.exitCode = result.findings.length ? 1 : 0
