import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade | Retoria",
  description: "Como o Retoria coleta, usa e protege seus dados, incluindo a integração com o Google Agenda.",
};

const CONTATO = "seikivinicius@gmail.com";

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-200">
      <div className="mx-auto max-w-3xl px-4 py-12 space-y-6 leading-relaxed">
        <Link href="/" className="text-sm text-slate-400 hover:text-white">← Voltar ao Retoria</Link>
        <h1 className="text-3xl font-bold text-white">Política de Privacidade</h1>
        <p className="text-sm text-slate-400">Última atualização: 19 de outubro de 2026</p>

        <p>
          O Retoria (https://retoria.vercel.app) é uma plataforma de agendamento de horários para profissionais
          autônomos e seus clientes. Esta política explica quais dados coletamos, como os usamos e quais são os seus direitos.
          O responsável pelo tratamento dos dados é Vinicius Matoba, contato: {CONTATO}.
        </p>

        <h2 className="text-xl font-semibold text-white pt-4">1. Dados que coletamos</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Profissionais:</strong> nome, e-mail, telefone, dados do negócio, serviços, horários e configurações da agenda.</li>
          <li><strong>Clientes que agendam:</strong> nome, telefone, serviço escolhido, data, horário e observação opcional.</li>
          <li><strong>Notificações:</strong> token do dispositivo, caso o profissional ative notificações push.</li>
        </ul>

        <h2 className="text-xl font-semibold text-white pt-4">2. Integração com o Google Agenda</h2>
        <p>
          Se o profissional optar por conectar sua conta Google, o Retoria solicita o acesso
          <code className="mx-1 rounded bg-slate-800 px-1">https://www.googleapis.com/auth/calendar.events</code>.
          Usamos esse acesso apenas para:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>criar um evento na agenda principal do profissional quando um agendamento é feito ou reagendado;</li>
          <li>remover esse evento quando o agendamento é cancelado ou reagendado.</li>
        </ul>
        <p>
          Não lemos, não copiamos e não armazenamos outros eventos ou informações da sua agenda Google. Guardamos apenas os
          tokens de acesso necessários para criar e remover esses eventos. O profissional pode desconectar a integração a
          qualquer momento no painel do Retoria e também revogar o acesso em{" "}
          <a className="underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.
        </p>
        <p>
          O uso e a transferência de informações recebidas das APIs do Google pelo Retoria seguem a{" "}
          <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
            Política de Dados do Usuário dos Serviços de API do Google
          </a>, incluindo os requisitos de Uso Limitado.
        </p>

        <h2 className="text-xl font-semibold text-white pt-4">3. Como usamos os dados</h2>
        <p>
          Usamos os dados para operar o agendamento, mostrar a agenda ao profissional, enviar notificações sobre novos
          agendamentos e permitir o contato por WhatsApp entre profissional e cliente. Não vendemos dados pessoais nem os
          usamos para publicidade.
        </p>

        <h2 className="text-xl font-semibold text-white pt-4">4. Compartilhamento e armazenamento</h2>
        <p>
          Os dados ficam armazenados em serviços de infraestrutura que utilizamos para operar a plataforma: Google Firebase
          (banco de dados, autenticação e notificações) e Vercel (hospedagem). O profissional dono da agenda tem acesso aos
          dados dos clientes que agendaram com ele. Não compartilhamos dados com terceiros além disso, salvo obrigação legal.
        </p>

        <h2 className="text-xl font-semibold text-white pt-4">5. Seus direitos (LGPD)</h2>
        <p>
          Você pode solicitar acesso, correção, exclusão ou portabilidade dos seus dados, bem como revogar consentimentos,
          enviando um e-mail para {CONTATO}. Responderemos em prazo razoável.
        </p>

        <h2 className="text-xl font-semibold text-white pt-4">6. Segurança e retenção</h2>
        <p>
          Adotamos regras de acesso no banco de dados e comunicação criptografada (HTTPS). Mantemos os dados enquanto a conta
          estiver ativa ou pelo tempo necessário para cumprir obrigações legais, e os excluímos mediante solicitação.
        </p>

        <h2 className="text-xl font-semibold text-white pt-4">7. Alterações</h2>
        <p>Podemos atualizar esta política. A data da última atualização fica sempre indicada no topo desta página.</p>

        <h2 className="text-xl font-semibold text-white pt-4">8. Contato</h2>
        <p>Dúvidas sobre privacidade: {CONTATO}.</p>

        <p className="pt-6 text-sm text-slate-400">
          Veja também os <Link href="/termos" className="underline">Termos de Serviço</Link>.
        </p>
      </div>
    </main>
  );
}
