import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import nodemailer from 'nodemailer'
import multer from 'multer'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  Appointment, AuditLog, Department, Doctor, MedicalRecord, Notification,
  Patient, Prescription, Review, User,
} from './models.js'

const app = express()
const port = Number(process.env.PORT || 4000)
const demoMode = !process.env.MONGODB_URI
const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-development-secret-change-before-deploying')
const memory = { users: [], doctors: [], patients: [], appointments: [], records: [], prescriptions: [], notifications: [], departments: [], reviews: [], auditLogs: [] }
const resetTokens = new Map()
const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const profileUploadDirectory = path.join(serverDirectory, 'uploads', 'profile')
const recordUploadDirectory = path.join(serverDirectory, 'uploads', 'records')
for (const directory of [profileUploadDirectory, recordUploadDirectory]) if (!existsSync(directory)) mkdirSync(directory, { recursive: true })
const mailer = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null
const profileUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, profileUploadDirectory),
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ? callback(null, true) : callback(new Error('Upload a JPG, PNG, or WebP image.')),
})
const recordUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, recordUploadDirectory),
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype) ? callback(null, true) : callback(new Error('Upload a PDF, JPG, or PNG medical report.')),
})

if (!jwtSecret) throw new Error('JWT_SECRET is required in production')
app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json({ limit: '1mb' }))
app.use('/uploads/profile', express.static(profileUploadDirectory, { fallthrough: false, maxAge: '1d' }))
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }))

const idOf = (item) => typeof item === 'string' ? item : String(item?._id ?? item?.id ?? '')
const publicUser = (user) => ({ id: idOf(user), name: user.name, email: user.email, role: user.role, phone: user.phone || '', profileImage: user.profileImage || '' })
const fail = (res, status, message) => res.status(status).json({ message })

function demoSeed() {
  const departmentNames = ['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Dermatology']
  memory.departments = departmentNames.map((name, index) => ({ id: `dept-${index + 1}`, name, description: `${name} care and consultation`, icon: name }))
  const people = [
    { id: 'user-admin', name: 'Jordan Lee', email: 'admin@northstar.health', password: 'Admin123!', role: 'admin' },
    { id: 'user-doctor-1', name: 'Dr. Maya Chen', email: 'maya@northstar.health', password: 'Doctor123!', role: 'doctor', phone: '+1 555 014 2081' },
    { id: 'user-doctor-2', name: 'Dr. Elias Morgan', email: 'elias@northstar.health', password: 'Doctor123!', role: 'doctor', phone: '+1 555 014 7734' },
    { id: 'user-patient-1', name: 'Olivia Bennett', email: 'olivia@example.com', password: 'Patient123!', role: 'patient', phone: '+1 555 010 4352' },
  ]
  memory.users = people.map(({ password, ...user }) => ({ ...user, passwordHash: bcrypt.hashSync(password, 10) }))
  memory.doctors = [
    { id: 'doctor-1', userId: 'user-doctor-1', department: 'Cardiology', specialty: 'Cardiology', qualifications: 'MD, FACC', experienceYears: 12, consultationFee: 180, approved: true, availability: [{ day: 'Mon', slots: ['09:00', '10:30', '14:00'] }, { day: 'Wed', slots: ['09:00', '11:00', '15:00'] }, { day: 'Fri', slots: ['10:00', '13:00'] }] },
    { id: 'doctor-2', userId: 'user-doctor-2', department: 'Neurology', specialty: 'Neurology', qualifications: 'MD, FAAN', experienceYears: 9, consultationFee: 160, approved: true, availability: [{ day: 'Tue', slots: ['09:00', '10:30', '14:00'] }, { day: 'Thu', slots: ['09:00', '11:00', '15:00'] }] },
  ]
  memory.patients = [{ id: 'patient-1', userId: 'user-patient-1', bloodType: 'O+', emergencyContact: '' }]
  memory.appointments = []
  memory.records = []
  memory.prescriptions = []
  memory.notifications = []
  memory.reviews = []
  memory.auditLogs = []
}

