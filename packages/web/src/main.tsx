import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SkThemeProvider } from '@skelloapp/skello-ds-web'
import App from './App'
import { ThemeVars } from './styles/themeVars'
import './styles/theme.css'
import './index.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('index.html has no #root element')
}

createRoot(root).render(
  <StrictMode>
    <SkThemeProvider>
      <ThemeVars />
      <App />
    </SkThemeProvider>
  </StrictMode>,
)
