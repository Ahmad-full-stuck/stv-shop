import { createRoot } from 'react-dom/client'
import { Router } from 'wouter'
import { useHashLocation } from '@/lib/hash-location'
import App from './App'
import { ErrorBoundary } from '@/components/error-boundary'
import { flushPendingOrders, loadServerConfig } from '@/lib/api'
import './fonts.css'
import './index.css'

const root = document.getElementById('root')

if (root) {
  void loadServerConfig().then(flushPendingOrders)
  createRoot(root).render(
    <ErrorBoundary>
      <Router hook={useHashLocation}>
        <App />
      </Router>
    </ErrorBoundary>,
  )
}