async function findUserByEmail(email, includePassword = false) {
  if (demoMode) return memory.users.find((user) => user.email === email.toLowerCase())
  const query = User.findOne({ email: email.toLowerCase() })
  if (includePassword) query.select('+passwordHash')
  return query
}
async function findUserById(id) { return demoMode ? memory.users.find((user) => idOf(user) === id) : User.findById(id) }
async function userSave(values) {
  if (!demoMode) return User.create(values)
  const user = { id: crypto.randomUUID(), ...values, createdAt: new Date().toISOString() }
  memory.users.push(user)
  return user
}
async function profileFor(role, userId) {
  if (demoMode) return memory[role === 'doctor' ? 'doctors' : 'patients'].find((item) => item.userId === userId)
  return role === 'doctor' ? Doctor.findOne({ userId }) : role === 'patient' ? Patient.findOne({ userId }) : null
}
async function createProfile(role, userId) {
  if (role === 'doctor') {
    const defaults = { userId, department: 'General Medicine', specialty: 'General Medicine', qualifications: '', experienceYears: 0, consultationFee: 0, availability: [], approved: false }
    if (demoMode) { const profile = { id: crypto.randomUUID(), ...defaults }; memory.doctors.push(profile); return profile }
    return Doctor.create(defaults)
  }
  if (role === 'patient') {
    const defaults = { userId, bloodType: '', emergencyContact: '' }
    if (demoMode) { const profile = { id: crypto.randomUUID(), ...defaults }; memory.patients.push(profile); return profile }
    return Patient.create(defaults)
  }
}
async function doctorRows({ search = '', department = '', sort = '' } = {}) {
  let rows
  if (demoMode) {
    rows = memory.doctors.filter((doctor) => doctor.approved).map((doctor) => ({ ...doctor, user: memory.users.find((user) => user.id === doctor.userId) }))
  } else {
    rows = await Doctor.find({ approved: true }).populate('userId', 'name email profileImage').lean()
    rows = rows.map((doctor) => ({ ...doctor, user: doctor.userId }))
  }
  const normalized = search.toLowerCase()
  rows = rows.filter((doctor) => {
    const user = doctor.user || {}
    return (!normalized || `${user.name} ${doctor.specialty} ${doctor.qualifications}`.toLowerCase().includes(normalized)) && (!department || doctor.department.toLowerCase() === department.toLowerCase())
  })
  if (sort === 'fee') rows.sort((a, b) => a.consultationFee - b.consultationFee)
  return rows.map((doctor) => ({ id: idOf(doctor), userId: idOf(doctor.userId), name: doctor.user?.name || 'Care provider', email: doctor.user?.email, profileImage: doctor.user?.profileImage || '', department: doctor.department, specialty: doctor.specialty, qualifications: doctor.qualifications, experienceYears: doctor.experienceYears, consultationFee: doctor.consultationFee, availability: doctor.availability || [] }))
}
async function appointmentRows() {
  if (demoMode) return memory.appointments
  return Appointment.find().lean()
}
async function notify(userId, title, message) {
  if (demoMode) memory.notifications.unshift({ id: crypto.randomUUID(), userId, title, message, readAt: null, createdAt: new Date().toISOString() })
  else await Notification.create({ userId, title, message })
}
async function audit(actorId, action, targetType, targetId, details = {}) {
  if (demoMode) memory.auditLogs.unshift({ id: crypto.randomUUID(), actorId, action, targetType, targetId, details, createdAt: new Date().toISOString() })
  else await AuditLog.create({ actorId, action, targetType, targetId, details })
}
async function sendEmail(to, subject, text) {
  if (!mailer) {
    if (process.env.NODE_ENV !== 'production') console.info('Email integration is inactive; configure SMTP_URL to deliver email.')
    return
  }
  await mailer.sendMail({ from: process.env.EMAIL_FROM || 'Northstar Care <care@localhost>', to, subject, text })
}
const hashToken = (token) => createHash('sha256').update(token).digest('hex')

const registrationSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().email().max(254), password: z.string().min(8).max(128), role: z.enum(['patient', 'doctor']), phone: z.string().trim().max(30).optional(), specialty: z.string().trim().max(100).optional(), department: z.string().trim().max(100).optional() })
const appointmentSchema = z.object({ doctorId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/), reason: z.string().trim().max(500).optional() })

async function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return fail(res, 401, 'Sign in to continue.')
  try {
    const payload = jwt.verify(token, jwtSecret)
    req.user = await findUserById(payload.sub)
    if (!req.user) return fail(res, 401, 'Session is no longer valid.')
    next()
  } catch { return fail(res, 401, 'Session is invalid or expired.') }
}
const allow = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : fail(res, 403, 'You do not have permission to perform this action.')
const signToken = (user) => jwt.sign({ sub: idOf(user), role: user.role }, jwtSecret, { expiresIn: '8h', issuer: 'northstar-care' })

