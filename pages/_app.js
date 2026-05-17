import '../styles/globals.css'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { AuthProvider } from '../lib/auth'
import { StoreProvider } from '../lib/store'

const NO_LAYOUT = ['/login', '/auth/callback', '/auth/error']

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const noLayout = NO_LAYOUT.includes(router.pathname)

  return (
    <AuthProvider>
      <StoreProvider>
        <Head>
          <title>AI OFM</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="description" content="AI OFM — Automation Suite" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        </Head>
        {noLayout ? (
          <Component {...pageProps} />
        ) : (
          <Layout>
            <Component {...pageProps} />
          </Layout>
        )}
      </StoreProvider>
    </AuthProvider>
  )
}
