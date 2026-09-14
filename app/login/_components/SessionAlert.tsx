'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

function AlertContent() {
  const searchParams = useSearchParams()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (searchParams.get('reason') === 'session_expired') {
      setIsVisible(true)
      // Mesajı 5 saniye sonra otomatik gizle
      const timer = setTimeout(() => setIsVisible(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  if (!isVisible) return null

  return (
    <div className="w-full bg-red-500/10 border border-red-500/50 p-4 rounded-md mb-6 flex items-start gap-3 animate-in slide-in-from-top-2">
      <div className="text-red-500 mt-0.5">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-red-500">Oturum Sonlandırıldı</h3>
        <p className="text-xs text-red-400/80 mt-1">
          Güvenliğiniz için veya aynı hesapla başka bir cihazdan giriş yapıldığı için oturumunuz kapatıldı. Lütfen tekrar giriş yapın.
        </p>
      </div>
    </div>
  )
}

export default function SessionAlert() {
  return (
    <Suspense fallback={null}>
      <AlertContent />
    </Suspense>
  )
}