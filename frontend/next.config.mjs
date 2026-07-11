import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = dirname(__dirname)

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
