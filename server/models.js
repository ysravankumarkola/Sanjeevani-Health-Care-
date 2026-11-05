import mongoose from 'mongoose'

const { Schema, model } = mongoose

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  resetTokenHash: { type: String, select: false },
  resetExpiresAt: { type: Date, select: false },
  role: { type: String, enum: ['admin', 'doctor', 'patient'], required: true },
  phone: { type: String, trim: true, maxlength: 30 },
  profileImage: String,
}, { timestamps: true })

const doctorSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  department: { type: String, required: true, trim: true },
  specialty: { type: String, required: true, trim: true },
  qualifications: { type: String, default: '' },
  experienceYears: { type: Number, min: 0, default: 0 },
  consultationFee: { type: Number, min: 0, default: 0 },
  availability: [{ day: String, slots: [String] }],
  approved: { type: Boolean, default: false },
}, { timestamps: true })

const patientSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  dateOfBirth: Date,
  bloodType: String,
  emergencyContact: String,
}, { timestamps: true })

const departmentSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: String,
  icon: String,
}, { timestamps: true })

const appointmentSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  reason: { type: String, maxlength: 500, default: '' },
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'], default: 'pending' },
}, { timestamps: true })
appointmentSchema.index({ doctorId: 1, date: 1, time: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } })

const medicalRecordSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  diagnosis: { type: String, required: true, maxlength: 500 },
  notes: { type: String, maxlength: 4000, default: '' },
  documents: [{ name: String, storageName: String, mimeType: String }],
}, { timestamps: true })

const prescriptionSchema = new Schema({
  recordId: { type: Schema.Types.ObjectId, ref: 'MedicalRecord', required: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  medications: [{ name: String, dosage: String, instructions: String }],
}, { timestamps: true })

const notificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  readAt: Date,
}, { timestamps: true })

const reviewSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 1000, default: '' },
}, { timestamps: true })

const auditLogSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  targetType: String,
  targetId: String,
  details: Schema.Types.Mixed,
}, { timestamps: true })

export const User = model('User', userSchema)
export const Doctor = model('Doctor', doctorSchema)
export const Patient = model('Patient', patientSchema)
export const Department = model('Department', departmentSchema)
export const Appointment = model('Appointment', appointmentSchema)
export const MedicalRecord = model('MedicalRecord', medicalRecordSchema)
export const Prescription = model('Prescription', prescriptionSchema)
export const Notification = model('Notification', notificationSchema)
export const Review = model('Review', reviewSchema)
export const AuditLog = model('AuditLog', auditLogSchema)