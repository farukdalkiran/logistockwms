"use client";

import { createContext, useContext, useEffect, useState } from "react";
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

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && isMounted) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, branch_id, branches(name)")
            .eq("id", session.user.id)
            .single();

          if (profile && isMounted) {
            // TypeScript'in dizi (Array) veya nesne (Object) algılama karmaşasını çözen güvenli okuma bloğu
            const branchData = profile.branches as any;
            const resolvedBranchName = Array.isArray(branchData) 
              ? branchData[0]?.name 
              : branchData?.name;

            setUserProfile({
              id: session.user.id,
              email: session.user.email || "",
              fullName: session.user.user_metadata?.full_name || "Faruk Dalkıran",
              role: profile.role || "Developer",
              branchName: resolvedBranchName || "Şube Tanımsız",
              isGlobalAdmin: profile.role === "Developer" || profile.role === "Admin",
            });
          }
        } else if (isMounted) {
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Auth Provider Error:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchProfile();

    // Kullanıcı çıkış yaparsa veya sekme değiştirirse anında yakala
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && isMounted) {
        setUserProfile(null);
        setIsLoading(false);
      } else if (_event === 'SIGNED_IN') {
        fetchProfile();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ userProfile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

// İstediğimiz bileşenden anında userProfile'ı çekmek için özel hook
export const useAuth = () => useContext(AuthContext);