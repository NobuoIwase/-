import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import { GlossaryProvider } from './components/Glossary'
import { EMPTY_GLOSSARY } from './data/glossary'
import Home from './pages/Home'
import Session from './pages/Session'
import Result from './pages/Result'
import Progress from './pages/Progress'
import Settings from './pages/Settings'
import History from './pages/History'

function applyTheme(theme: 'auto' | 'light' | 'dark') {
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export default function App() {
  const ready = useAppStore((s) => s.ready)
  const error = useAppStore((s) => s.error)
  const route = useAppStore((s) => s.route)
  const glossary = useAppStore((s) => s.subject?.glossary) ?? EMPTY_GLOSSARY
  const theme = useAppStore((s) => s.settings.theme)
  const init = useAppStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    applyTheme(theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = () => applyTheme(theme)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [theme])

  if (!ready) return <div className="app"><main><p className="muted">読み込み中…</p></main></div>
  if (error) return <div className="app"><main><div className="card"><h2>エラー</h2><p>{error}</p></div></main></div>

  const page = (() => {
    switch (route.name) {
      case 'session':
        return <Session id={route.id} />
      case 'result':
        return <Result id={route.id} />
      case 'progress':
        return <Progress />
      case 'settings':
        return <Settings />
      case 'history':
        return <History />
      default:
        return <Home />
    }
  })()
  return <GlossaryProvider glossary={glossary}>{page}</GlossaryProvider>
}
