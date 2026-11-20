import { Route, Routes } from 'react-router'
import AppLayout from './components/AppLayout'
import AdminApprovalsPage from './pages/AdminApprovalsPage'
import { RequireAdmin, RequireApproved, RequireSignedIn, RequireSignedOut } from './components/RouteGuards'
import ListingDetailsPage from './pages/ListingDetailsPage'
import ListingFormPage from './pages/ListingFormPage'
import MarketplacePage from './pages/MarketplacePage'
import MyListingsPage from './pages/MyListingsPage'
import NotFoundPage from './pages/NotFoundPage'
import PendingApprovalPage from './pages/PendingApprovalPage'
import RegisterPage from './pages/RegisterPage'
import RequestDetailPage from './pages/RequestDetailPage'
import RequestListPage from './pages/RequestListPage'
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
            <Route path="/sell" element={<ListingFormPage />} />
            <Route path="/listings/:id" element={<ListingDetailsPage />} />
            <Route path="/listings/:id/edit" element={<ListingFormPage />} />
            <Route path="/my-listings" element={<MyListingsPage />} />
            <Route path="/my-requests" element={<RequestListPage role="buyer" />} />
            <Route path="/requests-received" element={<RequestListPage role="seller" />} />
            <Route path="/requests/:id" element={<RequestDetailPage />} />
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
