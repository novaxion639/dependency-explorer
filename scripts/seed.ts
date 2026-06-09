/**
 * Seed script — pushes all services, connections and flows to MongoDB.
 *
 * Usage:
 *   MONGODB_URI=mongodb://localhost:27017/dependency-explorer npx tsx scripts/seed.ts
 *
 * Behaviour:
 *   - Upserts every document by its natural key (name / from+to / id).
 *   - Safe to run multiple times — subsequent runs update existing records.
 */

import { connect, disconnect } from '../src/db/connection'
import { ServiceModel, ConnectionModel, FlowModel, TeamModel, DomainModel } from '../src/db/models'
import { connectivityMap } from '../src/data'

async function seed() {
  await connect()

  // ── Services ────────────────────────────────────────────────────────────────
  const serviceOps = connectivityMap.services.map(svc =>
    ServiceModel.findOneAndUpdate(
      { name: svc.name },
      svc,
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    )
  )
  await Promise.all(serviceOps)
  console.log(`✅ Seeded ${connectivityMap.services.length} services`)

  // ── Connections ─────────────────────────────────────────────────────────────
  const connectionOps = connectivityMap.connections.map(conn =>
    ConnectionModel.findOneAndUpdate(
      { from: conn.from, to: conn.to },
      conn,
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    )
  )
  await Promise.all(connectionOps)
  console.log(`✅ Seeded ${connectivityMap.connections.length} connections`)

  // ── Flows ───────────────────────────────────────────────────────────────────
  const flowOps = connectivityMap.flows.map(flow =>
    FlowModel.findOneAndUpdate(
      { id: flow.id },
      flow,
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    )
  )
  await Promise.all(flowOps)
  console.log(`✅ Seeded ${connectivityMap.flows.length} flows`)

  // ── Teams ──────────────────────────────────────────────────────────────────
  if (connectivityMap.teams?.length) {
    const teamOps = connectivityMap.teams.map(team =>
      TeamModel.findOneAndUpdate(
        { id: team.id },
        team,
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
    )
    await Promise.all(teamOps)
    console.log(`✅ Seeded ${connectivityMap.teams.length} teams`)
  }

  // ── Domains ────────────────────────────────────────────────────────────────
  if (connectivityMap.domains?.length) {
    const domainOps = connectivityMap.domains.map(domain =>
      DomainModel.findOneAndUpdate(
        { id: domain.id },
        domain,
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
    )
    await Promise.all(domainOps)
    console.log(`✅ Seeded ${connectivityMap.domains.length} domains`)
  }

  await disconnect()
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
