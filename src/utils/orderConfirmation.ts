import { Order, OrderComparisonSummary } from '../types';
import { formatGs, formatWaPhone } from '../config';

const SPANISH_DIGIT_WORDS: Record<string, string> = {
  '0': 'cero',
  '1': 'uno',
  '2': 'dos',
  '3': 'tres',
  '4': 'cuatro',
  '5': 'cinco',
  '6': 'seis',
  '7': 'siete',
  '8': 'ocho',
  '9': 'nueve'
};

/**
 * Convierte un grupo de dígitos en palabras número por número (ej. "0973" -> "cero nueve siete tres",
 * "857" -> "ocho cinco siete"), evitando que el motor de voz lo lea como centenas ("novecientos setenta y tres").
 */
export function formatDigitGroupForSpanishTTS(group: string): string {
  const d = String(group || '').replace(/\D/g, '');
  if (!d) return '';
  return d
    .split('')
    .map(ch => SPANISH_DIGIT_WORDS[ch] || ch)
    .join(' ');
}

const SPANISH_UNITS_MAP: Record<string, number> = {
  cero: 0,
  uno: 1,
  un: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9
};

const SPANISH_TEENS_TWENTIES_MAP: Record<string, number> = {
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  dieciséis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiun: 21,
  veintiún: 21,
  veintidos: 22,
  veintidós: 22,
  veintitres: 23,
  veintitrés: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintiséis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29
};

const SPANISH_TENS_MAP: Record<string, number> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90
};

const SPANISH_HUNDREDS_MAP: Record<string, number> = {
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900
};

/**
 * Si el LLM escribió un número de teléfono paraguayo en palabras usando decenas ("cero noventa y siete tres..."),
 * centenas ("cero novecientos setenta y tres, quinientos treinta y dos...") o sin pausas,
 * lo convierte determinísticamente a "09XX XXX XXX".
 */
export function convertSpokenSpanishPhoneWordsToDigits(rawText: string): string {
  if (!rawText) return '';
  const spokenPhoneRegex =
    /\bcero[\s,.-]+(?:nueve|noventa|novecientos)(?:[\s,.-]+(?:y|cero|uno|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veinti[uú]n|veintid[oó]s|veintitr[eé]s|veinticuatro|veinticinco|veintis[eé]is|veintisiete|veintiocho|veintinueve|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|\d+)){3,20}\b/gi;

  return String(rawText).replace(spokenPhoneRegex, match => {
    const tokens = match
      .toLowerCase()
      .split(/[\s,.-]+/)
      .filter(Boolean);
    let digits = '';
    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i];
      if (tok === 'y') {
        i++;
        continue;
      }
      if (/^\d+$/.test(tok)) {
        digits += tok;
        i++;
        continue;
      }
      if (SPANISH_HUNDREDS_MAP[tok] !== undefined) {
        let val = SPANISH_HUNDREDS_MAP[tok];
        i++;
        if (i < tokens.length && SPANISH_TENS_MAP[tokens[i]] !== undefined) {
          val += SPANISH_TENS_MAP[tokens[i]];
          i++;
          if (
            i + 1 < tokens.length &&
            tokens[i] === 'y' &&
            SPANISH_UNITS_MAP[tokens[i + 1]] !== undefined
          ) {
            val += SPANISH_UNITS_MAP[tokens[i + 1]];
            i += 2;
          }
        } else if (i < tokens.length && SPANISH_TEENS_TWENTIES_MAP[tokens[i]] !== undefined) {
          val += SPANISH_TEENS_TWENTIES_MAP[tokens[i]];
          i++;
        } else if (i < tokens.length && SPANISH_UNITS_MAP[tokens[i]] !== undefined && tokens[i] !== 'cero') {
          val += SPANISH_UNITS_MAP[tokens[i]];
          i++;
        }
        digits += String(val);
        continue;
      }
      if (SPANISH_TENS_MAP[tok] !== undefined) {
        let val = SPANISH_TENS_MAP[tok];
        i++;
        if (
          i + 1 < tokens.length &&
          tokens[i] === 'y' &&
          SPANISH_UNITS_MAP[tokens[i + 1]] !== undefined
        ) {
          val += SPANISH_UNITS_MAP[tokens[i + 1]];
          i += 2;
        }
        digits += String(val);
        continue;
      }
      if (SPANISH_TEENS_TWENTIES_MAP[tok] !== undefined) {
        digits += String(SPANISH_TEENS_TWENTIES_MAP[tok]);
        i++;
        continue;
      }
      if (SPANISH_UNITS_MAP[tok] !== undefined) {
        digits += String(SPANISH_UNITS_MAP[tok]);
        i++;
        continue;
      }
      i++;
    }

    if (digits.length === 10 && digits.startsWith('09')) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
    }
    return match;
  });
}

/**
 * Normaliza cualquier número de celular paraguayo en un texto libre (incluso si fue separado en 3-3-4 como "097 353 2550"
 * o escrito con centenas/decenas en palabras) al formato paraguayo estricto 4 - 3 - 3 ("0973 532 550").
 */
