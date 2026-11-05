# Sanjeevani Health Care Hospital Management System Workspace Notes

- Keep frontend API calls under `src/HospitalApp.jsx` aligned with validated routes in `server/index.js`.
- Add persistent data structures to `server/models.js`; keep development-only fixtures synthetic and ephemeral.
- Medical records and report files must remain behind patient/assigned-clinician/admin authorization checks.
- Never store JWTs or medical record content in browser local storage.
- Use `.env.example` as the source of truth for configuration names; do not commit `.env` or credentials.
- Run `npm run lint` and `npm run build` after client changes, and `node --check server/index.js` after API changes.