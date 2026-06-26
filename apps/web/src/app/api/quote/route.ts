import { NextResponse } from 'next/server';

const QUOTES = [
  { q: 'El éxito es la suma de pequeños esfuerzos repetidos día tras día.', a: 'Robert Collier' },
  { q: 'La creatividad es la inteligencia divirtiéndose.', a: 'Albert Einstein' },
  { q: 'No cuentes los días, haz que los días cuenten.', a: 'Muhammad Ali' },
  { q: 'El único modo de hacer un gran trabajo es amar lo que haces.', a: 'Steve Jobs' },
  { q: 'La innovación distingue a los líderes de los seguidores.', a: 'Steve Jobs' },
  { q: 'El talento gana partidos, pero el trabajo en equipo gana campeonatos.', a: 'Michael Jordan' },
  { q: 'El futuro pertenece a quienes creen en la belleza de sus sueños.', a: 'Eleanor Roosevelt' },
  { q: 'No es la más fuerte de las especies la que sobrevive, sino la que mejor se adapta.', a: 'Charles Darwin' },
  { q: 'La mejor forma de predecir el futuro es creándolo.', a: 'Peter Drucker' },
  { q: 'El liderazgo es la capacidad de convertir una visión en realidad.', a: 'Warren Bennis' },
  { q: 'Lo que no se mide, no se puede mejorar.', a: 'Peter Drucker' },
  { q: 'El aprendizaje es el único bien que nadie te puede quitar.', a: 'Erasmo de Róterdam' },
  { q: 'Trabaja duro en silencio; deja que el éxito haga el ruido.', a: 'Frank Ocean' },
  { q: 'La disciplina es el puente entre metas y logros.', a: 'Jim Rohn' },
  { q: 'Una persona que nunca cometió un error nunca intentó nada nuevo.', a: 'Albert Einstein' },
  { q: 'El mejor tiempo para plantar un árbol fue hace 20 años. El segundo mejor tiempo es ahora.', a: 'Proverbio chino' },
  { q: 'En medio de las dificultades reside la oportunidad.', a: 'Albert Einstein' },
  { q: 'El coraje no es la ausencia de miedo, sino la determinación de que algo más importa.', a: 'Ambrose Redmoon' },
  { q: 'El conocimiento es poder, pero el entusiasmo lleva a las estrellas.', a: 'Brian Tracy' },
  { q: 'La excelencia no es un acto, sino un hábito.', a: 'Aristóteles' },
  { q: 'Si puedes soñarlo, puedes lograrlo.', a: 'Walt Disney' },
  { q: 'El verdadero progreso consiste en renovarse.', a: 'Maurice Maeterlinck' },
  { q: 'Todo lo que puedas imaginar es real.', a: 'Pablo Picasso' },
  { q: 'Sé el cambio que quieres ver en el mundo.', a: 'Mahatma Gandhi' },
  { q: 'La única manera de hacer un trabajo excelente es apasionarte con él.', a: 'Steve Jobs' },
  { q: 'El éxito no es definitivo, el fracaso no es fatal: lo que cuenta es el coraje de continuar.', a: 'Winston Churchill' },
  { q: 'Nunca es demasiado tarde para ser lo que podrías haber sido.', a: 'George Eliot' },
  { q: 'La vida es 10% lo que te sucede y 90% cómo reaccionas ante ello.', a: 'Charles R. Swindoll' },
  { q: 'Los obstáculos son esas cosas aterradoras que ves cuando apartas los ojos de tu meta.', a: 'Henry Ford' },
  { q: 'Haz siempre lo que temes, y la muerte del miedo es segura.', a: 'Ralph Waldo Emerson' },
];

export async function GET(): Promise<NextResponse> {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  const quote = QUOTES[dayOfYear % QUOTES.length];
  return NextResponse.json([quote]);
}
