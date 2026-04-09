import mongoose from 'mongoose'
import { config } from 'dotenv'

config()

const DEFAULT_URI = 'mongodb://localhost:27017/dependency-explorer'

export async function connect(uri = process.env.MONGODB_URI ?? DEFAULT_URI) {
  await mongoose.connect(uri)
  console.log(`Connected to MongoDB: ${uri}`)
}

export async function disconnect() {
  await mongoose.disconnect()
}
