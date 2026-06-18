import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import { OverviewPage } from './pages/Overview'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionsPage } from './pages/Sessions'

const queryClient = new QueryClient()

function App() {

  return (
    <>
      <QueryClientProvider client={queryClient}>
        {/* <OverviewPage /> */}
        <SessionsPage />
      </QueryClientProvider>
    </>
  )
}

export default App
