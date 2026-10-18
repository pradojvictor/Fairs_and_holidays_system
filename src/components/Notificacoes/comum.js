// O que o sino, a central, o modal e a gaveta usam igual.
import { dataBR, hojeISO } from '../../../shared/ferias.js';

export const CATEGORIAS = [
  { id: 'sistema', nome: 'Sistema', descricao: 'Novidades e atualizações do sistema' },
  { id: 'ferias', nome: 'Férias', descricao: 'Períodos de 12 meses e férias lançadas' },
  { id: 'escala', nome: 'Escala', descricao: 'Ausências próximas e cobertura da equipe' },
];

export const nomeCategoria = (id) => CATEGORIAS.find((c) => c.id === id)?.nome || 'Outros';

// "hoje", "há 3 dias", "em 2 dias"; longe disso, a data.
export function quandoRelativo(iso) {
  if (!iso) return '';
  const dias = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${hojeISO()}T00:00:00Z`)) / 86_400_000);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias === -1) return 'ontem';
  if (dias > 1 && dias <= 30) return `em ${dias} dias`;
  if (dias < -1 && dias >= -30) return `há ${-dias} dias`;
  return dataBR(iso);
}
