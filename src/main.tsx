
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { queryClient } from './lib/query-client'
import { setMockInitialization } from './lib/mock-ready'
import './styles/index.css'

let resolveMocks!: () => void
let rejectMocks!: (error: unknown) => void
const mockInitialization = import.meta.env.VITE_ENABLE_MOCKS === 'true'
  ? new Promise<void>((resolve, reject) => { resolveMocks = resolve; rejectMocks = reject })
  : Promise.resolve()
setMockInitialization(mockInitialization)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)

if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
  const startMocks = () => {
    void import('./mocks/browser').then(({ worker }) => worker.start()).then(resolveMocks).catch((error: unknown) => {
      console.error('Falha ao iniciar os mocks da aplicação:', error)
      rejectMocks(error)
    })
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(startMocks, { timeout: 150 })
  else globalThis.setTimeout(startMocks, 0)
}

