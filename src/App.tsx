import { Route, Routes } from 'react-router'
import AppLayout from './components/AppLayout'
import AdminApprovalsPage from './pages/AdminApprovalsPage'
import { RequireAdmin, RequireApproved, RequireSignedIn, RequireSignedOut } from './components/RouteGuards'
import MarketplacePage from './pages/MarketplacePage'
import NotFoundPage from './pages/NotFoundPage'
import PendingApprovalPage from './pages/PendingApprovalPage'
import RegisterPage from './pages/RegisterPage'
import SignInPage from './pages/SignInPage'

export default function App() {
  return (
    <Routes>
      <Route element={<RequireSignedOut />}>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireSignedIn />}>
        <Route path="/pending" element={<PendingApprovalPage />} />
        <Route element={<RequireApproved />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<MarketplacePage />} />
            <Route element={<RequireAdmin />}>
              <Route path="/admin/approvals" element={<AdminApprovalsPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
