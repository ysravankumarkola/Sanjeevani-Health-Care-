import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { User } from './models.js'

const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env

async function seedAdmin() {
  if (!MONGODB_URI || !ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before running this command.')
  }
  if (ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.')
  await mongoose.connect(MONGODB_URI)
  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() })
  if (existing) throw new Error('An account already uses ADMIN_EMAIL; no changes were made.')
  await User.create({ name: ADMIN_NAME, email: ADMIN_EMAIL.toLowerCase(), passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12), role: 'admin' })
  console.log(`Administrator account created for ${ADMIN_EMAIL.toLowerCase()}.`)
}

seedAdmin().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(async () => { if (mongoose.connection.readyState) await mongoose.disconnect() })