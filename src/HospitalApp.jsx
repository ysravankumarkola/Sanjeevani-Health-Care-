import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, ArrowRight, ArrowUpRight, Bell, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, Clock3, Download, FileHeart, HeartPulse, LayoutDashboard, LogOut, Mail, Menu, Pencil, Phone, Plus, Search, Settings2, ShieldCheck, Stethoscope, Trash2, Users, X } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import './hospital.css'

const API = import.meta.env.VITE_API_URL || '/api'
const portraits = [
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=720&q=85',
  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=720&q=85',
  'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=720&q=85',
]
const demoAccounts = [
  { role: 'Patient', email: 'olivia@example.com', password: 'Patient123!' },
  { role: 'Doctor', email: 'maya@northstar.health', password: 'Doctor123!' },
  { role: 'Administrator', email: 'admin@northstar.health', password: 'Admin123!' },
]

async function request(path, { token, ...options } = {}) {
  const isForm = options?.body instanceof FormData
  const tunnelHeaders = window.location.hostname.endsWith('.loca.lt') ? { 'bypass-tunnel-reminder': 'true' } : {}
  const response = await fetch(`${API}${path}`, { ...options, headers: { ...(!isForm ? { 'Content-Type': 'application/json' } : {}), ...tunnelHeaders, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || 'The request could not be completed.')
  return body
}
const dateLabel = (date, options = { month: 'short', day: 'numeric' }) => date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-US', options) : 'Date to be confirmed'
const dateParts = (date) => { const value = new Date(`${date}T12:00:00`); return { day: value.getDate(), month: value.toLocaleDateString('en-US', { month: 'short' }) } }

function Avatar({ name = '', image, size = '' }) {
  return image ? <img className={`avatar ${size}`} src={image} alt={name} /> : <span className={`avatar avatar-initial ${size}`} aria-label={name}>{name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
}
function Status({ value }) { return <span className={`status status-${value}`}>{value}</span> }

function Dialog({ title, onClose, children }) {
  return <AnimatePresence><motion.div className="dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><motion.section className="dialog-panel" role="dialog" aria-modal="true" aria-label={title} initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}><div className="dialog-heading"><div><small>SANJEEVANI HEALTHCARE</small><h2>{title}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</motion.section></motion.div></AnimatePresence>
}

export default function HospitalApp() {
  const [initialReset] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return { token: params.get('resetToken') || '', email: params.get('email') || '' }
  })
  const [session, setSession] = useState(null)
  const [mode, setMode] = useState('checking')
  const [authOpen, setAuthOpen] = useState(Boolean(initialReset.token))
  const [register, setRegister] = useState(false)
  const [resetFlow, setResetFlow] = useState(Boolean(initialReset.token))
  const [resetToken, setResetToken] = useState(initialReset.token)
  const [resetEmail, setResetEmail] = useState(initialReset.email)
  const [authBusy, setAuthBusy] = useState(false)
  const [pendingDoctor, setPendingDoctor] = useState(null)
  const [bookingDoctor, setBookingDoctor] = useState(null)
  const [page, setPage] = useState('overview')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [doctors, setDoctors] = useState([])
  const [departments, setDepartments] = useState([])
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('All departments')
  const [sort, setSort] = useState('recommended')
  const [workspace, setWorkspace] = useState({ dashboard: null, appointments: [], records: [], notifications: [], clinicians: [], patients: [] })

  useEffect(() => {
    request('/health').then((result) => setMode(result.mode)).catch(() => setMode('offline'))
    request('/departments').then(setDepartments).catch(() => {})
    if (initialReset.token) window.history.replaceState({}, '', window.location.pathname)
  }, [initialReset.token])
  useEffect(() => {
    const query = new URLSearchParams()
    if (search) query.set('search', search)
    if (department !== 'All departments') query.set('department', department)
    if (sort === 'fee') query.set('sort', 'fee')
    request(`/doctors?${query}`).then(setDoctors).catch(() => setDoctors([]))
  }, [search, department, sort])

  async function loadWorkspace(current = session) {
    if (!current) return
    const token = current.token
    const results = await Promise.allSettled([
      request('/dashboard', { token }), request('/appointments', { token }), request('/records', { token }), request('/notifications', { token }),
      current.user.role === 'admin' ? request('/admin/doctors', { token }) : Promise.resolve([]),
      current.user.role === 'admin' ? request('/admin/patients', { token }) : Promise.resolve([]),
    ])
    const [dashboard, appointments, records, notifications, clinicians, patients] = results
    setWorkspace({ dashboard: dashboard.status === 'fulfilled' ? dashboard.value : null, appointments: appointments.status === 'fulfilled' ? appointments.value : [], records: records.status === 'fulfilled' ? records.value : [], notifications: notifications.status === 'fulfilled' ? notifications.value : [], clinicians: clinicians.status === 'fulfilled' ? clinicians.value : [], patients: patients.status === 'fulfilled' ? patients.value : [] })
    const error = results.find((result) => result.status === 'rejected')
    if (error) toast.error(error.reason.message)
  }
  async function reloadDepartments() {
    try { setDepartments(await request('/departments')) } catch (error) { toast.error(error.message) }
  }
  async function submitAuth(event) {
    event.preventDefault()
    setAuthBusy(true)
    const body = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      const path = resetFlow ? resetToken ? '/auth/reset-password' : '/auth/forgot-password' : register ? '/auth/register' : '/auth/login'
      if (resetFlow && resetToken) { body.token = resetToken; body.email = resetEmail || body.email }
      const result = await request(path, { method: 'POST', body: JSON.stringify(body) })
      if (resetFlow && !resetToken) {
        setResetEmail(body.email)
        if (result.devResetToken) { setResetToken(result.devResetToken); toast.success('Demo reset link ready. Choose a new password below.') }
        else toast.success(result.message)
        return
      }
      if (resetFlow) { setResetFlow(false); setResetToken(''); setRegister(false); toast.success(result.message); return }
      setSession(result)
      setAuthOpen(false)
      setPage('overview')
      void loadWorkspace(result)
      toast.success(result.message || `Welcome, ${result.user.name.split(' ')[0]}.`)
      if (pendingDoctor && result.user.role === 'patient') { setBookingDoctor(pendingDoctor); setPendingDoctor(null) }
    } catch (error) { toast.error(error.message) } finally { setAuthBusy(false) }
  }
  async function quickLogin(account) {
    try {
      const result = await request('/auth/login', { method: 'POST', body: JSON.stringify(account) })
      setSession(result); setAuthOpen(false); void loadWorkspace(result)
      if (pendingDoctor && account.role === 'patient') { setBookingDoctor(pendingDoctor); setPendingDoctor(null) }
      toast.success(`Signed in as ${account.role.toLowerCase()}.`)
    }
    catch (error) { toast.error(error.message) }
  }
  function signOut() { setSession(null); setPage('overview'); setWorkspace({ dashboard: null, appointments: [], records: [], notifications: [], clinicians: [], patients: [] }); toast.success('You have signed out.') }
  function updateUser(updated) { setSession((current) => current && ({ ...current, user: { ...current.user, ...updated } })) }
  function startBooking(doctor) {
    if (!doctor) return toast.error('No clinician is available yet. Try again shortly.')
    if (!session) { setPendingDoctor(doctor); setRegister(false); setAuthOpen(true); return }
    if (session.user.role !== 'patient') return toast.error('Appointment booking is available to patient accounts.')
    setBookingDoctor(doctor)
  }
  async function book(event) {
    event.preventDefault()
    const form = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      await request('/appointments', { token: session.token, method: 'POST', body: JSON.stringify({ doctorId: bookingDoctor.id, ...form }) })
      toast.success('Your appointment request has been sent.')
      setBookingDoctor(null); setPage('appointments'); await loadWorkspace()
    } catch (error) { toast.error(error.message) }
  }
  async function changeAppointment(id, status) {
    try { await request(`/appointments/${id}/status`, { token: session.token, method: 'PATCH', body: JSON.stringify({ status }) }); toast.success(`Appointment ${status}.`); await loadWorkspace() }
    catch (error) { toast.error(error.message) }
  }
  async function approveDoctor(id, approved) {
    try { await request(`/admin/doctors/${id}/approval`, { token: session.token, method: 'PATCH', body: JSON.stringify({ approved }) }); toast.success(approved ? 'Clinician approved.' : 'Clinician declined.'); await loadWorkspace() }
    catch (error) { toast.error(error.message) }
  }
  async function createRecord(event, appointment) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget).entries())
    const medications = values.medication ? [{ name: values.medication, dosage: values.dosage || '', instructions: values.instructions || '' }] : []
    try { await request('/records', { token: session.token, method: 'POST', body: JSON.stringify({ appointmentId: appointment.id, diagnosis: values.diagnosis, notes: values.notes, medications }) }); await changeAppointment(appointment.id, 'completed'); toast.success('Consultation record saved.') }
    catch (error) { toast.error(error.message) }
  }
  async function toggleNotifications() {
    setNotifyOpen((value) => !value)
    if (workspace.notifications.some((item) => !item.readAt)) {
      try { await request('/notifications/read', { token: session.token, method: 'PATCH' }); setWorkspace((value) => ({ ...value, notifications: value.notifications.map((item) => ({ ...item, readAt: new Date().toISOString() })) })) }
      catch (error) { toast.error(error.message) }
    }
  }
  function exportCsv() {
    const rows = [['Date', 'Time', 'Patient', 'Doctor', 'Status'], ...workspace.appointments.map((item) => [item.date, item.time, item.patient?.name || '', item.doctor?.name || '', item.status])]
    const csv = rows.map((row) => row.map((field) => `"${String(field).replaceAll('"', '""')}"`).join(',')).join('\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'sanjeevani-appointments.csv'; link.click(); URL.revokeObjectURL(link.href)
  }

  return <>
    <Toaster position="top-right" toastOptions={{ duration: 3600, style: { borderRadius: 7, fontFamily: 'DM Sans' } }} />
    {!session ? <PublicSite mode={mode} doctors={doctors} departments={departments} search={search} setSearch={setSearch} department={department} setDepartment={setDepartment} sort={sort} setSort={setSort} startBooking={startBooking} onLogin={() => { setRegister(false); setResetFlow(false); setAuthOpen(true) }} onRegister={() => { setRegister(true); setResetFlow(false); setAuthOpen(true) }} /> : <Dashboard session={session} page={page} setPage={setPage} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} notifyOpen={notifyOpen} toggleNotifications={toggleNotifications} workspace={workspace} doctors={doctors} departments={departments} search={search} setSearch={setSearch} department={department} setDepartment={setDepartment} startBooking={startBooking} changeAppointment={changeAppointment} createRecord={createRecord} approveDoctor={approveDoctor} exportCsv={exportCsv} refresh={() => loadWorkspace()} refreshDepartments={reloadDepartments} signOut={signOut} onUserUpdate={updateUser} />}
    {!session && authOpen && <Dialog title={resetFlow ? resetToken ? 'Choose a new password' : 'Reset your password' : register ? 'Create your account' : 'Welcome back'} onClose={() => setAuthOpen(false)}><p className="dialog-copy">{resetFlow ? resetToken ? 'Your reset link is valid for 15 minutes.' : 'Enter your email and we’ll send password reset instructions.' : register ? 'A more connected care experience starts here.' : 'Sign in to your Sanjeevani Healthcare workspace.'}</p><form className="form-stack" onSubmit={submitAuth}>{register && <label>Full name<input name="name" minLength="2" maxLength="100" required placeholder="Your name" /></label>}<label>Email address<input name="email" type="email" required placeholder="you@example.com" defaultValue={resetEmail} readOnly={resetFlow && Boolean(resetToken)} /></label>{(!resetFlow || resetToken) && <label>{resetFlow ? 'New password' : 'Password'}<input name="password" type="password" minLength={register || resetFlow ? 8 : 1} required placeholder={register || resetFlow ? 'At least 8 characters' : 'Your password'} /></label>}{register && <><label>Account type<select name="role"><option value="patient">Patient</option><option value="doctor">Doctor (requires approval)</option></select></label><label>Phone (optional)<input name="phone" type="tel" maxLength="30" /></label></>}<button className="btn btn-main btn-wide" disabled={authBusy}>{authBusy ? 'Please wait…' : resetFlow ? resetToken ? 'Update password' : 'Send reset instructions' : register ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></button></form>{!resetFlow && !register && <button className="forgot-link" onClick={() => { setResetFlow(true); setResetToken(''); setResetEmail('') }}>Forgot password?</button>}{mode === 'demo' && !register && !resetFlow && <div className="demo-login"><small>DEVELOPMENT DEMO ACCOUNTS</small>{demoAccounts.map((account) => <button key={account.role} onClick={() => quickLogin(account)}><strong>{account.role}</strong><span>{account.email}</span><ArrowRight size={14} /></button>)}</div>}<p className="dialog-switch">{resetFlow ? <button onClick={() => { setResetFlow(false); setResetToken('') }}>Back to sign in</button> : register ? 'Already have an account?' : 'New to Sanjeevani Healthcare?'} {!resetFlow && <button onClick={() => setRegister((value) => !value)}>{register ? 'Sign in' : 'Create an account'}</button>}</p></Dialog>}
    {session && authOpen && <Dialog title="Your account" onClose={() => setAuthOpen(false)}><p className="dialog-copy">You are signed in as {session.user.name}.</p></Dialog>}
    {bookingDoctor && <BookingDialog doctor={bookingDoctor} onClose={() => setBookingDoctor(null)} onSubmit={book} />}
  </>
}

