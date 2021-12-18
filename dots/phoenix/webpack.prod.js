const { merge } = require('webpack-merge')
const TerserPlugin = require('terser-webpack-plugin')
const base = require('./webpack.base.js')

module.exports = merge(base, {
  mode: 'production',
  optimization: {
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          format: {
            comments: false,
          },
        },
      }),
    ],
  },
})
