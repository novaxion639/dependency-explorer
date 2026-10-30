import { connectivityMap } from '@dependency-explorer/data'
import { checkStateMachines } from './state-machine-check'
import { machineSection } from './finding-sections'
import { PINNED_BASE } from './pinned'

const result = checkStateMachines(connectivityMap, PINNED_BASE)
console.log(machineSection(result))
process.exitCode = result.findings.length ? 1 : 0
