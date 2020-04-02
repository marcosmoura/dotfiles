const black = '#555'
const blue = '#57c7ff'
const cyan = '#9aedfe'
const green = '#5af78e'
const magenta = '#ff6ac1'
const red = '#ff5c57'
const white = '#f1f1f0'
const yellow = '#f3f99d'
const foregroundColor = '#eff0eb'
const lightBlack = '#888'

module.exports = {
  config: {
    copyOnSelect: true,
    updateChannel: 'canary',

    padding: '16px 32px',

    cursorBlink: true,
    cursorShape: 'BEAM',

    fontFamily: '"JetBrains Mono", "Hack Nerd Font", "Fira Code", Hack, monospace',
    fontSize: 17,
    letterSpacing: 0.0125,
    lineHeight: 1.3,

    hypest: {
      borders: false,
      darkmode: true,
      hideControls: true,
      colors: {
        black,
        blue,
        cyan,
        green,
        magenta,
        red,
        white,
        yellow,
        lightBlack,
        lightBlue: blue,
        lightCyan: cyan,
        lightGreen: green,
        lightMagenta: magenta,
        lightRed: red,
        lightWhite: foregroundColor,
        lightYellow: yellow
      }
    },

    paneNavigation: {
      hotkeys: {
        navigation: {
          up: 'meta+up',
          down: 'meta+down',
          left: 'meta+left',
          right: 'meta+right'
        },
        jump_prefix: 'meta'
      },
      showIndicators: false,
      inactivePaneOpacity: 0.7
    },

    hypercwd: {
      initialWorkingDirectory: '~/Projects'
    },

    css: `
      .header_header {
        display: none !important;
      }

      .header_header + .terms_terms {
        margin-top: 0;
      }

      .term_fit.term_active > .term_fit:not(.term_term) {
        opacity: 1;
        transition: opacity 175ms ease-out;
        will-change: opacity;
      }

      .term_fit:not(.term_active) > .term_fit:not(.term_term) {
        opacity: .5;
      }
    `
  },

  plugins: [
    'hyper-hypest',
    'hyper-pane',
    'hyper-font-ligatures',
    'hypercwd',
    'hyperterm-paste',
    'hyperlinks',
    'hyper-search',
    'hyper-dark-scrollbar'
  ]
}
