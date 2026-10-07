"use client";

import { useState, useEffect } from "react";
import { CartItem } from "@/types";

export function usePersistentCart(storageKey: string = "wms_b2b_cart") {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. AŞAMA: Sayfa yüklendiğinde LocalStorage'dan sepeti getir (Hydration Mismatch'i önler)
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(storageKey);
      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
    } catch (error) {
      console.error("[WMS_CART_ERROR] Sepet verisi okunamadı:", error);
    } finally {
      setIsLoaded(true);
    }
  }, [storageKey]);

  // 2. AŞAMA: Sepet her değiştiğinde LocalStorage'ı senkronize et
  useEffect(() => {
    if (isLoaded) {
      // Sepet boşaltıldıysa key'i temizle, değilse üstüne yaz
      if (cartItems.length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(cartItems));
      }
    }
  }, [cartItems, isLoaded, storageKey]);

  return { cartItems, setCartItems, isLoaded };
}