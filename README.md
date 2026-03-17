# 🌿 FarmLink Zim

Zimbabwe's Agricultural Marketplace & Advisory Platform.

## Deploy to Vercel in 3 steps

### 1. Install & run locally first (optional)
```bash
npm install
npm run dev
```
Open http://localhost:5173

### 2. Push to GitHub
```bash
git init
git add .
git commit -m "FarmLink Zim initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/farmlink-zim.git
git push -u origin main
```

### 3. Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Framework will auto-detect as **Vite**
4. Go to **Settings → Environment Variables** and add:
   - `ANTHROPIC_API_KEY` = `sk-ant-your-key-here`
5. Click **Deploy** → you'll get a live URL like `farmlink-zim.vercel.app`

## Get your Anthropic API Key
- Go to [console.anthropic.com](https://console.anthropic.com)
- Create an account → API Keys → Create Key
- Copy it into your Vercel environment variable

## Project Structure
```
farmlink-zim/
├── api/
│   └── chat.js          # Secure Anthropic API proxy (serverless)
├── src/
│   ├── main.jsx         # React entry point
│   └── App.jsx          # Full FarmLink Zim app
├── public/
│   └── favicon.svg
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

## Features
- 🛖 Home dashboard with weather & price alerts
- 🛒 Agricultural marketplace (B2B & B2C)
- 📍 3-step farmer registration & crop mapping
- 🤖 AI Advisory chat (powered by Claude, Zimbabwe-specific)
- 📊 Market insights & yield forecasting
