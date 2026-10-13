// Catálogos de la Matriz de Riesgos (TIC-RE-08 v00). Generado a partir de
// docs/specs/catalogos-matriz-riesgos.json; amenazas y vulnerabilidades son
// solo sugerencias: los campos aceptan texto libre.

export interface ScaleOption {
  value: number;
  label: string;
  description: string;
}

export const THREATS: string[] = [
  "Acceso a la red o al sistema de información por personas no autorizadas.",
  "Amenaza o ataque con bomba.",
  "Incumplimiento de relaciones contractuales.",
  "Infracción legal.",
  "Comprometer información confidencial.",
  "Ocultar la identidad de un usuario.",
  "Daño causado por un tercero.",
  "Daños resultantes de las pruebas de penetración.",
  "Destrucción de registros.",
  "Desastre generado por causas humanas.",
  "Desastre natural, incendio, inundación, rayo.",
  "Revelación de información.",
  "Divulgación de contraseñas.",
  "Malversación y fraude.",
  "Errores en mantenimiento.",
  "Fallo de los enlaces de comunicación.",
  "Falsificación de registros.",
  "Espionaje industrial.",
  "Fuga de información.",
  "Interrupción de procesos de negocio.",
  "Pérdida de electricidad.",
  "Pérdida de servicios de apoyo.",
  "Mal funcionamiento del equipo.",
  "Código malicioso.",
  "Uso indebido de los sistemas de información.",
  "Uso indebido de las herramientas de auditoría.",
  "Contaminación.",
  "Errores de software.",
  "Huelgas o paros.",
  "Ataques terroristas.",
  "Hurtos o vandalismo.",
  "Cambio involuntario de datos en un sistema de información.",
  "Cambios no autorizados de registros.",
  "Instalación no autorizada de software.",
  "Acceso físico no autorizado.",
  "Uso no autorizado de material con copyright.",
  "Uso no autorizado de software.",
  "Error de usuario."
];

export const VULNERABILITIES: string[] = [
  "Interfaz de usuario complicada.",
  "Contraseñas predeterminadas no modificadas.",
  "Eliminación de medios de almacenamiento sin eliminar datos.",
  "Sensibilidad del equipo a los cambios de voltaje.",
  "Sensibilidad del equipo a la humedad, temperatura o contaminantes.",
  "Inadecuada seguridad del cableado.",
  "Inadecuada gestión de capacidad del sistema.",
  "Gestión inadecuada del cambio.",
  "Clasificación inadecuada de la información.",
  "Control inadecuado del acceso físico.",
  "Mantenimiento inadecuado.",
  "Inadecuada gestión de red.",
  "Respaldo inapropiado o irregular.",
  "Inadecuada gestión y protección de contraseñas.",
  "Protección física no apropiada.",
  "Reemplazo inadecuado de equipos viejos.",
  "Falta de formación y conciencia sobre seguridad.",
  "Inadecuada segregación de funciones.",
  "Mala segregación de las instalaciones operativas y de prueba.",
  "Insuficiente supervisión de los empleados y vendedores.",
  "Especificación incompleta para el desarrollo de software.",
  "Pruebas de software insuficientes.",
  "Falta de política de acceso o política de acceso remoto.",
  "Ausencia de política de escritorio limpio y pantalla clara.",
  "Falta de control sobre los datos de entrada y salida.",
  "Falta de documentación interna.",
  "Carencia o mala implementación de la auditoría interna.",
  "Falta de políticas para el uso de la criptografía.",
  "Falta de procedimientos para eliminar los derechos de acceso a la terminación del empleo.",
  "Desprotección en equipos móviles.",
  "Falta de redundancia, copia única.",
  "Ausencia de sistemas de identificación y autenticación.",
  "No validación de los datos procesados.",
  "Ubicación vulnerable a inundaciones.",
  "Mala selección de datos de prueba.",
  "Copia no controlada de datos.",
  "Descarga no controlada de Internet.",
  "Uso incontrolado de sistemas de información.",
  "Software no documentado.",
  "Empleados desmotivados.",
  "Conexiones a red pública desprotegidas.",
  "Los derechos del usuario no se revisan regularmente."
];

/** Sugerencias de categoría; el campo acepta texto libre. */
export const CATEGORIES: string[] = ['Ciberseguridad (IT)'];

export const ASSET_TYPES: string[] = [
  "Personas",
  "Hardware",
  "Software",
  "Información",
  "Edificios",
  "Servicios",
  "SaaS"
];

