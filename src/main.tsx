import './game-id';
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './app.less'
import { preloadCharacterLibrary } from './game/assetLibrary'

const root = ReactDOM.createRoot(document.getElementById('root')!)

preloadCharacterLibrary()
  .then(() => root.render(<React.StrictMode><App /></React.StrictMode>))
  .catch((error) => {
    console.error(error)
    root.render(<main className="got-boot-error">角色资源加载失败，请刷新重试。</main>)
  })
