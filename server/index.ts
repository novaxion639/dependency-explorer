import express from 'express'
import cors from 'cors'
import { connect } from '../src/db/connection'
import { ServiceModel, ConnectionModel, FlowModel, TeamModel, DomainModel } from '../src/db/models'
import { connectivityMap } from '../src/data'
import type { ConnectivityMap } from '../src/data/schemas'

const PORT = process.env.PORT ?? 3001

const app = express()
app.use(cors())
app.use(express.json())

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/services', async (_req, res) => {
  const services = await ServiceModel.find({}, { _id: 0, __v: 0 }).lean()
  res.json(services)
})

app.get('/api/connections', async (_req, res) => {
  const connections = await ConnectionModel.find({}, { _id: 0, __v: 0 }).lean()
  res.json(connections)
})

app.get('/api/flows', async (_req, res) => {
  const flows = await FlowModel.find({}, { _id: 0, __v: 0 }).lean()
  res.json(flows)
})

app.get('/api/teams', async (_req, res) => {
  const teams = await TeamModel.find({}, { _id: 0, __v: 0 }).lean()
  res.json(teams)
})

app.get('/api/domains', async (_req, res) => {
  const domains = await DomainModel.find({}, { _id: 0, __v: 0 }).lean()
  res.json(domains)
})

app.get('/api/map', async (_req, res) => {
  const [services, connections, flows, teams, domains] = await Promise.all([
    ServiceModel.find({}, { _id: 0, __v: 0 }).lean(),
    ConnectionModel.find({}, { _id: 0, __v: 0 }).lean(),
    FlowModel.find({}, { _id: 0, __v: 0 }).lean(),
    TeamModel.find({}, { _id: 0, __v: 0 }).lean(),
    DomainModel.find({}, { _id: 0, __v: 0 }).lean(),
  ])
  const map: ConnectivityMap = { services, connections, flows, teams, domains } as ConnectivityMap
  res.json(map)
})

// ── Seed ─────────────────────────────────────────────────────────────────────

app.post('/api/seed', async (_req, res) => {
  try {
    const results: Record<string, number> = {}

    await Promise.all(connectivityMap.services.map(svc =>
      ServiceModel.findOneAndUpdate({ name: svc.name }, svc, { upsert: true }),
    ))
    results.services = connectivityMap.services.length

    await Promise.all(connectivityMap.connections.map(conn =>
      ConnectionModel.findOneAndUpdate({ from: conn.from, to: conn.to }, conn, { upsert: true }),
    ))
    results.connections = connectivityMap.connections.length

    await Promise.all(connectivityMap.flows.map(flow =>
      FlowModel.findOneAndUpdate({ id: flow.id }, flow, { upsert: true }),
    ))
    results.flows = connectivityMap.flows.length

    if (connectivityMap.teams?.length) {
      await Promise.all(connectivityMap.teams.map(team =>
        TeamModel.findOneAndUpdate({ id: team.id }, team, { upsert: true }),
      ))
      results.teams = connectivityMap.teams.length
    }

    if (connectivityMap.domains?.length) {
      await Promise.all(connectivityMap.domains.map(domain =>
        DomainModel.findOneAndUpdate({ id: domain.id }, domain, { upsert: true }),
      ))
      results.domains = connectivityMap.domains.length
    }

    res.json({ ok: true, seeded: results })
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) })
  }
})

// ── Boot ──────────────────────────────────────────────────────────────────────

connect().then(() => {
  app.listen(PORT, () => console.log(`API server listening on http://localhost:${PORT}`))
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err)
  process.exit(1)
})