function PublicSite({ mode, doctors, departments, search, setSearch, department, setDepartment, sort, setSort, startBooking, onLogin, onRegister }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const services = [{ icon: HeartPulse, name: 'Cardiology', text: 'Thoughtful heart care, from prevention to recovery.' }, { icon: Activity, name: 'Neurology', text: 'Expert guidance for your brain and nervous system.' }, { icon: Stethoscope, name: 'Primary care', text: 'A familiar team for every stage of your health.' }, { icon: FileHeart, name: 'Diagnostics', text: 'Clear answers with advanced imaging and lab care.' }]
  return <>
    <header className="site-header"><a className="brand" href="#home"><span className="brand-mark"><HeartPulse size={19} /></span>Sanjeevani<span> Healthcare</span></a><button className="menu-toggle" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><nav className={menuOpen ? 'site-nav nav-open' : 'site-nav'}><a href="#services" onClick={() => setMenuOpen(false)}>Our care</a><a href="#doctors" onClick={() => setMenuOpen(false)}>Find a doctor</a><a href="#approach" onClick={() => setMenuOpen(false)}>Our approach</a></nav><div className="site-actions"><button className="btn btn-quiet" onClick={onLogin}>Sign in</button><button className="btn btn-main" onClick={onRegister}>Get started <ArrowRight size={15} /></button></div></header>
    <main>
      <section className="hero" id="home"><div className="hero-copy"><span className="hero-kicker"><i /> A more connected kind of care</span><h1>Your health,<br /><em>our priority.</em></h1><p>Better care starts with feeling understood. Meet your clinicians, manage appointments, and keep your health in one thoughtful place.</p><div className="hero-buttons"><button className="btn btn-main" onClick={() => startBooking(doctors[0])}>Book an appointment <ArrowRight size={16} /></button><a className="btn btn-quiet" href="#doctors">Explore doctors <ArrowRight size={16} /></a></div><div className="hero-proof"><div className="proof-avatars"><Avatar name="Dr Maya" image={portraits[0]} size="tiny" /><Avatar name="Dr Elias" image={portraits[1]} size="tiny" /><Avatar name="Care team" image={portraits[2]} size="tiny" /></div><p><strong>Care that follows through.</strong><br />A real team, here for every step.</p><ShieldCheck size={18} /></div></div><motion.div className="hero-visual" initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .65 }}><img src="https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=1500&q=88" alt="Clinician speaking with a patient in a bright care room" onError={(event) => { event.currentTarget.style.display = 'none' }} /><div className="hero-image-shade" /><div className="hero-caption"><span><HeartPulse size={18} /></span><div><strong>Care, made personal</strong><small>One team. Every detail connected.</small></div><ArrowUpRight size={17} /></div><div className="next-visit"><span><CalendarDays size={18} /></span><div><small>Online booking</small><strong>Choose an open slot</strong></div><ArrowRight size={15} /></div></motion.div><div className="hero-stats"><div><b>{doctors.length}</b><span>Available clinicians</span></div><div><b>{departments.length}</b><span>Care departments</span></div><div><b>3</b><span>Account roles</span></div></div></section>
      <div className="trust-strip"><span>CARE THAT CONNECTS</span><b><ShieldCheck size={16} /> Secure by design</b><b><Clock3 size={16} /> Less waiting, more living</b><b><HeartPulse size={16} /> Clinician-led care</b></div>
      <section className="public-section" id="services"><div className="section-head"><div><small>A HEALTHIER WAY FORWARD</small><h2>Care for the whole you.</h2></div><p>From your first question to your next check-in, your care team makes every step feel simpler.</p></div><div className="service-grid">{services.map(({ icon: Icon, name, text }, index) => <motion.article className="service-item" key={name} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .06 }}><span><Icon size={20} /></span><h3>{name}</h3><p>{text}</p><a href="#doctors" aria-label={`Explore ${name}`}><ArrowUpRight size={17} /></a></motion.article>)}</div></section>
      <section className="public-section doctors-section" id="doctors"><div className="section-head"><div><small>MEET YOUR CARE TEAM</small><h2>Good people. Great care.</h2></div><a href="#doctor-search">Find your doctor <ArrowRight size={15} /></a></div><div className="doctor-filter" id="doctor-search"><label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clinicians or specialties" /></label><select value={department} onChange={(event) => setDepartment(event.target.value)}><option>All departments</option>{departments.map((item) => <option key={item.id || item._id}>{item.name}</option>)}</select><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Recommended</option><option value="fee">Lowest consultation fee</option></select></div><div className="doctor-grid">{doctors.slice(0, 3).map((doctor, index) => <DoctorCard doctor={doctor} index={index} key={doctor.id} startBooking={startBooking} />)}</div>{doctors.length === 0 && <p className="empty-inline">No clinicians match that search. Try another name or department.</p>}</section>
      <section className="approach" id="approach"><div className="approach-image"><img src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=85" alt="A calm, sunlit hospital room" onError={(event) => { event.currentTarget.style.opacity = '0' }} /><span><CheckCircle2 size={16} /> Thoughtful care, by design</span></div><div className="approach-copy"><small>THE SANJEEVANI DIFFERENCE</small><h2>Health care should feel like people care.</h2><p>We bring your appointments, care team, and health records together, so you can spend less time coordinating and more time feeling well.</p>{['A team that knows your story|Connected notes make every visit more personal.', 'Care that keeps moving|Simple scheduling and clear follow-through.', 'Your health, held with care|Private by design, accessible when you need it.'].map((point, index) => <div className="approach-point" key={point}><span>0{index + 1}</span><p><b>{point.split('|')[0]}</b><small>{point.split('|')[1]}</small></p></div>)}<button className="btn btn-main" onClick={onRegister}>Get started <ArrowRight size={15} /></button></div></section>
      <section className="testimonial"><small>DEMO PATIENT STORY</small><span>“</span><blockquote>For the first time, all the parts of my care feel like they’re talking to each other. That gives me a lot of peace of mind.</blockquote><div><Avatar name="Olivia Bennett" size="small" /><p><b>Olivia Bennett</b><small>Sample patient</small></p></div></section><section className="contact-band"><div><small>HERE WHEN YOU NEED US</small><h2>Let’s take the next step together.</h2><p>Our care coordination team is ready to help you find your way.</p></div><a className="btn btn-white" href="mailto:hello@northstar.health">Contact our team <ArrowRight size={15} /></a></section>
    </main><footer className="site-footer"><div className="footer-content"><div className="footer-brand-column"><a className="brand" href="#home"><span className="brand-mark"><HeartPulse size={17} /></span>Sanjeevani<span> Healthcare</span></a><p>Care that connects, from the first hello.</p></div><div className="footer-contact"><span className="footer-label">GET IN TOUCH</span><strong>Ysravan Kumar</strong><a href="tel:9059854387"><Phone size={14} /> 9059854387</a><a href="mailto:ysravankumarkola123@gmail.com"><Mail size={14} /> ysravankumarkola123@gmail.com</a></div><nav className="footer-nav" aria-label="Footer navigation"><span className="footer-label">EXPLORE</span><a href="#services">Services</a><a href="#doctors">Clinicians</a><a href="#approach">Our approach</a></nav></div><div className="footer-bottom"><span>© 2026 Sanjeevani Healthcare</span><span>Private care, thoughtfully connected</span></div></footer>
    {mode === 'offline' && <div className="offline-banner">The care portal API is not reachable. Start the development server to sign in or request appointments.</div>}
  </>
}