app.get('/api/health', (_req, res) => res.json({ status: 'ok', mode: demoMode ? 'demo' : 'connected', database: demoMode ? 'ephemeral' : mongoose.connection.readyState === 1 ? 'connected' : 'connecting' }))

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const input = registrationSchema.parse(req.body)
    if (await findUserByEmail(input.email)) return fail(res, 409, 'An account with that email already exists.')
    const user = await userSave({ name: input.name, email: input.email.toLowerCase(), passwordHash: await bcrypt.hash(input.password, 12), role: input.role, phone: input.phone || '' })
    const profile = await createProfile(input.role, idOf(user))
    if (input.role === 'doctor') {
      const fields = { specialty: input.specialty || 'General Medicine', department: input.department || input.specialty || 'General Medicine' }
      if (demoMode) Object.assign(profile, fields)
      else await Doctor.findByIdAndUpdate(profile._id, fields)
    }
    return res.status(201).json({ user: publicUser(user), token: signToken(user), message: input.role === 'doctor' ? 'Your profile is awaiting administrator approval.' : 'Welcome to Northstar Care.' })
  } catch (error) { next(error) }
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body)
    const user = await findUserByEmail(input.email, true)
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return fail(res, 401, 'Email or password is incorrect.')
    return res.json({ user: publicUser(user), token: signToken(user) })
  } catch (error) { next(error) }
})
app.post('/api/auth/forgot-password', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body)
    const user = await findUserByEmail(email)
    let devResetToken
    if (user) {
      const token = randomBytes(32).toString('hex')
      const tokenHash = hashToken(token)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
      if (demoMode) resetTokens.set(idOf(user), { tokenHash, expiresAt })
      else await User.findByIdAndUpdate(idOf(user), { resetTokenHash: tokenHash, resetExpiresAt: expiresAt })
      const resetUrl = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/?resetToken=${token}&email=${encodeURIComponent(user.email)}`
      await sendEmail(user.email, 'Reset your Northstar Care password', `Use this link within 15 minutes to reset your password:\n\n${resetUrl}`)
      if (demoMode && !mailer) devResetToken = token
    }
    res.json({ message: 'If that email belongs to an account, password reset instructions have been sent.', ...(devResetToken ? { devResetToken } : {}) })
  } catch (error) { next(error) }
})
app.post('/api/auth/reset-password', async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email(), token: z.string().min(32).max(128), password: z.string().min(8).max(128) }).parse(req.body)
    const user = await findUserByEmail(input.email)
    const saved = user && (demoMode ? resetTokens.get(idOf(user)) : await User.findById(idOf(user)).select('+resetTokenHash +resetExpiresAt').then((item) => item && ({ tokenHash: item.resetTokenHash, expiresAt: item.resetExpiresAt })))
    if (!saved || saved.expiresAt < new Date() || saved.tokenHash !== hashToken(input.token)) return fail(res, 400, 'This reset link is invalid or has expired.')
    const passwordHash = await bcrypt.hash(input.password, 12)
    if (demoMode) { user.passwordHash = passwordHash; resetTokens.delete(idOf(user)) }
    else await User.findByIdAndUpdate(idOf(user), { passwordHash, $unset: { resetTokenHash: 1, resetExpiresAt: 1 } })
    res.json({ message: 'Password updated. You can now sign in.' })
  } catch (error) { next(error) }
})
app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(req.user) }))
app.patch('/api/profile', auth, async (req, res, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().max(30).optional() }).parse(req.body)
    if (demoMode) Object.assign(req.user, input)
    else await User.findByIdAndUpdate(idOf(req.user), input, { runValidators: true })
    res.json({ user: publicUser({ ...req.user.toObject?.(), ...req.user, ...input }) })
  } catch (error) { next(error) }
})
app.post('/api/profile/photo', auth, profileUpload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return fail(res, 400, 'Choose an image to upload.')
    const profileImage = `/uploads/profile/${req.file.filename}`
    if (demoMode) req.user.profileImage = profileImage
    else await User.findByIdAndUpdate(idOf(req.user), { profileImage })
    res.json({ profileImage, user: publicUser({ ...req.user.toObject?.(), ...req.user, profileImage }) })
  } catch (error) { next(error) }
})
app.get('/api/doctor/profile', auth, allow('doctor'), async (req, res, next) => {
  try {
    const profile = await profileFor('doctor', idOf(req.user))
    if (!profile) return fail(res, 404, 'Clinician profile not found.')
    res.json(profile)
  } catch (error) { next(error) }
})
app.patch('/api/doctor/profile', auth, allow('doctor'), async (req, res, next) => {
  try {
    const input = z.object({
      department: z.string().trim().min(2).max(100),
      specialty: z.string().trim().min(2).max(100),
      qualifications: z.string().trim().max(300),
      experienceYears: z.coerce.number().int().min(0).max(70),
      consultationFee: z.coerce.number().min(0).max(10000),
      availability: z.array(z.object({ day: z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']), slots: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).max(20) })).max(7),
    }).parse(req.body)
    const profile = await profileFor('doctor', idOf(req.user))
    if (!profile) return fail(res, 404, 'Clinician profile not found.')
    if (demoMode) Object.assign(profile, input)
    else await Doctor.findByIdAndUpdate(profile._id, input, { runValidators: true })
    await audit(idOf(req.user), 'doctor.profile.updated', 'Doctor', idOf(profile))
    res.json(input)
  } catch (error) { next(error) }
})

app.get('/api/departments', async (_req, res, next) => {
  try { res.json(demoMode ? memory.departments : await Department.find().sort('name').lean()) } catch (error) { next(error) }
})
app.get('/api/doctors', async (req, res, next) => {
  try { res.json(await doctorRows({ search: String(req.query.search || ''), department: String(req.query.department || ''), sort: String(req.query.sort || '') })) } catch (error) { next(error) }
})
app.get('/api/doctors/:id/availability', async (req, res, next) => {
  try {
    const rows = await doctorRows()
    const doctor = rows.find((item) => item.id === req.params.id)
    if (!doctor) return fail(res, 404, 'Doctor not found.')
    const existing = (await appointmentRows()).filter((item) => idOf(item.doctorId) === doctor.id && ['pending', 'confirmed'].includes(item.status))
    res.json({ availability: doctor.availability, booked: existing.map(({ date, time }) => ({ date, time })) })
  } catch (error) { next(error) }
})

app.get('/api/appointments', auth, async (req, res, next) => {
  try {
    const profile = req.user.role === 'patient' ? await profileFor('patient', idOf(req.user)) : req.user.role === 'doctor' ? await profileFor('doctor', idOf(req.user)) : null
    const rows = await appointmentRows()
    let result = rows
    if (req.user.role === 'patient') result = rows.filter((item) => idOf(item.patientId) === idOf(profile))
    if (req.user.role === 'doctor') result = rows.filter((item) => idOf(item.doctorId) === idOf(profile))
    if (!demoMode) result = await Appointment.find({ ...(req.user.role === 'patient' ? { patientId: profile?._id } : req.user.role === 'doctor' ? { doctorId: profile?._id } : {}) }).populate({ path: 'patientId', populate: { path: 'userId', select: 'name email phone' } }).populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } }).sort({ date: 1, time: 1 }).lean()
    res.json(result.map((item) => {
      const patient = demoMode ? memory.patients.find((row) => row.id === idOf(item.patientId)) : item.patientId
      const doctor = demoMode ? memory.doctors.find((row) => row.id === idOf(item.doctorId)) : item.doctorId
      const patientUser = demoMode ? memory.users.find((row) => row.id === patient?.userId) : patient?.userId
      const doctorUser = demoMode ? memory.users.find((row) => row.id === doctor?.userId) : doctor?.userId
      return { id: idOf(item), date: item.date, time: item.time, reason: item.reason, status: item.status, patient: patientUser ? publicUser(patientUser) : null, doctor: doctorUser ? { id: idOf(doctor), name: doctorUser.name } : null, createdAt: item.createdAt }
    }))
  } catch (error) { next(error) }
})

app.post('/api/appointments', auth, allow('patient'), async (req, res, next) => {
  try {
    const input = appointmentSchema.parse(req.body)
    const patient = await profileFor('patient', idOf(req.user))
    const doctors = await doctorRows()
    const doctor = doctors.find((row) => row.id === input.doctorId)
    if (!patient || !doctor) return fail(res, 404, 'Patient or doctor profile was not found.')
    const requestedDay = new Date(`${input.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
    if (!doctor.availability.some((day) => day.day === requestedDay && day.slots.includes(input.time))) return fail(res, 400, 'That time is outside the doctor’s published availability.')
    const rows = await appointmentRows()
    const conflict = rows.some((item) => idOf(item.doctorId) === doctor.id && item.date === input.date && item.time === input.time && ['pending', 'confirmed'].includes(item.status))
    if (conflict) return fail(res, 409, 'That appointment slot has just been taken. Choose another time.')
    const values = { patientId: idOf(patient), doctorId: doctor.id, date: input.date, time: input.time, reason: input.reason || '', status: 'pending' }
    const appointment = demoMode ? { id: crypto.randomUUID(), ...values, createdAt: new Date().toISOString() } : await Appointment.create(values)
    if (demoMode) memory.appointments.push(appointment)
    else await Promise.all([Appointment.findByIdAndUpdate(appointment._id, { patientId: patient._id, doctorId: doctor.id }), Notification.create({ userId: doctor.userId, title: 'New appointment request', message: `${req.user.name} requested ${input.date} at ${input.time}.` })])
    if (demoMode) await notify(doctor.userId, 'New appointment request', `${req.user.name} requested ${input.date} at ${input.time}.`)
    await notify(idOf(req.user), 'Appointment requested', `Your request with ${doctor.name} is pending confirmation.`)
    await Promise.all([sendEmail(doctor.email, 'New appointment request', `${req.user.name} requested an appointment for ${input.date} at ${input.time}.`), sendEmail(req.user.email, 'Appointment request received', `Your appointment request with ${doctor.name} for ${input.date} at ${input.time} is pending confirmation.`)])
    res.status(201).json({ appointment: { id: idOf(appointment), ...values }, message: 'Appointment request sent.' })
  } catch (error) { next(error) }
})

