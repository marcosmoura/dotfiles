const { resolve, sep, join } = require('path')
const webpack = require('webpack')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')

function getPath(path) {
  return resolve(__dirname, './', path)
}

module.exports = {
  entry: {
    '.phoenix.js': './src/index.ts',
    '.phoenix.debug.js': './src/index.ts',
  },
  output: {
    path: getPath(join('..', '..', 'dotfiles')),
    filename: '[name]',
  },
  node: {
    __dirname: false,
  },
  target: 'node16.0',
  resolve: {
    alias: {
      '@': getPath('src'),
    },
    extensions: ['.ts', '.js', '.d.ts'],
  },
  module: {
    rules: [
      {
        test: /\.png?$/,
        type: 'asset/resource',
        generator: {
          emit: false,
          publicPath: join(getPath('src'), sep),
          filename: 'assets/[name][ext]',
        },
      },
      {
        test: /\.ts?$/,
        loader: 'ts-loader',
        include: getPath('src'),
        options: {
          transpileOnly: true,
        },
      },
    ],
  },
  plugins: [new webpack.ProgressPlugin(), new ForkTsCheckerWebpackPlugin()],
}
