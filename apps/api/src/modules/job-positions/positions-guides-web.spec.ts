import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormattedText } from '../../../../web/src/app/(dashboard)/rrhh/matriz-puestos/formatted-text';
import { FIELD_GUIDES, REQUIRED_FIELDS, parseTextBlocks } from '../../../../web/src/app/(dashboard)/rrhh/matriz-puestos/positions-constants';

describe('Matriz de Puestos (web) · guía de llenado de los campos', () => {
  it('cada campo lleva la guía corta de RRHH y un ejemplo como placeholder', () => {
    expect(FIELD_GUIDES.roleSummary.guide).toBe('Qué hace, en una frase.');
    expect(FIELD_GUIDES.positionObjective.guide).toBe('Para qué existe.');
    expect(FIELD_GUIDES.description.guide).toBe('Actividades y su frecuencia (una por línea).');
    expect(FIELD_GUIDES.validationPoints.guide).toBe('Cómo se mide (uno por línea).');
    expect(FIELD_GUIDES.roleSummary.placeholder).toMatch(/^Ej\.: /);
    expect(FIELD_GUIDES.positionObjective.placeholder).toMatch(/^Ej\.: /);
    for (const k of ['description', 'validationPoints'] as const) {
      const lines = FIELD_GUIDES[k].placeholder.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines.every((l) => l.startsWith('- '))).toBe(true);
    }
  });

  it('los cuatro campos siguen obligatorios con las mismas claves (no se renombra nada)', () => {
    expect(REQUIRED_FIELDS.map((f) => f.key).sort()).toEqual(['description', 'positionObjective', 'roleSummary', 'validationPoints']);
  });
});

describe('Matriz de Puestos (web) · formato del texto guardado', () => {
  it('«-», «*» y «•» forman listas con viñetas y el resto son párrafos', () => {
    expect(parseTextBlocks('Intro\n- Uno\n* Dos\n• Tres\nCierre')).toEqual([
      { kind: 'paragraph', text: 'Intro' },
      { kind: 'list', items: ['Uno', 'Dos', 'Tres'] },
      { kind: 'paragraph', text: 'Cierre' },
    ]);
  });

  it('respeta saltos de línea de cualquier tipo, ignora líneas vacías y vacío no genera bloques', () => {
    expect(parseTextBlocks('A\r\n\r\nB\rC')).toEqual([{ kind: 'paragraph', text: 'A' }, { kind: 'paragraph', text: 'B' }, { kind: 'paragraph', text: 'C' }]);
    expect(parseTextBlocks(null)).toEqual([]);
    expect(parseTextBlocks('  \n ')).toEqual([]);
  });

  it('se renderiza como texto: el HTML escrito en el campo no se inyecta', () => {
    const html = renderToStaticMarkup(createElement(FormattedText, { text: '- <script>alert(1)</script>\n<b>x</b>' }));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
  });
});
