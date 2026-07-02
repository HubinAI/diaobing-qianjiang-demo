import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import './styles/game.css'
import './styles/_chibi.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
