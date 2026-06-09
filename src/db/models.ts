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
  teamId:      { type: String },
  repoUrl:     { type: String },
  tags:        { type: [String] },
})

export const ServiceModel = model('Service', serviceSchema)

// ── Connections ───────────────────────────────────────────────────────────────

const connectionSchema = new Schema({
  from:              { type: String, required: true, index: true },
  to:                { type: String, required: true, index: true },
  sdkPackage:        { type: String, required: true },
  description:       { type: String, required: true },
  usedEndpoints:     { type: [String], required: true },
  communicationType: { type: String },
  protocol:          { type: String },
  authType:          { type: String },
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

// ── Teams ────────────────────────────────────────────────────────────────────

const teamSchema = new Schema({
  id:           { type: String, required: true, unique: true, index: true },
  name:         { type: String, required: true },
  slackChannel: { type: String },
  onCallUrl:    { type: String },
})

export const TeamModel = model('Team', teamSchema)

// ── Domains ──────────────────────────────────────────────────────────────────

const domainSchema = new Schema({
  id:              { type: String, required: true, unique: true, index: true },
  name:            { type: String, required: true },
  description:     { type: String, required: true },
  color:           { type: String, required: true },
  serviceNames:    { type: [String], required: true },
  dataEntities:    { type: [String] },
  publishedEvents: { type: [String] },
  consumedEvents:  { type: [String] },
})

export const DomainModel = model('Domain', domainSchema)
