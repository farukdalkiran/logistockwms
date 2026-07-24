'use client';

import { useState } from 'react';
import { Download, Loader2, Info, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase'; 

export default function LeaveExcelDownloader({ branchId, isGlobal }: { branchId: string | null, isGlobal: boolean }) {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      let query = supabase
        .from('employees')
        .select('full_name, employment_date, leave_balance')
        .eq('is_active', true);
        
      if (!isGlobal && branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data: employees, error } = await query;
      if (error) throw error;

      const exportData = employees.map((emp) => {
        const empDate = emp.employment_date ? new Date(emp.employment_date) : null;
        
        return {
          "PERSONEL ADI SOYADI": emp.full_name || "",
          "İŞE GİRİŞ TARİHİ": empDate ? empDate.toLocaleDateString('tr-TR') : "",
          "KALAN İZİN": emp.leave_balance || 0  // Sistemdeki aktif leave_balance kullanılıyor
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      const wscols = [{wch: 35}, {wch: 20}, {wch: 15}];
      worksheet['!cols'] = wscols;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Yıllık İzinler');
      
      XLSX.writeFile(workbook, `LogiStock_Izin_Sablonu_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('İndirme hatası:', err);
      alert('Şablon oluşturulurken hata oluştu.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden h-full">
      <div className="p-6 flex-1 flex flex-col">
        <h3 className="text-lg font-bold text-slate-800 mb-2">1. Mevcut Durumu İndir</h3>
        <p className="text-slate-500 text-sm mb-6">
          Sisteme kayıtlı personellerin güncel <strong className="text-slate-700">leave_balance</strong> (izin bakiyesi) değerlerini içeren 3 kolonlu basitleştirilmiş Excel şablonunu indirin.
        </p>
        
        <div className="flex flex-col gap-3 mt-auto">
          <div className="flex items-start gap-3 bg-blue-50/50 border border-blue-100 p-4 rounded-md">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-1">Otomatik Hak Ediş</h4>
              <p className="text-xs text-blue-700/80 leading-relaxed text-justify">
                Yükleme sırasında sistem, <strong>İŞE GİRİŞ TARİHİ</strong> alanını baz alarak geçmiş kıdemleri (1-5 Yıl: +14, 6+ Yıl: +20) hesaplar. 
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-yellow-50/50 border border-yellow-200/60 p-4 rounded-md">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-yellow-900 mb-1">Leave Balance Eşitleme</h4>
              <p className="text-xs text-yellow-800/80 leading-relaxed text-justify">
                Sadece sarı renkli <strong>KALAN İZİN</strong> sütununu doldurun. Veritabanındaki <span className="font-mono bg-yellow-200 px-1 rounded text-yellow-900">leave_balance</span> alanı, sizin girdiğiniz bu değerle (Min -14) doğrudan güncellenir.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="px-6 pb-6 mt-auto border-t border-slate-100 pt-5">
        <button
          onClick={handleDownload}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white py-3.5 rounded transition-all font-medium disabled:opacity-50 shadow-sm"
        >
          {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          <span className="tracking-wide uppercase text-sm">{isExporting ? 'Hazırlanıyor...' : 'Şablonu İndir'}</span>
        </button>
      </div>
    </div>
  );
}