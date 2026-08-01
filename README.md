# CPP Review App

A professional pedagogical tool for interactive code review and grading. Designed for educators to analyze and evaluate student submissions with efficiency and precision.

## Key Features

- **Theme Customization**: Support for Light and Dark modes with automatic system preference detection.
- **Dynamic Imports**: Upload student submissions via ZIP. The system automatically identifies folder structures and student metadata.
- **AI-Powered Analysis**: Integration with local models (Ollama) and cloud services (Gemini, Claude, GPT) for automated score proposals and detailed feedback.
- **Integrated Terminal**: Execute and interact with C++ code in real-time within the application environment.
- **Class Statistics**: A dedicated Moodle import that builds an analytics dashboard — engagement evidence, accuracy and difficulty per question, at-risk student alerts with explained scores, and AI-written pedagogical reports.
- **Data Portability**: Comprehensive import and export functionality for grading data using JSON and Excel formats.
- **Configurable Criteria**: Customizable evaluation standards to align with specific pedagogical requirements.

## Setup Instructions

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **G++ Compiler** (must be available in the system PATH for local code execution)
- **Ollama** (optional, for local AI analysis)

### 2. Installation
Clone the repository and install all dependencies:
```bash
# Install root, client, and server dependencies
npm install
npm run install:all
```

### 3. Development and Execution
The application consists of a Node.js server and an Electron client.

#### Start the Application (Electron and Server)
In the project root:
```bash
npm run dev
```

### 4. Building the Application
To generate a distribution package:
```bash
npm run electron:build
```

## Project Structure
- `/client`: React frontend utilizing Vite and TailwindCSS.
- `/server`: Node.js/Express backend with Socket.io and AI SDKs.
- `/server/data`: Local storage for student submissions, settings, and grading records.

## Security and Privacy
Student data and API configurations are stored locally in the `server/data/` directory. This folder is excluded from version control to ensure data privacy and security.

---
Built for technical education excellence.
