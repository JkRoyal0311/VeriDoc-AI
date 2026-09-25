"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PDFUploader } from "./PDFUploader";
import { ChatInterface } from "./ChatInterface";
import { AIState } from "./AIStatusIndicator";
import { History, Plus, Trash2, MessageSquare, Cpu } from "lucide-react";

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
  messages: any[];
  fileNames?: string[];
}

export function SplitLayout() {
  const [files, setFiles] = useState<File[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [aiState, setAiState] = useState<AIState>("idle");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [ingestedInfo, setIngestedInfo] = useState<{ numChunks: number; filenames: string[] } | null>(null);

  // LocalStorage Sessions State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => Date.now().toString());
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingQuestionRef = useRef<string | null>(null);
  const isIngestingRef = useRef<boolean>(false);

  useEffect(() => {
    // Removed dark mode lock
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_qa_sessions") || localStorage.getItem("docuscholar_sessions");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load local chat sessions", e);
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;

    try {
      const sessionTitle = files.length > 0
        ? files.map(f => f.name).join(", ")
        : messages[0]?.content.slice(0, 30) || "Chat Session";
      const updatedSession: ChatSession = {
        id: currentSessionId,
        title: sessionTitle,
        timestamp: new Date().toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        messages,
        fileNames: files.map(f => f.name),
      };

      setSessions((prev) => {
        const existingIdx = prev.findIndex((s) => s.id === currentSessionId);
        let next: ChatSession[];
        if (existingIdx >= 0) {
          next = [...prev];
          next[existingIdx] = updatedSession;
        } else {
          next = [updatedSession, ...prev];
        }
        localStorage.setItem("ai_qa_sessions", JSON.stringify(next));
        return next;
      });
    } catch (e) {
      console.error("Failed to save session to localStorage", e);
    }
  }, [messages, files, currentSessionId]);

  const handleFilesSelect = async (selectedFiles: File[]) => {
    setFiles(selectedFiles);

    if (selectedFiles.length === 0) {
      setMessages([]);
      setIngestedInfo(null);
      setIsIngesting(false);
      isIngestingRef.current = false;
      return;
    }

    try {
      setIsIngesting(true);
      isIngestingRef.current = true;
      const formData = new FormData();
      selectedFiles.forEach((f) => {
        formData.append("files", f);
      });

      const filenamesStr = selectedFiles.map((f) => f.name).join(", ");
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.isIngestionToast);
        return [
          ...filtered,
          {
            id: Date.now().toString(),
            role: "ai",
            isIngestionToast: true,
            content: `Ingesting **${selectedFiles.length} document(s)** (${filenamesStr}) into Vector Store (purging previous memory context)...`,
          },
        ];
      });

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to process document batch.");
      }

      // INSTANT STATE RELEASE AFTER INGESTION (0ms delay)
      setIsIngesting(false);
      isIngestingRef.current = false;
      setIngestedInfo({ numChunks: data.num_chunks, filenames: selectedFiles.map((f) => f.name) });

      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.isIngestionToast);
        return [
          ...filtered,
          {
            id: Date.now().toString(),
            role: "ai",
            isIngestionToast: true,
            content: `🎉 Successfully ingested ${selectedFiles.length} file(s)! All documents are indexed. You can now ask questions.\n\n*(${filenamesStr} — ${data.num_chunks} vector chunks indexed via FastEmbed)*`,
          },
        ];
      });

      // IMMEDIATE QUEUED QUESTION EXECUTION POST-INGESTION
      if (pendingQuestionRef.current) {
        const queuedMsg = pendingQuestionRef.current;
        pendingQuestionRef.current = null;
        setTimeout(() => {
          handleSendMessage(queuedMsg);
        }, 50);
      }
    } catch (error: any) {
      setIngestedInfo(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "ai",
          content: `<span style="color: #f87171">Error: ${error.message}</span>`,
        },
      ]);
    } finally {
      setIsIngesting(false);
      isIngestingRef.current = false;
    }
  };

  const handleAddFiles = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    setFiles((prev) => [...prev, ...newFiles]);

    try {
      setIsIngesting(true);
      isIngestingRef.current = true;
      const formData = new FormData();
      newFiles.forEach((f) => {
        formData.append("files", f);
      });

      const filenamesStr = newFiles.map((f) => f.name).join(", ");
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.isIngestionToast);
        return [
          ...filtered,
          {
            id: Date.now().toString(),
            role: "ai",
            isIngestionToast: true,
            content: `Ingesting **${newFiles.length} additional document(s)** (${filenamesStr}) into Vector Store...`,
          },
        ];
      });

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to process document batch.");
      }

      setIsIngesting(false);
      isIngestingRef.current = false;
      setIngestedInfo((prev) => ({
        numChunks: (prev?.numChunks || 0) + data.num_chunks,
        filenames: [...(prev?.filenames || []), ...newFiles.map((f) => f.name)],
      }));

      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.isIngestionToast);
        return [
          ...filtered,
          {
            id: Date.now().toString(),
            role: "ai",
            isIngestionToast: true,
            content: `🎉 Successfully ingested ${newFiles.length} additional file(s)! You can now ask questions.\n\n*(${filenamesStr} — ${data.num_chunks} new vector chunks indexed)*`,
          },
        ];
      });

      if (pendingQuestionRef.current) {
        const queuedMsg = pendingQuestionRef.current;
        pendingQuestionRef.current = null;
        setTimeout(() => {
          handleSendMessage(queuedMsg);
        }, 50);
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "ai",
          content: `<span style="color: #f87171">Error adding files: ${error.message}</span>`,
        },
      ]);
    } finally {
      setIsIngesting(false);
      isIngestingRef.current = false;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setAiState("idle");
    setIsGenerating(false);
  };

  const handleSendMessage = async (message: string) => {
    if (!message || !message.trim()) return;

    // Queue question instantly if ingestion is currently active
    if (isIngesting || isIngestingRef.current) {
      console.log("Ingestion in progress. Queuing message for instant post-ingestion execution:", message);
      pendingQuestionRef.current = message;
      return;
    }

    if (files.length === 0 || isGenerating) return;

    const now = Date.now();
    const newUserMessage = { id: now.toString(), role: "user", content: message };
    const aiMessageId = (now + 1).toString();
    const newAiMessage = { id: aiMessageId, role: "ai", content: "" };

    // ATOMIC DISPATCH: Append user question and AI placeholder message together to prevent state race condition
    setMessages((prev) => [...prev, newUserMessage, newAiMessage]);
    setAiState("searching");
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const history = messages
        .filter((m: any) => !m.isIngestionToast && !m.content?.startsWith("Ingesting **"))
        .map((m: any) => ({ role: m.role, content: m.content }));

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, history }),
        signal: controller.signal,
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        // Keep trailing incomplete fragment in the buffer for next read
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (!dataStr) continue;

              try {
                const data = JSON.parse(dataStr);

                if (data.type === "state") {
                  setAiState(data.state);
                } else if (data.type === "chunk") {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId ? { ...msg, content: msg.content + data.content } : msg
                    )
                  );
                } else if (data.type === "done") {
                  setAiState("idle");
                  setIsGenerating(false);
                } else if (data.type === "error") {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId
                        ? {
                            ...msg,
                            content:
                              msg.content +
                              `\n\n<span style="color: #f87171">Error: ${data.message}</span>`,
                          }
                        : msg
                    )
                  );
                  setAiState("idle");
                  setIsGenerating(false);
                }
              } catch (e) {
                console.error("Error parsing SSE JSON:", e, dataStr);
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Generation stopped by user.");
      } else {
        console.error(error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? {
                  ...msg,
                  content:
                    msg.content +
                    `\n\n<span style="color: #f87171">Network Error: Could not connect to backend server.</span>`,
                }
              : msg
          )
        );
      }
    } finally {
      setAiState("idle");
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(Date.now().toString());
    setMessages([]);
  };

  const handleRestoreSession = (s: ChatSession) => {
    setCurrentSessionId(s.id);
    setMessages(s.messages);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.id !== sessionId);
    setSessions(updated);
    localStorage.setItem("ai_qa_sessions", JSON.stringify(updated));
    if (sessionId === currentSessionId) {
      handleNewChat();
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-[#FAF9FC] text-[#282438] font-sans">
      {/* Left Dark Sidebar Panel */}
      <div className="w-full md:w-80 lg:w-96 h-[40vh] md:h-full border-b md:border-b-0 md:border-r border-[#9A89D0]/30 bg-[#FAF9FC] z-20 flex flex-col shadow-xl">
        {/* Brand Header */}
        <div className="p-4 border-b border-[#9A89D0]/30 bg-[#E5E0F4]/90 backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#38BDF8] via-sky-600 to-indigo-700 shadow-lg text-white glow-cyan">
              <Cpu className="w-5 h-5 text-sky-100" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-wide text-[#282438] flex items-center gap-1.5">
                <span>VeriDoc AI</span>
              </h1>
              <p className="text-[#282438]/70 text-xs truncate">Multi-Format RAG &amp; Intelligence Suite</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {/* History Toggle */}
            <button
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isHistoryOpen
                  ? "bg-[#6956A5] text-[#0B0F19] border-[#6956A5] shadow-md font-bold"
                  : "glass-card text-slate-600 border-[#9A89D0]/30 hover:border-[#6956A5]"
              }`}
              title="Saved Sessions"
            >
              <History className="w-4 h-4" />
            </button>

            {/* New Session Button */}
            <button
              onClick={handleNewChat}
              className="p-2 rounded-xl glass-card text-slate-600 border border-[#9A89D0]/30 hover:border-[#6956A5] hover:text-[#282438] transition-all cursor-pointer"
              title="New Chat Session"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* History Drawer Overlay or Multi-Format Uploader */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence>
            {isHistoryOpen ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="absolute inset-0 glass-panel p-4 flex flex-col z-30 overflow-y-auto bg-[#FAF9FC]"
              >
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#9A89D0]/30">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#6956A5] flex items-center space-x-2">
                    <History className="w-4 h-4 text-[#6956A5]" />
                    <span>Saved Q&amp;A Sessions</span>
                  </h3>

                  <button
                    onClick={() => setIsHistoryOpen(false)}
                    className="text-xs text-[#9A89D0] hover:text-white cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                {sessions.length === 0 ? (
                  <p className="text-xs text-[#282438]/70 text-center py-8">No saved sessions found.</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          handleRestoreSession(s);
                          setIsHistoryOpen(false);
                        }}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between group ${
                          s.id === currentSessionId
                            ? "bg-[#6956A5]/15 border-[#6956A5]/40 text-[#6956A5] shadow-md"
                            : "glass-card text-slate-600 hover:border-[#6956A5]/50 hover:text-[#282438]"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 overflow-hidden">
                          <MessageSquare className="w-4 h-4 shrink-0 text-[#6956A5]" />
                          <div className="overflow-hidden">
                            <p className="text-xs font-semibold truncate">{s.title}</p>
                            <p className="text-[10px] text-[#9A89D0]">{s.timestamp}</p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#9A89D0] hover:text-rose-400 transition-opacity cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <PDFUploader
                onFilesSelect={handleFilesSelect}
                ingestedInfo={ingestedInfo}
                isIngesting={isIngesting}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right Main Chat Panel */}
      <div className="flex-1 h-[60vh] md:h-full flex flex-col relative z-0 bg-[#FAF9FC]">
        <ChatInterface
          messages={messages}
          aiState={aiState}
          isGenerating={isGenerating}
          hasFile={files.length > 0}
          ingestedInfo={ingestedInfo}
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
          onFilesAdded={handleAddFiles}
        />
      </div>
    </div>
  );
}

