# VeriDoc AI
> **Intelligent Document Q&A, Page Citations & Tiered Assessment System**

![VeriDoc AI Tech Stack](https://img.shields.io/badge/Frontend-Next.js%2014%2B%20%7C%20React%2018-blue)
![Styling](https://img.shields.io/badge/UI-Tailwind%20CSS%20v4%20%7C%20Framer%20Motion-purple)
![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.10%2B-emerald)
![AI Model](https://img.shields.io/badge/LLM-Google%20Gemini%202.5%20Pro-amber)

---

## 🌟 Overview

**VeriDoc AI** is an advanced Retrieval-Augmented Generation (RAG) platform designed for scholars, researchers, educators, and students. By combining FastAPI vector indexation with Google Gemini 2.5 Pro and Next.js 14, VeriDoc AI enables users to upload multiple complex academic PDFs, query text instantly, extract verified page citations, and generate structured assessment test papers.

---

## ✨ Key Features

- 📑 **Instant Multi-PDF Ingestion & Vector Indexing:** Fast chunking and vector embedding of multiple uploaded documents powered by PyPDF and vector search. Add more files at any time during the chat!
- 📌 **Automatic Verified Page Citations:** Every AI response includes exact `[Source: Page X]` citation pills grounded in document text.
- 📝 **Customizable Assessment Generation:** One-click generation of practice question papers. The AI explicitly asks whether you prefer Multiple Choice Questions (MCQs) or descriptive questions.
- 💾 **Export to PDF:** Instant export of AI-generated summaries, study notes, and test papers directly to high-quality `.pdf` files.
- 🎨 **Clean & Professional Light UI:** A sleek, whitish UI design tailored for prolonged reading, focused research, and high readability.
- ⚡ **Interactive Message Action Toolbars:**
  - **AI Response Cards:** Download as PDF, Copy raw content.
  - **User Message Bubbles:** Hover action bar with Copy and Edit (pencil) to resend modified queries.
- ⏹️ **Streaming Generation & Abort Control:** Server-Sent Events (SSE) real-time response streaming with a Stop/Cancel button.
- 🗂️ **Local Chat History & Session Management:** Session persistence powered by `localStorage` with history drawer and new chat creation.

---

## 🏗️ Architecture & Project Structure

```
VeriDoc AI/
├── backend/
│   ├── main.py                  # FastAPI Application & SSE endpoints (/upload, /chat)
│   ├── requirements.txt          # Python dependencies
│   ├── .env                     # Environment configuration (GEMINI_API_KEY)
│   └── app/
│       ├── agent/
│       │   ├── react_agent.py   # Gemini ReAct Agent & prompt templates
│       │   └── vector_search.py # Vector embedding & document retrieval
│       └── rag/
│           ├── pdf_loader.py    # PyPDF text extraction
│           └── ingestion.py     # PDF chunking pipeline
│
└── frontend/
    ├── package.json             # Node dependencies
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx       # Root layout & theme provider
    │   │   ├── page.tsx         # Main application page
    │   │   └── globals.css      # Custom styles & Light theme CSS configuration
    │   └── components/
    │       ├── SplitLayout.tsx  # Dual-pane layout
    │       ├── ChatInterface.tsx# Message history, response cards & action toolbars
    │       ├── PDFUploader.tsx  # Dropzone upload & document indexing summary widget
    │       └── AIStatusIndicator.tsx # AI state status indicator (searching/thinking)
```

---

## 🚀 Local Setup & Installation

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & `npm`
- **Google Gemini API Key** (obtain from [Google AI Studio](https://aistudio.google.com/))

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file and add your Gemini API Key
echo GEMINI_API_KEY=your_gemini_api_key_here > .env

# Run FastAPI backend server
uvicorn main:app --reload
```
> The backend server runs at `http://localhost:8000`.

---

### 2. Frontend Setup

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Next.js development server
npm run dev
```
> The frontend application runs at `http://localhost:3000`.

---

## 🛰️ API Reference

### `POST /upload`
Uploads and indexes PDF documents into the vector database. Can process single or multiple files in one batch.
- **Request:** `FormData` containing `files` (`.pdf`).
- **Response:**
  ```json
  {
    "status": "success",
    "filename": "document.pdf",
    "num_chunks": 42
  }
  ```

### `POST /chat`
Streams real-time response data using Server-Sent Events (SSE).
- **Request Body:**
  ```json
  {
    "message": "Summarize key concepts in Chapter 2",
    "history": []
  }
  ```
- **Response:** SSE Stream emitting events:
  - `data: {"type": "state", "state": "searching"}`
  - `data: {"type": "chunk", "content": "..."}`
  - `data: {"type": "done"}`

---

## 📜 License

This project is open-source under the [MIT License](LICENSE).