app.patch('/api/appointments/:id/status', auth, async (req, res, next) => {
  try {
    const input = z.object({ status: z.enum(['confirmed', 'rejected', 'completed', 'cancelled']) }).parse(req.body)
    const rows = await appointmentRows()
    const appointment = rows.find((item) => idOf(item) === req.params.id)
    if (!appointment) return fail(res, 404, 'Appointment not found.')
    const doctor = req.user.role === 'doctor' ? await profileFor('doctor', idOf(req.user)) : null
    const patient = req.user.role === 'patient' ? await profileFor('patient', idOf(req.user)) : null
    const permitted = req.user.role === 'admin' || (doctor && idOf(appointment.doctorId) === idOf(doctor) && ['confirmed', 'rejected', 'completed'].includes(input.status)) || (patient && idOf(appointment.patientId) === idOf(patient) && input.status === 'cancelled')
    if (!permitted) return fail(res, 403, 'You cannot update this appointment.')
    if (!['pending', 'confirmed'].includes(appointment.status) && input.status !== 'completed') return fail(res, 409, 'This appointment can no longer be changed.')
    appointment.status = input.status
    if (demoMode) Object.assign(memory.appointments.find((item) => idOf(item) === req.params.id), { status: input.status })
    else await Appointment.findByIdAndUpdate(req.params.id, { status: input.status })
    const patientProfile = demoMode ? memory.patients.find((item) => item.id === idOf(appointment.patientId)) : await Patient.findById(appointment.patientId)
    if (patientProfile) await notify(patientProfile.userId, `Appointment ${input.status}`, `Your appointment on ${appointment.date} at ${appointment.time} is ${input.status}.`)
    const patientUser = demoMode ? memory.users.find((item) => item.id === patientProfile?.userId) : patientProfile ? await User.findById(patientProfile.userId) : null
    if (patientUser) await sendEmail(patientUser.email, `Appointment ${input.status}`, `Your appointment on ${appointment.date} at ${appointment.time} is ${input.status}.`)
    await audit(idOf(req.user), `appointment.${input.status}`, 'Appointment', req.params.id)
    res.json({ id: req.params.id, status: input.status })
  } catch (error) { next(error) }
})