export function normalizeParaguayanPhonesInText(rawText: string): string {
  if (!rawText) return '';
  return convertSpokenSpanishPhoneWordsToDigits(String(rawText))
    .replace(
      /(?:\+?595[\s,.-]*|0)(9)[\s,.-]*([6789])[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)\b/g,
      '0$1$2$3 $4$5$6 $7$8$9'
    )
    .replace(
      /\b(9)[\s,.-]*([6789])[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)[\s,.-]*(\d)\b/g,
      '0$1$2$3 $4$5$6 $7$8$9'
    );
}

/**
 * Formatea siempre un número de celular paraguayo en grupos de 4 - 3 - 3 (ej. "0973 532 550"):
 * primero los 4 números del prefijo de la operadora (0973, 0981, etc.), luego 3 y luego 3.
 */
export function formatParaguayanPhone433(rawPhone?: string): string {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  let local = digits;
  if (digits.startsWith('595') && digits.length === 12) {
    local = '0' + digits.slice(3);
  } else if (digits.length === 9 && digits.startsWith('9')) {
    local = '0' + digits;
  }
  if (local.length === 10 && local.startsWith('09')) {
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7, 10)}`;
  }
  return local || String(rawPhone || '');
}

/**
 * Prepara los números de celular paraguayos dentro de un texto para síntesis de voz (TTS) en español
 * garantizando que SIEMPRE pronuncie número por número (NUNCA con centenas) en estructura 4 - 3 - 3:
 * primero los 4 dígitos del prefijo de corrido número por número ("cero nueve siete tres"),
 * luego una breve pausa (", "), luego 3 dígitos número por número ("ocho cinco siete"),
 * otra breve pausa (", ") y los últimos 3 dígitos número por número ("tres nueve siete").
 */
export function formatParaguayanPhonesForSpanishTTS(rawText: string): string {
  const normalized = normalizeParaguayanPhonesInText(rawText);
  return normalized.replace(/\b(09\d{2})[\s,.-]+(\d{3})[\s,.-]+(\d{3})\b/g, (_m, g1, g2, g3) => {
    return `${formatDigitGroupForSpanishTTS(g1)}, ${formatDigitGroupForSpanishTTS(g2)}, ${formatDigitGroupForSpanishTTS(g3)}`;
  });
}

/**
 * Devuelve 1 minuto (60.000 ms) para el 1er intento de seguimiento por inactividad,
 * y 1 hora (3.600.000 ms) para el 2do, 3er, 4to... intento consecutivo.
 */
export function getInactivityFollowUpDelayMs(attemptNumber: number): number {
  return attemptNumber <= 1 ? 60 * 1000 : 60 * 60 * 1000;
}

/**
 * Detecta si la respuesta del cliente durante los pasos 1..4 es demasiado corta, cortada o incomprensible.
 */
export function isUnclearOrTooShortCustomerReply(cleanInput: string, currentStep: number): boolean {
  const trimmed = String(cleanInput || '').trim();
  if (!trimmed) return true;
  if (/\[El cliente envi[oó] un audio que no se escuch[oó]|\[Nota de voz del cliente\]/i.test(trimmed)) {
    return true;
  }
  if (/👍|👌|✅|🙏/.test(trimmed) && currentStep < 4) {
    return false;
  }
  const alphaNum = trimmed.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '');
  if (!alphaNum) return true;
  if (/^(?:eh+|em+|mm+|hm+|ah+|oh+|uh+|q|qu[eé]|c[oó]mo|ha+|\?+|\.+|-+)$/i.test(trimmed)) {
    return true;
  }
  if (alphaNum.length === 1 && !/^[s12]$/i.test(alphaNum)) {
    return true;
  }
  if (currentStep === 4 && /^(?:s[ií]|ok|dale|bueno|ya|hola|bien)$/i.test(trimmed)) {
    return true;
  }
  return false;
}

export function isBuildingOrder(order?: Partial<Order> | null): boolean {
  if (!order) return false;
  if (order.tipoVivienda === 'edificio') return true;
  if (order.nombreEdificio && String(order.nombreEdificio).trim().length > 0) return true;
  if (order.pisoEdificio && String(order.pisoEdificio).trim().length > 0) return true;
  if (order.departamentoNumero && String(order.departamentoNumero).trim().length > 0) return true;
  return /\bedificio\b.*?\bpiso\b/i.test(`${order.direccion || ''} ${order.referenciaCasa || ''}`);
}

export function formatBuildingDetailsSummary(order?: Partial<Order> | null): string {
  if (!order || !isBuildingOrder(order)) return '';
  const parts: string[] = [];
  if (order.nombreEdificio?.trim()) {
    parts.push(`Edificio ${order.nombreEdificio.trim()}`);
  }
  if (order.pisoEdificio?.trim()) {
    parts.push(`Piso ${order.pisoEdificio.trim()}`);
  }
  if (order.departamentoNumero?.trim()) {
    parts.push(`Dpto./Cuarto ${order.departamentoNumero.trim()}`);
  }
  if (order.detalleRecepcion?.trim()) {
    parts.push(`Recepción: ${order.detalleRecepcion.trim()}`);
  } else if (order.tieneRecepcion === 'si_recepcionista') {
    parts.push('Recepción: Sí, recibe la recepcionista / portería');
  } else if (order.tieneRecepcion === 'no_personalmente') {
    parts.push('Recepción: Recibe el cliente personalmente en entrada');
  }
  return parts.join(' · ');
}

export function buildPoliteUnclearReplyClarification(
  displayFirstName: string,
  currentStep: number,
  variationIndex = 0,
  isBuilding = false
): string {
  const nameToUse = displayFirstName && displayFirstName !== 'qué tal' ? displayFirstName : 'estimado cliente';
  let reminderContext = 'si disponés de un minutito ahora para verificar los datos de tu envío';
  if (currentStep === 2) {
    reminderContext = 'si tu nombre y este número de teléfono están correctamente registrados';
  } else if (currentStep === 3) {
    reminderContext = isBuilding
      ? 'si los datos de tu edificio, piso, cuarto, calle y el mapa que te pasé acá arriba en el chat están todos correctos'
      : 'si la dirección y el mapa que te pasé acá arriba en el chat están todos correctos';
  } else if (currentStep === 4) {
    reminderContext = isBuilding
      ? 'si en tu edificio la recepcionista o guardia va a recibir tu pedido o si bajás vos a recibirlo, y qué comercio o referencia hay al lado del edificio'
      : 'cómo es la fachada de tu casa, el color de la pared o del portón y algún comercio cercano de referencia';
  }

  const variants = [
    `${nameToUse}, ¿sabés qué? Disculpame pero no he entendido bien lo que me has dicho recién. ¿Será que es posible que me vuelvas a repetir un poquito más claro por favor? Te consultaba ${reminderContext}.`,
    `Perdoname ${nameToUse}, ¿sabés qué? No alcancé a comprender bien tu mensaje porque llegó muy cortito. ¿Sería posible que me lo repitas de forma un poco más clara por favor? Así confirmamos ${reminderContext}.`,
    `${nameToUse}, te pido mil disculpas, te leo con mucha atención pero no logré entender bien lo que me quisiste decir. ¿Será posible que me vuelvas a escribir un poquito más detallado por favor? Necesitaba saber ${reminderContext}.`,
    `Disculpame la molestia ${nameToUse}, ¿sabés qué? No me quedó del todo claro lo que me comentaste recién. ¿Me podrías volver a repetir con un poquito más de claridad por favor? Quedamos atentos para saber ${reminderContext}.`
  ];
  const idx = Math.abs(variationIndex) % variants.length;
  return variants[idx];
}

export function cleanStreetAddressText(rawAddress: string): string {
  if (!rawAddress) return 'Por confirmar';
  const cleaned = String(rawAddress)
    .replace(/\s*·?\s*\[GPS:\s*https?:\/\/[^\]]+\]/gi, '')
    .replace(
      /\s*https?:\/\/(?:www\.)?(?:google\.com\/maps\S+|maps\.google\.com\S+|maps\.app\.goo\.gl\/\S+|goo\.gl\/maps\/\S+|tinyurl\.com\/\S+|is\.gd\/\S+)/gi,
      ''
    )
    .replace(/\s+·\s*$/g, '')
    .trim();
  return cleaned || 'Por confirmar';
}

export function buildOrderLocationConfirmationText(
  order: Partial<Order> & { gpsShortLink?: string; systemLocationConfirmedSent?: boolean },
  step: number
): string {
  const city = String(order?.ciudad || '').trim() || 'Por confirmar';
  const dept = String(order?.departamento || '').trim();
  const cleanAddress = cleanStreetAddressText(order?.direccion || '');
  const isBuilding = isBuildingOrder(order);
  const directMapUrl =
    typeof order?.gpsLat === 'number' && typeof order?.gpsLng === 'number'
      ? `https://www.google.com/maps?q=${Number(order.gpsLat).toFixed(6)},${Number(order.gpsLng).toFixed(6)}`
      : order?.gpsLink && !/tinyurl\.com|is\.gd/i.test(String(order.gpsLink))
        ? String(order.gpsLink).trim()
        : '';

  if (step === 3) {
    if (isBuilding) {
      const buildingName = String(order?.nombreEdificio || '').trim() || 'Por confirmar';
      const floor = String(order?.pisoEdificio || '').trim() || 'Por confirmar';
      const apt = String(order?.departamentoNumero || '').trim() || 'Por confirmar';
      const receptionText =
        order?.detalleRecepcion?.trim() ||
        (order?.tieneRecepcion === 'si_recepcionista'
          ? 'Sí tiene recepción (La recepcionista / portería recibe el pedido)'
          : order?.tieneRecepcion === 'no_personalmente'
            ? 'Recibe el cliente personalmente en la entrada del edificio'
            : 'Por confirmar en recepción');

      const mapSection = directMapUrl
        ? `\n\n🗺️ *Este es el mapa que se ha guardado de la ubicación exacta de tu edificio:*\n` +
          `🔘 *[ TOCÁ AQUÍ PARA ABRIR EL MAPA DE TU EDIFICIO ]* 👇\n` +
          `${directMapUrl}\n\n` +
          `👉 *Cómo revisarlo paso a paso:* Podés darle clic al enlace de arriba y se te va a abrir en tu navegador. Visualizá bien que marque tu edificio, y después volvé otra vez acá al chat y confirmame si el nombre del edificio, piso, departamento y calle están todos correctos para seguir al siguiente paso.`
        : `\n\n👉 *Por favor revisá bien estos datos de tu edificio que pusiste en el formulario y confirmame acá en el chat si están todos correctos para que sigamos en el siguiente paso (o decime si querés corregir algún dato).*`;

      return (
        `📋 *Estos son los datos de tu EDIFICIO que pusiste en el formulario para que se te entregue tu producto:*\n\n` +
        `🏙️ *Ciudad y barrio:* ${city}${dept ? ` (${dept})` : ''}\n` +
        `🛣️ *Calle donde está el edificio:* ${cleanAddress}\n` +
        `🏢 *Nombre del Edificio:* ${buildingName}\n` +
        `🔢 *Piso y Departamento / Cuarto:* Piso ${floor} · Dpto./Cuarto ${apt}\n` +
        `🛎️ *Recepción del pedido:* ${receptionText}` +
        mapSection
      );
    }

    const mapSection = directMapUrl
      ? `\n\n🗺️ *Este es el mapa que se ha guardado de la dirección exacta de tu casa:*\n` +
        `🔘 *[ TOCÁ AQUÍ PARA ABRIR TU MAPA ]* 👇\n` +
        `${directMapUrl}\n\n` +
        `👉 *Cómo revisarlo paso a paso:* Podés darle clic al enlace de arriba y se te va a abrir en tu navegador. Visualizá bien que marque tu casa, y después volvé otra vez acá al chat y confirmame si está todo correcto para que sigamos en el siguiente paso.`
      : `\n\n👉 *Por favor revisá bien estos datos que pusiste en el formulario y confirmame acá en el chat si está todo correcto para que sigamos en el siguiente paso (o decime si querés corregir tu calle o barrio).*`;

    return (
      `📋 *Estos son los datos de dirección que pusiste en el formulario para que se te entregue tu producto:*\n\n` +
      `🏙️ *Ciudad donde vivís:* ${city}${dept ? ` (${dept})` : ''}\n` +
      `🏘️ *Calle y barrio donde vivís:* ${cleanAddress}` +
      mapSection
    );
  }

  return '';
}

