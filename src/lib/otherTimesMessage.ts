// Mensagem de "Pedir outras opções de horário" (página pública → WhatsApp do profissional),
// com a data e o horário que o cliente gostaria. Testada em scripts/test-other-times.ts.

export const DEFAULT_OTHER_TIMES_TEMPLATE =
  "Olá! Gostaria de agendar {servico}, mas nenhum dos horários sugeridos serve para mim. Poderia me enviar outras opções de horário?";

// Opções de horário desejado, de hora em hora (só para o cliente indicar a preferência; não precisa estar livre)
export const DESIRED_HOURS = Array.from({ length: 16 }, (_, i) => `${String(i + 6).padStart(2, "0")}:00`); // 06:00 a 21:00

export const buildOtherTimesMessage = (opts: {
  template?: string;
  servicos: string;
  desiredDate: string; // "YYYY-MM-DD" ou ""
  desiredTime: string; // "HH:MM" ou ""
}): string => {
  const template = opts.template?.trim() || DEFAULT_OTHER_TIMES_TEMPLATE;
  const [dy, dm, dd] = opts.desiredDate.split("-");
  const dateLabel = opts.desiredDate && dy && dm && dd ? `${dd}/${dm}/${dy}` : "";
  const timeLabel = /^\d{2}:\d{2}$/.test(opts.desiredTime) ? opts.desiredTime : "";

  let message = template
    .replace(/{servico}/g, opts.servicos || "um horário")
    .replace(/{data}/g, dateLabel || "uma data a combinar")
    .replace(/{horario}/g, timeLabel || "um horário a combinar");

  const needDate = !!dateLabel && !template.includes("{data}");
  const needTime = !!timeLabel && !template.includes("{horario}");
  if (needDate && needTime) message += ` Data e horário que eu gostaria: ${dateLabel} às ${timeLabel}.`;
  else if (needDate) message += ` Data que eu gostaria: ${dateLabel}.`;
  else if (needTime) message += ` Horário que eu gostaria: ${timeLabel}.`;
  return message;
};
