import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";
import type { User } from "firebase/auth";

export interface Account {
  uid: string;
  email: string;
  displayName: string;
  accountTypes: Array<"customer" | "professional">;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface CustomerAccount {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export async function getOrCreateAccount(user: User): Promise<Account> {
  const ref = doc(db, "accounts", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as Account;
  }
  const account: Account = {
    uid: user.uid,
    email: user.email ?? "",
    displayName:
      user.displayName ?? user.email?.split("@")[0] ?? "Usuário",
    accountTypes: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, account);
  return account;
}

export async function addAccountType(
  uid: string,
  type: "customer" | "professional"
): Promise<void> {
  const ref = doc(db, "accounts", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, {
    accountTypes: arrayUnion(type),
    updatedAt: serverTimestamp(),
  });
}

export async function getCustomerAccount(
  uid: string
): Promise<CustomerAccount | null> {
  const snap = await getDoc(doc(db, "customerAccounts", uid));
  return snap.exists() ? (snap.data() as CustomerAccount) : null;
}

export async function getOrCreateCustomerAccount(
  user: User,
  name?: string
): Promise<CustomerAccount> {
  const ref = doc(db, "customerAccounts", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as CustomerAccount;
  const ca: CustomerAccount = {
    uid: user.uid,
    name: name ?? user.displayName ?? user.email?.split("@")[0] ?? "Cliente",
    email: user.email ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, ca);
  return ca;
}

/** Validates a returnUrl is an internal safe path (no open-redirect). */
export function isSafeReturnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.includes("://") || url.startsWith("//")) return false;
  const allowed = ["/portal", "/customer", "/dashboard", "/p/", "/professional"];
  return allowed.some((prefix) => url.startsWith(prefix));
}