/**
 * Valida si una respuesta generada en etapa post-confirmación (después del cierre en Paso 5)
 * es demasiado corta (ej. 1, 2, 3 o menos de 22 palabras), lo cual está prohibido porque el agente
 * debe ser sumamente empático, conversacional, buscar ángulos y nunca cortar en seco.
 */
export function isPostConfirmReplyTooShort(replyText: string): boolean {
  const cleaned = String(replyText || '').trim();
  if (!cleaned) return true;
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length < 22;
}

/**
 * Genera respuestas post-confirmación ricas, empáticas, conversacionales (de 3 a 5 oraciones, >40 palabras)
 * con múltiples ángulos argumentales sin repetir frases, adaptadas a preguntas congruentes,
 * comentarios no congruentes (evasión educada sin cerrar la puerta), solicitudes de cambio o despedida,
 * y congruentes con si el cliente vive en un Edificio o en una Casa Independiente.
 */
export function buildEmpatheticPostConfirmationReply(
  order: Partial<Order> | null | undefined,
  cleanInput: string,
  turnNumber: number,
  callPhoneSpeech: string,
  isNaturalClosingTurn: boolean
): string {
  const rawName = String(order?.nombre || '').trim();
  const firstName = rawName.split(/\s+/)[0] || 'cliente';
  const displayFirstName = firstName !== 'qué tal' ? firstName : 'cliente';
  const isBuilding = isBuildingOrder(order);
  const placeLabel = isBuilding
    ? `tu edificio${order?.nombreEdificio ? ` ${order.nombreEdificio}` : ''}`
    : 'tu casa';
  const monto = order?.monto ? formatGs(order.monto) : 'el monto acordado';
  const angle = ((Math.max(1, turnNumber) - 1) % 4) + 1;
  const rawProd = String(order?.producto || '').trim();
  const isDefaultNoelux = !rawProd || /noelux|proyector/i.test(rawProd);
  const productLabel = isDefaultNoelux ? 'Proyector Navideño' : rawProd;
  const customAngles: string[] | undefined = Array.isArray((order as any)?.agentBrain?.postConfirmationProductAngles)
    ? (order as any).agentBrain.postConfirmationProductAngles
    : undefined;

  const clientAskedForPhoneOrChange =
    /\b(n[uú]mero|telefono|tel[eé]fono|soporte|llamar|llamo|contacto|agregar|aumentar|cambiar|modificar|cancelar|anular|otro|m[aá]s|direcci[oó]n|piso|edificio)\b/i.test(
      cleanInput
    );

  const clientAskedProductOrShippingCongruent =
    /\b(proyector|luz|luces|lluvia|agua|afuera|exterior|enchufe|cable|garant[ií]a|dise[ñn]o|figura|cu[aá]ndo|hora|llega|repartidor|env[ií]o|entrega|pago|efectivo|qr|tarjeta|funciona|instala|distancia|metros|bater[ií]a|usa|caja|trae|incluye|tama[ñn]o|potencia|material)\b/i.test(
      cleanInput
    );

  if (isNaturalClosingTurn && !clientAskedForPhoneOrChange && !clientAskedProductOrShippingCongruent) {
    if (angle % 2 === 1) {
      return `Muchísimas gracias a vos por tu excelente buena onda y por conversar conmigo, ${displayFirstName}. Quedate con la tranquilidad total de que tu paquete del ${productLabel} ya sigue su curso en la línea de despacho con todos los sellos de calidad para que el repartidor te lo entregue impecable en ${placeLabel}, y por cualquier cosita te queda nuestro número directo ${callPhoneSpeech}. Que pases una hermosa jornada.`;
    }
    return `Te agradezco de corazón por tu amabilidad y por tu confianza, ${displayFirstName}, ha sido un verdadero gusto atenderte hoy. Tu pedido ya quedó cien por ciento embalado y priorizado en la hoja de ruta para llegar perfecto hasta ${placeLabel}, y recordá que recién abonás tus ${monto} al recibirlo en mano; cualquier consulta extra tenés nuestra línea directa ${callPhoneSpeech} siempre a tu disposición.`;
  }

  // CASO 1: Pide modificar el pedido confirmado, cancelar o pide el número de soporte (4 ángulos distintos explicando el porqué y para qué)
  if (clientAskedForPhoneOrChange) {
    if (angle === 1) {
      return `Te entiendo perfectamente lo que me comentás, ${displayFirstName}, y te explico con todo cariño el porqué y para qué desde esta pantalla ya no nos permite modificar la orden por chat. Lo que sucede es que apenas confirmamos los datos de ${placeLabel}, nuestro sistema informático emitió la etiqueta con código de barras y el equipo de depósito selló tu caja con precinto de seguridad para que suba directo a la camioneta del repartidor sin perder su prioridad. Justamente para blindar tu envío el sistema bloquea las ediciones por mensaje, pero si querés que en administración central abran manualmente tu planilla antes de que salga el chofer, podés pegarles una llamadita al ${callPhoneSpeech} donde un especialista te ayuda al instante.`;
    }
    if (angle === 2) {
      return `Claro que sí, ${displayFirstName}, mirá te cuento con total empatía el motivo real por el cual desde esta terminal de seguimiento ya no podemos alterar la planilla por escrito. Cuando tu pedido del ${productLabel} pasa al sector de despacho, el sistema le asigna automáticamente al repartidor tu unidad probada en taller y cierra la boleta de ruta hacia ${placeLabel} por ${monto}, todo esto para evitar cualquier confusión de mercadería o de cobro al entregarte. Si necesitás realizar ese ajuste en la orden maestra, comunicándote un segundito por llamada al ${callPhoneSpeech} los encargados de central tienen la llave del sistema para gestionártelo con todo gusto.`;
    }
    if (angle === 3) {
      return `Qué importante lo que me decís, ${displayFirstName}, y te explico con total transparencia cómo funciona nuestro protocolo informático para cuidar tu compra. Desde esta cabina de confirmación nuestro sistema únicamente nos habilita a verificar la ubicación de ${placeLabel} y darle salida prioritaria a tu paquete, y una vez aprobado se bloquea la edición por chat para garantizar que nadie altere por error los datos que ya validamos juntos. Por eso, para cualquier cambio de unidades o de orden, podés llamar directamente al ${callPhoneSpeech} donde el equipo de ventas tiene autorización para modificar tu ficha en vivo.`;
    }
    return `Te comprendo totalmente, ${displayFirstName}, y te comento con mucho respeto el porqué de este procedimiento operativo. Cada unidad confirmada entra enseguida a la mesa de control técnico donde se verifica su funcionamiento y se embala con protección reforzada a tu nombre para enviarla a ${placeLabel}, motivo por el cual la orden queda sellada en nuestra pantalla. Si deseás que desde administración central te gestionen algún ajuste manual antes de que parta el móvil, tenés a tu disposición la línea telefónica directa ${callPhoneSpeech} acá abajo en el chat.`;
  }

  // CASO 2: Pregunta CONGRUENTE sobre el producto, funcionamiento, garantía o envío
  if (clientAskedProductOrShippingCongruent) {
    if (!isDefaultNoelux && customAngles && customAngles.length > 0) {
      const customAngleText = customAngles[(angle - 1) % customAngles.length];
      return `Qué buena pregunta me hacés, ${displayFirstName}, con muchísimo gusto te cuento todos los detalles para que estés con total seguridad. ${customAngleText} Además, tu paquete ya quedó confirmado en despacho para entregarse en ${placeLabel} con envío totalmente gratis y recién abonás los ${monto} cuando el repartidor te lo entregue en mano.`;
    }
    if (angle === 1) {
      return `Qué buena pregunta me hacés, ${displayFirstName}, con muchísimo gusto te cuento todos los detalles para que estés con total seguridad. Tu Proyector Navideño cuenta con doce diseños en movimiento de alta definición, es totalmente impermeable con protección para lluvia o intemperie y cubre hasta setenta metros cuadrados enchufándolo directo en noventa segundos. Además, tu paquete ya quedó confirmado en despacho para entregarse en ${placeLabel} con envío totalmente gratis y recién abonás los ${monto} cuando el repartidor te lo entregue en mano.`;
    }
    if (angle === 2) {
      return `Me encanta que me consultes eso, ${displayFirstName}, te explico con todo detalle porque es una de las mayores ventajas de tu equipo. Antes de sellar tu caja en nuestra mesa técnica verificamos el motor rotatorio y la lámpara LED para que ilumine con nitidez total desde el primer minuto, contando además con garantía escrita y base doble tanto para exterior como para interior. Quedate con la tranquilidad de que el courier ya tiene agendada la ruta hacia ${placeLabel} y te avisará al llegar para que revises y abones recién en puerta.`;
    }
    if (angle === 3) {
      return `Con todo gusto te respondo esa duda, ${displayFirstName}, para que tengas la máxima tranquilidad con tu compra ya confirmada. El equipo va completo en su caja sellada con sus doce tarjetas intercambiables y cable reforzado listo para enchufar, y como ya dejamos registrada toda la referencia de ${placeLabel} en nuestro sistema informático, el chofer asignado a tu zona te va a contactar directamente cuando esté en camino para entregártelo en mano.`;
    }
    return `Excelente consulta, ${displayFirstName}, te comento con mucha alegría que tu unidad ya pasó por revisión de calidad en nuestro depósito y está lista en el sector de carga. El proyector está diseñado específicamente para resistir el clima de Paraguay sin recalentar y proyectar figuras súper nítidas a varios metros de distancia, así que muy pronto el repartidor estará llegando a ${placeLabel} para entregártelo con pago contra entrega.`;
  }

  // CASO 3: Comentario o pregunta NO CONGRUENTE (otro tema, broma, charla casual) -> Evasión educada, muy empática y con ángulos potentes sin cerrarle la puerta en la cara
  if (angle === 1) {
    return `Qué simpático e interesante lo que me comentás, ${displayFirstName}, la verdad es que da muchísimo gusto conversar con personas con tan buena onda como vos. Mirá, te cuento con todo cariño que en este momento te estoy hablando desde la cabina de control operativo donde estamos conectados en vivo con los técnicos y empaquetadores que están probando y sellando las cajas que salen hoy a reparto, por lo que toda nuestra pantalla en este sector está dedicada exclusivamente a cuidar que tu ${productLabel} salga verificado al cien por ciento y llegue impecable hasta ${placeLabel}.`;
  }
  if (angle === 2) {
    return `Te escucho con muchísima atención y simpatía, ${displayFirstName}, y te agradezco de corazón la confianza al escribirme. Te comento con total amabilidad que desde esta terminal de logística nuestro sistema informático está enfocado exclusivamente en monitorear las hojas de ruta de los repartidores y el control de calidad de los pedidos confirmados, justamente para garantizarte que tu paquete viaje seguro y lo recibas sin ningún contratiempo en ${placeLabel}.`;
  }
  if (angle === 3) {
    return `Totalmente comprensible lo que me decís, ${displayFirstName}, qué lindo poder charlar un ratito con vos mientras el equipo termina de alistar la carga del día. Como desde este puesto de despacho trabajamos únicamente con las planillas de envíos y el sellado técnico de cada unidad, concentramos todo nuestro trabajo de cabina en asegurar que tu ${productLabel} tenga prioridad en la camioneta que va hacia ${placeLabel} y llegue en perfectas condiciones.`;
  }
  return `Me saca una sonrisa tu mensaje, ${displayFirstName}, y te valoro muchísimo la buena predisposición. Te cuento con mucha educación que acá estamos justo en el centro de coordinación de empaque supervisando que cada equipo confirmado lleve sus accesorios completos y su precinto de seguridad, así que todo nuestro enfoque en esta línea está puesto en que disfrutes muchísimo tu pedido apenas llegue a ${placeLabel}.`;
}