app.get('/api/records', auth, async (req, res, next) => {
  try {
    const profile = req.user.role === 'patient' ? await profileFor('patient', idOf(req.user)) : req.user.role === 'doctor' ? await profileFor('doctor', idOf(req.user)) : null
    let rows = demoMode ? memory.records : await MedicalRecord.find().populate({ path: 'patientId', populate: { path: 'userId', select: 'name' } }).populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } }).sort({ createdAt: -1 }).lean()
    if (req.user.role === 'patient') rows = rows.filter((item) => idOf(item.patientId) === idOf(profile))
    if (req.user.role === 'doctor') rows = rows.filter((item) => idOf(item.doctorId) === idOf(profile))
    res.json(rows)
  } catch (error) { next(error) }
})
app.post('/api/records', auth, allow('doctor'), async (req, res, next) => {
  try {
    const input = z.object({ appointmentId: z.string().min(1), diagnosis: z.string().trim().min(2).max(500), notes: z.string().max(4000).optional(), medications: z.array(z.object({ name: z.string().min(1), dosage: z.string().max(100), instructions: z.string().max(300) })).max(30).default([]) }).parse(req.body)
    const appointment = demoMode ? memory.appointments.find((item) => item.id === input.appointmentId) : await Appointment.findById(input.appointmentId)
    const doctor = await profileFor('doctor', idOf(req.user))
    if (!appointment || idOf(appointment.doctorId) !== idOf(doctor) || appointment.status !== 'confirmed') return fail(res, 403, 'A confirmed appointment assigned to you is required.')
    const recordData = { patientId: appointment.patientId, doctorId: idOf(doctor), appointmentId: idOf(appointment), diagnosis: input.diagnosis, notes: input.notes || '', createdAt: new Date().toISOString() }
    let record
    if (demoMode) { record = { id: crypto.randomUUID(), ...recordData }; memory.records.unshift(record) }
    else { record = await MedicalRecord.create({ ...recordData, patientId: appointment.patientId, doctorId: doctor._id, appointmentId: appointment._id }); if (input.medications.length) await Prescription.create({ recordId: record._id, patientId: appointment.patientId, doctorId: doctor._id, medications: input.medications }) }
    if (demoMode && input.medications.length) memory.prescriptions.push({ id: crypto.randomUUID(), recordId: record.id, patientId: appointment.patientId, doctorId: idOf(doctor), medications: input.medications })
    await notify(demoMode ? memory.patients.find((item) => item.id === idOf(appointment.patientId)).userId : (await Patient.findById(appointment.patientId)).userId, 'Medical record added', 'A new consultation record is available in your account.')
    res.status(201).json({ record })
  } catch (error) { next(error) }
})
app.get('/api/records/:id/prescriptions', auth, async (req, res, next) => {
  try {
    const record = demoMode ? memory.records.find((item) => item.id === req.params.id) : await MedicalRecord.findById(req.params.id)
    if (!record) return fail(res, 404, 'Record not found.')
    const patient = req.user.role === 'patient' ? await profileFor('patient', idOf(req.user)) : null
    const doctor = req.user.role === 'doctor' ? await profileFor('doctor', idOf(req.user)) : null
    if (req.user.role !== 'admin' && idOf(record.patientId) !== idOf(patient) && idOf(record.doctorId) !== idOf(doctor)) return fail(res, 403, 'You cannot access this record.')
    res.json(demoMode ? memory.prescriptions.filter((item) => item.recordId === req.params.id) : await Prescription.find({ recordId: req.params.id }).lean())
  } catch (error) { next(error) }
})
app.post('/api/records/:id/documents', auth, allow('doctor'), recordUpload.single('report'), async (req, res, next) => {
  try {
    if (!req.file) return fail(res, 400, 'Choose a medical report to upload.')
    const record = demoMode ? memory.records.find((item) => item.id === req.params.id) : await MedicalRecord.findById(req.params.id)
    const doctor = await profileFor('doctor', idOf(req.user))
    if (!record) return fail(res, 404, 'Medical record not found.')
    if (idOf(record.doctorId) !== idOf(doctor)) return fail(res, 403, 'You can only add reports to records for your patients.')
    const document = { _id: randomUUID(), name: path.basename(req.file.originalname).replace(/[^\w.-]/g, '_').slice(0, 120), storageName: req.file.filename, mimeType: req.file.mimetype }
    if (demoMode) { record.documents ||= []; record.documents.push(document) }
    else await MedicalRecord.findByIdAndUpdate(req.params.id, { $push: { documents: document } })
    res.status(201).json({ document: { id: document._id, name: document.name, mimeType: document.mimeType } })
  } catch (error) { next(error) }
})
app.get('/api/records/:id/documents/:documentId', auth, async (req, res, next) => {
  try {
    const record = demoMode ? memory.records.find((item) => item.id === req.params.id) : await MedicalRecord.findById(req.params.id)
    if (!record) return fail(res, 404, 'Medical record not found.')
    const patient = req.user.role === 'patient' ? await profileFor('patient', idOf(req.user)) : null
    const doctor = req.user.role === 'doctor' ? await profileFor('doctor', idOf(req.user)) : null
    const permitted = req.user.role === 'admin' || (patient && idOf(record.patientId) === idOf(patient)) || (doctor && idOf(record.doctorId) === idOf(doctor))
    if (!permitted) return fail(res, 403, 'You cannot access this medical report.')
    const document = (record.documents || []).find((item) => idOf(item) === req.params.documentId)
    if (!document) return fail(res, 404, 'Medical report not found.')
    res.download(path.join(recordUploadDirectory, document.storageName), document.name)
  } catch (error) { next(error) }
})

