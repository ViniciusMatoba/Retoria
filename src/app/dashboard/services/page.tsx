"use client";

import React, { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy, getDocs, where } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from "../../providers";
import {
  Plus, Edit2, Trash2, Clock, Check, X, Loader2, AlertCircle, Sparkles,
  ToggleLeft, ToggleRight, Upload, Briefcase, Building2, User,
} from "lucide-react";
import { validateImageFile, buildVersionedImageUrl } from "../../../lib/themeUtils";

interface Service {
  id: string;
  professionalId: string;
  nome: string;
  descricaoCurta: string;
  duracaoEstimada: string;
  ativo: boolean;
  preco?: number | null;
  exibirPreco?: boolean;
  createdAt: any;
  updatedAt: any;
  imagemUrl?: string | null;
  imagemStoragePath?: string | null;
  imagemAlt?: string | null;
  imagemUpdatedAt?: number | null;
  // runtime only — which professional's subcollection this belongs to
  _profId?: string;
  _profNome?: string;
}

interface TeamMemberOption {
  id: string;
  nome: string;
  especialidade?: string;
}

export default function ServicesPage() {
  const { user } = useAuth();

  const [services, setServices] = useState<Service[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState("");
  const [editingProfId, setEditingProfId] = useState(""); // whose subcollection the edit/delete targets

  // "Para quem é este serviço" — owner uid = establishment, member uid = member
  const [targetProfId, setTargetProfId] = useState("");

  // Form fields
  const [nome, setNome] = useState("");
  const [descricaoCurta, setDescricaoCurta] = useState("");
  const [duracaoEstimada, setDuracaoEstimada] = useState("30 min");
  const [ativo, setAtivo] = useState(true);
  const [preco, setPreco] = useState<string>("");
  const [exibirPreco, setExibirPreco] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [existingImageStoragePath, setExistingImageStoragePath] = useState("");
  const [removeImageMarked, setRemoveImageMarked] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");

  const hasTeam = teamMembers.length > 0;

  // ── Load team members ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchTeam = async () => {
      try {
        const q = query(
          collection(db, "professionals"),
          where("parentProfessionalId", "==", user.uid),
          where("role", "==", "team_member"),
          where("professionalStatus", "==", "active"),
        );
        const snap = await getDocs(q);
        setTeamMembers(snap.docs.map((d) => ({
          id: d.id,
          nome: d.data().nome ?? "",
          especialidade: d.data().teamConfig?.especialidade ?? d.data().especialidade ?? "",
        })));
      } catch {
        // No team / error — treat as solo
      }
    };
    fetchTeam();
  }, [user]);

  // ── Load services (owner + all members) ───────────────────────────────────
  const loadAllServices = useCallback(async () => {
    if (!user) return;

    const allProfs: TeamMemberOption[] = [
      { id: user.uid, nome: "Estabelecimento" },
      ...teamMembers,
    ];

    const allServices: Service[] = [];

    for (const prof of allProfs) {
      try {
        const snap = await getDocs(
          query(collection(db, "professionals", prof.id, "services"), orderBy("nome", "asc"))
        );
        snap.forEach((d) => {
          allServices.push({
            id: d.id,
            _profId: prof.id,
            _profNome: prof.nome,
            ...d.data(),
          } as Service);
        });
      } catch {
        // skip if subcollection missing
      }
    }

    setServices(allServices);
    setLoading(false);
  }, [user, teamMembers]);

  useEffect(() => {
    if (user) loadAllServices();
  }, [loadAllServices, user]);

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const resetForm = () => {
    setNome(""); setDescricaoCurta(""); setDuracaoEstimada("30 min"); setAtivo(true);
    setPreco(""); setExibirPreco(true); setImageFile(null); setImagePreview(""); setImageAlt("");
    setExistingImageUrl(""); setExistingImageStoragePath(""); setRemoveImageMarked(false);
    setError("");
  };

  const openAddModal = () => {
    setModalMode("add");
    setEditingId("");
    setEditingProfId("");
    setTargetProfId(user?.uid ?? "");
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setModalMode("edit");
    setEditingId(service.id);
    setEditingProfId(service._profId ?? user?.uid ?? "");
    setTargetProfId(service._profId ?? user?.uid ?? "");
    setNome(service.nome);
    setDescricaoCurta(service.descricaoCurta);
    setDuracaoEstimada(service.duracaoEstimada);
    setAtivo(service.ativo);
    setPreco(service.preco != null ? String(service.preco) : "");
    setExibirPreco(service.exibirPreco ?? true);
    setImageFile(null);
    setImagePreview(service.imagemUrl ? buildVersionedImageUrl(service.imagemUrl, service.imagemUpdatedAt) : "");
    setImageAlt(service.imagemAlt || "");
    setExistingImageUrl(service.imagemUrl || "");
    setExistingImageStoragePath(service.imagemStoragePath || "");
    setRemoveImageMarked(false);
    setError("");
    setIsModalOpen(true);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError("");
    setFormLoading(true);

    if (!nome.trim()) {
      setError("Por favor, preencha o nome do serviço.");
      setFormLoading(false);
      return;
    }

    const profId = modalMode === "add" ? (targetProfId || user.uid) : editingProfId;
    // "Estabelecimento" com equipe = todos os profissionais
    const isEstabelecimento = modalMode === "add" && profId === user.uid && hasTeam;
    const targetProfIds = isEstabelecimento
      ? [user.uid, ...teamMembers.map((m) => m.id)]
      : [profId];

    try {
      let serviceId = editingId;

      if (modalMode === "add") {
        // Gera o ID uma vez; todas as cópias compartilham o mesmo ID
        const tempRef = doc(collection(db, "professionals", profId, "services"));
        serviceId = tempRef.id;
        const precoNum = preco.trim() !== "" ? parseFloat(preco.replace(",", ".")) : null;

        for (const pid of targetProfIds) {
          const newDocRef = doc(db, "professionals", pid, "services", serviceId);
          await setDoc(newDocRef, {
            id: serviceId,
            professionalId: pid,
            nome: nome.trim(),
            descricaoCurta: descricaoCurta.trim(),
            duracaoEstimada: duracaoEstimada.trim(),
            ativo,
            preco: precoNum,
            exibirPreco,
            createdAt: new Date(),
            updatedAt: new Date(),
            imagemUrl: null,
            imagemStoragePath: null,
            imagemAlt: null,
            imagemUpdatedAt: null,
            ...(isEstabelecimento ? { isEstabelecimento: true } : {}),
          });
        }
      } else {
        const precoNum = preco.trim() !== "" ? parseFloat(preco.replace(",", ".")) : null;
        await updateDoc(doc(db, "professionals", profId, "services", serviceId), {
          nome: nome.trim(), descricaoCurta: descricaoCurta.trim(),
          duracaoEstimada: duracaoEstimada.trim(), ativo, preco: precoNum, exibirPreco,
          updatedAt: new Date(),
        });
      }

      // Imagem: upload uma vez no owner (profId), propaga URL para todas as cópias
      const primaryDocRef = doc(db, "professionals", profId, "services", serviceId);

      if (removeImageMarked && existingImageStoragePath) {
        try { await deleteObject(ref(storage, existingImageStoragePath)); } catch {}
        for (const pid of targetProfIds) {
          await updateDoc(doc(db, "professionals", pid, "services", serviceId), { imagemUrl: null, imagemStoragePath: null, imagemAlt: null, imagemUpdatedAt: Date.now() });
        }
      }

      if (imageFile) {
        const storagePath = `services/${profId}/${serviceId}/cover`;
        const fileRef = ref(storage, storagePath);
        await uploadBytes(fileRef, imageFile);
        const downloadUrl = await getDownloadURL(fileRef);
        const imgPayload = { imagemUrl: downloadUrl, imagemStoragePath: storagePath, imagemAlt: imageAlt.trim() || nome.trim(), imagemUpdatedAt: Date.now() };
        for (const pid of targetProfIds) {
          await updateDoc(doc(db, "professionals", pid, "services", serviceId), imgPayload);
        }
      } else if (!removeImageMarked && modalMode === "edit" && existingImageUrl) {
        await updateDoc(primaryDocRef, { imagemAlt: imageAlt.trim() || nome.trim(), updatedAt: new Date() });
      }

      setIsModalOpen(false);
      loadAllServices();
    } catch (err: any) {
      setError("Erro ao salvar serviço: " + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // ── Toggle / Delete ────────────────────────────────────────────────────────
  const handleToggleAtivo = async (service: Service) => {
    if (!user) return;
    const profId = service._profId ?? user.uid;
    try {
      await updateDoc(doc(db, "professionals", profId, "services", service.id), {
        ativo: !service.ativo, updatedAt: new Date(),
      });
      loadAllServices();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (service: Service) => {
    if (!user || !window.confirm(`Excluir o serviço "${service.nome}"?`)) return;
    const profId = service._profId ?? user.uid;
    setDeleteLoading(service.id);
    try {
      if (service.imagemStoragePath) {
        try { await deleteObject(ref(storage, service.imagemStoragePath)); } catch {}
      }
      await deleteDoc(doc(db, "professionals", profId, "services", service.id));
      loadAllServices();
    } catch (err: any) {
      alert("Erro ao excluir serviço: " + err.message);
    } finally {
      setDeleteLoading(null);
    }
  };

  // ── Label helpers ──────────────────────────────────────────────────────────
  const ownerLabel = "Estabelecimento";
  const getProfLabel = (id: string) => {
    if (id === user?.uid) return ownerLabel;
    return teamMembers.find((m) => m.id === id)?.nome ?? "Membro";
  };

  const isOwner = (id: string) => id === user?.uid;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Serviços</h1>
          <p className="text-sm text-slate-400">
            {hasTeam
              ? "Gerencie os serviços do estabelecimento e de cada profissional da equipe."
              : "Cadastre e edite os serviços que oferece para os seus clientes."}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Cadastrar Serviço</span>
        </button>
      </div>

      {/* Services List */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-16">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="mt-4 text-slate-400 font-medium">Buscando serviços...</p>
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col justify-center items-center py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
          <div className="p-4 bg-slate-900 rounded-full text-slate-600 mb-4">
            <Sparkles className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-300">Nenhum serviço cadastrado</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm">
            Clique no botão acima para cadastrar o primeiro serviço.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div
              key={`${service._profId}-${service.id}`}
              className={`bg-slate-900/50 border rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden group ${service.ativo ? "border-slate-800 hover:border-slate-700/80 shadow-md" : "border-slate-900/80 opacity-60"}`}
            >
              {/* Owner badge — only shown when team exists */}
              {hasTeam && service._profId && (
                <div className={`absolute top-3 left-3 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${isOwner(service._profId) ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"}`}>
                  {isOwner(service._profId) ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  <span>{getProfLabel(service._profId)}</span>
                </div>
              )}

              {/* Cover Image */}
              <div className={`relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-850 mb-4 shrink-0 ${hasTeam ? "mt-6" : ""}`}>
                {service.imagemUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={buildVersionedImageUrl(service.imagemUrl, service.imagemUpdatedAt)} alt={service.imagemAlt || service.nome} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center text-slate-650 bg-slate-900/40">
                    <Briefcase className="h-8 w-8 text-slate-600 opacity-40 mb-1" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Sem imagem</span>
                  </div>
                )}
              </div>

              {/* Card info */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-lg text-slate-100 group-hover:text-indigo-400 transition-colors truncate">{service.nome}</h3>
                  <button onClick={() => handleToggleAtivo(service)} className="text-slate-400 hover:text-white transition-colors shrink-0" title={service.ativo ? "Desativar" : "Ativar"}>
                    {service.ativo ? <ToggleRight className="h-6 w-6 text-emerald-500" /> : <ToggleLeft className="h-6 w-6 text-slate-600" />}
                  </button>
                </div>
                <p className="text-sm text-slate-400 line-clamp-3 mb-4 min-h-[60px]">{service.descricaoCurta || "Sem descrição cadastrada."}</p>
              </div>

              {/* Bottom actions */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-850">
                    <Clock className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{service.duracaoEstimada}</span>
                  </div>
                  {service.preco != null && (
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(service.preco)}
                      {!service.exibirPreco && <span className="text-slate-500 font-normal">(oculto)</span>}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditModal(service)} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-lg border border-slate-850 hover:border-indigo-500/20 transition-all" title="Editar">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(service)} disabled={deleteLoading === service.id} className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg border border-slate-850 hover:border-red-500/20 transition-all disabled:opacity-50" title="Excluir">
                    {deleteLoading === service.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all">
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-6">
              {modalMode === "add" ? "Novo Serviço" : "Editar Serviço"}
            </h2>

            {error && (
              <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-3 items-center">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* ── Seletor de profissional (só quando há equipe E é novo serviço) ── */}
              {hasTeam && modalMode === "add" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Para quem é este serviço? *</label>
                  <div className="grid gap-2">
                    {/* Estabelecimento */}
                    <button
                      type="button"
                      onClick={() => setTargetProfId(user!.uid)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${targetProfId === user?.uid ? "border-indigo-500 bg-indigo-500/10" : "border-slate-800 hover:border-slate-700"}`}
                    >
                      <Building2 className={`h-5 w-5 shrink-0 ${targetProfId === user?.uid ? "text-indigo-400" : "text-slate-500"}`} />
                      <div>
                        <p className={`text-sm font-bold ${targetProfId === user?.uid ? "text-indigo-300" : "text-slate-300"}`}>Estabelecimento</p>
                        <p className="text-xs text-slate-500">Serviço geral do negócio</p>
                      </div>
                      {targetProfId === user?.uid && <Check className="h-4 w-4 text-indigo-400 ml-auto shrink-0" />}
                    </button>

                    {/* Members */}
                    {teamMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setTargetProfId(m.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${targetProfId === m.id ? "border-amber-500 bg-amber-500/10" : "border-slate-800 hover:border-slate-700"}`}
                      >
                        <User className={`h-5 w-5 shrink-0 ${targetProfId === m.id ? "text-amber-400" : "text-slate-500"}`} />
                        <div>
                          <p className={`text-sm font-bold ${targetProfId === m.id ? "text-amber-300" : "text-slate-300"}`}>{m.nome}</p>
                          {m.especialidade && <p className="text-xs text-slate-500">{m.especialidade}</p>}
                        </div>
                        {targetProfId === m.id && <Check className="h-4 w-4 text-amber-400 ml-auto shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nome do Serviço *</label>
                <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Corte Degradê, Manicure, Consultoria"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 text-sm transition-all" />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Descrição Curta</label>
                <textarea value={descricaoCurta} onChange={(e) => setDescricaoCurta(e.target.value)} placeholder="Explique o que está incluído..." rows={3}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 text-sm transition-all resize-none" />
              </div>

              {/* Duração */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Duração Estimada *</label>
                <input type="text" required value={duracaoEstimada} onChange={(e) => setDuracaoEstimada(e.target.value)} placeholder="Ex: 30 min, 1h, 1h 30min"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 text-sm transition-all" />
              </div>

              {/* Preço */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Preço (Opcional)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 text-sm font-semibold pointer-events-none">R$</span>
                  <input type="text" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value.replace(/[^0-9,.]/g, ""))} placeholder="0,00"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 text-sm transition-all" />
                </div>
              </div>

              {/* Exibir preço */}
              {preco.trim() !== "" && (
                <div className="flex items-center justify-between px-4 py-3 bg-slate-950/60 border border-slate-800/60 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-slate-300">Exibir preço na página pública</p>
                    <p className="text-xs text-slate-500 mt-0.5">Mostra o valor para o cliente durante o agendamento</p>
                  </div>
                  <button type="button" onClick={() => setExibirPreco(!exibirPreco)}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${exibirPreco ? "bg-indigo-600" : "bg-slate-600"}`}>
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${exibirPreco ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              )}

              {/* Ativo */}
              <div className="flex items-center gap-3 pt-2">
                <input type="checkbox" id="ativo" checked={ativo} onChange={(e) => setAtivo(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500" />
                <label htmlFor="ativo" className="text-sm font-semibold text-slate-350 cursor-pointer">Disponível para agendamento (Ativo)</label>
              </div>

              {/* Imagem */}
              <div className="space-y-2 border-t border-slate-800/60 pt-4">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Imagem do Serviço (Opcional)</label>
                {imagePreview ? (
                  <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-955 border border-slate-800 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-all duration-200">
                      <label className="cursor-pointer px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold rounded-lg text-slate-200 transition-all flex items-center gap-1">
                        Alterar
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const res = validateImageFile(file, 2);
                          if (!res.valid) { alert(res.error); return; }
                          setImageFile(file); setImagePreview(URL.createObjectURL(file)); setRemoveImageMarked(false);
                        }} />
                      </label>
                      <button type="button" onClick={() => {
                        if (window.confirm("Remover imagem? Será confirmado ao salvar.")) {
                          setImageFile(null); setImagePreview(""); setRemoveImageMarked(true);
                        }
                      }} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 border border-red-500/30 text-xs font-bold rounded-lg text-white transition-all">
                        Remover
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center aspect-[16/9] w-full border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/20 cursor-pointer hover:border-slate-700 transition-all">
                    <div className="flex flex-col items-center text-center p-4">
                      <Upload className="h-7 w-7 text-slate-500 mb-1.5" />
                      <span className="text-xs font-bold text-slate-400">Selecionar Imagem</span>
                      <span className="text-[10px] text-slate-550 mt-1">JPEG, PNG ou WEBP de até 2MB</span>
                    </div>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const res = validateImageFile(file, 2);
                      if (!res.valid) { alert(res.error); return; }
                      setImageFile(file); setImagePreview(URL.createObjectURL(file)); setRemoveImageMarked(false);
                    }} />
                  </label>
                )}
                {(imagePreview || imageFile) && (
                  <div className="mt-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Descrição alternativa (Acessibilidade)</label>
                    <input type="text" value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} placeholder="Descreva o procedimento"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800/80 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-100 text-xs transition-all" />
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold rounded-xl text-sm transition-all active:scale-[0.98]">
                  Cancelar
                </button>
                <button type="submit" disabled={formLoading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-2">
                  {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : modalMode === "add" ? "Cadastrar" : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
