import express from 'express'
import cors from 'cors'
import { connect } from '../src/db/connection'
import { ServiceModel, ConnectionModel, FlowModel } from '../src/db/models'
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

app.get('/api/map', async (_req, res) => {
  const [services, connections, flows] = await Promise.all([
    ServiceModel.find({}, { _id: 0, __v: 0 }).lean(),
    ConnectionModel.find({}, { _id: 0, __v: 0 }).lean(),
    FlowModel.find({}, { _id: 0, __v: 0 }).lean(),
  ])
  const map: ConnectivityMap = { services, connections, flows } as ConnectivityMap
  res.json(map)
})

// ── Boot ──────────────────────────────────────────────────────────────────────

connect().then(() => {
  app.listen(PORT, () => console.log(`API server listening on http://localhost:${PORT}`))
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err)
  process.exit(1)
})
