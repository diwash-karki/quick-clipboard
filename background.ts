import { Storage } from "@plasmohq/storage"

const storage = new Storage({
  area: "local"
})

interface HistoryItem {
  type: "text" | "image"
  content: string
  timestamp: number
}

// Create context menu item
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Quick Clipboard: Background script initialized")
  
  chrome.contextMenus.create({
    id: "add-to-quick-clipboard",
    title: "Add Selection to Quick Clipboard",
    contexts: ["selection"]
  })

  chrome.contextMenus.create({
    id: "add-url-to-quick-clipboard",
    title: "Add Current URL to Quick Clipboard",
    contexts: ["page", "link"]
  })

  // Add a welcome item if history is empty
  const history = await storage.get<HistoryItem[]>("clipboard-history")
  if (!history || history.length === 0) {
    await storage.set("clipboard-history", [{
      type: "text",
      content: "Welcome to Quick Clipboard! Your copied items will appear here.",
      timestamp: Date.now()
    }])
  }
})

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let text = ""
  
  if (info.menuItemId === "add-to-quick-clipboard" && info.selectionText) {
    text = info.selectionText
  } else if (info.menuItemId === "add-url-to-quick-clipboard") {
    text = info.linkUrl || info.pageUrl || ""
  }

  if (text) {
    const history = (await storage.get<HistoryItem[]>("clipboard-history")) || []
    
    // De-duplication check: avoid saving if the same content matches the top item
    if (history[0]?.content !== text) {
      const newItem: HistoryItem = { 
        type: "text",
        content: text, 
        timestamp: Date.now() 
      }
      const newHistory = [newItem, ...history.filter(item => item.content !== text)].slice(0, 50)
      await storage.set("clipboard-history", newHistory)
      console.log("Quick Clipboard: Item added via context menu")
    }
  }
})
