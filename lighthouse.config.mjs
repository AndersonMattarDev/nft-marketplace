export const lighthouseConfig = {
  version: '1.0.0',
  baseUrl: process.env.LIGHTHOUSE_BASE_URL ?? 'http://127.0.0.1:4173',
  port: Number(process.env.LIGHTHOUSE_PORT ?? 4173),
  repetitions: 3,
  categories: ['performance', 'accessibility', 'best-practices', 'seo'],
  targets: {
    performance: 90,
    accessibility: 95,
    'best-practices': 95,
    seo: 90,
  },
  routes: [
    { name: 'inicio', path: '/' },
    { name: 'detalhe-nft', path: '/nft/cosmic-001' },
  ],
  profiles: {
    mobile: {
      formFactor: 'mobile',
      screenEmulation: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, disabled: false },
      throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
    },
    desktop: {
      formFactor: 'desktop',
      screenEmulation: { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false, disabled: false },
      throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 },
    },
  },
}
