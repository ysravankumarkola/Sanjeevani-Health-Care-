import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './HospitalApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
