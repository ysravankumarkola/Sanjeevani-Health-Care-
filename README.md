# Sanjeevani Health Care Hospital Management System

A full-stack hospital care portal built with React, Vite, Tailwind CSS, Express, MongoDB/Mongoose, JWT, and bcrypt. The project includes public clinician discovery and role-based patient, clinician, and administrator workspaces.

## Run Locally

Requirements: Node.js 20.19+ and npm. MongoDB is optional for the demo.

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. The Express API runs at `http://localhost:4000`.

When `MONGODB_URI` is unset, the API starts with synthetic process-local demo data. Changes are lost when the server stops. Demo sign-ins:

| Role | Email | Password |
| --- | --- | --- |
| Patient | `olivia@example.com` | `Patient123!` |
| Doctor | `maya@northstar.health` | `Doctor123!` |
| Administrator | `admin@northstar.health` | `Admin123!` |

## MongoDB Mode

Copy `.env.example` to `.env`, set `MONGODB_URI`, and set a unique `JWT_SECRET`. Then run `npm run dev`. Register patient and doctor accounts through the UI; doctor applications remain hidden until an administrator approves them.

Create the first administrator in an existing MongoDB database by setting `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `.env`, then running:

```powershell
npm run seed:admin
```

The bootstrap command refuses to overwrite an existing account and requires a 12-character password. The demo administrator is only seeded in the no-database development mode.

## Integrations

- **MongoDB:** configured with `MONGODB_URI`. Without it, the API uses ephemeral in-memory data and refuses to start in production.
- **Email:** configure `SMTP_URL` and `EMAIL_FROM` for password-reset and appointment email. Without SMTP, no email is sent. The development password-reset flow returns a one-time token to the UI; it expires after 15 minutes.
- **Images:** profile images are validated (JPG/PNG/WebP, 5 MB maximum) and saved under `server/uploads/profile` in development.
- **Medical reports:** PDF/JPG/PNG uploads are limited to 10 MB and stored outside the static web root under `server/uploads/records`. Downloads require an authorized patient, assigned clinician, or administrator.
- **Authentication:** bearer JWTs expire after eight hours and are held in React memory, not browser local storage. Production requires HTTPS, a strong `JWT_SECRET`, durable private file storage, backups, and appropriate at-rest encryption.

## Implemented Workflows

- Patient/doctor registration, sign-in, sign-out, password recovery, profile edits, and profile image upload.
- Doctor application approval, specialty/qualification/fee editing, weekly availability, and appointment request review.
- Doctor search and department/fee filtering; booking validates published availability and prevents an occupied slot from being booked twice.
- Appointment confirmation, rejection, cancellation, completion, history, in-app notifications, optional SMTP email, and CSV export.
- Consultation records, medication orders, downloadable prescription PDFs, and access-controlled medical report uploads/downloads.
- Administrator metrics and charts, clinician approval, department create/edit/delete, appointment controls, and audit history.

## Commands

- `npm run dev` starts the API and frontend together.
- `npm run build` creates the production frontend in `dist/`.
- `npm run start` starts the API only; serve the built client separately in production.
- `npm run seed:admin` creates the initial administrator in MongoDB.
- `npm run lint` runs Oxlint.

This project is a development foundation, not a certified clinical system. Complete a security, privacy, retention, consent, and operational review before using real patient information. Cloudinary is not configured; local uploads are for development and must be replaced with private durable storage for production.# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
