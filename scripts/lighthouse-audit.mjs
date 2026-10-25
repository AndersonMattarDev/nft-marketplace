import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import lighthouse from 'lighthouse'
import { getChromePath, launch } from 'chrome-launcher'
import { lighthouseConfig } from '../lighthouse.config.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const outputRoot = path.join(projectRoot, 'lighthouse-reports')
const runStartedAt = new Date()
const runId = runStartedAt.toISOString().replaceAll(':', '-').replaceAll('.', '-')
const reportDirectory = path.join(outputRoot, runId)
const chromePath = process.env.CHROME_PATH || getChromePath()

if (!chromePath) {
  throw new Error('Chrome não foi encontrado. Defina a variável CHROME_PATH com o caminho de chrome.exe.')
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function numericAudit(lhr, id) {
  const value = lhr.audits[id]?.numericValue
  return typeof value === 'number' ? value : null
}

function categoryScore(lhr, id) {
  const score = lhr.categories[id]?.score
  return typeof score === 'number' ? Math.round(score * 100) : null
}

function belowTargetAudits(lhr) {
  return lhr.categories.performance.auditRefs
    .map((reference) => ({ reference, audit: lhr.audits[reference.id] }))
    .filter(({ reference, audit }) => reference.weight > 0 && typeof audit?.score === 'number' && audit.score < 0.9)
    .map(({ reference, audit }) => ({
      id: reference.id,
      title: audit.title,
      score: Math.round(audit.score * 100),
      detail: audit.displayValue || audit.description?.split('.')[0] || '',
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
}

async function waitForServer(url, server) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`O preview encerrou antes de iniciar (código ${server.exitCode}).`)
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // O Vite ainda está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`O preview não respondeu em até 60 segundos: ${url}`)
}

async function findAvailablePort(preferredPort) {
  const probe = createServer()
  return new Promise((resolve, reject) => {
    probe.once('error', (error) => {
      if (error.code !== 'EADDRINUSE') return reject(error)
      const fallback = createServer()
      fallback.once('error', reject)
      fallback.listen(0, '127.0.0.1', () => {
        const address = fallback.address()
        fallback.close((closeError) => closeError ? reject(closeError) : resolve(address.port))
      })
    })
    probe.listen(preferredPort, '127.0.0.1', () => {
      const address = probe.address()
      probe.close((closeError) => closeError ? reject(closeError) : resolve(address.port))
    })
  })
}

function renderSummary(summary) {
  const lines = [
    '# Relatório Lighthouse',
    '',
    `- Configuração: ${summary.configuration.version}`,
    `- Executado em (UTC): ${summary.environment.startedAt}`,
    `- Node: ${summary.environment.node}`,
    `- Lighthouse: ${summary.environment.lighthouse}`,
    `- Chrome: ${summary.environment.chrome}`,
    `- Sistema: ${summary.environment.platform} ${summary.environment.release} (${summary.environment.arch})`,
    `- CPU: ${summary.environment.cpu} (${summary.environment.cpuCount} núcleos); memória total: ${summary.environment.memoryGiB} GiB`,
    `- Build: Vite preview otimizado, MSW ativado, origem ${summary.configuration.baseUrl}`,
    `- Condições: mobile 390×844, DPR 2, RTT 150 ms, 1.638 Kbps, CPU 4×; desktop 1440×1000, DPR 1, RTT 40 ms, 10.240 Kbps, CPU 1×; throttling simulado; armazenamento limpo a cada execução pelo Lighthouse.`,
    `- Repetições: ${summary.configuration.repetitions} por página e perfil. Relatórios individuais HTML e JSON estão salvos nesta pasta.`,
    '',
    '## Medianas por página e perfil',
    '',
    '| Página | Perfil | Desempenho | Acessibilidade | Boas práticas | SEO | LCP (ms) | CLS | TBT (ms) | Metas |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---|',
  ]

  for (const result of summary.results) {
    const scores = result.medians.scores
    const metrics = result.medians.metrics
    lines.push(`| ${result.page} | ${result.profile} | ${scores.performance} | ${scores.accessibility} | ${scores['best-practices']} | ${scores.seo} | ${metrics.lcpMs} | ${metrics.cls} | ${metrics.tbtMs} | ${result.targetsMet ? 'Atingidas' : 'Abaixo da meta'} |`)
  }

  lines.push('', '## Pontos que ficaram abaixo das metas', '')
  const belowTarget = summary.results.filter((result) => !result.targetsMet)
  if (!belowTarget.length) {
    lines.push('Todas as medianas atingiram as metas configuradas.')
  } else {
    for (const result of belowTarget) {
      const failingCategories = Object.entries(result.medians.scores)
        .filter(([category, score]) => score < lighthouseConfig.targets[category])
        .map(([category, score]) => `${category}: ${score} (meta ${lighthouseConfig.targets[category]})`)
      lines.push(`### ${result.page} · ${result.profile}`, '', `Categorias abaixo da meta: ${failingCategories.join('; ')}.`, '')
      const issues = [...new Map(result.runs.flatMap((run) => run.belowTargetAudits).map((audit) => [audit.id, audit])).values()].slice(0, 8)
      if (issues.length) {
        lines.push('Auditorias de performance recorrentes abaixo de 90 pontos:')
        for (const issue of issues) lines.push(`- ${issue.title} (${issue.score}): ${issue.detail}`)
      } else {
        lines.push('Consulte os relatórios JSON/HTML individuais para os detalhes dos critérios abaixo da meta.')
      }
      lines.push('')
    }
  }

  lines.push('## Arquivos', '')
  lines.push('- `summary.json`: resultados completos, medianas, metas e detalhes de ambiente.')
  lines.push('- `*.report.html` e `*.report.json`: relatórios Lighthouse de cada repetição.')
  return `${lines.join('\n')}\n`
}

await mkdir(reportDirectory, { recursive: true })
const previewPort = await findAvailablePort(lighthouseConfig.port)
const baseUrl = process.env.LIGHTHOUSE_BASE_URL ?? `http://127.0.0.1:${previewPort}`
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))
let chromeVersion = 'não identificado'

