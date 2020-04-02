module.exports = {
  tabWidth: 2,
  printWidth: 120,
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  overrides: [
    {
      files: '*.ts',
      options: {
        parser: 'typescript'
      }
    },
    {
      files: '*.vue',
      options: {
        parser: 'vue'
      }
    },
    {
      files: '*.scss',
      options: {
        parser: 'scss'
      }
    },
    {
      files: '*.html',
      options: {
        parser: 'html'
      }
    },
    {
      files: '*.md',
      options: {
        parser: 'markdown'
      }
    }
  ]
}
