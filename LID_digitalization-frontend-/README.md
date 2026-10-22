# React + Vite

This project uses React with Vite for fast development, HMR, and basic ESLint configuration.

## Before Running the Project

Before starting the application, make sure your local project is up to date and all dependencies are installed.

```bash
git pull
npm install
```

## Run the Project

To start the development server, use:

```bash
npm run dev
```

After that, open the local URL shown in the terminal, usually:

```bash
http://localhost:5173
```

## Build for Production

To create a production build, run:

```bash
npm run build
```

## Preview Production Build

To preview the production build locally, run:

```bash
npm run preview
```

## Available React Plugins

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react)
  uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc)
  uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled in this template because it may affect development and build performance.  
To enable it, see the official documentation:

- [React Compiler Installation](https://react.dev/learn/react-compiler/installation)

## ESLint Configuration

If you are building a production-grade application, it is recommended to use TypeScript with type-aware lint rules enabled.

You can check the official Vite TypeScript template here:

- [Vite React TypeScript Template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts)

And the TypeScript ESLint documentation here:

- [typescript-eslint](https://typescript-eslint.io)
