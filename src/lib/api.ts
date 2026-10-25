
import axios from 'axios'
import { sessionToken } from './session'
import { waitForMockInitialization } from './mock-ready'

export const api = axios.create({
  baseURL: '/api',
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(async (config) => {
  await waitForMockInitialization()
  const token = sessionToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  const scenario = new URLSearchParams(window.location.search).get('scenario')
  if (scenario === 'slow' || scenario === 'variable-latency') config.headers['X-Mock-Scenario'] = scenario
  return config
})
