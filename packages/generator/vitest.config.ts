import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.{spec,test}.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
})
