import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    { input: 'src/index.ts' },
    { input: 'src/tools/zod-core/cli.ts' },
  ],
  failOnWarn: false,
  clean: true,
  rollup: {
    inlineDependencies: true,
    esbuild: {
      target: 'node16',
      minify: true,
    },
  },
})
