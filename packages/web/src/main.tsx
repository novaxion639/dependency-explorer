import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StyledEngineProvider } from '@mui/material/styles'
import { SkThemeProvider } from '@skelloapp/skello-ds-web'
import App from './App'
import { ThemeBridge } from './styles/ThemeBridge'
import './styles/theme.css'
import './index.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('index.html has no #root element')
}

createRoot(root).render(
  <StrictMode>
    <StyledEngineProvider injectFirst>
      <SkThemeProvider>
        <ThemeBridge>
          <App />
        </ThemeBridge>
      </SkThemeProvider>
    </StyledEngineProvider>
  </StrictMode>,
)
