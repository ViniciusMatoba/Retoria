/**
 * Cleans and formats a phone number for the WhatsApp link (wa.me)
 * E.g., "(11) 99999-9999" -> "5511999999999"
 * E.g., "5511999999999" -> "5511999999999"
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, "");

  if (!cleaned) return "";

  // If the number doesn't start with 55 (and has 10 or 11 digits, typical for BR mobile), add 55
  if ((cleaned.length === 10 || cleaned.length === 11) && !cleaned.startsWith("55")) {
    cleaned = "55" + cleaned;
  }

  return cleaned;
}

/**
 * Generates a WhatsApp wa.me link with a pre-filled message
 */
export function getWhatsAppLink(phone: string, message: string): string {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedText}`;
}

/**
 * Máscara dinâmica aplicada enquanto o usuário digita: (DD) DDDDD-DDDD
 * Aceita até 11 dígitos (celular) ou 10 (fixo).
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  // 11 dígitos — celular com 9
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Formats a raw phone string into a friendly visual format: (DD) XXXXX-XXXX
 */
export function formatPhoneFriendly(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  
  // If it starts with 55, remove it for local visual formatting
  if (cleaned.startsWith("55") && (cleaned.length === 12 || cleaned.length === 13)) {
    cleaned = cleaned.substring(2);
  }

  if (cleaned.length === 11) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
  }
  
  return phone;
}