function DoctorCard({ doctor, index, startBooking }) {
  return <article className="doctor-card"><div className="doctor-photo"><img src={doctor.profileImage || portraits[index % portraits.length]} alt={doctor.name} onError={(event) => { event.currentTarget.src = portraits[index % portraits.length] }} /><span><i /> Accepting patients</span></div><div className="doctor-info"><div className="doctor-name"><div><h3>{doctor.name}</h3><p>{doctor.specialty}</p></div></div><div className="doctor-meta"><span>{doctor.qualifications || 'Board-certified'}</span><span>{doctor.experienceYears} years experience</span></div><div className="doctor-footer"><strong>${doctor.consultationFee}<small> / visit</small></strong><button className="btn btn-outline" onClick={() => startBooking(doctor)}>Book visit <ArrowRight size={14} /></button></div></div></article>
}

function BookingDialog({ doctor, onClose, onSubmit }) {
  const [weekday, setWeekday] = useState('')
  const [dates] = useState(() => Array.from({ length: 28 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index + 1); return date }))
  const availableDates = dates.filter((date) => doctor.availability?.some((item) => item.day === date.toLocaleDateString('en-US', { weekday: 'short' })))
  const slots = doctor.availability?.find((item) => item.day === weekday)?.slots || []
  return <Dialog title="Request an appointment" onClose={onClose}><div className="booking-doctor"><Avatar name={doctor.name} image={doctor.profileImage || portraits[0]} /><div><b>{doctor.name}</b><span>{doctor.specialty} · ${doctor.consultationFee} / visit</span></div></div><form className="form-stack" onSubmit={onSubmit}><label>Choose a date<select name="date" required defaultValue="" onChange={(event) => setWeekday(new Date(`${event.target.value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }))}><option value="" disabled>Select an available day</option>{availableDates.map((date) => <option key={date.toISOString().slice(0, 10)} value={date.toISOString().slice(0, 10)}>{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</option>)}</select></label><label>Available time<select name="time" required disabled={!slots.length}><option value="">{slots.length ? 'Select a time' : 'Choose a date first'}</option>{slots.map((slot) => <option key={slot}>{slot}</option>)}</select></label><label>What would you like help with?<textarea name="reason" rows="3" maxLength="500" placeholder="A short note for your care team (optional)" /></label><button className="btn btn-main btn-wide">Send appointment request <ArrowRight size={15} /></button></form></Dialog>
}

function Dashboard({ session, page, setPage, mobileOpen, setMobileOpen, notifyOpen, toggleNotifications, workspace, doctors, departments, search, setSearch, department, setDepartment, startBooking, changeAppointment, createRecord, approveDoctor, exportCsv, refresh, refreshDepartments, signOut, onUserUpdate }) {
  const { user, token } = session
  const [today] = useState(() => new Date())
  const todayISO = today.toISOString().slice(0, 10)
  const salutation = today.getHours() < 12 ? 'morning' : 'afternoon'
  const isAdmin = user.role === 'admin'; const isDoctor = user.role === 'doctor'
  const navigation = [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'appointments', label: 'Appointments', icon: CalendarDays }, { id: 'doctors', label: isAdmin ? 'Clinicians' : isDoctor ? 'Care team' : 'Find a doctor', icon: Stethoscope }, ...(isAdmin ? [{ id: 'patients', label: 'Patients', icon: Users }, { id: 'departments', label: 'Departments', icon: Building2 }, { id: 'activity', label: 'Activity log', icon: Activity }] : [{ id: 'records', label: 'Medical records', icon: FileHeart }]), { id: 'profile', label: 'My profile', icon: Settings2 }]
  const counts = workspace.dashboard?.counts || {}
  const visits = workspace.appointments
  const next = visits.find((item) => ['pending', 'confirmed'].includes(item.status) && item.date >= todayISO)
  const metrics = isAdmin ? [['Registered patients', counts.totalPatients, Users, 'blue'], ['Clinicians', counts.totalDoctors, Stethoscope, 'green'], ['Appointments', counts.totalAppointments, CalendarDays, 'lavender'], ['Awaiting review', counts.pendingAppointments, Clock3, 'peach']] : isDoctor ? [['Total visits', counts.totalAppointments, Users, 'blue'], ["Today's visits", counts.todayAppointments, CalendarDays, 'green'], ['Pending requests', counts.pendingRequests, Clock3, 'peach'], ['Completed', counts.completedAppointments, CheckCircle2, 'lavender']] : [['Total visits', counts.totalAppointments, CalendarDays, 'blue'], ['Upcoming', counts.upcomingAppointments, Clock3, 'green'], ['Completed', counts.completedAppointments, CheckCircle2, 'lavender'], ['Past visits', counts.cancelledAppointments, Activity, 'peach']]
  const pageTitle = navigation.find((item) => item.id === page)?.label || 'Overview'
  const greeting = `Good ${salutation}, ${user.name.split(' ')[0]}`
  return <div className="app-shell"><aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}><a className="brand sidebar-brand" href="#dashboard"><span className="brand-mark"><HeartPulse size={18} /></span>Sanjeevani<span> Healthcare</span></a><small className="workspace-label">WORKSPACE</small><nav>{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'side-link active' : 'side-link'} onClick={() => { setPage(id); setMobileOpen(false) }}><Icon size={17} /><span>{label}</span>{id === 'appointments' && isDoctor && counts.pendingRequests > 0 && <b>{counts.pendingRequests}</b>}</button>)}</nav><div className="sidebar-bottom"><div className="help-card"><CircleHelpIcon /><b>Need a hand?</b><small>Our care team is here for you.</small><a href="mailto:hello@northstar.health">Contact support <ArrowRight size={12} /></a></div><button className="side-link" onClick={signOut}><LogOut size={17} /> Sign out</button></div></aside><div className="workspace"><header className="workspace-header"><button className="menu-toggle workspace-menu" onClick={() => setMobileOpen((value) => !value)} aria-label="Open menu"><Menu size={19} /></button><div className="crumb">Workspace <ArrowRight size={12} /> <b>{pageTitle}</b></div><div className="workspace-tools"><span className="connected"><i /> {workspace.dashboard ? 'Connected' : 'Connecting'}</span><div className="notification-wrap"><button className="icon-btn bell-btn" onClick={toggleNotifications} aria-label="Notifications"><Bell size={18} />{workspace.notifications.some((item) => !item.readAt) && <i>{workspace.notifications.filter((item) => !item.readAt).length}</i>}</button>{notifyOpen && <div className="notification-menu"><div className="notification-title"><b>Notifications</b><span>{workspace.notifications.filter((item) => !item.readAt).length} unread</span></div>{workspace.notifications.length ? workspace.notifications.slice(0, 6).map((item) => <div className="notification-row" key={item.id || item._id}><b>{item.title}</b><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleDateString()}</small></div>) : <div className="empty-inline">You’re all caught up.</div>}</div>}</div><div className="account-chip"><Avatar name={user.name} image={user.profileImage} size="small" /><div><b>{user.name}</b><small>{user.role}</small></div><ChevronDown size={13} /></div></div></header><main className="dashboard-main"><div className="dashboard-heading"><div><small>{isAdmin ? 'HOSPITAL OPERATIONS' : isDoctor ? 'CLINICIAN PORTAL' : 'PATIENT PORTAL'}</small><h1>{page === 'overview' ? greeting : pageTitle}</h1><p>{page === 'overview' ? isAdmin ? 'A clear view of care activity across Northstar.' : isDoctor ? 'Your schedule and patient requests, all in one place.' : 'Your care, organized around you.' : page === 'appointments' ? 'Review, schedule, and manage visits.' : page === 'records' ? 'Your consultations and health documents.' : 'Find the right next step for your health.'}</p></div><div className="heading-actions">{page === 'appointments' && <button className="btn btn-outline" onClick={exportCsv}><Download size={14} /> Export CSV</button>}{!isDoctor && !isAdmin && <button className="btn btn-main" onClick={() => startBooking(doctors[0])}><Plus size={15} /> Book a visit</button>}</div></div>
      {page === 'overview' && <><div className="metric-grid">{metrics.map(([label, value, Icon, tone], index) => <motion.article className="metric-card glass" key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }}><span className={`metric-icon ${tone}`}><Icon size={17} /></span><small>{label}</small><b>{value || 0}</b><span className="metric-sub"><ArrowUpRight size={11} /> Updated just now</span></motion.article>)}</div>{isAdmin ? <AdminDashboard workspace={workspace} approveDoctor={approveDoctor} /> : <div className="overview-grid"><section className="panel glass"><div className="panel-title"><div><small>YOUR SCHEDULE</small><h2>{isDoctor ? 'Today & upcoming' : 'Your next visit'}</h2></div><button className="text-action" onClick={() => setPage('appointments')}>All appointments <ArrowRight size={13} /></button></div>{next ? <AppointmentFeature appointment={next} doctor={isDoctor} /> : <div className="empty-state"><span><CalendarDays size={21} /></span><b>No visits on the calendar</b><p>{isDoctor ? 'New requests will show up here.' : 'Find a clinician and schedule a visit when you’re ready.'}</p>{!isDoctor && <button className="btn btn-main" onClick={() => setPage('doctors')}>Explore clinicians <ArrowRight size={14} /></button>}</div>}<div className="appointment-list">{visits.filter((item) => item.id !== next?.id).slice(0, 3).map((item) => <AppointmentRow key={item.id} appointment={item} doctor={isDoctor} onStatus={changeAppointment} role={user.role} />)}</div></section><section className="panel glass quick-panel"><div className="panel-title"><div><small>QUICK ACCESS</small><h2>Your care, at a glance</h2></div><HeartPulse size={17} /></div><button className="quick-link" onClick={() => setPage('records')}><FileHeart size={17} /><span><b>Medical records</b><small>{workspace.records.length} consultation{workspace.records.length === 1 ? '' : 's'} available</small></span><ArrowRight size={14} /></button><button className="quick-link" onClick={() => setPage('doctors')}><Stethoscope size={17} /><span><b>Find a clinician</b><small>Browse your care options</small></span><ArrowRight size={14} /></button><p className="privacy-hint"><ShieldCheck size={15} /> Your health information is private and shared only with your care team.</p></section></div>}</>}
      {page === 'appointments' && <section className="panel glass full-panel"><div className="panel-title"><div><small>VISIT HISTORY</small><h2>{visits.length} appointment{visits.length === 1 ? '' : 's'}</h2></div><button className="icon-btn" onClick={refresh} aria-label="Refresh appointments"><Activity size={16} /></button></div>{visits.length ? visits.map((item) => <AppointmentRow key={item.id} appointment={item} doctor={isDoctor} onStatus={changeAppointment} onRecord={createRecord} role={user.role} />) : <div className="empty-state"><span><CalendarDays size={21} /></span><b>Your schedule is clear</b><p>Appointments will appear here once they’re booked.</p>{!isDoctor && !isAdmin && <button className="btn btn-main" onClick={() => setPage('doctors')}>Find a doctor <ArrowRight size={14} /></button>}</div>}</section>}
      {page === 'doctors' && <DoctorDirectory admin={isAdmin} doctor={isDoctor} doctors={doctors} clinicians={workspace.clinicians} departments={departments} search={search} setSearch={setSearch} department={department} setDepartment={setDepartment} startBooking={startBooking} approveDoctor={approveDoctor} />}
      {page === 'patients' && isAdmin && <PatientDirectory patients={workspace.patients} />}
      {page === 'departments' && isAdmin && <DepartmentManager departments={departments} token={token} onUpdated={refreshDepartments} />}
      {page === 'records' && <RecordsPanel records={workspace.records} token={token} role={user.role} onUpdated={refresh} />}
      {page === 'activity' && <ActivityLog token={token} />}
      {page === 'profile' && <><Profile user={user} token={token} onUpdated={refresh} onUserUpdate={onUserUpdate} />{isDoctor && <DoctorSettings token={token} />}</>}
    </main><footer className="workspace-footer"><span>© 2026 Sanjeevani Healthcare</span><span>Private care, thoughtfully connected <HeartPulse size={13} /></span></footer></div></div>
}

function CircleHelpIcon() { return <span className="help-mark">?</span> }
function AppointmentFeature({ appointment, doctor }) {
  const person = doctor ? appointment.patient : appointment.doctor
  const date = dateParts(appointment.date)
  return <div className="featured-visit"><span className="date-tile"><b>{date.day}</b><small>{date.month}</small></span><div><small><i /> {doctor ? 'Patient visit' : 'Upcoming appointment'}</small><b>{person?.name || (doctor ? 'Patient' : 'Care team')}</b><span>{dateLabel(appointment.date, { weekday: 'long', month: 'long', day: 'numeric' })} · {appointment.time}</span></div><Status value={appointment.status} /></div>
}

function AppointmentRow({ appointment, doctor, onStatus, onRecord, role }) {
  const person = doctor ? appointment.patient : appointment.doctor
  return <article className="appointment-row">
    <div className="appointment-date"><CalendarDays size={15} /><span>{dateLabel(appointment.date)}</span><small>{appointment.time}</small></div>
    <div className="appointment-person"><Avatar name={person?.name || 'Care team'} size="small" /><div><b>{person?.name || (doctor ? 'Patient' : 'Care team')}</b><small>{doctor ? 'Patient visit' : 'Consultation'}</small></div></div>
    <Status value={appointment.status} />
    <div className="row-actions">
      {role === 'doctor' && appointment.status === 'pending' && <><button className="icon-btn accept" title="Confirm appointment" onClick={() => onStatus(appointment.id, 'confirmed')}><Check size={15} /></button><button className="icon-btn decline" title="Decline appointment" onClick={() => onStatus(appointment.id, 'rejected')}><X size={15} /></button></>}
      {role === 'doctor' && appointment.status === 'confirmed' && onRecord && <details className="record-form"><summary>Add consultation</summary><form onSubmit={(event) => { onRecord(event, appointment); event.currentTarget.closest('details').open = false }}><label>Diagnosis<input name="diagnosis" required /></label><label>Notes<textarea name="notes" rows="2" /></label><label>Medication<input name="medication" placeholder="Optional medication" /></label><label>Dosage<input name="dosage" placeholder="e.g. 10 mg" /></label><label>Instructions<input name="instructions" placeholder="e.g. Once daily" /></label><button className="btn btn-main">Save & complete</button></form></details>}
      {role === 'admin' && appointment.status === 'pending' && <button className="icon-btn accept" title="Confirm appointment" onClick={() => onStatus(appointment.id, 'confirmed')}><Check size={15} /></button>}
      {role === 'admin' && ['pending', 'confirmed'].includes(appointment.status) && <button className="icon-btn decline" title="Cancel appointment" onClick={() => onStatus(appointment.id, 'cancelled')}><X size={15} /></button>}
      {role === 'patient' && ['pending', 'confirmed'].includes(appointment.status) && <button className="text-action cancel" onClick={() => onStatus(appointment.id, 'cancelled')}>Cancel</button>}
    </div>
  </article>
}

function AdminDashboard({ workspace, approveDoctor }) {
  const chart = workspace.dashboard?.monthly || []; const distribution = workspace.dashboard?.departmentDistribution || []; const pending = workspace.clinicians.filter((item) => !item.approved)
  return <div className="admin-grid"><section className="panel glass"><div className="panel-title"><div><small>CARE ACTIVITY</small><h2>Appointments over time</h2></div><span className="legend-dot">This period</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#48a397" stopOpacity={.23} /><stop offset="100%" stopColor="#48a397" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e8efec" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8b9b95', fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b9b95', fontSize: 10 }} allowDecimals={false} /><Tooltip /><Area dataKey="appointments" type="monotone" stroke="#398d81" strokeWidth={2.5} fill="url(#fill)" /></AreaChart></ResponsiveContainer></div></section><section className="panel glass"><div className="panel-title"><div><small>BY DEPARTMENT</small><h2>Care distribution</h2></div></div>{distribution.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={distribution} layout="vertical" margin={{ left: 3, right: 12 }}><CartesianGrid strokeDasharray="3 5" horizontal={false} stroke="#e8efec" /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={90} axisLine={false} tickLine={false} tick={{ fill: '#657a72', fontSize: 10 }} /><Tooltip /><Bar dataKey="value" fill="#55a597" radius={[0, 5, 5, 0]} barSize={14} /></BarChart></ResponsiveContainer></div> : <p className="empty-inline">Department data will appear as appointments are made.</p>}</section><section className="panel glass"><div className="panel-title"><div><small>CLINICIAN ONBOARDING</small><h2>Approval queue <i className="queue-count">{pending.length}</i></h2></div></div>{pending.length ? pending.map((item) => <div className="approval-row" key={item.id || item._id}><Avatar name={item.user?.name || 'Clinician'} size="small" /><div><b>{item.user?.name || 'Clinician'}</b><small>{item.specialty} · {item.department}</small></div><button className="btn btn-outline" onClick={() => approveDoctor(item.id || item._id, true)}>Approve</button></div>) : <p className="empty-inline">All clinician profiles are up to date.</p>}</section><section className="panel glass"><div className="panel-title"><div><small>LATEST ACTIVITY</small><h2>Recent appointments</h2></div></div>{workspace.appointments.slice(0, 4).map((item) => <div className="recent-row" key={item.id}><i /><div><b>{item.patient?.name || 'Patient'} <span>with</span> {item.doctor?.name || 'Care team'}</b><small>{dateLabel(item.date, { month: 'short', day: 'numeric', year: 'numeric' })} · {item.time}</small></div><Status value={item.status} /></div>)}</section></div>
}

function DoctorDirectory({ admin, doctor, doctors, clinicians, departments, search, setSearch, department, setDepartment, startBooking, approveDoctor }) {
  if (admin) return <section className="panel glass full-panel"><div className="panel-title"><div><small>CLINICIAN DIRECTORY</small><h2>Manage clinicians</h2></div></div>{clinicians.map((item) => <div className="approval-row" key={item.id || item._id}><Avatar name={item.user?.name || 'Clinician'} size="small" /><div><b>{item.user?.name || 'Clinician'}</b><small>{item.specialty} · {item.department} · {item.user?.email}</small></div>{item.approved ? <Status value="confirmed" /> : <button className="btn btn-outline" onClick={() => approveDoctor(item.id || item._id, true)}>Approve profile</button>}</div>)}</section>
  return <section className="panel glass full-panel">{!doctor && <div className="doctor-filter dashboard-filter"><label><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or specialty" /></label><select value={department} onChange={(event) => setDepartment(event.target.value)}><option>All departments</option>{departments.map((item) => <option key={item.id || item._id}>{item.name}</option>)}</select></div>}<div className="doctor-grid">{doctors.map((item, index) => <DoctorCard doctor={item} index={index} key={item.id} startBooking={startBooking} />)}</div>{!doctors.length && <p className="empty-inline">No clinicians match your search.</p>}</section>
}


function PatientDirectory({ patients }) {
  const [query, setQuery] = useState('')
  const filtered = patients.filter((item) => `${item.user?.name} ${item.user?.email} ${item.user?.phone}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="panel glass full-panel"><div className="panel-title"><div><small>PATIENT ACCOUNTS</small><h2>{patients.length} registered patients</h2></div></div><label className="patient-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or phone" /></label>{filtered.map((patient) => <article className="patient-row" key={patient.id || patient._id}><Avatar name={patient.user?.name || 'Patient'} size="small" /><div><b>{patient.user?.name || 'Patient'}</b><small>{patient.user?.email}</small></div><span>{patient.user?.phone || 'No phone on file'}</span><small>Joined {patient.user?.createdAt ? dateLabel(String(patient.user.createdAt).slice(0, 10), { month: 'short', day: 'numeric', year: 'numeric' }) : 'recently'}</small></article>)}{filtered.length === 0 && <p className="empty-inline">No patients match that search.</p>}</section>
}

function DepartmentManager({ departments, token, onUpdated }) {
  const [editing, setEditing] = useState('')
  const [draft, setDraft] = useState({ name: '', description: '' })
  const [busy, setBusy] = useState(false)
  async function save(event, id = '') {
    event.preventDefault()
    const form = Object.fromEntries(new FormData(event.currentTarget).entries())
    setBusy(true)
    try { await request(id ? `/admin/departments/${id}` : '/admin/departments', { token, method: id ? 'PATCH' : 'POST', body: JSON.stringify(form) }); toast.success(id ? 'Department updated.' : 'Department added.'); setEditing(''); setDraft({ name: '', description: '' }); await onUpdated() }
    catch (error) { toast.error(error.message) } finally { setBusy(false) }
  }
  async function remove(id) {
    try { await request(`/admin/departments/${id}`, { token, method: 'DELETE' }); toast.success('Department removed.'); await onUpdated() }
    catch (error) { toast.error(error.message) }
  }
  return <section className="panel glass full-panel"><div className="panel-title"><div><small>HOSPITAL STRUCTURE</small><h2>Manage departments</h2></div><span className="record-count">{departments.length} departments</span></div><form className="department-add" onSubmit={(event) => save(event)}><input name="name" value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} placeholder="Department name" required minLength="2" maxLength="100" /><input name="description" value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder="Short description" maxLength="500" /><button className="btn btn-main" disabled={busy}><Plus size={14} /> Add department</button></form>{departments.map((item) => {
    const id = item.id || item._id
    return <article className="department-row" key={id}>{editing === id ? <form className="department-edit" onSubmit={(event) => save(event, id)}><input name="name" defaultValue={item.name} required minLength="2" maxLength="100" /><input name="description" defaultValue={item.description} maxLength="500" /><button className="icon-btn accept" title="Save department"><Check size={14} /></button><button type="button" className="icon-btn" title="Cancel editing" onClick={() => setEditing('')}><X size={14} /></button></form> : <><div><b>{item.name}</b><small>{item.description || 'Hospital department'}</small></div><button className="icon-btn" title={`Edit ${item.name}`} onClick={() => setEditing(id)}><Pencil size={14} /></button><button className="icon-btn decline" title={`Remove ${item.name}`} onClick={() => remove(id)}><Trash2 size={14} /></button></>}</article>
  })}</section>
}
function RecordsPanel({ records, token }) {
  async function downloadPrescription(record) {
    try {
      const result = await request(`/records/${record.id || record._id}/prescriptions`, { token })
      if (!result.length) return toast('No prescription is attached to this record.')
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF()
      pdf.setTextColor(39, 107, 96)
      pdf.setFontSize(18)
      pdf.text('Sanjeevani Healthcare', 18, 22)
      pdf.setTextColor(45, 59, 54)
      pdf.setFontSize(12)
      pdf.text('Digital prescription', 18, 34)
      pdf.setFontSize(10)
      pdf.text(`Diagnosis: ${record.diagnosis}`, 18, 46)
      pdf.text(`Issued: ${dateLabel(record.createdAt?.slice(0, 10), { month: 'long', day: 'numeric', year: 'numeric' })}`, 18, 54)
      let y = 69
      for (const medication of result.flatMap((item) => item.medications || [])) {
        pdf.setFont(undefined, 'bold')
        pdf.text(medication.name, 18, y)
        pdf.setFont(undefined, 'normal')
        pdf.text(`Dosage: ${medication.dosage || 'As directed'}`, 18, y + 7)
        const instructions = pdf.splitTextToSize(`Instructions: ${medication.instructions || 'As directed'}`, 170)
        pdf.text(instructions, 18, y + 14)
        y += 14 + instructions.length * 5 + 6
        if (y > 270) { pdf.addPage(); y = 22 }
      }
      pdf.save('sanjeevani-prescription.pdf')
    } catch (error) { toast.error(error.message) }
  }
  return <section className="panel glass full-panel"><div className="panel-title"><div><small>HEALTH HISTORY</small><h2>Consultation records</h2></div><span className="record-count"><FileHeart size={14} /> {records.length} records</span></div>{records.length ? records.map((record) => <article className="record-row" key={record.id || record._id}><span className="record-icon"><FileHeart size={17} /></span><div><b>{record.diagnosis}</b><small>{dateLabel(record.createdAt?.slice(0, 10), { month: 'long', day: 'numeric', year: 'numeric' })}</small><p>{record.notes || 'No additional notes.'}</p></div><button className="btn btn-outline" onClick={() => downloadPrescription(record)}><Download size={13} /> Prescription</button></article>) : <div className="empty-state"><span><FileHeart size={21} /></span><b>No records yet</b><p>Completed consultations and care notes will be available here.</p></div>}</section>
}

function ActivityLog({ token }) {
  const [logs, setLogs] = useState([])
  useEffect(() => { request('/admin/audit-logs', { token }).then(setLogs).catch((error) => toast.error(error.message)) }, [token])
  return <section className="panel glass full-panel"><div className="panel-title"><div><small>SYSTEM AUDIT</small><h2>Administrative activity</h2></div></div>{logs.map((log) => <div className="recent-row" key={log.id || log._id}><i /><div><b>{log.action}</b><small>{log.targetType} · {new Date(log.createdAt).toLocaleString()}</small></div></div>)}{!logs.length && <p className="empty-inline">Administrative actions will be recorded here.</p>}</section>
}

function Profile({ user, token, onUpdated, onUserUpdate }) {
  const [saving, setSaving] = useState(false)
  return <section className="panel glass profile-panel"><div className="profile-top"><Avatar name={user.name} image={user.profileImage?.startsWith('/') ? `${API.replace('/api', '')}${user.profileImage}` : user.profileImage} size="large" /><div><small>ACCOUNT DETAILS</small><h2>{user.name}</h2><span>{user.role}</span></div></div><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); setSaving(true); try { const result = await request('/profile', { token, method: 'PATCH', body: JSON.stringify(values) }); onUserUpdate(result.user); toast.success('Profile updated.'); await onUpdated() } catch (error) { toast.error(error.message) } finally { setSaving(false) } }}><label>Full name<input name="name" defaultValue={user.name} required /></label><label>Email address<input value={user.email} disabled /></label><label>Phone number<input name="phone" defaultValue={user.phone} /></label><label>Profile picture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const photo = event.target.files?.[0]; if (!photo) return; const body = new FormData(); body.append('photo', photo); try { const result = await request('/profile/photo', { token, method: 'POST', body }); onUserUpdate(result.user); toast.success('Profile photo updated.') } catch (error) { toast.error(error.message) } }} /></label><button className="btn btn-main">{saving ? 'Saving…' : 'Save changes'} <Check size={14} /></button></form><p className="privacy-hint"><ShieldCheck size={15} /> Profile images use local storage in development. Appointment email requires SMTP configuration.</p></section>
  async function uploadReport(record, file) {
    const body = new FormData()
    body.append('report', file)
    try { await request(`/records/${record.id || record._id}/documents`, { token, method: 'POST', body }); toast.success('Medical report uploaded.'); await onUpdated() }
    catch (error) { toast.error(error.message) }
  }
  async function downloadReport(record, document) {
    try {
      const tunnelHeaders = window.location.hostname.endsWith('.loca.lt') ? { 'bypass-tunnel-reminder': 'true' } : {}
      const response = await fetch(`${API}/records/${record.id || record._id}/documents/${document.id || document._id}`, { headers: { ...tunnelHeaders, Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error((await response.json()).message || 'Report download failed.')
      const link = document.createElement('a')
      link.href = URL.createObjectURL(await response.blob())
      link.download = document.name
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) { toast.error(error.message) }
  }
  return <section className="panel glass full-panel"><div className="panel-title"><div><small>HEALTH HISTORY</small><h2>Consultation records</h2></div><span className="record-count"><FileHeart size={14} /> {records.length} records</span></div>{records.length ? records.map((record) => <article className="record-row" key={record.id || record._id}><span className="record-icon"><FileHeart size={17} /></span><div><b>{record.diagnosis}</b><small>{dateLabel(record.createdAt?.slice(0, 10), { month: 'long', day: 'numeric', year: 'numeric' })}</small><p>{record.notes || 'No additional notes.'}</p><div className="record-documents">{(record.documents || []).map((document) => <button key={document.id || document._id} onClick={() => downloadReport(record, document)}><Download size={11} /> {document.name}</button>)}{role === 'doctor' && <label className="upload-report">+ Add report<input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadReport(record, file) }} /></label>}</div></div><button className="btn btn-outline" onClick={() => downloadPrescription(record)}><Download size={13} /> Prescription PDF</button></article>) : <div className="empty-state"><span><FileHeart size={21} /></span><b>No records yet</b><p>Completed consultations and care notes will be available here.</p></div>}</section>
}