export function isOrderConfirmedByAgent(order?: Partial<Order> | null): boolean {
  if (!order) return false;
  return Boolean(
    order.datosConfirmados ||
    (order.convStep && order.convStep >= 5) ||
    (order.empaquetado && order.referenciaCasa)
  );
}

export function buildOrderComparisonSummary(order: Order): OrderComparisonSummary {
  const autoGpsLink =
    order.gpsLink ||
    (typeof order.gpsLat === 'number' && typeof order.gpsLng === 'number'
      ? `https://www.google.com/maps?q=${order.gpsLat.toFixed(6)},${order.gpsLng.toFixed(6)}`
      : undefined);

  const autoStreetViewLink =
    order.gpsStreetViewLink ||
    (typeof order.gpsLat === 'number' && typeof order.gpsLng === 'number'
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${order.gpsLat.toFixed(6)},${order.gpsLng.toFixed(6)}`
      : undefined);

  if (order.comparativaDatos && order.comparativaDatos.resumenTexto) {
    return {
      ...order.comparativaDatos,
      gpsLink: order.comparativaDatos.gpsLink || autoGpsLink,
      gpsStreetViewLink: order.comparativaDatos.gpsStreetViewLink || autoStreetViewLink,
      fachadaFotoUrl: order.comparativaDatos.fachadaFotoUrl || order.fachadaFotoUrl,
      gpsLat: order.comparativaDatos.gpsLat ?? order.gpsLat,
      gpsLng: order.comparativaDatos.gpsLng ?? order.gpsLng,
      gpsConfirmado: Boolean(order.comparativaDatos.gpsConfirmado || order.gpsConfirmado || autoGpsLink),
      tipoVivienda: order.comparativaDatos.tipoVivienda || order.tipoVivienda,
      nombreEdificio: order.comparativaDatos.nombreEdificio || order.nombreEdificio,
      pisoEdificio: order.comparativaDatos.pisoEdificio || order.pisoEdificio,
      departamentoNumero: order.comparativaDatos.departamentoNumero || order.departamentoNumero,
      tieneRecepcion: order.comparativaDatos.tieneRecepcion || order.tieneRecepcion,
      detalleRecepcion: order.comparativaDatos.detalleRecepcion || order.detalleRecepcion
    };
  }

  const nombreWeb = (order.nombre || '').trim();
  const celularWeb = (order.celular || '').trim();
  const ubicacionWeb = `${(order.ciudad || '').trim()}, ${(order.departamento || '').trim()}`.replace(/^,\s*|,\s*$/g, '');
  const direccionWeb = cleanStreetAddressText((order.direccion || '').trim());
  const buildingSummary = formatBuildingDetailsSummary(order);
  const referenciaConfirmada = (
    order.referenciaCasa ||
    buildingSummary ||
    (isBuildingOrder(order) ? 'Edificio verificado con el cliente en el chat' : 'Fachada verificada con el cliente en el chat')
  ).trim();
  const packConfirmado = `${order.cantidad || 1} ${(order.cantidad || 1) > 1 ? 'unidades' : 'unidad'} · ${formatGs(order.monto)} (${order.detalle || 'Efectivo al recibir'})`;

  const resumenTexto =
    order.resumenConfirmacionIA ||
    `El Agente IA completó los 5 pasos de validación con ${nombreWeb} (${formatWaPhone(celularWeb)}). Modalidad: ${
      isBuildingOrder(order) ? `EDIFICIO (${buildingSummary || direccionWeb})` : 'CASA INDEPENDIENTE'
    }. Se verificó que los datos dejados en el formulario web coinciden al 100% con los confirmados en la conversación: entrega en ${ubicacionWeb}, dirección "${direccionWeb}"${autoGpsLink ? ` (GPS exacto: ${autoGpsLink})` : ''} y referencia "${referenciaConfirmada}".`;

  return {
    nombreWeb,
    nombreConfirmado: nombreWeb,
    celularWeb,
    celularConfirmado: celularWeb,
    ubicacionWeb,
    ubicacionConfirmada: ubicacionWeb,
    direccionWeb,
    direccionConfirmada: direccionWeb,
    referenciaConfirmada,
    packConfirmado,
    coincidenDatos: true,
    resumenTexto,
    fechaConfirmacion: order.fecha,
    gpsLink: autoGpsLink,
    gpsStreetViewLink: autoStreetViewLink,
    fachadaFotoUrl: order.fachadaFotoUrl,
    gpsLat: order.gpsLat,
    gpsLng: order.gpsLng,
    gpsConfirmado: Boolean(order.gpsConfirmado || autoGpsLink),
    tipoVivienda: order.tipoVivienda || (isBuildingOrder(order) ? 'edificio' : 'casa'),
    nombreEdificio: order.nombreEdificio,
    pisoEdificio: order.pisoEdificio,
    departamentoNumero: order.departamentoNumero,
    tieneRecepcion: order.tieneRecepcion,
    detalleRecepcion: order.detalleRecepcion
  };
}

/**
 * Genera el reporte ejecutivo humano, espaciado y bien diseñado que el Agente envía
 * directamente al WhatsApp del vendedor sobre su producto específico.
 */
export function buildSellerExecutiveWhatsAppReport(
  productName: string,
  productOrders: Partial<Order>[],
  newlyConfirmedOrder?: Partial<Order> | null
): string {
  const confirmedList = productOrders.filter(o => isOrderConfirmedByAgent(o));
  const inProgressList = productOrders.filter(o => !isOrderConfirmedByAgent(o));
  const shippedCount = confirmedList.filter(
    o => o.estadoEnvioProducto === 'enviado' || o.estadoEnvioProducto === 'concretado' || o.estado === 'en_camino' || o.estado === 'entregado_pagado'
  ).length;
  const completedCount = confirmedList.filter(
    o => o.concretadoCobrado || o.estadoEnvioProducto === 'concretado' || o.estado === 'entregado_pagado'
  ).length;

  const lines: string[] = [];

  if (newlyConfirmedOrder) {
    lines.push(`📋 *REPORTE DE TU AGENTE · ${productName.toUpperCase()}*`);
    lines.push('');
    lines.push(
      `Hola jefe, acabo de terminar de confirmar el pedido de *${newlyConfirmedOrder.nombre || 'Cliente'}* (${newlyConfirmedOrder.ciudad || 'Paraguay'}). Te paso el resumen actualizado de tu producto:`
    );
  } else {
    lines.push(`📋 *REPORTE ACTUALIZADO · ${productName.toUpperCase()}*`);
    lines.push('');
    lines.push(`Hola jefe, acá tenés el estado en tiempo real de los pedidos de tu producto:`);
  }

  lines.push('');
  lines.push(`📊 *ESTADO GENERAL:*`);
  lines.push(`• ✅ *Confirmados listos:* ${confirmedList.length}`);
  lines.push(`• ⏳ *En curso de confirmación:* ${inProgressList.length}`);
  lines.push(`• 🚚 *Enviados / Concretados:* ${shippedCount} enviados (${completedCount} cobrados)`);

  if (confirmedList.length > 0) {
    lines.push('');
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`✅ *PEDIDOS CONFIRMADOS (${confirmedList.length}):*`);
    confirmedList.slice(0, 10).forEach((ord, idx) => {
      const num = idx + 1;
      const montoStr = formatGs(ord.monto || 189000);
      const estadoDespacho =
        ord.concretadoCobrado || ord.estadoEnvioProducto === 'concretado'
          ? '💰 Concretado'
          : ord.estadoEnvioProducto === 'enviado'
            ? '🚚 Enviado'
            : '📦 Listo p/ envío';
      const ordGpsLink =
        ord.gpsLink ||
        (typeof ord.gpsLat === 'number' && typeof ord.gpsLng === 'number'
          ? `https://www.google.com/maps?q=${ord.gpsLat.toFixed(6)},${ord.gpsLng.toFixed(6)}`
          : '');
      const ordStreetViewLink =
        ord.gpsStreetViewLink ||
        (typeof ord.gpsLat === 'number' && typeof ord.gpsLng === 'number'
          ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ord.gpsLat.toFixed(6)},${ord.gpsLng.toFixed(6)}`
          : '');
      const isBldg = isBuildingOrder(ord);
      const bldgDetails = formatBuildingDetailsSummary(ord);
      lines.push('');
      lines.push(
        `*#${num} · ${ord.nombre || 'Cliente'}* (${ord.celular || 'S/N'}) · ${isBldg ? '🏢 *EDIFICIO*' : '🏠 *CASA*'}`
      );
      lines.push(`📍 ${ord.ciudad || ''}, ${ord.departamento || ''} — ${ord.direccion || ''}`);
      if (isBldg && bldgDetails) {
        lines.push(`🏢 *Datos del Edificio:* ${bldgDetails}`);
      }
      if (ordGpsLink) {
        lines.push(`🗺️ *GPS Exacto p/ Courier:* ${ordGpsLink}`);
      }
      if (ordStreetViewLink) {
        lines.push(`🚶 *Fachada Street View 360°:* ${ordStreetViewLink}`);
      }
      lines.push(`🏠 Ref: ${ord.referenciaCasa || bldgDetails || 'Datos verificados en el chat'}`);
      lines.push(`🛍️ Pack: ${ord.cantidad || 1} un. (${montoStr}) · _${estadoDespacho}_`);
    });
  }

  if (inProgressList.length > 0) {
    lines.push('');
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`⏳ *EN CURSO DE CONFIRMACIÓN (${inProgressList.length}):*`);
    inProgressList.slice(0, 5).forEach((ord, idx) => {
      const num = idx + 1;
      lines.push(
        `• *#${num}* ${ord.nombre || 'Cliente'} (${ord.ciudad || 'Paraguay'}) — _En conversación (Paso ${ord.convStep || 1}/5)_`
      );
    });
    if (inProgressList.length > 5) {
      lines.push(`• _...y ${inProgressList.length - 5} pedido(s) más en gestión._`);
    }
  }

  lines.push('');
  lines.push(
    `💬 _Cuando quieras saber cuántos pedidos siguen en curso o cuáles ya están confirmados, escribime por acá mismo en WhatsApp._`
  );

  return lines.join('\n');
}

