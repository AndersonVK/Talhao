import { useState, useCallback } from 'react'

let showToastFn = null

export function useToast() {
  return useCallback((msg) => {
    if (showToastFn) showToastFn(msg)
  }, [])
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  showToastFn = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  return (
    <>
      {children}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
