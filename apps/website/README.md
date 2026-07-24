# Auditure Website

The marketing / landing site for Auditure. It started as a Figma Make export ([original design](https://www.figma.com/design/tmJrSrr8PsO8D8AI56af4z/Webpage-for-Auditure-App)) and is built with **Vite + React**.

## Stack

- Vite + React 18 + TypeScript
- MUI and Radix UI components
- Cloudflare (see `wrangler.toml` and `functions/`) for hosting and edge functions

## Running Locally

```bash
npm install     # install dependencies
npm run dev     # start the Vite dev server
npm run build   # production build to dist/
```

## Notes

- `functions/` holds Cloudflare Pages/Workers functions.
- Third-party asset credits are in [ATTRIBUTIONS.md](./ATTRIBUTIONS.md).
