// components/providers/AuthProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  branchName: string;
  isGlobalAdmin: boolean;
};

type AuthContextType = {
  userProfile: UserProfile | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  userProfile: null,
  isLoading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Oturumun tekrar tekrar yüklenmesini önleyen bellek kilidi
  const isInitializedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async (userId: string, email?: string, meta?: any) => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, branch_id, branches(name)")
          .eq("id", userId)
          .single();

        if (profile && isMounted) {
          const branchData = profile.branches as any;
          const resolvedBranchName = Array.isArray(branchData)
            ? branchData[0]?.name
            : branchData?.name;

          setUserProfile({
            id: userId,
            email: email || "",
            fullName: meta?.full_name || "Faruk Dalkıran",
            role: profile.role || "Developer",
            branchName: resolvedBranchName || "Şube Tanımsız",
            isGlobalAdmin: profile.role === "Developer" || profile.role === "Admin",
          });
        } else if (isMounted) {
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Auth Provider Error:", error);
        if (isMounted) setUserProfile(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          isInitializedRef.current = true;
        }
      }
    };

    const initAuth = async () => {
      // Eğer daha önceden yüklenmişse bir daha loading state'ine sokma
      if (isInitializedRef.current) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await fetchProfile(session.user.id, session.user.email, session.user.user_metadata);
        } else if (isMounted) {
          setUserProfile(null);
          setIsLoading(false);
          isInitializedRef.current = true;
        }
      } catch (err) {
        if (isMounted) {
          setIsLoading(false);
          isInitializedRef.current = true;
        }
      }
    };

    initAuth();

    // Dinleyici: Sekme değişimlerinde, TOKEN_REFRESHED olaylarını ve gereksiz tetiklemeleri tamamen yalıt
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Tarayıcı sekmesine dönüldüğünde veya token yenilendiğinde asla yükleniyor ekranına düşme!
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;

      if (!session?.user) {
        if (isMounted) {
          setUserProfile(null);
          setIsLoading(false);
          isInitializedRef.current = false;
        }
        return;
      }

      // Eğer kullanıcı zaten oturum açmışsa ve ID aynıysa tablodan tekrar profil çekme (Sekme odaklanma koruması)
      if (isInitializedRef.current && userProfile?.id === session.user.id) {
        return;
      }

      if (isMounted) {
        await fetchProfile(session.user.id, session.user.email, session.user.user_metadata);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [userProfile?.id]);

  return (
    <AuthContext.Provider value={{ userProfile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);