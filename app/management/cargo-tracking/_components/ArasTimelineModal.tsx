"use client";

import { useEffect, useState } from "react";
import { getPublicArasTracking } from "@/app/actions/cargo-tracking";

interface ModalProps {
  trackingNo: string;
  onClose: () => void;
}

interface TimelineEvent {
  id: string;
  date: string;
  branch: string;
  status: string;
  isCurrent: boolean;
}

interface TrackingData {
  trackingNo: string;
  currentStatus: string;
  timeline: TimelineEvent[];
}

export default function ArasTimelineModal({ trackingNo, onClose }: ModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchTracking = async () => {
      setLoading(true);
      setError(null);
      
      const result = await getPublicArasTracking(trackingNo);
      
      if (isMounted) {
        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.error || "Kargo bilgisi bulunamadı.");
        }
        setLoading(false);
      }
    };

    fetchTracking();

    return () => { isMounted = false; };
  }, [trackingNo]);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-sm">
      <div className="bg-white border-4 border-slate-300 shadow-xl w-full max-w-2xl rounded-none flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="bg-slate-900 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-[#dc3545]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            <h2 className="text-white font-black tracking-widest uppercase text-sm sm:text-base">
              ARAS KARGO CANLI TAKİP
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-[#dc3545] rounded-full animate-spin"></div>
              <span className="text-xs font-black text-slate-500 tracking-widest">ARAS SUNUCULARINA BAĞLANILIYOR...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-2 border-[#dc3545] p-6 text-center">
              <p className="text-[#dc3545] font-black uppercase tracking-widest">{error}</p>
            </div>
          ) : data ? (
            <div className="flex flex-col gap-6">
              
              {/* TAKİP BİLGİ KARTI */}
              <div className="bg-white border-2 border-slate-200 p-4 flex justify-between items-center shadow-sm">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">TAKİP NUMARASI</span>
                  <span className="text-xl font-black font-mono text-slate-900">{data.trackingNo}</span>
                </div>
                <div className="text-right">
                  <span className="bg-blue-100 text-blue-800 px-3 py-1.5 text-[10px] font-black tracking-widest border border-blue-200">
                    {data.currentStatus}
                  </span>
                </div>
              </div>

              {/* TIMELINE (ZAMAN ÇİZELGESİ) */}
              <div className="bg-white border-2 border-slate-300 border-l-4 border-l-[#dc3545] p-5 shadow-sm">
                <div className="flex flex-col gap-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  
                  {data.timeline.map((event) => (
                    <div key={event.id} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${event.isCurrent ? 'is-active' : ''}`}>
                      <div className={`flex items-center justify-center w-5 h-5 rounded-full border-4 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${event.isCurrent ? 'bg-[#dc3545] text-slate-500' : 'bg-slate-300'}`}></div>
                      <div className={`w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 border-2 ${event.isCurrent ? 'border-[#dc3545] bg-red-50' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className={`font-black text-xs uppercase ${event.isCurrent ? 'text-slate-900' : 'text-slate-600'}`}>{event.branch}</div>
                          <div className={`text-[10px] font-mono font-bold ${event.isCurrent ? 'text-slate-500' : 'text-slate-400'}`}>{event.date}</div>
                        </div>
                        <div className={`text-[10px] uppercase font-bold ${event.isCurrent ? 'text-[#dc3545] tracking-widest' : 'text-slate-600'}`}>
                          {event.status}
                        </div>
                      </div>
                    </div>
                  ))}

                </div>
              </div>

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}