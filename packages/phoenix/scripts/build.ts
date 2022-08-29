import { build } from 'esbuild'
import { dirname, join, resolve } from 'node:path'

function getFileFromRoot(...paths: string[]) {
  const root = resolve(dirname('..'))

  if (paths.length > 1) {
    return join(root, ...paths)
  }

  return join(root, paths[0])
}

const mode = process.argv[2] || 'build'
const isBuildMode = mode === 'build'

build({
  entryPoints: [getFileFromRoot('src/index.ts')],
  outfile: getFileFromRoot('..', '..', 'dotfiles', '.phoenix.js'),
  assetNames: '[name]',
  bundle: true,
  minify: isBuildMode,
  platform: 'node',
  target: 'esnext',
  watch: !isBuildMode,
  drop: ['debugger', 'console'],
  loader: {
    '.png': 'file',
  },
  plugins: [
    {
      name: 'phoenix-codegen',
      setup(build) {
        const options = build.initialOptions

        options.define = options.define || {}
        options.define['process.env.NODE_ENV'] = options.minify ? '"production"' : '"development"'

        build.onResolve({ filter: /^@\/assets\// }, ({ path }) => ({
          path: getFileFromRoot('src', path.replace('@/', '')),
        }))

        build.onLoad({ filter: /assets\// }, ({ path }) => ({
          loader: 'json',
          contents: `"${path}"`,
        }))
      },
    },
  ],
})
