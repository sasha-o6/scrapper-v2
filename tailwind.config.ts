import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx,scss}'],
  theme: {
    screens: {
      'max-2xl': { max: '1535px' },
      'max-xl': { max: '1279px' },
      'max-lg': { max: '1023px' },
      'max-md': { max: '767px' },
      'max-sm': { max: '639px' },
      xxs: '360px'
    },
    extend: {
      colors: {
        ink: '#1f2933',
        mist: '#f6f7f9',
        line: '#d9dee7',
        pine: '#1f7a6b',
        coral: '#ca5a3d',
        honey: '#b7791f'
      },
      boxShadow: {
        focus: '0 0 0 3px rgba(31, 122, 107, 0.18)'
      }
    }
  },
  plugins: []
}

export default config
