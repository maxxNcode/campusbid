import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import AuthProvider from './components/AuthProvider'
import App from './App'
import SetupNotice from './components/SetupNotice'
import DemoBanner from './components/DemoBanner'
import { supabaseConfigured } from './lib/supabase'
import { demoMode } from './lib/demo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {supabaseConfigured || demoMode ? (
      <BrowserRouter>
        <AuthProvider>
          {demoMode && <DemoBanner />}
          <App />
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <SetupNotice />
    )}
  </StrictMode>,
)
