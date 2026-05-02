# CPP Review App 🚀

A modern, high-performance pedagogical tool for interactive code review and grading. Built for educators who need to analyze student submissions quickly and effectively.

## ✨ Features

- **Neon Cyan UI**: Sleek, high-contrast dark theme with glowing accents and smooth CRT animations.
- **Dynamic Imports**: Upload student submissions via ZIP. The app automatically detects question structures and student metadata.
- **AI Analysis**: Integrate local (Ollama) or cloud (Gemini, Claude, GPT) models to get instant score proposals and feedback.
- **Interactive Terminal**: Run and interact with C++ code in real-time directly from your browser.
- **Data Portability**: Bulk import and export grading data via JSON.
- **Pedagogical Alignment**: Fully configurable evaluation criteria based on professional grading standards.

## 🛠 Setup

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **G++ Compiler** (added to PATH for local code execution)
- **Ollama** (optional, for local AI analysis)

### 2. Installation
Clone the repository and install dependencies:
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Running the App
Start the backend and frontend:
```bash
# In one terminal (server folder)
node index.js

# In another terminal (client folder)
npm run dev
```

## 📂 Structure
- `/client`: React frontend with Vite, TailwindCSS, and xterm.js.
- `/server`: Node.js/Express backend with Socket.io and AI SDKs.
- `/server/data`: Self-contained storage for imported submissions and grade files.

## 🛡 Security
Student data and API keys are stored locally in `server/data/`, which is excluded from version control by default.

---
Created for excellence in technical education.