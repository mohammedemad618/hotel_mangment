/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
        './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f5f3ff',
                    100: '#ede9fe',
                    200: '#ddd6fe',
                    300: '#c4b5fd',
                    400: '#a78bfa',
                    500: '#8b5cf6',
                    600: '#7c3aed',
                    700: '#6d28d9',
                    800: '#5b21b6',
                    900: '#4c1d95',
                    950: '#2e1065',
                },
                accent: {
                    50: '#fff1f7',
                    100: '#ffe4f0',
                    200: '#fecddf',
                    300: '#fda5c8',
                    400: '#fb6aa8',
                    500: '#f43f8c',
                    600: '#e11d74',
                    700: '#be185d',
                    800: '#9d174d',
                    900: '#831843',
                    950: '#500724',
                },
                success: {
                    500: '#22d3a6',
                    600: '#12b981',
                },
                warning: {
                    500: '#f59e0b',
                    600: '#d97706',
                },
                danger: {
                    500: '#f43f5e',
                    600: '#e11d48',
                },
            },
            fontFamily: {
                sans: ['var(--font-ibm-arabic)', 'var(--font-space)', 'sans-serif'],
                arabic: ['var(--font-ibm-arabic)', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-in-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
                'scale-in': 'scaleIn 0.2s ease-out',
                'spin-slow': 'spin 3s linear infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideDown: {
                    '0%': { opacity: '0', transform: 'translateY(-10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
            },
            borderRadius: {
                '4xl': '2rem',
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(10, 8, 24, 0.55)',
                'card': '0 10px 30px rgba(10, 8, 24, 0.55)',
                'card-hover': '0 16px 40px rgba(12, 10, 32, 0.7)',
            },
            backdropBlur: {
                'glass': '4px',
            },
        },
    },
    plugins: [],
};