function DoctorSettings({ token }) {
  const [profile, setProfile] = useState(null)
  const [days, setDays] = useState([])
  const [saving, setSaving] = useState(false)
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  useEffect(() => { request('/doctor/profile', { token }).then((result) => { setProfile(result); setDays(result.availability?.map((item) => item.day) || []) }).catch((error) => toast.error(error.message)) }, [token])
  async function save(event) {
    event.preventDefault()
    const form = Object.fromEntries(new FormData(event.currentTarget).entries())
    const slots = String(form.slots || '').split(',').map((slot) => slot.trim()).filter(Boolean)
    const values = { department: form.department, specialty: form.specialty, qualifications: form.qualifications, experienceYears: Number(form.experienceYears), consultationFee: Number(form.consultationFee), availability: days.map((day) => ({ day, slots })) }
    setSaving(true)
    try { const result = await request('/doctor/profile', { token, method: 'PATCH', body: JSON.stringify(values) }); setProfile((current) => ({ ...current, ...result })); toast.success('Clinician profile and availability saved.') }
    catch (error) { toast.error(error.message) } finally { setSaving(false) }
  }
  if (!profile) return <section className="panel glass profile-panel"><p className="empty-inline">Loading clinician settings…</p></section>
  return <section className="panel glass profile-panel doctor-settings"><div className="panel-title"><div><small>CLINICIAN SETTINGS</small><h2>Specialty & availability</h2></div></div><form className="form-stack" onSubmit={save}><label>Department<input name="department" defaultValue={profile.department} required /></label><label>Specialty<input name="specialty" defaultValue={profile.specialty} required /></label><label>Qualifications<input name="qualifications" defaultValue={profile.qualifications} placeholder="MD, board certifications" /></label><div className="profile-fields"><label>Years of experience<input name="experienceYears" type="number" min="0" max="70" defaultValue={profile.experienceYears} required /></label><label>Consultation fee ($)<input name="consultationFee" type="number" min="0" max="10000" step="1" defaultValue={profile.consultationFee} required /></label></div><fieldset className="days-selector"><legend>Available days</legend>{weekdays.map((day) => <label key={day}><input type="checkbox" checked={days.includes(day)} onChange={(event) => setDays((current) => event.target.checked ? [...current, day] : current.filter((value) => value !== day))} />{day}</label>)}</fieldset><label>Time slots<input name="slots" defaultValue={profile.availability?.[0]?.slots?.join(', ') || '09:00, 10:30, 14:00'} placeholder="09:00, 10:30, 14:00" /><small>Use 24-hour times separated by commas.</small></label><button className="btn btn-main" disabled={saving}>{saving ? 'Saving…' : 'Save clinician settings'} <Check size={14} /></button></form></section>
}