const foregroundColor = '#eff0eb'
const lightBlack = '#888'
const white = '#f1f1f0'
const red = '#ff5c57'
const green = '#5af78e'
const yellow = '#f3f99d'
const blue = '#57c7ff'
const magenta = '#ff6ac1'
const cyan = '#9aedfe'

module.exports = {
  config: {
    updateChannel: 'canary',
    showWindowControls: false,
    copyOnSelect: true,

    padding: '16px 32px',

    foregroundColor,
    borderColor: 'transparent',
    selectionColor: 'rgba(151, 151, 155, 0.2)',

    cursorColor: '#97979b',
    cursorAccentColor: '#888',
    cursorShape: 'BEAM',
    cursorBlink: true,

    fontFamily: '"JetBrains Mono", "Hack Nerd Font", "Fira Code", Hack, monospace',
    fontSize: 17,
    letterSpacing: 0.0125,
    lineHeight: 1.3,

    hypest: {
      hideControls: true,
      accentColor: 'blue',
      darkmode: true,
      borders: false,
      colors: {
        red,
        green,
        yellow,
        blue,
        magenta,
        cyan,
        white,
        lightBlack,
        lightRed: red,
        lightGreen: green,
        lightYellow: yellow,
        lightBlue: blue,
        lightMagenta: magenta,
        lightCyan: cyan,
        lightWhite: foregroundColor
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
      inactivePaneOpacity: 0.5
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
        opacity: .4;
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
