import type { PlasmoCSConfig } from "plasmo"
import { Storage } from "@plasmohq/storage"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

const storage = new Storage({
  area: "local"
})

interface HistoryItem {
  type: "text" | "image"
  content: string
  timestamp: number
}

console.log("Quick Clipboard: Tracking core initialized")

// Global listener for the copy event
document.addEventListener("copy", (e) => {
  let capturedImage = false
  
  // Try to capture image from clipboard data
  const items = (e as ClipboardEvent).clipboardData?.items
  if (items) {
    for (let i = 0; i < items.length; i++) {
      // ONLY capture the first image format found to prevent duplicates
      if (!capturedImage && items[i].type.startsWith("image/")) {
        const blob = items[i].getAsFile()
        if (blob && blob.size > 500) { 
          capturedImage = true
          const reader = new FileReader()
          reader.onload = async (event) => {
            const base64 = event.target?.result as string
            if (base64) {
              await saveToHistory(base64, "image")
            }
          }
          reader.readAsDataURL(blob)
        }
      }
    }
  }

  // Capture text after a small delay to avoid race conditions with image capture
  setTimeout(async () => {
    let text = ""
    const selection = window.getSelection()?.toString()
    
    if (selection && selection.trim()) {
      text = selection.trim()
    } else {
      const activeEl = document.activeElement
      if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
        text = activeEl.value.substring(activeEl.selectionStart || 0, activeEl.selectionEnd || 0).trim()
      }
    }

    // Capture text if it's substantial and we didn't just capture an image 
    if (text && text.length > 1 && !capturedImage) {
      await saveToHistory(text, "text")
    }
  }, 100)
}, true)

// Sync clipboard when window gains focus (catches address bar copies)
window.addEventListener("focus", async () => {
  try {
    // Only sync if the extension is still valid
    if (!chrome.runtime?.id) return
    
    const text = await navigator.clipboard.readText()
    if (text && text.trim().length > 0) {
      await saveToHistory(text.trim(), "text")
    }
  } catch (err) {
    // Silently fail - might not have focus or permission yet
  }
})

async function saveToHistory(content: string, type: "text" | "image") {
  if (!chrome.runtime?.id) return
  
  try {
    const history = (await storage.get<HistoryItem[]>("clipboard-history")) || []
    
    // De-duplication check: avoid saving if the same content was saved in the last 2 seconds
    // or if it matches one of the top 3 items.
    const isDuplicate = history.slice(0, 3).some(item => item.content === content)
    if (isDuplicate) return

    const newItem: HistoryItem = { 
      type,
      content, 
      timestamp: Date.now() 
    }
    
    const newHistory = [newItem, ...history.filter(item => item.content !== content)].slice(0, 50)
    await storage.set("clipboard-history", newHistory)
  } catch (err) {
    console.warn("Quick Clipboard: Storage error - might be exceeding quota if image is huge", err)
  }
}