app.get('/api/notifications', auth, async (req, res, next) => {
  try { res.json(demoMode ? memory.notifications.filter((item) => item.userId === idOf(req.user)) : await Notification.find({ userId: idOf(req.user) }).sort({ createdAt: -1 }).limit(50).lean()) } catch (error) { next(error) }
})
app.patch('/api/notifications/read', auth, async (req, res, next) => {
  try {
    if (demoMode) memory.notifications.filter((item) => item.userId === idOf(req.user)).forEach((item) => { item.readAt = new Date().toISOString() })
    else await Notification.updateMany({ userId: idOf(req.user), readAt: null }, { readAt: new Date() })
    res.json({ success: true })
  } catch (error) { next(error) }
})

app.get('/api/dashboard', auth, async (req, res, next) => {
  try {
    const appointments = await appointmentRows()
    if (req.user.role === 'admin') {
      const doctors = demoMode ? memory.doctors : await Doctor.find().lean()
      const patients = demoMode ? memory.patients : await Patient.find().lean()
      const counts = { totalPatients: patients.length, totalDoctors: doctors.length, totalAppointments: appointments.length, pendingAppointments: appointments.filter((item) => item.status === 'pending').length }
      const monthly = Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - 5 + index); const month = date.toLocaleString('en-US', { month: 'short' }); return { month, appointments: appointments.filter((item) => new Date(item.date).getMonth() === date.getMonth()).length } })
      const departments = await doctorRows()
      return res.json({ counts, monthly, departmentDistribution: Object.values(departments.reduce((result, doctor) => { result[doctor.department] = result[doctor.department] || { name: doctor.department, value: 0 }; result[doctor.department].value += appointments.filter((item) => idOf(item.doctorId) === doctor.id).length; return result }, {})) })
    }
    const profile = await profileFor(req.user.role, idOf(req.user))
    const mine = appointments.filter((item) => idOf(req.user.role === 'patient' ? item.patientId : item.doctorId) === idOf(profile))
    const today = new Date().toISOString().slice(0, 10)
    return res.json({ counts: { totalAppointments: mine.length, upcomingAppointments: mine.filter((item) => item.date >= today && ['pending', 'confirmed'].includes(item.status)).length, completedAppointments: mine.filter((item) => item.status === 'completed').length, cancelledAppointments: mine.filter((item) => ['cancelled', 'rejected'].includes(item.status)).length, todayAppointments: mine.filter((item) => item.date === today).length, pendingRequests: mine.filter((item) => item.status === 'pending').length }, recent: mine.slice(-5).reverse() })
  } catch (error) { next(error) }
})

