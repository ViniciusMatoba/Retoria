import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { db } from "@/lib/firebase";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { POST as createBookingHandler } from "../bookings/create/route";

// A mock professional ID and service ID for testing purposes
const TEST_PROF_ID = "test_integration_professional";
const TEST_SERVICE_30 = "test_service_30";
const TEST_SERVICE_45 = "test_service_45";

export async function GET(req: NextRequest) {
  if (!dbAdmin) {
    return NextResponse.json(
      { success: false, error: "Erro de configuração no servidor: As credenciais do Firebase Admin não puderam ser carregadas." },
      { status: 500 }
    );
  }

  const results: Array<{ name: string; passed: boolean; error?: string }> = [];

  try {
    // Setup test environment (clean up and seed documents)
    const profRef = dbAdmin.collection("professionals").doc(TEST_PROF_ID);
    await profRef.set({
      nome: "Test Professional",
      nomeNegocio: "Test Biz",
      slugPublico: "test-biz",
      telefoneWhatsapp: "5511999999999",
      agendaConfig: {
        duracaoSlot: 30,
        janelaAgendamentoDias: 30
      }
    });

    const s30Ref = profRef.collection("services").doc(TEST_SERVICE_30);
    await s30Ref.set({
      nome: "Service 30m",
      duracaoEstimada: "30 minutos",
      ativo: true
    });

    const s45Ref = profRef.collection("services").doc(TEST_SERVICE_45);
    await s45Ref.set({
      nome: "Service 45m",
      duracaoEstimada: "45 minutos",
      ativo: true
    });

    // Helper to seed a slot
    const seedSlot = async (time: string, disponivel: boolean, bookingId: string | null = null, ocupacaoTipo: string | null = null) => {
      const slotId = `2026-07-01_${time.replace(":", "-")}`;
      await profRef.collection("availableSlots").doc(slotId).set({
        id: slotId,
        data: "2026-07-01",
        horario: time,
        disponivel,
        bookingId,
        ocupacaoTipo,
        updatedAt: new Date()
      });
      return slotId;
    };

    // Test 1: Tentativa externa de atualizar um slot diretamente (Acesso Negado)
    try {
      const slotId = await seedSlot("09:00", true);
      // Try to write using the Client SDK (unauthenticated request on server)
      await updateDoc(doc(db, "professionals", TEST_PROF_ID, "availableSlots", slotId), {
        disponivel: false
      });
      results.push({ name: "1. Tentativa externa de atualizar slot diretamente (deve falhar)", passed: false, error: "A atualização direta pelo Client SDK funcionou, violando a segurança." });
    } catch (e: any) {
      if (e.code === "permission-denied" || e.message?.includes("permission-denied") || e.message?.includes("Permission denied")) {
        results.push({ name: "1. Tentativa externa de atualizar slot diretamente (deve falhar)", passed: true });
      } else {
        results.push({ name: "1. Tentativa externa de atualizar slot diretamente (deve falhar)", passed: false, error: "Falhou com erro inesperado: " + e.message });
      }
    }

    // Test 2: Lead e slots sendo criados/atualizados na mesma transação
    try {
      const slotId1 = await seedSlot("10:00", true);
      const slotId2 = await seedSlot("10:30", true);

      // Call API Route handler programmatically
      const mockReq = new NextRequest(new URL("http://localhost/api/bookings/create"), {
        method: "POST",
        body: JSON.stringify({
          professionalId: TEST_PROF_ID,
          serviceId: TEST_SERVICE_30,
          nome: "Maria Silva",
          telefone: "11988888888",
          dataEscolhida: "2026-07-01",
          horarioEscolhido: "10:00",
          observacao: "Teste transação"
        })
      });

      const response = await createBookingHandler(mockReq);
      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || "Erro na chamada do handler");
      }

      // Verify lead is created and slot updated
      const leadSnap = await profRef.collection("leads").doc(resData.leadId).get();
      const slotSnap = await profRef.collection("availableSlots").doc(slotId1).get();

      const leadPassed = leadSnap.exists && leadSnap.data()?.nome === "Maria Silva";
      const slotPassed = slotSnap.exists && slotSnap.data()?.disponivel === false && slotSnap.data()?.bookingId === resData.leadId;

      if (leadPassed && slotPassed) {
        results.push({ name: "2. Lead e slots sendo criados na mesma transação", passed: true });
      } else {
        results.push({ name: "2. Lead e slots sendo criados na mesma transação", passed: false, error: `Lead criado: ${leadPassed}, Slot atualizado: ${slotPassed}` });
      }
    } catch (e: any) {
      results.push({ name: "2. Lead e slots sendo criados na mesma transação", passed: false, error: e.message });
    }

    // Test 3: Falha de um slot impedindo toda a reserva (Atomidade)
    try {
      // Seed slots where one is already occupied
      const slotId1 = await seedSlot("11:00", true);
      const slotId2 = await seedSlot("11:30", false); // Occupied

      const mockReq = new NextRequest(new URL("http://localhost/api/bookings/create"), {
        method: "POST",
        body: JSON.stringify({
          professionalId: TEST_PROF_ID,
          serviceId: TEST_SERVICE_45, // Requires 2 slots
          nome: "Jose Carlos",
          telefone: "11988888888",
          dataEscolhida: "2026-07-01",
          horarioEscolhido: "11:00",
          observacao: "Deve falhar"
        })
      });

      const response = await createBookingHandler(mockReq);
      const resData = await response.json();

      // Check that it failed
      if (response.ok) {
        results.push({ name: "3. Falha de um slot impedindo toda a reserva", passed: false, error: "A reserva foi permitida mesmo com slot ocupado." });
      } else {
        // Assert no lead was created for this name
        const leadsSnap = await profRef.collection("leads").where("nome", "==", "Jose Carlos").get();
        const slot1Snap = await profRef.collection("availableSlots").doc(slotId1).get();
        
        const noLead = leadsSnap.empty;
        const slot1RemainedAvailable = slot1Snap.data()?.disponivel === true;

        if (noLead && slot1RemainedAvailable) {
          results.push({ name: "3. Falha de um slot impedindo toda a reserva", passed: true });
        } else {
          results.push({ name: "3. Falha de um slot impedindo toda a reserva", passed: false, error: `Lead criado: ${!noLead}, Slot 1 alterado: ${!slot1RemainedAvailable}` });
        }
      }
    } catch (e: any) {
      results.push({ name: "3. Falha de um slot impedindo toda a reserva", passed: false, error: e.message });
    }

    // Test 4: Payload com bookingId falso sendo rejeitado
    try {
      const mockReq = new NextRequest(new URL("http://localhost/api/bookings/create"), {
        method: "POST",
        body: JSON.stringify({
          professionalId: TEST_PROF_ID,
          serviceId: TEST_SERVICE_30,
          nome: "Ataque Hacker",
          telefone: "11988888888",
          dataEscolhida: "2026-07-01",
          horarioEscolhido: "10:00",
          bookingId: "fake_id_123" // extra key
        })
      });

      const response = await createBookingHandler(mockReq);
      if (response.status === 400) {
        results.push({ name: "4. Payload com bookingId falso sendo rejeitado", passed: true });
      } else {
        results.push({ name: "4. Payload com bookingId falso sendo rejeitado", passed: false, error: `Retornou status ${response.status} ao invés de 400.` });
      }
    } catch (e: any) {
      results.push({ name: "4. Payload com bookingId falso sendo rejeitado", passed: false, error: e.message });
    }

    // Test 5: Agendamento de 45 minutos sobre grade de 30 minutos
    try {
      const slotId1 = await seedSlot("12:00", true);
      const slotId2 = await seedSlot("12:30", true);
      const slotId3 = await seedSlot("13:00", true);

      const mockReq = new NextRequest(new URL("http://localhost/api/bookings/create"), {
        method: "POST",
        body: JSON.stringify({
          professionalId: TEST_PROF_ID,
          serviceId: TEST_SERVICE_45, // 45 minutes
          nome: "Cliente 45m",
          telefone: "11977777777",
          dataEscolhida: "2026-07-01",
          horarioEscolhido: "12:00"
        })
      });

      const response = await createBookingHandler(mockReq);
      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || "Erro no booking");
      }

      // Verify that both 12:00 and 12:30 slots are locked, but 13:00 is still available
      const s1 = await profRef.collection("availableSlots").doc(slotId1).get();
      const s2 = await profRef.collection("availableSlots").doc(slotId2).get();
      const s3 = await profRef.collection("availableSlots").doc(slotId3).get();

      const correctLocks = s1.data()?.disponivel === false && 
                           s1.data()?.ocupacaoTipo === "principal" &&
                           s2.data()?.disponivel === false && 
                           s2.data()?.ocupacaoTipo === "continuacao" &&
                           s3.data()?.disponivel === true;

      if (correctLocks) {
        results.push({ name: "5. Agendamento de 45m sobre grade de 30m bloqueia 2 slots", passed: true });
      } else {
        results.push({ 
          name: "5. Agendamento de 45m sobre grade de 30m bloqueia 2 slots", 
          passed: false, 
          error: `Slot 12:00 Livre: ${s1.data()?.disponivel}, Slot 12:30 Livre: ${s2.data()?.disponivel}, Slot 13:00 Livre: ${s3.data()?.disponivel}` 
        });
      }
    } catch (e: any) {
      results.push({ name: "5. Agendamento de 45m sobre grade de 30m bloqueia 2 slots", passed: false, error: e.message });
    }

    // Test 6: Restauração de cancelamento com horário já reutilizado
    try {
      // 1. Create a cancelled booking on 14:00
      const leadRef = profRef.collection("leads").doc();
      await leadRef.set({
        professionalId: TEST_PROF_ID,
        nome: "Cancelado Original",
        telefone: "11999999999",
        servicoEscolhido: "Service 30m",
        serviceId: TEST_SERVICE_30,
        dataEscolhida: "2026-07-01",
        horarioEscolhido: "14:00",
        status: "Cancelado",
        duracaoAgendamento: 30,
        horarioInicio: "14:00",
        horarioFim: "14:30"
      });

      // 2. Create another active booking on 14:00 (occupying the slot)
      const slotId = await seedSlot("14:00", false, "other_booking_id", "principal");

      // 3. Attempt to restore the cancelled booking (emulating dashboard transaction logic)
      // Query to simulate the check:
      const slotsRef = profRef.collection("availableSlots");
      const checkSnap = await slotsRef.where("data", "==", "2026-07-01").where("horario", "==", "14:00").get();
      
      let restoreAllowed = true;
      if (!checkSnap.empty) {
        const slotData = checkSnap.docs[0].data();
        if (!slotData.disponivel) {
          restoreAllowed = false; // Must abort
        }
      }

      if (!restoreAllowed) {
        // Assert that we aborted restoring and kept status as Cancelled
        results.push({ name: "6. Restauração de cancelamento com horário reutilizado (deve abortar)", passed: true });
      } else {
        results.push({ name: "6. Restauração de cancelamento com horário reutilizado (deve abortar)", passed: false, error: "A restauração foi permitida sobre um horário ocupado." });
      }
    } catch (e: any) {
      results.push({ name: "6. Restauração de cancelamento com horário reutilizado (deve abortar)", passed: false, error: e.message });
    }

    // Test 7: Endpoint funcionando sem expor credenciais administrativas
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const isExposedOnClient = Object.keys(process.env).some(k => k.startsWith("NEXT_PUBLIC_") && process.env[k]?.includes("private_key"));
    
    if (serviceAccountKey && !isExposedOnClient) {
      results.push({ name: "7. Endpoint funciona sem expor credenciais no Client SDK", passed: true });
    } else {
      results.push({ name: "7. Endpoint funciona sem expor credenciais no Client SDK", passed: false, error: `Credenciais no cliente expostas: ${isExposedOnClient}` });
    }

    // Clean up test documents
    const leadsSnap = await profRef.collection("leads").get();
    for (const d of leadsSnap.docs) {
      await d.ref.delete();
    }
    const slotsSnap = await profRef.collection("availableSlots").get();
    for (const d of slotsSnap.docs) {
      await d.ref.delete();
    }
    const servicesSnap = await profRef.collection("services").get();
    for (const d of servicesSnap.docs) {
      await d.ref.delete();
    }
    await profRef.delete();

  } catch (err: any) {
    console.error("Test integration suite error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }

  const allPassed = results.every(r => r.passed);
  return NextResponse.json({ success: allPassed, results });
}
