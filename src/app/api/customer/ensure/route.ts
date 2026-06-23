import { NextRequest, NextResponse } from "next/server";
import { authAdmin, dbAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.slice(7);
    const decoded = await authAdmin.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email ?? "";

    const ref = dbAdmin.collection("customerAccounts").doc(uid);
    const snap = await ref.get();

    if (!snap.exists) {
      await ref.set({
        uid,
        name: decoded.name ?? email.split("@")[0] ?? "Cliente",
        email,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Garante que accounts/{uid} existe e contém "customer" — sem gravação desnecessária
    const accountRef = dbAdmin.collection("accounts").doc(uid);
    const accountSnap = await accountRef.get();
    if (!accountSnap.exists) {
      await accountRef.set({
        uid, email,
        displayName: decoded.name ?? email.split("@")[0] ?? "Cliente",
        accountTypes: ["customer"],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      const data = accountSnap.data();
      // Só grava se "customer" ainda não está presente — verdadeiramente idempotente
      if (!Array.isArray(data?.accountTypes) || !data.accountTypes.includes("customer")) {
        await accountRef.update({
          accountTypes: FieldValue.arrayUnion("customer"),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      // else: nenhuma gravação — updatedAt preservado
    }

    return NextResponse.json({ ok: true, uid });
  } catch (e: any) {
    console.error("[ensure-customer]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
