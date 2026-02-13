import { useState, useMemo, useEffect } from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { Storage } from "@plasmohq/storage"
import { Copy, Trash2, Search, Eraser, CheckCircle2, Clipboard, Clock } from "lucide-react"
import { DateTime } from "luxon"
import "./style.css"

interface HistoryItem {
  type: "text" | "image"
  content: string
  timestamp: number
}

function IndexPopup() {
  const [history, setHistory] = useStorage<HistoryItem[]>({
    key: "clipboard-history",
    instance: new Storage({ area: "local" }) as any
  }, [])
  const [searchQuery, setSearchQuery] = useState("")
  const [showToast, setShowToast] = useState(false)
  const [toastMsg, setToastMsg] = useState("")
  const storage = new Storage({ area: "local" })

  // Sync clipboard when popup opens
  useEffect(() => {
    const syncClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (text && text.trim().length > 0) {
          await saveToHistory(text.trim())
        }
      } catch (err) {
        console.debug("Quick Clipboard: Popup sync failed", err)
      }
    }
    syncClipboard()
  }, [])

  const saveToHistory = async (content: string) => {
    const currentHistory = (await storage.get<HistoryItem[]>("clipboard-history")) || []
    
    // De-duplication
    if (currentHistory.slice(0, 3).some(item => item.content === content)) return

    const newItem: HistoryItem = { 
      type: "text",
      content, 
      timestamp: Date.now() 
    }
    
    const newHistory = [newItem, ...currentHistory.filter(item => item.content !== content)].slice(0, 50)
    await storage.set("clipboard-history", newHistory)
  }

  const filteredHistory = useMemo(() => {
    if (!history) return []
    return history.filter(item => 
      item.type === "text" 
        ? item.content.toLowerCase().includes(searchQuery.toLowerCase())
        : searchQuery === ""
    )
  }, [history, searchQuery])

  const handleCopy = async (item: HistoryItem) => {
    try {
      if (item.type === "text") {
        await navigator.clipboard.writeText(item.content)
      } else {
        const response = await fetch(item.content);
        const blob = await response.blob();
        const type = blob.type || "image/png";
        
        await navigator.clipboard.write([
          new ClipboardItem({
            [type]: blob
          })
        ]);
      }
      setToastMsg("Copied to clipboard!")
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleDelete = (timestamp: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const newHistory = history.filter(item => item.timestamp !== timestamp)
    setHistory(newHistory)
  }

  const clearAll = () => {
    if (window.confirm("Clear all clipboard history?")) {
      setHistory([])
    }
  }

  const formatTime = (timestamp: number) => {
    return DateTime.fromMillis(timestamp).toRelative()
  }

  return (
    <div className="popup-container">
      <header className="header">
        <div className="title-row">
          <h1 className="title">Quick Clipboard</h1>
          <button className="clear-btn" onClick={clearAll} title="Clear All">
            <Eraser size={14} style={{ marginRight: 6 }} />
            Clear
          </button>
        </div>
        
        <div className="search-container">
          <Search className="search-icon" size={16} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search history..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <main className="content-list">
        {filteredHistory.length > 0 ? (
          filteredHistory.map((item, index) => (
            <div 
              key={item.timestamp + index} 
              className="clipboard-item"
              onClick={() => handleCopy(item)}
            >
              {item.type === "text" ? (
                <div className="clipboard-text">{item.content}</div>
              ) : (
                <div className="clipboard-image">
                  <img src={item.content} alt="copied item" />
                </div>
              )}
              <div className="item-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={10} />
                  <span>{formatTime(item.timestamp)}</span>
                  <span style={{ margin: '0 4px' }}>•</span>
                  <span>{item.type === "text" ? `${item.content.length} chars` : "Image"}</span>
                </div>
                <div className="item-actions">
                  <button 
                    className="action-btn" 
                    onClick={(e) => { e.stopPropagation(); handleCopy(item); }}
                    title="Copy"
                  >
                    <Copy size={14} />
                  </button>
                  <button 
                    className="action-btn delete" 
                    onClick={(e) => handleDelete(item.timestamp, e)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <Clipboard size={48} strokeWidth={1} />
            <p>{searchQuery ? "No matches found" : "Your clipboard history is empty"}</p>
          </div>
        )}
      </main>

      {showToast && (
        <div className="toast">
          <CheckCircle2 size={14} style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }} />
          {toastMsg}
        </div>
      )}
    </div>
  )
}

export default IndexPopup
