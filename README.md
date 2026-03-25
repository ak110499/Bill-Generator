# Logistics PDF to Excel Converter (OpenAI)

This app extracts tabular data from logistics PDFs and exports it to Excel using the ChatGPT API (OpenAI).

## Run locally

**Prerequisites:**
- Node.js 18+
- OpenAI API key

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file:
   ```bash
   cp .env.example .env.local
   ```
3. Set `VITE_OPENAI_API_KEY` in `.env.local`.
4. Start the dev server:
   ```bash
   npm run dev
   ```

## Build for production

```bash
npm run build
npm run preview
```

## Notes on API keys

- This project currently calls OpenAI directly from the browser for simplicity.
- For production use, move OpenAI requests to a backend endpoint so your API key is not exposed client-side.
