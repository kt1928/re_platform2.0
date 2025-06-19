import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        nord: {
          0: 'hsl(220, 16%, 22%)',
          1: 'hsl(222, 16%, 28%)',
          2: 'hsl(220, 17%, 32%)',
          3: 'hsl(220, 16%, 36%)',
          4: 'hsl(219, 28%, 88%)',
          5: 'hsl(218, 27%, 92%)',
          6: 'hsl(218, 27%, 94%)',
          7: 'hsl(179, 25%, 65%)',
          8: 'hsl(193, 43%, 67%)',
          9: 'hsl(210, 34%, 63%)',
          10: 'hsl(213, 32%, 52%)',
          11: 'hsl(354, 42%, 56%)',
          12: 'hsl(14, 51%, 63%)',
          13: 'hsl(40, 71%, 73%)',
          14: 'hsl(92, 28%, 65%)',
          15: 'hsl(311, 20%, 63%)',
        },
      },
    },
  },
  plugins: [],
}

export default config