import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Serviço | Retoria",
  description: "Condições de uso da plataforma de agendamento Retoria.",
};

const CONTATO = "seikivinicius@gmail.com";

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-200">
      <div className="mx-auto max-w-3xl px-4 py-12 space-y-6 leading-relaxed">
        <Link href="/" className="text-sm text-slate-400 hover:text-white">← Voltar ao Retoria</Link>
        <h1 className="text-3xl font-bold text-white">Termos de Serviço</h1>
        <p className="text-sm text-slate-400">Última atualização: 19 de outubro de 2026</p>

        <h2 className="text-xl font-semibold text-white pt-4">1. O serviço</h2>
        <p>
          O Retoria é uma plataforma que permite a profissionais publicar uma página de agendamento, gerenciar horários,
          serviços e clientes, e a clientes reservarem horários. Ao usar o serviço, você concorda com estes termos.
        </p>

        <h2 className="text-xl font-semibold text-white pt-4">2. Contas e responsabilidades</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Você é responsável pelas informações fornecidas e pela segurança do seu acesso.</li>
          <li>O profissional é responsável pelos serviços que oferece, pelos preços e pelo atendimento aos clientes.</li>
          <li>O Retoria intermedia apenas o agendamento e não participa da prestação do serviço nem de pagamentos entre as partes.</li>
        </ul>

        <h2 className="text-xl font-semibold text-white pt-4">3. Uso adequado</h2>
        <p>
          É proibido usar a plataforma para fins ilegais, enviar spam, tentar acessar dados de terceiros ou comprometer a
          segurança e o funcionamento do serviço.
        </p>

        <h2 className="text-xl font-semibold text-white pt-4">4. Integração com o Google Agenda</h2>
        <p>
          A conexão com o Google Agenda é opcional e pode ser desfeita a qualquer momento. O tratamento dos dados está descrito
          na <Link href="/privacidade" className="underline">Política de Privacidade</Link>.
        </p>

        <h2 className="text-xl font-semibold text-white pt-4">5. Disponibilidade e limitação de responsabilidade</h2>
        <p>
          Trabalhamos para manter o serviço disponível, mas ele é oferecido como está, sem garantia de funcionamento
          ininterrupto. Não nos responsabilizamos por perdas decorrentes de indisponibilidade, falhas de serviços de
          terceiros ou conflitos entre profissionais e clientes.
        </p>

        <h2 className="text-xl font-semibold text-white pt-4">6. Alterações e encerramento</h2>
        <p>
          Podemos alterar estes termos ou o serviço. Podemos suspender contas que violem estas regras. Você pode encerrar sua
          conta e solicitar a exclusão dos dados pelo e-mail {CONTATO}.
        </p>

        <h2 className="text-xl font-semibold text-white pt-4">7. Contato</h2>
        <p>{CONTATO}</p>
      </div>
    </main>
  );
}
