import { Schema, model } from 'mongoose'

// Zod handles all structural validation before documents reach Mongoose.
// These schemas only define top-level indexed fields and use Mixed for
// complex nested arrays — keeping Mongoose as a thin persistence layer.

// ── Services ──────────────────────────────────────────────────────────────────

const serviceSchema = new Schema({
  name:        { type: String, required: true, unique: true, index: true },
  type:        { type: String, required: true },
  description: { type: String, required: true },
  endpoints:   { type: Schema.Types.Mixed, required: true },
  databases:   { type: Schema.Types.Mixed },
})

export const ServiceModel = model('Service', serviceSchema)

// ── Connections ───────────────────────────────────────────────────────────────

const connectionSchema = new Schema({
  from:          { type: String, required: true, index: true },
  to:            { type: String, required: true, index: true },
  sdkPackage:    { type: String, required: true },
  description:   { type: String, required: true },
  usedEndpoints: { type: [String], required: true },
})
connectionSchema.index({ from: 1, to: 1 }, { unique: true })

export const ConnectionModel = model('Connection', connectionSchema)

// ── Flows ─────────────────────────────────────────────────────────────────────

const flowSchema = new Schema({
  id:          { type: String, required: true, unique: true, index: true },
  name:        { type: String, required: true },
  description: { type: String, required: true },
  steps:       { type: Schema.Types.Mixed, required: true },
  infraNodes:  { type: Schema.Types.Mixed },
  infraEdges:  { type: Schema.Types.Mixed },
})

export const FlowModel = model('Flow', flowSchema)
