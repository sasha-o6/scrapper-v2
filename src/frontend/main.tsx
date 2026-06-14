import { render } from 'preact'

import { App } from '@frontend/App'
import '@frontend/styles/global.scss'

const root = document.getElementById('app')

if (!root) {
  throw new Error('App root was not found')
}

render(<App />, root)
