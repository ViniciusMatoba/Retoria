"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { Calendar, ArrowRight, CheckCircle2, Smartphone, Users, Zap, Star } from "lucide-react";

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.15 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

export default function Home() {
  useReveal();

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 font-sans relative overflow-hidden">

      {/* ── Animated background glows ─────────────────────────────────── */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none animate-glow-pulse"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)" }} />
      <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none animate-glow-pulse"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)", animationDelay: "2s" }} />
      <div className="absolute bottom-0 left-1/3 w-[350px] h-[350px] rounded-full blur-[100px] pointer-events-none animate-glow-pulse"
        style={{ background: "radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)", animationDelay: "4s" }} />

      {/* ── Floating decorative shapes (hidden on mobile) ─────────────── */}
      <div className="hidden md:block absolute top-28 right-[8%] w-14 h-14 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 animate-float pointer-events-none" />
      <div className="hidden md:block absolute top-56 right-[15%] w-6 h-6 rounded-full bg-purple-500/20 animate-float-slow pointer-events-none" style={{ animationDelay: "1.5s" }} />
      <div className="hidden md:block absolute top-40 left-[6%] w-10 h-10 rounded-xl border border-purple-500/15 bg-purple-500/5 animate-float pointer-events-none" style={{ animationDelay: "3s" }} />
      <div className="hidden md:block absolute top-72 left-[12%] w-4 h-4 rounded-full bg-indigo-400/20 animate-float-slow pointer-events-none" style={{ animationDelay: "0.8s" }} />

      {/* ── Navigation Header ─────────────────────────────────────────── */}
      <header className="max-w-7xl w-full mx-auto px-6 h-20 flex items-center justify-between z-10 border-b border-slate-900/80 animate-fade-in">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <span className="font-extrabold tracking-tight text-xl text-white">Retoria</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-semibold text-slate-400 hover:text-white transition-all">
            Entrar
          </Link>
          <Link href="/register" className="btn-shine px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.97]">
            Solicitar acesso
          </Link>
        </div>
      </header>

      {/* ── Hero Section ──────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-16 md:py-28 flex flex-col items-center text-center justify-center z-10 space-y-8">

        {/* Badge */}
        <div className="animate-fade-up inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 rounded-full text-xs font-semibold tracking-wide"
          style={{ animationDelay: "0.1s" }}>
          <Zap className="h-3.5 w-3.5 animate-pulse" />
          <span>Pré-atendimento profissional via WhatsApp</span>
        </div>

        {/* Hero Title */}
        <div className="space-y-5 max-w-3xl animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] shimmer-text">
            Evite perder clientes por falta de resposta no WhatsApp
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Tenha uma página profissional de pré-atendimento. Seus clientes escolhem o serviço, o horário, preenchem os dados e enviam para o seu WhatsApp com tudo pronto.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md pt-2 animate-fade-up" style={{ animationDelay: "0.35s" }}>
          <Link
            href="/register"
            className="btn-shine w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-base transition-all shadow-xl shadow-indigo-500/25 active:scale-[0.98]"
          >
            <span>Quero começar agora</span>
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-4 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 font-semibold rounded-2xl text-base transition-all active:scale-[0.98]"
          >
            Acessar painel
          </Link>
        </div>

        {/* Social proof */}
        <div className="animate-fade-up flex items-center gap-2 text-slate-500 text-xs" style={{ animationDelay: "0.5s" }}>
          <div className="flex -space-x-1">
            {["bg-indigo-500", "bg-purple-500", "bg-pink-500", "bg-blue-500"].map((c, i) => (
              <div key={i} className={`h-6 w-6 rounded-full ${c} border-2 border-slate-950 flex items-center justify-center`}>
                <Star className="h-2.5 w-2.5 text-white" />
              </div>
            ))}
          </div>
          <span>Profissionais autônomos já utilizam o Retoria</span>
        </div>

        {/* ── Feature Cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10 w-full text-left">
          {[
            {
              icon: <Smartphone className="h-5 w-5" />,
              title: "Link wa.me inteligente",
              desc: "O cliente é redirecionado para o seu número com a mensagem pronta, com todos os detalhes já preenchidos.",
              delay: "0s",
            },
            {
              icon: <CheckCircle2 className="h-5 w-5" />,
              title: "Controle de Leads",
              desc: "Os dados de agendamento são salvos no banco antes do redirecionamento. Você nunca perde o contato do cliente.",
              delay: "0.15s",
            },
            {
              icon: <Users className="h-5 w-5" />,
              title: "Histórico de clientes",
              desc: "Cada pedido é salvo com nome, telefone e observações. Você tem acesso ao histórico completo de quem já agendou.",
              delay: "0.3s",
            },
          ].map((card, i) => (
            <div
              key={i}
              className="reveal card-hover bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-sm space-y-3"
              style={{ transitionDelay: card.delay }}
            >
              <div className="h-10 w-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 transition-transform duration-300 group-hover:scale-110">
                {card.icon}
              </div>
              <h3 className="font-bold text-lg text-slate-100">{card.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>

        {/* ── How it works ───────────────────────────────────────────── */}
        <div className="reveal w-full pt-16 space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Como funciona</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Simples para você e para o cliente</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { num: "01", title: "Cliente acessa seu link", desc: "Você compartilha seu link personalizado nas redes sociais, WhatsApp ou cartão de visita." },
              { num: "02", title: "Escolhe serviço e horário", desc: "O cliente seleciona o serviço, a data disponível e o horário — tudo na sua página." },
              { num: "03", title: "Você recebe tudo pronto", desc: "Um lead é salvo no seu painel e o cliente é redirecionado ao seu WhatsApp com a mensagem completa." },
            ].map((step, i) => (
              <div key={i} className={`reveal reveal-delay-${i + 1} flex flex-col items-center text-center gap-3 p-5 rounded-2xl bg-slate-900/30 border border-slate-800/60`}>
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-500/20">
                  {step.num}
                </div>
                <h4 className="font-bold text-slate-100">{step.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA final ──────────────────────────────────────────────── */}
        <div className="reveal w-full mt-8">
          <div className="relative rounded-3xl overflow-hidden p-8 sm:p-12 text-center space-y-6"
            style={{ background: "linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #7c3aed 100%)" }}>
            <div className="absolute inset-0 animate-gradient-bg opacity-60"
              style={{ background: "linear-gradient(135deg, #312e81, #4f46e5, #7c3aed, #4338ca)" }} />
            <div className="relative z-10 space-y-4">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Comece a usar agora, gratuitamente</h2>
              <p className="text-indigo-200 text-sm max-w-md mx-auto">Configure sua página em minutos e comece a receber agendamentos organizados hoje mesmo.</p>
              <Link
                href="/register"
                className="btn-shine inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-indigo-50 text-indigo-700 font-black rounded-2xl text-base transition-all shadow-2xl shadow-black/20 active:scale-[0.98]"
              >
                Criar minha página grátis
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>

      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="py-8 text-center text-xs text-slate-600 z-10 border-t border-slate-900 mt-4">
        <p>&copy; {new Date().getFullYear()} Retoria. Feito com paixão para profissionais autônomos.</p>
      </footer>
    </div>
  );
}
