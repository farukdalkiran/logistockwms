'use client';

import { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, FileSpreadsheet, AlertTriangle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

/**
 * WMS Zırhlı Türkçe İsim Standardizasyonu (Ultra Agresif)
 */
const normalizeWMSName = (name: string | null | undefined): string => {
  if (!name) return "";
  
  return name.toString().trim()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .toLowerCase()
    .replace(/\s+/g, '');
};

// Excel tarih seri numarasını veya string tarihi ISO formatına (YYYY-MM-DD) çevirici
const parseExcelDate = (dateVal: any): string | null => {
  if (!dateVal) return null;
  
  // Eğer Excel Serial Number ise (Örn: 45892)
  if (typeof dateVal === 'number') {
    const d = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null;
  }
  
  // Eğer GG.AA.YYYY formatındaysa
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (trimmed.includes('.')) {
      const parts = trimmed.split('.');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    // Standart Date string
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }
  return null;
};

export default function LeaveExcelUploader({ branchId, isGlobal }: { branchId: string | null, isGlobal: boolean }) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) throw new Error("Excel dosyası boş veya okunamadı.");

      // WMS İzolasyonu: Aktif personelleri çek
      let query = supabase.from('employees').select('id, full_name').eq('is_active', true);
      if (!isGlobal && branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { data: dbEmployees, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const dbEmpMap = new Map();
      dbEmployees.forEach(emp => {
        const normalizedDbName = normalizeWMSName(emp.full_name);
        if (normalizedDbName) {
          dbEmpMap.set(normalizedDbName, emp.id);
        }
      });

      const safeUpdates: { id: string, leave_balance: number, employment_date?: string }[] = [];
      let missingEmployees = [];

      for (const row of jsonData) {
        const keys = Object.keys(row);
        
        // Kolon eşleştirmeleri (Defensive Programming)
        const nameKey = keys.find(k => normalizeWMSName(k).includes('personel'));
        const dateKey = keys.find(k => normalizeWMSName(k).includes('giris') || normalizeWMSName(k).includes('tarih'));
        const leaveKey = keys.find(k => normalizeWMSName(k).includes('kalan'));

        const rawName = nameKey ? row[nameKey] : null;
        if (!rawName || typeof rawName !== 'string') continue; 
        
        const remaining = parseFloat(leaveKey ? row[leaveKey] : 0) || 0;
        
        // WMS Limit Kontrolü (-14 Gün)
        if (remaining < -14) {
          throw new Error(`"${rawName}" için kalan izin -14'ten düşük olamaz (${remaining}). İşlem durduruldu.`);
        }
        
        const rawDate = dateKey ? row[dateKey] : null;
        const formattedDate = parseExcelDate(rawDate);

        const normalizedExcelName = normalizeWMSName(rawName);
        const matchedId = dbEmpMap.get(normalizedExcelName);

        if (matchedId) {
           const updatePayload: any = {
             id: matchedId,
             leave_balance: remaining
           };
           
           // Eğer Excel'den geçerli bir işe giriş tarihi okunmuşsa payload'a ekle
           if (formattedDate) {
             updatePayload.employment_date = formattedDate;
           }

           safeUpdates.push(updatePayload);
        } else {
           missingEmployees.push(rawName);
        }
      }

      if (safeUpdates.length === 0) {
        throw new Error("Excel'deki hiçbir isim veritabanındaki aktif personellerle eşleşmedi.");
      }

      // --- WMS GÜVENLİ PARALEL GÜNCELLEME (PATCH) ---
      const updatePromises = safeUpdates.map((updateData) => {
        const payload: any = { leave_balance: updateData.leave_balance };
        if (updateData.employment_date) {
          payload.employment_date = updateData.employment_date;
        }

        return supabase
          .from('employees')
          .update(payload) 
          .eq('id', updateData.id);
      });

      const results = await Promise.all(updatePromises);
      
      const firstError = results.find(result => result.error !== null);
      if (firstError && firstError.error) {
         throw new Error(`Veritabanı güncelleme hatası: ${firstError.error.message}`);
      }
      
      let msg = `${safeUpdates.length} personelin bilgileri başarıyla güncellendi.`;
      if (missingEmployees.length > 0) {
        msg += ` Eşleşmeyenler: ${missingEmployees.slice(0,3).join(', ')}${missingEmployees.length > 3 ? '...' : ''}`;
      }
      
      setSuccessMsg(msg);
      setSelectedFile(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Dosya işlenirken kritik bir hata oluştu.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col justify-between overflow-hidden">
      <div className="p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-2">2. Düzenlenmiş Dosyayı Yükle</h3>
        <p className="text-slate-500 text-sm mb-6">
          <strong>PERSONEL ADI SOYADI</strong>, <strong>İŞE GİRİŞ TARİHİ</strong> ve <strong>KALAN İZİN</strong> sütunlarını içeren dosyayı yükleyin. Sistem tarihleri ve izin bakiyelerini güvenle günceller.
        </p>

        {!selectedFile ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-[#dc3545] bg-slate-50 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors group"
          >
            <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-[#dc3545] mb-2 transition-colors" />
            <p className="text-slate-600 font-medium">Tıklayın veya Sürükleyin</p>
            <p className="text-slate-400 text-xs mt-1">.xlsx, .xls</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".xlsx, .xls" 
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-md border border-slate-200">
              <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-slate-800 truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-[#dc3545] text-sm font-medium">
                Kaldır
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 flex items-start gap-2 text-sm text-[#dc3545] bg-red-50 p-3 rounded border border-red-100">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded border border-emerald-100">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{successMsg}</span>
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="px-6 pb-6 mt-auto">
          <button
            onClick={handleProcess}
            disabled={isUploading}
            className="w-full bg-[#dc3545] hover:bg-red-700 active:scale-[0.98] text-white font-bold py-3.5 rounded transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            {isUploading ? (
              <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> İŞLENİYOR...</span>
            ) : (
              <span className="flex items-center gap-2 tracking-wide uppercase text-sm"><CheckCircle2 className="w-5 h-5" /> GÜNCELLEMEYİ BAŞLAT</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}