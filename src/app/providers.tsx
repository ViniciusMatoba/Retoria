"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Account, CustomerAccount } from "@/lib/accountUtils";

export interface ProfessionalProfile {
  id: string;
  userId: string;
  nome: string;
  nomeNegocio: string;
  slugPublico: string;
  telefoneWhatsapp: string;
  descricaoCurta?: string;
  fotoLogoUrl?: string;
  corPrincipal?: string;
  agendaConfig?: any;
  calendarColorConfig?: any;
  createdAt: any;
  updatedAt: any;
  themeConfig?: any;
  professionalStatus?: "onboarding" | "trial" | "active" | "suspended" | "cancelled";
  plan?: "trial" | "basic" | "professional" | "premium";
  trialStartedAt?: any;
  trialEndsAt?: any;

  // Public info
  publicPhone?: string;
  serviceLocationType?: string;
  publicAddress?: any;
  showResponsibleName?: boolean;
  showWelcomeMessage?: boolean;
  showPublicPhone?: boolean;
  showPublicWhatsApp?: boolean;
  showPublicAddress?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: ProfessionalProfile | null;
  account: Account | null;
  customerProfile: CustomerAccount | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  refreshCustomerProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  account: null,
  customerProfile: null,
  loading: true,
  refreshProfile: async () => {},
  refreshCustomerProfile: async () => {},
  logout: async () => {},
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, "professionals", uid));
      setProfile(snap.exists() ? (snap.data() as ProfessionalProfile) : null);
    } catch {
      setProfile(null);
    }
  };

  const fetchAccount = async (user: User) => {
    try {
      const ref = doc(db, "accounts", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setAccount(snap.data() as Account);
      } else {
        // Auto-create for any authenticated user
        const newAccount: Account = {
          uid: user.uid,
          email: user.email ?? "",
          displayName: user.displayName ?? user.email?.split("@")[0] ?? "Usuário",
          accountTypes: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(ref, newAccount);
        setAccount(newAccount);
      }
    } catch {
      setAccount(null);
    }
  };

  const fetchCustomerProfile = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, "customerAccounts", uid));
      setCustomerProfile(snap.exists() ? (snap.data() as CustomerAccount) : null);
    } catch {
      setCustomerProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  const refreshCustomerProfile = async () => {
    if (user) await fetchCustomerProfile(user.uid);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
    setAccount(null);
    setCustomerProfile(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await Promise.all([
          fetchProfile(currentUser.uid),
          fetchAccount(currentUser),
          fetchCustomerProfile(currentUser.uid),
        ]);
      } else {
        setProfile(null);
        setAccount(null);
        setCustomerProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        account,
        customerProfile,
        loading,
        refreshProfile,
        refreshCustomerProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