app.get('/api/admin/doctors', auth, allow('admin'), async (_req, res, next) => {
  try {
    if (demoMode) return res.json(memory.doctors.map((doctor) => ({ ...doctor, user: publicUser(memory.users.find((user) => user.id === doctor.userId)) })))
    res.json(await Doctor.find().populate('userId', 'name email phone').lean())
  } catch (error) { next(error) }
})
app.get('/api/admin/patients', auth, allow('admin'), async (_req, res, next) => {
  try {
    if (demoMode) return res.json(memory.patients.map((patient) => ({ id: idOf(patient), ...patient, user: publicUser(memory.users.find((user) => user.id === patient.userId)) })))
    const patients = await Patient.find().populate('userId', 'name email phone createdAt').sort({ createdAt: -1 }).lean()
    res.json(patients.map((patient) => ({ ...patient, user: patient.userId })))
  } catch (error) { next(error) }
})
app.patch('/api/admin/doctors/:id/approval', auth, allow('admin'), async (req, res, next) => {
  try {
    const { approved } = z.object({ approved: z.boolean() }).parse(req.body)
    const doctor = demoMode ? memory.doctors.find((item) => item.id === req.params.id) : await Doctor.findByIdAndUpdate(req.params.id, { approved }, { new: true })
    if (!doctor) return fail(res, 404, 'Doctor profile not found.')
    if (demoMode) doctor.approved = approved
    await audit(idOf(req.user), approved ? 'doctor.approved' : 'doctor.rejected', 'Doctor', req.params.id)
    await notify(doctor.userId, approved ? 'Profile approved' : 'Profile update required', approved ? 'Your clinician profile is now visible to patients.' : 'Your clinician profile was not approved. Contact the care team for next steps.')
    res.json({ approved })
  } catch (error) { next(error) }
})
app.post('/api/admin/departments', auth, allow('admin'), async (req, res, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).optional() }).parse(req.body)
    const exists = demoMode ? memory.departments.some((item) => item.name.toLowerCase() === input.name.toLowerCase()) : await Department.exists({ name: new RegExp(`^${input.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
    if (exists) return fail(res, 409, 'That department already exists.')
    const department = demoMode ? { id: randomUUID(), ...input, description: input.description || '' } : await Department.create(input)
    if (demoMode) memory.departments.push(department)
    await audit(idOf(req.user), 'department.created', 'Department', idOf(department))
    res.status(201).json(department)
  } catch (error) { next(error) }
})
app.patch('/api/admin/departments/:id', auth, allow('admin'), async (req, res, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).optional() }).parse(req.body)
    const department = demoMode ? memory.departments.find((item) => idOf(item) === req.params.id) : await Department.findByIdAndUpdate(req.params.id, input, { new: true, runValidators: true })
    if (!department) return fail(res, 404, 'Department not found.')
    if (demoMode) Object.assign(department, input)
    await audit(idOf(req.user), 'department.updated', 'Department', req.params.id)
    res.json(department)
  } catch (error) { next(error) }
})
app.delete('/api/admin/departments/:id', auth, allow('admin'), async (req, res, next) => {
  try {
    const department = demoMode ? memory.departments.find((item) => idOf(item) === req.params.id) : await Department.findById(req.params.id)
    if (!department) return fail(res, 404, 'Department not found.')
    const assigned = demoMode ? memory.doctors.some((doctor) => doctor.department === department.name) : await Doctor.exists({ department: department.name })
    if (assigned) return fail(res, 409, 'Reassign clinicians before removing this department.')
    if (demoMode) memory.departments = memory.departments.filter((item) => idOf(item) !== req.params.id)
    else await Department.findByIdAndDelete(req.params.id)
    await audit(idOf(req.user), 'department.deleted', 'Department', req.params.id)
    res.json({ success: true })
  } catch (error) { next(error) }
})
app.get('/api/admin/audit-logs', auth, allow('admin'), async (_req, res, next) => {
  try { res.json(demoMode ? memory.auditLogs.slice(0, 100) : await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean()) } catch (error) { next(error) }
})
app.post('/api/reviews', auth, allow('patient'), async (req, res, next) => {
  try {
    const input = z.object({ doctorId: z.string(), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }).parse(req.body)
    const patient = await profileFor('patient', idOf(req.user))
    const attended = (await appointmentRows()).some((item) => idOf(item.patientId) === idOf(patient) && idOf(item.doctorId) === input.doctorId && item.status === 'completed')
    if (!attended) return fail(res, 403, 'Feedback is available after a completed appointment.')
    const review = { patientId: idOf(patient), doctorId: input.doctorId, rating: input.rating, comment: input.comment || '' }
    if (demoMode) memory.reviews.push({ id: crypto.randomUUID(), ...review, createdAt: new Date().toISOString() })
    else await Review.create(review)
    res.status(201).json({ success: true })
  } catch (error) { next(error) }
})

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || 'Invalid request.' })
  if (error instanceof multer.MulterError || error?.message?.startsWith('Upload a JPG')) return res.status(400).json({ message: error.message })
  if (error?.code === 11000) return res.status(409).json({ message: 'That record already exists.' })
  console.error(error)
  res.status(500).json({ message: 'Something went wrong. Please try again.' })
})

async function start() {
  if (demoMode && process.env.NODE_ENV === 'production') throw new Error('MONGODB_URI is required in production')
  if (demoMode) {
    demoSeed()
    console.warn('Running with ephemeral demo data; records reset when this process stops.')
  } else {
    await mongoose.connect(process.env.MONGODB_URI)
  }
  app.listen(port, () => console.log(`Northstar Care API listening on http://localhost:${port}`))
}

start().catch((error) => { console.error(error); process.exit(1) })