"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type TransferItem = {
  id: string;
  requested_qty: number;
  sent_qty: number;
  received_qty: number;
  products: {
    id: string;
    barcode: string;
    sku: string | null;
    name: string;
    image_url: string | null;
  };
};

export function useTransferScan(
  empId: string,
  branchName: string,
  isSpectator: boolean = false,
) {
  const [branchId, setBranchId] = useState<string | null>(null);
  const [activeTransfer, setActiveTransfer] = useState<any>(null);
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [mode, setMode] = useState<"outbound" | "inbound" | null>(null);
  const [lastScanned, setLastScanned] = useState<{
    product: any;
    qtyChange: number;
    currentTotal: number;
    reqTotal: number;
    type: "add" | "remove";
  } | null>(null);

  const [isFetching, setIsFetching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [flashState, setFlashState] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  const barcodeResolverCache = useRef(new Map());
  const pendingSyncRef = useRef(new Map<string, any>());
  const isSyncingRef = useRef(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]); // Log State

  // Şube ID Bulma
  useEffect(() => {
    const initBranch = async () => {
      const { data } = await supabase
        .from("branches")
        .select("id")
        .eq("name", branchName)
        .single();
      if (data) setBranchId(data.id);
    };
    initBranch();
  }, [branchName]);

  const playSound = useCallback((type: "success" | "error") => {
    try {
      const AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (err) {
      console.warn("Ses API desteklenmiyor.");
    }
  }, []);

  const triggerFeedback = useCallback(
    (type: "success" | "error", msg: string = "") => {
      playSound(type);
      setFlashState(type);
      if (type === "error") setErrorMsg(msg);
      setTimeout(() => {
        setFlashState("idle");
        if (type === "error") setErrorMsg("");
      }, 1500);
    },
    [playSound],
  );

  // İşlem Loglama (Başarılı & Başarısız) + State Güncelleme
  const logScanEvent = async (
    status: "SUCCESS" | "FAILED",
    barcode: string,
    qty: number,
    type: "ADD" | "REMOVE",
    message = "",
  ) => {
    if (!activeTransfer || !branchId) return;
    
    const newLog = {
      transfer_id: activeTransfer.id,
      employee_id: empId,
      branch_id: branchId,
      barcode,
      scanned_qty: qty,
      scan_type: type,
      status,
      error_message: message,
      created_at: new Date().toISOString()
    };

    // Arka planda veritabanına kaydet (Bekletmeden)
    supabase.from("scan_logs").insert(newLog).then();

    // Okutan kişinin ekranında anında göstermek için state'i güncelle (İzleyici değilse)
    if (!isSpectator) {
      setRecentLogs(prev => [newLog, ...prev].slice(0, 15));
    }
  };

  // İzleyici Modu Canlı Soket Bağlantısı
  useEffect(() => {
    if (!activeTransfer || !isSpectator) return;
    const channel = supabase
      .channel("live-scan-spectator")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "scan_logs",
          filter: `transfer_id=eq.${activeTransfer.id}`,
        },
        async (payload) => {
          const log = payload.new;
          
          // Log'u izleyici ekranına anında ekle (Canlı Akış)
          setRecentLogs(prev => [log, ...prev].slice(0, 15));

          if (log.status === "SUCCESS") {
            playSound("success");
            const { data: pData } = await supabase
              .from("products")
              .select("*")
              .eq("barcode", log.barcode)
              .single();
            if (pData) {
              setLastScanned({
                product: pData,
                qtyChange: log.scanned_qty,
                currentTotal: 0,
                reqTotal: 0,
                type: log.scan_type.toLowerCase() as any,
              });
            }
            const { data } = await supabase
              .from("transfer_items")
              .select(
                `id, requested_qty, sent_qty, received_qty, products(id, barcode, sku, name, image_url)`,
              )
              .eq("transfer_id", activeTransfer.id)
              .order("id");
            if (data) setTransferItems(data as any);
          } else {
            playSound("error");
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTransfer, isSpectator, playSound]);

  const flushPendingSync = async () => {
    if (pendingSyncRef.current.size === 0) return;
    const updates = Array.from(pendingSyncRef.current.entries()).map(
      ([id, payload]) => ({ id, ...payload }),
    );
    pendingSyncRef.current.clear();
    const promises = updates.map((u) =>
      supabase.from("transfer_items").update(u).eq("id", u.id),
    );
    await Promise.allSettled(promises);
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      if (isSyncingRef.current || pendingSyncRef.current.size === 0) return;
      isSyncingRef.current = true;
      try {
        await flushPendingSync();
      } finally {
        isSyncingRef.current = false;
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const startTransferScan = async (code: string) => {
    if (!branchId) return triggerFeedback("error", "Şube ID bulunamadı!");
    if (isFetching) return;
    setIsFetching(true);

    try {
      const { data: tx, error: txError } = await supabase
        .from("transfers")
        .select(
          "id, transfer_code, status, from_branch_id, to_branch_id, created_at, picker_employee_id",
        )
        .eq("transfer_code", code)
        .maybeSingle();

      if (txError || !tx) {
        setIsFetching(false);
        return triggerFeedback(
          "error",
          "Geçersiz veya Bulunamayan Evrak Kodu!",
        );
      }

      let currentMode: "outbound" | "inbound" | null = null;
      const isMNS = tx.transfer_code.startsWith("MNS");

      if (tx.from_branch_id === branchId) currentMode = "outbound";
      else if (tx.to_branch_id === branchId) currentMode = "inbound";
      else if (isMNS || tx.picker_employee_id === empId)
        currentMode = "outbound";

      if (!currentMode) {
        setIsFetching(false);
        return triggerFeedback(
          "error",
          "ERİŞİM REDDEDİLDİ: Bu evrak şubenize ait değil!",
        );
      }

      if (currentMode === "outbound" && tx.status === "Yolda") {
        setIsFetching(false);
        return triggerFeedback("error", "Sevkiyat zaten çıkış yapmış!");
      }
      if (tx.status === "Tamamlandi") {
        setIsFetching(false);
        return triggerFeedback("error", "Sayım evrağı tamamlanıp kapatılmış!");
      }

      const { data: items } = await supabase
        .from("transfer_items")
        .select(
          `id, requested_qty, sent_qty, received_qty, products(id, barcode, sku, name, image_url)`,
        )
        .eq("transfer_id", tx.id)
        .order("id");

      let resolvedFromName = "Özel / Serbest Çıkış";
      let resolvedToName = "Özel / Serbest Hedef";
      const branchIdsToFetch = [tx.from_branch_id, tx.to_branch_id].filter(
        Boolean,
      );
      if (branchIdsToFetch.length > 0) {
        const { data: bData } = await supabase
          .from("branches")
          .select("id, name")
          .in("id", branchIdsToFetch);
        if (tx.from_branch_id)
          resolvedFromName =
            bData?.find((b) => b.id === tx.from_branch_id)?.name ||
            resolvedFromName;
        if (tx.to_branch_id)
          resolvedToName =
            bData?.find((b) => b.id === tx.to_branch_id)?.name ||
            resolvedToName;
      }

      setActiveTransfer({
        ...tx,
        fromName: resolvedFromName,
        toName: resolvedToName,
      });
      setMode(currentMode);
      setTransferItems((items as unknown as TransferItem[]) || []);

      if (tx.status === "Bekliyor" && !isMNS && !isSpectator) {
        await supabase
          .from("transfers")
          .update({ status: "Toplaniyor" })
          .eq("id", tx.id);
      }

      // BAŞLANGIÇTA GEÇMİŞ LOGLARI ÇEK
      const { data: logs } = await supabase
        .from("scan_logs")
        .select("*")
        .eq("transfer_id", tx.id)
        .order("created_at", { ascending: false })
        .limit(15);
      if (logs) setRecentLogs(logs);

    } catch (err) {
      triggerFeedback("error", "Sistem Hatası!");
    } finally {
      setIsFetching(false);
    }
  };

  const processBarcode = async (
    rawBarcode: string,
    currentScanMode: "add" | "remove",
    inputQty: number,
  ) => {
    if (!rawBarcode || isProcessing || isSpectator) return;
    setIsProcessing(true);

    try {
      let targetBarcode = rawBarcode.trim();
      let resolved = barcodeResolverCache.current.get(targetBarcode);

      if (!resolved) {
        const { data: boxData } = await supabase
          .from("boxes")
          .select("product_id, quantity")
          .eq("box_barcode", targetBarcode)
          .maybeSingle();
        if (boxData) {
          const { data: pData } = await supabase
            .from("products")
            .select("id, barcode, sku, name, image_url")
            .eq("id", boxData.product_id)
            .single();
          if (pData) {
            resolved = { product: pData, qtyMulti: boxData.quantity };
            barcodeResolverCache.current.set(targetBarcode, resolved);
            barcodeResolverCache.current.set(pData.barcode, {
              product: pData,
              qtyMulti: 1,
            });
          }
        } else {
          const { data: pData } = await supabase
            .from("products")
            .select("id, barcode, sku, name, image_url")
            .eq("barcode", targetBarcode)
            .maybeSingle();
          if (pData) {
            resolved = { product: pData, qtyMulti: 1 };
            barcodeResolverCache.current.set(targetBarcode, resolved);
          }
        }
      }

      if (!resolved) {
        triggerFeedback("error", "HATA: Ürün sistemde (DB) bulunamadı!");
        await logScanEvent(
          "FAILED",
          targetBarcode,
          inputQty,
          currentScanMode.toUpperCase() as any,
          "Ürün DB'de bulunamadı",
        );
        return;
      }

      const finalQtyToAdd = inputQty * resolved.qtyMulti;
      const qtyChange =
        currentScanMode === "add" ? finalQtyToAdd : -finalQtyToAdd;

      const isMNS = activeTransfer.transfer_code.startsWith("MNS");
      const isFlexibleOutbound = isMNS && mode === "outbound";

      let newItems = [...transferItems];
      let itemIndex = newItems.findIndex(
        (i) => i.products.id === resolved.product.id,
      );

      // --- 1. LİSTEDE OLMAYAN ÜRÜN KONTROLÜ ---
      if (itemIndex === -1) {
        if (isFlexibleOutbound) {
          if (qtyChange < 0) {
            triggerFeedback("error", "Olmayan ürünü iptal edemezsiniz!");
            return;
          }

          const { data: newItem } = await supabase
            .from("transfer_items")
            .insert({
              transfer_id: activeTransfer.id,
              product_id: resolved.product.id,
              requested_qty: qtyChange,
              approved_qty: qtyChange,
              sent_qty: qtyChange,
              received_qty: qtyChange,
              status: "Tamamlandi",
            })
            .select()
            .single();

          if (newItem) {
            const newTxItem: TransferItem = {
              id: newItem.id,
              requested_qty: newItem.requested_qty,
              sent_qty: newItem.sent_qty,
              received_qty: newItem.received_qty,
              products: resolved.product,
            };
            newItems.unshift(newTxItem);
            setTransferItems(newItems);
            setLastScanned({
              product: resolved.product,
              qtyChange,
              currentTotal: qtyChange,
              reqTotal: qtyChange,
              type: currentScanMode,
            });
            triggerFeedback("success");
            await logScanEvent(
              "SUCCESS",
              targetBarcode,
              qtyChange,
              currentScanMode.toUpperCase() as any,
            );
          }
          return;
        } else {
          const msg =
            "AŞIM / HATA: Bu ürün gönderim listesinde (veya transferde) bulunmuyor!";
          triggerFeedback("error", msg);
          await logScanEvent(
            "FAILED",
            targetBarcode,
            inputQty,
            currentScanMode.toUpperCase() as any,
            msg,
          );
          return;
        }
      }

      // --- 2. LİSTEDE OLAN ÜRÜN LİMİT KONTROLLERİ ---
      const item = newItems[itemIndex];
      const currentCount =
        mode === "outbound" ? item.sent_qty : item.received_qty;
      const proposedCount = currentCount + qtyChange;

      if (proposedCount < 0) {
        return triggerFeedback("error", `HATA: Sayım sıfırın altına düşemez.`);
      }

      let updatePayload: any = {};
      let reqLimit = Infinity;

      if (mode === "outbound") {
        reqLimit = isFlexibleOutbound ? Infinity : item.requested_qty;
      } else if (mode === "inbound") {
        reqLimit = item.sent_qty;
      }

      if (proposedCount > reqLimit) {
        if (isFlexibleOutbound) {
          updatePayload = {
            sent_qty: proposedCount,
            received_qty: proposedCount,
            requested_qty: proposedCount,
            approved_qty: proposedCount,
          };
          newItems[itemIndex].sent_qty = proposedCount;
          newItems[itemIndex].received_qty = proposedCount;
          newItems[itemIndex].requested_qty = proposedCount;
        } else {
          const limitName = mode === "outbound" ? "İstenen" : "Gönderilen";
          const msg = `AŞIM KORUMASI: ${limitName} (${reqLimit}) miktarını geçemezsiniz!`;
          triggerFeedback("error", msg);
          await logScanEvent(
            "FAILED",
            targetBarcode,
            inputQty,
            currentScanMode.toUpperCase() as any,
            msg,
          );
          return;
        }
      } else {
        if (mode === "outbound") {
          updatePayload = { sent_qty: proposedCount };
          newItems[itemIndex].sent_qty = proposedCount;
          if (isFlexibleOutbound) {
            updatePayload.requested_qty = proposedCount;
            updatePayload.approved_qty = proposedCount;
            updatePayload.received_qty = proposedCount;
            newItems[itemIndex].requested_qty = proposedCount;
          }
        } else {
          updatePayload = { received_qty: proposedCount };
          newItems[itemIndex].received_qty = proposedCount;
        }
      }

      pendingSyncRef.current.set(item.id, updatePayload);
      setTransferItems(newItems);
      const referenceTotal = isFlexibleOutbound ? proposedCount : reqLimit;
      setLastScanned({
        product: item.products,
        qtyChange: Math.abs(qtyChange),
        currentTotal: proposedCount,
        reqTotal: referenceTotal,
        type: currentScanMode,
      });
      triggerFeedback("success");
      await logScanEvent(
        "SUCCESS",
        targetBarcode,
        finalQtyToAdd,
        currentScanMode.toUpperCase() as any,
      );
    } catch (error) {
      triggerFeedback("error", "İşlem Hatası!");
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    branchId,
    activeTransfer,
    setActiveTransfer,
    transferItems,
    setTransferItems,
    mode,
    lastScanned,
    setLastScanned,
    recentLogs,      // <--- BURA EKLENDİ
    isFetching,
    isProcessing,
    setIsProcessing,
    flashState,
    errorMsg,
    startTransferScan,
    processBarcode,
    flushPendingSync,
  };
}