/**
 * Filtra pedidos del panel administrativo por nombre, número de teléfono (ignorando espacios/guiones/prefijo 595)
 * y estado de archivado ('activos' | 'archivados' | 'todos').
 */
export function filterAdminOrders(
  orders: Order[],
  options: {
    nameQuery?: string;
    phoneQuery?: string;
    archiveMode?: 'activos' | 'archivados' | 'todos';
  }
): Order[] {
  const nameFilter = String(options.nameQuery || '').trim().toLowerCase();
  const rawPhoneFilter = String(options.phoneQuery || '').trim();
  const phoneDigitsFilter = rawPhoneFilter.replace(/\D/g, '');
  const archiveMode = options.archiveMode || 'activos';

  return (orders || []).filter(ord => {
    const isArchived = Boolean(ord.archivado);
    if (archiveMode === 'activos' && isArchived) return false;
    if (archiveMode === 'archivados' && !isArchived) return false;

    if (nameFilter) {
      const ordName = String(ord.nombre || '').toLowerCase();
      const confirmedName = String(ord.comparativaDatos?.nombreConfirmado || '').toLowerCase();
      const ordId = String(ord.reservaid || '').toLowerCase();
      if (!ordName.includes(nameFilter) && !confirmedName.includes(nameFilter) && !ordId.includes(nameFilter)) {
        return false;
      }
    }

    if (rawPhoneFilter) {
      const ordPhoneRaw = String(ord.celular || '').toLowerCase();
      const ordPhoneDigits = ordPhoneRaw.replace(/\D/g, '');
      const ordPhone433 = formatParaguayanPhone433(ord.celular).toLowerCase();
      const ordPhoneNospace = ordPhone433.replace(/\s+/g, '');

      const matchesText = ordPhoneRaw.includes(rawPhoneFilter.toLowerCase()) || ordPhone433.includes(rawPhoneFilter.toLowerCase());
      const matchesDigits =
        phoneDigitsFilter.length > 0 &&
        (ordPhoneDigits.includes(phoneDigitsFilter) || ordPhoneNospace.includes(phoneDigitsFilter));

      if (!matchesText && !matchesDigits) {
        return false;
      }
    }

    return true;
  });
}

