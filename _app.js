import '../styles/globals.css'
import Head from 'next/head'
import Layout from '../components/Layout'
import { StoreProvider } from '../lib/store'

export default function App({ Component, pageProps }) {
  return (
    <StoreProvider>
      <Head>
        <title>AI OFM</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="AI OnlyFans Management — Automation Suite" />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </StoreProvider>
  )
}
