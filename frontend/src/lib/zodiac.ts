const ZODIAC_SIGNS = [
  { name: 'Козерог', symbol: '♑', start: [1, 1], end: [1, 19] },
  { name: 'Водолей', symbol: '♒', start: [1, 20], end: [2, 18] },
  { name: 'Рыбы', symbol: '♓', start: [2, 19], end: [3, 20] },
  { name: 'Овен', symbol: '♈', start: [3, 21], end: [4, 19] },
  { name: 'Телец', symbol: '♉', start: [4, 20], end: [5, 20] },
  { name: 'Близнецы', symbol: '♊', start: [5, 21], end: [6, 20] },
  { name: 'Рак', symbol: '♋', start: [6, 21], end: [7, 22] },
  { name: 'Лев', symbol: '♌', start: [7, 23], end: [8, 22] },
  { name: 'Дева', symbol: '♍', start: [8, 23], end: [9, 22] },
  { name: 'Весы', symbol: '♎', start: [9, 23], end: [10, 22] },
  { name: 'Скорпион', symbol: '♏', start: [10, 23], end: [11, 21] },
  { name: 'Стрелец', symbol: '♐', start: [11, 22], end: [12, 21] },
  { name: 'Козерог', symbol: '♑', start: [12, 22], end: [12, 31] },
] as const;

export function getZodiacSign(birthDate: string): { name: string; symbol: string } {
  const date = new Date(birthDate);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  for (const sign of ZODIAC_SIGNS) {
    const [sm, sd] = sign.start;
    const [em, ed] = sign.end;
    if ((month === sm && day >= sd) || (month === em && day <= ed)) {
      return { name: sign.name, symbol: sign.symbol };
    }
  }

  return { name: 'Козерог', symbol: '♑' };
}

export const FOCUS_LABELS: Record<string, string> = {
  work: 'Работа',
  money: 'Деньги',
  love: 'Любовь',
  friends: 'Друзья',
  body: 'Тело',
  self: 'Самоценность',
};

export const STYLE_LABELS: Record<string, string> = {
  gentle: 'Мягкий',
  blunt: 'Прямой',
};
