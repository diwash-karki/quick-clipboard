import type { PlasmoCSConfig } from "plasmo"
import { useStorage } from "@plasmohq/storage/hook"
import { Storage } from "@plasmohq/storage"
import { motion, AnimatePresence } from "framer-motion"
import { Clipboard, X, Copy, Zap, Check, Link, Plus } from "lucide-react"
import { useState, useEffect } from "react"
import styleText from "data-text:../overlay.css"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = styleText
  return style
}

interface HistoryItem {
  type: "text" | "image"
  content: string
  timestamp: number
}

const Overlay = () => {
  const [history, setHistory] = useStorage<HistoryItem[]>({
    key: "clipboard-history",
    instance: new Storage({ area: "local" }) as any
  }, [])
  const [isVisible, setIsVisible] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // Sync clipboard when overlay opens
  useEffect(() => {
    if (isVisible) {
      syncClipboard()
    }
  }, [isVisible])

  const syncClipboard = async () => {
    try {
      // Small delay to ensure focus is stable
      await new Promise(r => setTimeout(r, 50))
      const text = await navigator.clipboard.readText()
      if (text && text.trim().length > 0) {
        await saveToHistory(text.trim(), "text")
      }
    } catch (err) {
      // Silently fail if clipboard access is denied or unavailable
      console.debug("Quick Clipboard: Could not auto-sync clipboard", err)
    }
  }

  const saveToHistory = async (content: string, type: "text" | "image") => {
    const s = new Storage({ area: "local" })
    const history = (await s.get<HistoryItem[]>("clipboard-history")) || []
    
    // De-duplication check: avoid saving if it matches one of the top 3 items
    const isDuplicate = history.slice(0, 3).some(item => item.content === content)
    if (isDuplicate) return

    const newItem: HistoryItem = { 
      type,
      content, 
      timestamp: Date.now() 
    }
    
    const newHistory = [newItem, ...history.filter(item => item.content !== content)].slice(0, 50)
    await s.set("clipboard-history", newHistory)
  }

  // Keyboard shortcut toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey
      if (isModifier && e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault()
        setIsVisible((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleCopyBack = async (item: HistoryItem, index: number) => {
    if (!chrome.runtime?.id) return
    
    try {
      if (item.type === "text") {
        await navigator.clipboard.writeText(item.content)
      } else {
        // Copying image back to clipboard
        const response = await fetch(item.content);
        const blob = await response.blob();
        
        // Ensure we use a standard image type the clipboard expects (usually image/png)
        // If it's not PNG, we try to write it as its original type
        const type = blob.type || "image/png";
        
        await navigator.clipboard.write([
          new ClipboardItem({
            [type]: blob
          })
        ]);
      }
      
      // Visual feedback
      setCopiedId(index)
      setTimeout(() => setCopiedId(null), 1500)
    } catch (err) {
      console.error("Quick Clipboard: Failed to copy back", err)
    }
  }

  const handleAddCurrentUrl = async () => {
    const url = window.location.href
    await saveToHistory(url, "text")
  }

  return (
    <>
      {/* Floating Trigger */}
      {!isVisible && (
        <motion.div
          className="floating-trigger"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setIsVisible(true)}
        >
          <Zap size={20} fill="currentColor" />
        </motion.div>
      )}

      <AnimatePresence>
        {isVisible && (
          <div className="overlay-container">
            <motion.div
              drag
              dragMomentum={false}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="overlay-content"
            >
              <div className="overlay-header">
                <div className="overlay-header-left">
                  <h3 className="overlay-title">
                    <Clipboard size={16} />
                    Quick Clipboard
                  </h3>
                </div>
                <div className="overlay-header-actions">
                  <button 
                    className="action-btn" 
                    onClick={handleAddCurrentUrl}
                    title="Add current URL"
                  >
                    <Plus size={14} style={{ marginRight: -4 }} />
                    <Link size={16} />
                  </button>
                  <button className="close-btn" onClick={() => setIsVisible(false)}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="overlay-list">
                {history && history.length > 0 ? (
                  history.slice(0, 15).map((item, index) => (
                    <motion.div
                      key={item.timestamp + index}
                      className="overlay-item"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => handleCopyBack(item, index)}
                    >
                      {item.type === "text" ? (
                        <div className="overlay-item-text">{item.content}</div>
                      ) : (
                        <div className="overlay-item-image">
                          <img src={item.content} alt="copied item" />
                        </div>
                      )}
                      <div className="overlay-item-footer">
                        <span style={{ 
                          color: copiedId === index ? "#58a6ff" : "inherit",
                          fontWeight: copiedId === index ? "600" : "inherit",
                          transition: "all 0.2s"
                        }}>
                          {copiedId === index ? (
                            "Copied!"
                          ) : (
                            item.type === "text" ? `${item.content.length} chars` : "Image"
                          )}
                        </span>
                        
                        <AnimatePresence mode="wait">
                          {copiedId === index ? (
                            <motion.div
                              key="check"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                            >
                              <Check size={12} color="#58a6ff" />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="copy"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0.5 }}
                              exit={{ opacity: 0 }}
                            >
                              <Copy size={12} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="empty-state-text">
                    Nothing copied yet
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

export default Overlay
