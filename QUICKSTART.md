# Quick Start Guide

Get DA Agent up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Chrome browser
- Anthropic API key ([Sign up here](https://console.anthropic.com/))

## Step 1: Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment file
cp env.example .env

# Edit .env and add your API key
# ANTHROPIC_API_KEY=sk-ant-your-key-here
nano .env  # or use your preferred editor

# Start the server
npm run dev
```

You should see:
```
🚀 DA Agent Backend running on http://localhost:3101
```

## Step 2: Install Chrome Extension

1. Open Chrome and go to: `chrome://extensions/`

2. Enable **Developer mode** (toggle in top right corner)

3. Click **"Load unpacked"** button

4. Navigate to and select the `chrome-extension` folder from this project

5. The DA Agent extension should now appear in your extensions list

## Step 3: Test It Out

1. Navigate to `https://da.live` (or `http://localhost:3000` if running locally)

2. Click the DA Agent extension icon in your browser toolbar

3. The side panel will open with the chat interface

4. Try a simple command:
   ```
   List the documents in this folder
   ```

## Example Usage

### In Explorer View

Navigate to: `https://da.live/#/your-org/your-repo/some-folder`

Try these commands:
- "Create a new page called welcome"
- "List all files here"
- "Create 3 blog posts about AI"

### In Editor View

Navigate to: `https://da.live/edit#/your-org/your-repo/path/to/file`

Try these commands:
- "Add a hero section"
- "Change the title to Welcome"
- "Add a two-column layout"

## Troubleshooting

### Backend won't start
- Check Node.js version: `node --version` (should be 18+)
- Verify port 3101 is free
- Make sure API key is set in `.env`

### Extension not appearing
- Refresh the extensions page
- Check for errors in the extension details
- Make sure you selected the `chrome-extension` folder, not the root

### Side panel doesn't open
- Make sure you're on a DA site (`da.live` or `localhost:3000`)
- Try clicking the extension icon again
- Check browser console for errors (F12)

### No response from AI
- Check backend is running (`http://localhost:3101/health`)
- Verify API key is valid
- Check backend console for errors

## Next Steps

- Read the full [README.md](./README.md) for detailed documentation
- Review [concept.md](./concept.md) to understand the architecture
- Check component-specific READMEs:
  - [Chrome Extension README](./chrome-extension/README.md)
  - [Backend README](./backend/README.md)

## Common Commands

**Backend**:
```bash
cd backend
npm run dev      # Development mode
npm run build    # Build for production
npm start        # Run production build
```

**Extension**:
- Load: `chrome://extensions/` → Load unpacked
- Reload: Click refresh icon in `chrome://extensions/`
- Debug: Right-click side panel → Inspect

## Getting Help

- Check the troubleshooting sections in READMEs
- Review browser and server console logs
- Ensure all prerequisites are met
- Verify environment variables are set correctly

Happy authoring! 🚀