const preview = spawn(process.execPath, [
  path.join(projectRoot, 'node_modules/vite/bin/vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort',
], {
  cwd: projectRoot,
  env: { ...process.env, VITE_ENABLE_MOCKS: 'true' },
  stdio: 'inherit',
  windowsHide: true,
})

const runsByGroup = new Map()
try {
  await waitForServer(baseUrl, preview)
  const combinations = Object.entries(lighthouseConfig.profiles).flatMap(([profileName, profile]) =>
    lighthouseConfig.routes.map((route) => ({ profileName, profile, route })),
  )
  let runNumber = 0
  const totalRuns = combinations.length * lighthouseConfig.repetitions

  for (const { profileName, profile, route } of combinations) {
    const groupKey = `${route.name}:${profileName}`
    const runs = []
    const url = new URL(route.path, baseUrl).toString()

    for (let repetition = 1; repetition <= lighthouseConfig.repetitions; repetition += 1) {
      runNumber += 1
      process.stdout.write(`[${runNumber}/${totalRuns}] ${route.name} · ${profileName} · execução ${repetition}\n`)
      const chrome = await launch({
        chromePath,
        chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run'],
        logLevel: 'error',
      })

      try {
        const result = await lighthouse(url, {
          port: chrome.port,
          output: 'html',
          logLevel: 'error',
          locale: 'pt-BR',
          onlyCategories: lighthouseConfig.categories,
          formFactor: profile.formFactor,
          screenEmulation: profile.screenEmulation,
          throttlingMethod: 'simulate',
          throttling: profile.throttling,
        })
        if (!result) throw new Error(`Lighthouse não retornou resultado para ${url}.`)
        chromeVersion = result.lhr.environment.hostUserAgent.match(/(?:Headless)?Chrome\/([\d.]+)/)?.[1] ?? chromeVersion

        const name = `${route.name}-${profileName}-run-${repetition}`
        const html = Array.isArray(result.report) ? result.report[0] : result.report
        await writeFile(path.join(reportDirectory, `${name}.report.html`), html, 'utf8')
        await writeFile(path.join(reportDirectory, `${name}.report.json`), JSON.stringify(result.lhr, null, 2), 'utf8')
        runs.push({
          report: name,
          scores: Object.fromEntries(lighthouseConfig.categories.map((category) => [category, categoryScore(result.lhr, category)])),
          metrics: {
            lcpMs: numericAudit(result.lhr, 'largest-contentful-paint'),
            cls: numericAudit(result.lhr, 'cumulative-layout-shift'),
            tbtMs: numericAudit(result.lhr, 'total-blocking-time'),
          },
          belowTargetAudits: belowTargetAudits(result.lhr),
        })
      } finally {
        await chrome.kill()
      }
    }
    runsByGroup.set(groupKey, { route, profileName, runs })
  }
} finally {
  preview.kill()
}

const results = [...runsByGroup.values()].map(({ route, profileName, runs }) => {
  const medians = {
    scores: Object.fromEntries(lighthouseConfig.categories.map((category) => [category, median(runs.map((run) => run.scores[category]))])),
    metrics: {
      lcpMs: Math.round(median(runs.map((run) => run.metrics.lcpMs))),
      cls: Number(median(runs.map((run) => run.metrics.cls)).toFixed(3)),
      tbtMs: Math.round(median(runs.map((run) => run.metrics.tbtMs))),
    },
  }
  const targetsMet = lighthouseConfig.categories.every((category) => medians.scores[category] >= lighthouseConfig.targets[category])
  return { page: route.name, profile: profileName, url: new URL(route.path, baseUrl).toString(), medians, targetsMet, runs }
})

const summary = {
  configuration: {
    version: lighthouseConfig.version,
    baseUrl,
    port: previewPort,
    repetitions: lighthouseConfig.repetitions,
    categories: lighthouseConfig.categories,
    targets: lighthouseConfig.targets,
    routes: lighthouseConfig.routes,
    profiles: lighthouseConfig.profiles,
    chromePath,
  },
  environment: {
    startedAt: runStartedAt.toISOString(),
    node: process.version,
    lighthouse: packageJson.devDependencies.lighthouse,
    chrome: chromeVersion,
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpu: os.cpus()[0]?.model ?? 'não identificado',
    cpuCount: os.cpus().length,
    memoryGiB: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
  },
  results,
}

await writeFile(path.join(reportDirectory, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8')
await writeFile(path.join(reportDirectory, 'summary.md'), renderSummary(summary), 'utf8')
process.stdout.write(`\nRelatórios gravados em ${reportDirectory}\n`)