export const VULNERABILITY_SCALE: ScaleOption[] = [
  {
    "value": 1,
    "label": "Muy baja",
    "description": "Muy baja: no se identifican vulnerabilidades aplicables del catálogo o están plenamente mitigadas mediante controles eficaces y evidencia vigente."
  },
  {
    "value": 2,
    "label": "Baja",
    "description": "Baja: existe una vulnerabilidad aislada de impacto limitado, como documentación incompleta, interfaz complicada o una mejora menor de mantenimiento; los controles reducen adecuadamente la exposición."
  },
  {
    "value": 3,
    "label": "Media",
    "description": "Media: existen varias debilidades operativas o una vulnerabilidad relevante, como capacitación insuficiente, gestión inadecuada del cambio, respaldos irregulares o revisión periódica de accesos; los controles son parciales."
  },
  {
    "value": 4,
    "label": "Alta",
    "description": "Alta: se presentan múltiples vulnerabilidades significativas en contraseñas, accesos físicos o remotos, redes, equipos móviles, segregación de funciones o protección de información; la amenaza puede materializarse con facilidad."
  },
  {
    "value": 5,
    "label": "Crítica",
    "description": "Crítica: hay ausencia o falla generalizada de controles esenciales, como autenticación, cifrado, respaldo y redundancia, gestión de accesos o protección de redes públicas; la amenaza puede materializarse de forma inmediata y afectar activos críticos."
  }
];

export const SEVERITY_SCALE: ScaleOption[] = [
  {
    "value": 1,
    "label": "Impacto insignificante",
    "description": "Impacto insignificante; sin pérdida de información ni interrupción relevante, y sin afectación perceptible a clientes o reputación."
  },
  {
    "value": 2,
    "label": "Impacto menor y recuperable",
    "description": "Impacto menor y recuperable; interrupción breve o error limitado, sin datos sensibles expuestos ni incumplimientos significativos."
  },
  {
    "value": 3,
    "label": "Impacto moderado",
    "description": "Impacto moderado; afecta parcialmente campañas, servicios o información de clientes y requiere esfuerzo relevante de recuperación."
  },
  {
    "value": 4,
    "label": "Impacto alto",
    "description": "Impacto alto; pérdida o alteración importante de datos, interrupción prolongada, afectación contractual, financiera o reputacional."
  },
  {
    "value": 5,
    "label": "Impacto crítico",
    "description": "Impacto crítico; exposición masiva de datos, fraude, indisponibilidad severa, sanciones, pérdida de clientes o daño grave a la reputación."
  }
];

export const PROBABILITY_SCALE: ScaleOption[] = [
  {
    "value": 1,
    "label": "Rara vez",
    "description": "Rara vez: máximo un evento cada dos años; no existen antecedentes recientes y las condiciones de materialización son excepcionales."
  },
  {
    "value": 2,
    "label": "Poco Probable",
    "description": "Poco probable: máximo un evento al año; existen antecedentes aislados o condiciones ocasionales que podrían materializarlo."
  },
  {
    "value": 3,
    "label": "Posible",
    "description": "Posible: hasta un evento cada tres meses; la amenaza se presenta periódicamente y hay exposición operativa moderada."
  },
  {
    "value": 4,
    "label": "Probable",
    "description": "Probable: al menos un evento al mes; existen antecedentes frecuentes, exposición continua o controles que fallan regularmente."
  },
  {
    "value": 5,
    "label": "Casi cierta",
    "description": "Casi cierta: al menos un evento por semana; la amenaza es recurrente, activa o se materializa de forma habitual en la operación."
  }
];

export const EFFICACY_SCALE: ScaleOption[] = [
  {
    "value": 0.1,
    "label": "Muy eficaz",
    "description": "Muy eficaz: el control está implementado, documentado, se ejecuta consistentemente y evita o detecta oportunamente la materialización del riesgo."
  },
  {
    "value": 0.2,
    "label": "Eficaz",
    "description": "Eficaz: el control opera adecuadamente y reduce significativamente el riesgo, aunque presenta oportunidades menores de mejora o evidencia."
  },
  {
    "value": 0.3,
    "label": "Moderadamente eficaz",
    "description": "Moderadamente eficaz: el control existe, pero su aplicación es parcial o inconsistente; reduce el riesgo de forma limitada y requiere fortalecimiento."
  },
  {
    "value": 0.4,
    "label": "Poco eficaz",
    "description": "Poco eficaz: el control presenta fallas frecuentes, cobertura insuficiente o escaso seguimiento, por lo que la amenaza aún puede materializarse."
  },
  {
    "value": 0.5,
    "label": "Ineficaz o inexistente",
    "description": "Ineficaz o inexistente: no hay control establecido, no se aplica o no reduce el riesgo; la amenaza puede materializarse sin barreras efectivas."
  }
];

export const ACTION_STATUSES = ["No iniciado","Pendiente","Iniciado","En proceso","Resuelto"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
