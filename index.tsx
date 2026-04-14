/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GoogleGenAI,
  Content,
  FunctionDeclaration,
  Type,
  FunctionCall,
  Part,
} from "@google/genai";
import { marked } from "marked";

const chatContainer = document.getElementById(
  "chat-container",
) as HTMLDivElement;
const chatForm = document.getElementById("chat-form") as HTMLFormElement;
const chatInput = document.getElementById("chat-input") as HTMLInputElement;
const sendButton = chatForm.querySelector("button") as HTMLButtonElement;
const journalButton = document.getElementById(
  "journal-button",
) as HTMLButtonElement;
const journalModal = document.getElementById("journal-modal") as HTMLDivElement;
const journalCloseButton = document.getElementById(
  "journal-close-button",
) as HTMLButtonElement;
const journalEntries = document.getElementById(
  "journal-entries",
) as HTMLDivElement;

// Wrap the main application logic in a function to control execution flow.
const main = () => {
  // Safely check for the API key without crashing the browser.
  const API_KEY =
    typeof process !== "undefined" && process.env
      ? process.env.API_KEY
      : undefined;

  // If the key is not found, display a user-friendly error and stop.
  if (!API_KEY) {
    chatContainer.innerHTML =
      '<div class="message bot-message"><p><strong>Configuration Error</strong></p><p>API key not found. Please set the <code>API_KEY</code> environment variable. The application cannot run without it.</p></div>';
    chatInput.disabled = true;
    sendButton.disabled = true;
    chatInput.placeholder = "Application is not configured.";
    // Stop the application from proceeding without a key.
    return;
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const systemInstruction =
    "You are NIRVANA, a compassionate and supportive AI companion. Your purpose is to provide a safe and non-judgmental space for users to talk about their feelings and mental well-being. Listen actively, show empathy, and offer gentle encouragement. Do not provide medical advice or diagnoses. If a user seems to be in serious distress, gently suggest they seek help from a qualified professional. Keep your responses concise and conversational.";

  type SavedThought = {
    id: number;
    html: string;
    sender: "user" | "bot";
  };

  // Use a single, manually-managed history array as the source of truth.
  let chatHistory: Content[] = [];

  let inactivityTimer: number | null = null;
  const INACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 minutes

  // --- Journal Functions ---
  const getSavedThoughts = (): SavedThought[] => {
    const thoughts = localStorage.getItem("nirvana-journal");
    return thoughts ? JSON.parse(thoughts) : [];
  };

  const saveThought = (id: number, html: string, sender: "user" | "bot") => {
    const thoughts = getSavedThoughts();
    if (!thoughts.some((thought) => thought.id === id)) {
      thoughts.push({ id, html, sender });
      localStorage.setItem("nirvana-journal", JSON.stringify(thoughts));
    }
  };

  const deleteThought = (id: number) => {
    let thoughts = getSavedThoughts();
    thoughts = thoughts.filter((thought) => thought.id !== id);
    localStorage.setItem("nirvana-journal", JSON.stringify(thoughts));
    renderJournal();
  };

  const renderJournal = () => {
    const thoughts = getSavedThoughts();
    journalEntries.innerHTML = "";
    if (thoughts.length === 0) {
      journalEntries.innerHTML = '<p>No saved thoughts yet.</p>';
      return;
    }

    thoughts.forEach((thought) => {
      const entryEl = document.createElement("div");
      entryEl.className = "journal-entry";

      const messageEl = document.createElement("div");
      messageEl.className = `message ${thought.sender}-message`;
      // Strip out the bookmark button if it exists in the saved HTML
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = thought.html;
      tempDiv.querySelector(".bookmark-button")?.remove();
      messageEl.innerHTML = tempDiv.innerHTML;

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.setAttribute("aria-label", "Delete thought");
      deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
      deleteButton.onclick = () => deleteThought(thought.id);

      entryEl.appendChild(messageEl);
      entryEl.appendChild(deleteButton);
      journalEntries.appendChild(entryEl);
    });
  };

  const openJournal = () => {
    renderJournal();
    journalModal.hidden = false;
  };

  const closeJournal = () => {
    journalModal.hidden = true;
  };

  // --- Message Handling ---
  const addMessage = async (
    text: string,
    sender: "user" | "bot",
    isStreaming = false,
  ) => {
    const messageEl = document.createElement("div");
    messageEl.classList.add("message", `${sender}-message`);

    const parsedHtml = await marked.parse(text);
    messageEl.innerHTML = parsedHtml;

    if (isStreaming) {
      messageEl.classList.add("streaming");
    }

    chatContainer.appendChild(messageEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return messageEl;
  };

  const finalizeMessage = (
    messageEl: HTMLDivElement,
    sender: "user" | "bot",
  ) => {
    const thoughtId = Date.now() + Math.random(); // Add randomness for uniqueness
    const bookmarkButton = document.createElement("button");
    bookmarkButton.className = "bookmark-button";
    bookmarkButton.setAttribute("aria-label", "Save thought");
    bookmarkButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>`;
    bookmarkButton.onclick = (e) => {
      e.preventDefault();
      const target = e.currentTarget as HTMLButtonElement;
      saveThought(thoughtId, messageEl.innerHTML, sender);
      target.classList.add("saved");
      target.disabled = true;
    };
    messageEl.appendChild(bookmarkButton);
  };

  // --- Mindfulness Exercise ---
  const displayBreathingExercise = () => {
    const exerciseEl = document.createElement("div");
    exerciseEl.className = "mindfulness-exercise";
    exerciseEl.innerHTML = `
        <p>Let's try a simple breathing exercise. Follow the circle.</p>
        <div class="pulsating-circle" id="pulse-text">Breathe in...</div>
    `;
    chatContainer.appendChild(exerciseEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    const pulseText = exerciseEl.querySelector("#pulse-text") as HTMLDivElement;
    let isInhale = true;
    const intervalId = setInterval(() => {
      isInhale = !isInhale;
      if (pulseText) {
        pulseText.textContent = isInhale ? "Breathe in..." : "Breathe out...";
      }
    }, 4000); // Match animation duration

    // Stop after 3 cycles (24s)
    setTimeout(() => {
      clearInterval(intervalId);
      exerciseEl.innerHTML = `<p>Well done. When you're ready, we can continue.</p>`;
    }, 24000);
  };

  // --- Summary ---
  const generateAndDisplaySummary = async () => {
    if (chatHistory.length === 0) {
      return;
    }

    const summaryIntro = await addMessage(
      "It seems like we've paused for a moment. Here's a gentle reflection on our chat:",
      "bot",
    );
    finalizeMessage(summaryIntro, "bot");

    const thinkingEl = document.createElement("div");
    thinkingEl.classList.add("message", "bot-message", "thinking");
    thinkingEl.innerText = "● ● ●";
    chatContainer.appendChild(thinkingEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
      const historyText = chatHistory
        .map((content: Content) => {
          const text = content.parts.map((part) => part.text).join("");
          return `${content.role === "user" ? "User" : "NIRVANA"}: ${text}`;
        })
        .join("\n");

      const summaryPrompt = `You are NIRVANA, a compassionate AI. The user has been inactive. Your task is to provide a gentle, reflective summary of the emotional arc of your conversation. Start by acknowledging the feelings the user initially expressed, and then comment on how the tone or mood seemed to shift or evolve as you talked. For example, "It sounds like you started our chat feeling quite heavy, but as we talked, a sense of hopefulness seemed to emerge." The goal is to help the user feel heard and to validate their emotional journey during the chat. This is purely a reflection of what was already discussed. Do not add any new advice. Address the user directly.\n\nHere is the conversation:\n${historyText}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: summaryPrompt,
      });

      thinkingEl.remove();
      const summaryMsg = await addMessage(response.text, "bot");
      finalizeMessage(summaryMsg, "bot");
    } catch (error) {
      console.error("Error generating summary:", error);
      thinkingEl.remove();
      await addMessage(
        "I had a little trouble summarizing our chat. My apologies.",
        "bot",
      );
    } finally {
      chatHistory = [];
      const newSessionMessage =
        "Whenever you're ready to talk again, I'm here.";
      const newSessionMsg = await addMessage(newSessionMessage, "bot");
      finalizeMessage(newSessionMsg, "bot");
    }
  };

  const resetInactivityTimer = () => {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
    inactivityTimer = window.setTimeout(
      generateAndDisplaySummary,
      INACTIVITY_TIMEOUT,
    );
  };

  const tools: FunctionDeclaration[] = [
    {
      name: "suggest_mindfulness_exercise",
      description:
        "Suggests a mindfulness exercise to the user when they seem stressed or anxious. Only use this if the user is expressing clear signs of distress that a short, calming exercise might help with.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          exercise_type: {
            type: Type.STRING,
            description:
              "The type of exercise to suggest. Currently, only 'breathing' is supported.",
          },
        },
        required: ["exercise_type"],
      },
    },
  ];

  const processBotResponse = async () => {
    sendButton.disabled = true;
    chatInput.disabled = true;

    const thinkingEl = document.createElement("div");
    thinkingEl.classList.add("message", "bot-message", "thinking");
    thinkingEl.innerText = "● ● ●";
    chatContainer.appendChild(thinkingEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
      const stream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: chatHistory,
        config: {
          systemInstruction: systemInstruction,
          tools: [{ functionDeclarations: tools }],
        },
      });

      let botMessage = "";
      let botMessageEl: HTMLDivElement | null = null;
      let functionCalls: FunctionCall[] = [];

      thinkingEl.remove();

      for await (const chunk of stream) {
        if (chunk.functionCalls) {
          functionCalls.push(...chunk.functionCalls);
        }

        if (chunk.text) {
          botMessage += chunk.text;
          if (!botMessageEl) {
            botMessageEl = await addMessage(botMessage, "bot", true);
          } else {
            botMessageEl.innerHTML = await marked.parse(botMessage);
          }
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }

      if (botMessageEl) {
        botMessageEl.classList.remove("streaming");
        const finalHtml = await marked.parse(botMessage);
        botMessageEl.innerHTML = finalHtml;
        finalizeMessage(botMessageEl, "bot");
      }

      const modelParts: Part[] = [];
      if (botMessage) {
        modelParts.push({ text: botMessage });
      }

      if (functionCalls.length > 0) {
        functionCalls.forEach((call) => {
          modelParts.push({ functionCall: call });
        });
      }

      if (modelParts.length > 0) {
        chatHistory.push({ role: "model", parts: modelParts });
      }

      if (functionCalls.length > 0) {
        const call = functionCalls[0];
        if (call.name === "suggest_mindfulness_exercise") {
          displayBreathingExercise();
          const functionResponsePart: Part = {
            functionResponse: {
              name: "suggest_mindfulness_exercise",
              response: {
                result:
                  "The user was shown the breathing exercise and it has completed.",
              },
            },
          };
          chatHistory.push({ role: "tool", parts: [functionResponsePart] });
          await processBotResponse(); // Get model's response after tool execution
        }
      }
    } catch (error) {
      console.error(error);
      thinkingEl.remove();
      const errorMsg = await addMessage(
        "Sorry, I encountered an error. Please try again.",
        "bot",
      );
      finalizeMessage(errorMsg, "bot");
    } finally {
      sendButton.disabled = false;
      chatInput.disabled = false;
      chatInput.focus();
      resetInactivityTimer();
    }
  };

  const handleFormSubmit = async (e: Event) => {
    e.preventDefault();
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;

    chatInput.value = "";

    const userMsgEl = await addMessage(userMessage, "user");
    finalizeMessage(userMsgEl, "user");

    chatHistory.push({ role: "user", parts: [{ text: userMessage }] });

    await processBotResponse();
  };

  const initialize = async () => {
    chatForm.addEventListener("submit", handleFormSubmit);
    journalButton.addEventListener("click", openJournal);
    journalCloseButton.addEventListener("click", closeJournal);
    journalModal.addEventListener("click", (e) => {
      if (e.target === journalModal) {
        closeJournal();
      }
    });

    const greetings = [
      "Hello, I'm NIRVANA. How are you feeling today?",
      "Welcome. I'm NIRVANA, your space to reflect. How are you feeling right now?",
      "Hi there, I'm NIRVANA. I'm here to listen. What's on your mind today?",
      "Hello, I'm NIRVANA. Thank you for being here. Feel free to share whatever you'd like.",
    ];

    const initialMessage =
      greetings[Math.floor(Math.random() * greetings.length)];
    const initialMsgEl = await addMessage(initialMessage, "bot");
    finalizeMessage(initialMsgEl, "bot");
    chatHistory = [];
  };

  initialize();
};

main();
