import Link from "next/link";
import { Calendar, ArrowRight, CheckCircle2, Smartphone, ShieldCheck, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 font-sans relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 translate-x-1/2 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="max-w-7xl w-full mx-auto px-6 h-20 flex items-center justify-between z-10 border-b border-slate-900/80">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <span className="font-extrabold tracking-tight text-xl bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Retoria</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-semibold text-slate-400 hover:text-white transition-all">
            Entrar
          </Link>
          <Link href="/register" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.97]">
            Começar Grátis
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 md:py-24 flex flex-col items-center text-center justify-center z-10 space-y-8">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 rounded-full text-xs font-semibold tracking-wide">
          <Zap className="h-3.5 w-3.5 animate-pulse" />
          <span>Agenda + WhatsApp simplificados</span>
        </div>

        {/* Hero Title */}
        <div className="space-y-4 max-w-3xl">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Evite perder clientes por falta de resposta no WhatsApp
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Tenha uma página profissional de pré-atendimento. Seus clientes escolhem o serviço, o horário, preenchem os dados e enviam para o seu WhatsApp com tudo pronto.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md pt-2">
          <Link 
            href="/register" 
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-base transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
          >
            <span>Criar minha página grátis</span>
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link 
            href="/login" 
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-4 bg-slate-900 hover:bg-slate-800 text-slate-350 border border-slate-800 font-semibold rounded-2xl text-base transition-all active:scale-[0.98]"
          >
            Acessar painel
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 w-full text-left">
          
          {/* Card 1 */}
          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-3xl backdrop-blur-sm space-y-3">
            <div className="h-10 w-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-100">Link wa.me inteligente</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              O cliente é redirecionado para o seu número com a mensagem pronta com todos os detalhes já preenchidos.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-3xl backdrop-blur-sm space-y-3">
            <div className="h-10 w-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-100">Controle de Leads</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Os dados de agendamento são salvos no banco antes do redirecionamento. Você nunca perde o contato do cliente.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-3xl backdrop-blur-sm space-y-3">
            <div className="h-10 w-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-100">100% Protegido</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Cada profissional faz login individual seguro e visualiza somente seus próprios atendimentos e configurações.
            </p>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-slate-650 z-10 border-t border-slate-950 mt-12">
        <p>&copy; {new Date().getFullYear()} Retoria. Feito com paixão para profissionais autônomos.</p>
      </footer>
    </div>
  );
}
