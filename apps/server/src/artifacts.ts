/** Stage 3.4 test catalog: cards transcribed from the client's "Артефакты" worksheet.
 * Only effects backed by explicit server handlers are included in the draft pool.
 * Original rows and descriptions remain traceable by ID art-XXX. */
import type { ArtifactCard } from '@samopalka/shared';
export const ARTIFACTS: readonly ArtifactCard[] = [
  {
    "id": "art-013",
    "title": "Грань · Удар, 2",
    "description": "Заменяет сторону на \"Удар, 2\"",
    "group": "Воин",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 2,
      "label": "Удар, 2"
    }
  },
  {
    "id": "art-015",
    "title": "Грань · Удар, Боль, 3",
    "description": "Заменяет сторону на \"Удар, Боль, 3\"",
    "group": "Воин",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 3,
      "label": "Удар, Боль, 3"
    }
  },
  {
    "id": "art-017",
    "title": "Грань · Удар, Гниение, 3",
    "description": "Заменяет сторону на \"Удар, Гниение, 3\"",
    "group": "Воин",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 3,
      "label": "Удар, Гниение, 3"
    }
  },
  {
    "id": "art-020",
    "title": "Грань · Удар, СамоЩит, 1",
    "description": "Заменяет сторону на \"Удар, СамоЩит, 1\"",
    "group": "Воин",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 1,
      "label": "Удар, СамоЩит, 1"
    }
  },
  {
    "id": "art-021",
    "title": "Грань · Удар, Слабость, 1",
    "description": "Заменяет сторону на \"Удар, Слабость, 1\"",
    "group": "Воин",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 1,
      "label": "Удар, Слабость, 1"
    }
  },
  {
    "id": "art-025",
    "title": "Грань · Удар, 3",
    "description": "Заменяет сторону на \"Удар, 3\"",
    "group": "Воин",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 3,
      "label": "Удар, 3"
    }
  },
  {
    "id": "art-026",
    "title": "Грань · Удар, Боль, 4",
    "description": "Заменяет сторону на \"Удар, Боль, 4\"",
    "group": "Воин",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 4,
      "label": "Удар, Боль, 4"
    }
  },
  {
    "id": "art-028",
    "title": "Грань · Удар, Гниение, 4",
    "description": "Заменяет сторону на \"Удар, Гниение, 4\"",
    "group": "Воин",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 4,
      "label": "Удар, Гниение, 4"
    }
  },
  {
    "id": "art-029",
    "title": "Грань · Удар, Дальность, 2",
    "description": "Заменяет сторону на \"Удар, Дальность, 2\"",
    "group": "Воин",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 2,
      "label": "Удар, Дальность, 2"
    }
  },
  {
    "id": "art-035",
    "title": "Грань · Удар, Разброс, 1",
    "description": "Заменяет сторону на \"Удар, Разброс, 1\"",
    "group": "Воин",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 1,
      "label": "Удар, Разброс, 1"
    }
  },
  {
    "id": "art-036",
    "title": "Грань · Удар, Рост, 1",
    "description": "Заменяет сторону на \"Удар, Рост, 1\"",
    "group": "Воин",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 1,
      "label": "Удар, Рост, 1"
    }
  },
  {
    "id": "art-037",
    "title": "Грань · Удар, Яд, 1",
    "description": "Заменяет сторону на \"Удар, Яд, 1\"",
    "group": "Воин",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 1,
      "label": "Удар, Яд, 1"
    }
  },
  {
    "id": "art-040",
    "title": "Грань · Удар, 4",
    "description": "Заменяет сторону на \"Удар, 4\"",
    "group": "Воин",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 4,
      "label": "Удар, 4"
    }
  },
  {
    "id": "art-042",
    "title": "Грань · Удар, Дальность, 3",
    "description": "Заменяет сторону на \"Удар, Дальность, 3\"",
    "group": "Воин",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 3,
      "label": "Удар, Дальность, 3"
    }
  },
  {
    "id": "art-044",
    "title": "Грань · Удар, Дальность, Разброс, 1",
    "description": "Заменяет сторону на \"Удар, Дальность, Разброс, 1\"",
    "group": "Воин",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 1,
      "label": "Удар, Дальность, Разброс, 1"
    }
  },
  {
    "id": "art-047",
    "title": "Грань · Удар, Разброс, 2",
    "description": "Заменяет сторону на \"Удар, Разброс, 2\"",
    "group": "Воин",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 2,
      "label": "Удар, Разброс, 2"
    }
  },
  {
    "id": "art-048",
    "title": "Грань · Удар, Рост, 2",
    "description": "Заменяет сторону на \"Удар, Рост, 2\"",
    "group": "Воин",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 2,
      "label": "Удар, Рост, 2"
    }
  },
  {
    "id": "art-049",
    "title": "Грань · Удар, СамоЩит, 2",
    "description": "Заменяет сторону на \"Удар, СамоЩит, 2\"",
    "group": "Воин",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 2,
      "label": "Удар, СамоЩит, 2"
    }
  },
  {
    "id": "art-050",
    "title": "Грань · Удар, Слабость, 2",
    "description": "Заменяет сторону на \"Удар, Слабость, 2\"",
    "group": "Воин",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 2,
      "label": "Удар, Слабость, 2"
    }
  },
  {
    "id": "art-053",
    "title": "Грань · Удар, Яд, Слабость, 1",
    "description": "Заменяет сторону на \"Удар, Яд, Слабость, 1\"",
    "group": "Воин",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 1,
      "label": "Удар, Яд, Слабость, 1"
    }
  },
  {
    "id": "art-056",
    "title": "Грань · Удар, 5",
    "description": "Заменяет сторону на \"Удар, 5\"",
    "group": "Воин",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 5,
      "label": "Удар, 5"
    }
  },
  {
    "id": "art-059",
    "title": "Грань · Удар, Дальность, 4",
    "description": "Заменяет сторону на \"Удар, Дальность, 4\"",
    "group": "Воин",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 4,
      "label": "Удар, Дальность, 4"
    }
  },
  {
    "id": "art-061",
    "title": "Грань · Удар, Дальность, Разброс, 2",
    "description": "Заменяет сторону на \"Удар, Дальность, Разброс, 2\"",
    "group": "Воин",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 2,
      "label": "Удар, Дальность, Разброс, 2"
    }
  },
  {
    "id": "art-064",
    "title": "Грань · Удар, СамоЩит, 3",
    "description": "Заменяет сторону на \"Удар, СамоЩит, 3\"",
    "group": "Воин",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 3,
      "label": "Удар, СамоЩит, 3"
    }
  },
  {
    "id": "art-065",
    "title": "Грань · Удар, Слабость, 3",
    "description": "Заменяет сторону на \"Удар, Слабость, 3\"",
    "group": "Воин",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 3,
      "label": "Удар, Слабость, 3"
    }
  },
  {
    "id": "art-068",
    "title": "Грань · Удар, Яд, 2",
    "description": "Заменяет сторону на \"Удар, Яд, 2\"",
    "group": "Воин",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 2,
      "label": "Удар, Яд, 2"
    }
  },
  {
    "id": "art-077",
    "title": "Грань · Удар, Разброс, 3",
    "description": "Заменяет сторону на \"Удар, Разброс, 3\"",
    "group": "Воин",
    "tier": 5,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 3,
      "label": "Удар, Разброс, 3"
    }
  },
  {
    "id": "art-078",
    "title": "Грань · Удар, СамоЛечение, СамоЩит, 3",
    "description": "Заменяет сторону на \"Удар, СамоЛечение, СамоЩит, 3\"",
    "group": "Воин",
    "tier": 5,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 3,
      "label": "Удар, СамоЛечение, СамоЩит, 3"
    }
  },
  {
    "id": "art-079",
    "title": "Грань · Удар, СамоУворот, 3",
    "description": "Заменяет сторону на \"Удар, СамоУворот, 3\"",
    "group": "Воин",
    "tier": 5,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 3,
      "label": "Удар, СамоУворот, 3"
    }
  },
  {
    "id": "art-083",
    "title": "Грань · Удар, Яд, 3",
    "description": "Заменяет сторону на \"Удар, Яд, 3\"",
    "group": "Воин",
    "tier": 5,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 3,
      "label": "Удар, Яд, 3"
    }
  },
  {
    "id": "art-088",
    "title": "Грань · Лечение, Щит, 1",
    "description": "Заменяет сторону на \"Лечение, Щит, 1\"",
    "group": "Защ",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 1,
      "label": "Лечение, Щит, 1"
    }
  },
  {
    "id": "art-092",
    "title": "Грань · Щит, 2",
    "description": "Заменяет сторону на \"Щит, 2\"",
    "group": "Защ",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 2,
      "label": "Щит, 2"
    }
  },
  {
    "id": "art-093",
    "title": "Грань · Щит, Боль, 3",
    "description": "Заменяет сторону на \"Щит, Боль, 3\"",
    "group": "Защ",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 3,
      "label": "Щит, Боль, 3"
    }
  },
  {
    "id": "art-094",
    "title": "Грань · Щит, Гниение, 3",
    "description": "Заменяет сторону на \"Щит, Гниение, 3\"",
    "group": "Защ",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 3,
      "label": "Щит, Гниение, 3"
    }
  },
  {
    "id": "art-096",
    "title": "Грань · Щит, Мана, 1",
    "description": "Заменяет сторону на \"Щит, Мана, 1\"",
    "group": "Защ",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 1,
      "label": "Щит, Мана, 1"
    }
  },
  {
    "id": "art-104",
    "title": "Грань · Щит, 3",
    "description": "Заменяет сторону на \"Щит, 3\"",
    "group": "Защ",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 3,
      "label": "Щит, 3"
    }
  },
  {
    "id": "art-105",
    "title": "Грань · Щит, Гниение, 4",
    "description": "Заменяет сторону на \"Щит, Гниение, 4\"",
    "group": "Защ",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 4,
      "label": "Щит, Гниение, 4"
    }
  },
  {
    "id": "art-106",
    "title": "Грань · Щит, Дальность, 2",
    "description": "Заменяет сторону на \"Щит, Дальность, 2\"",
    "group": "Защ",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 2,
      "label": "Щит, Дальность, 2"
    }
  },
  {
    "id": "art-109",
    "title": "Грань · Щит, Очищение, 2",
    "description": "Заменяет сторону на \"Щит, Очищение, 2\"",
    "group": "Защ",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 2,
      "label": "Щит, Очищение, 2"
    }
  },
  {
    "id": "art-110",
    "title": "Грань · Щит, Разброс, 1",
    "description": "Заменяет сторону на \"Щит, Разброс, 1\"",
    "group": "Защ",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 1,
      "label": "Щит, Разброс, 1"
    }
  },
  {
    "id": "art-111",
    "title": "Грань · Щит, Рост, 1",
    "description": "Заменяет сторону на \"Щит, Рост, 1\"",
    "group": "Защ",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 1,
      "label": "Щит, Рост, 1"
    }
  },
  {
    "id": "art-115",
    "title": "Грань · Лечение, Щит, 2",
    "description": "Заменяет сторону на \"Лечение, Щит, 2\"",
    "group": "Защ",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 2,
      "label": "Лечение, Щит, 2"
    }
  },
  {
    "id": "art-118",
    "title": "Грань · Щит, 4",
    "description": "Заменяет сторону на \"Щит, 4\"",
    "group": "Защ",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 4,
      "label": "Щит, 4"
    }
  },
  {
    "id": "art-120",
    "title": "Грань · Щит, Дальность, 3",
    "description": "Заменяет сторону на \"Щит, Дальность, 3\"",
    "group": "Защ",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 3,
      "label": "Щит, Дальность, 3"
    }
  },
  {
    "id": "art-121",
    "title": "Грань · Щит, Мана, 2",
    "description": "Заменяет сторону на \"Щит, Мана, 2\"",
    "group": "Защ",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 2,
      "label": "Щит, Мана, 2"
    }
  },
  {
    "id": "art-123",
    "title": "Грань · Щит, Очищение, 3",
    "description": "Заменяет сторону на \"Щит, Очищение, 3\"",
    "group": "Защ",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 3,
      "label": "Щит, Очищение, 3"
    }
  },
  {
    "id": "art-124",
    "title": "Грань · Щит, Разброс, 2",
    "description": "Заменяет сторону на \"Щит, Разброс, 2\"",
    "group": "Защ",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 2,
      "label": "Щит, Разброс, 2"
    }
  },
  {
    "id": "art-125",
    "title": "Грань · Щит, Рост, 2",
    "description": "Заменяет сторону на \"Щит, Рост, 2\"",
    "group": "Защ",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 2,
      "label": "Щит, Рост, 2"
    }
  },
  {
    "id": "art-134",
    "title": "Грань · Лечение, Щит, 3",
    "description": "Заменяет сторону на \"Лечение, Щит, 3\"",
    "group": "Защ",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 3,
      "label": "Лечение, Щит, 3"
    }
  },
  {
    "id": "art-139",
    "title": "Грань · Щит, Дальность, 4",
    "description": "Заменяет сторону на \"Щит, Дальность, 4\"",
    "group": "Защ",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 4,
      "label": "Щит, Дальность, 4"
    }
  },
  {
    "id": "art-140",
    "title": "Грань · Щит, Мана, 3",
    "description": "Заменяет сторону на \"Щит, Мана, 3\"",
    "group": "Защ",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 3,
      "label": "Щит, Мана, 3"
    }
  },
  {
    "id": "art-156",
    "title": "Грань · Щит, Разброс, 3",
    "description": "Заменяет сторону на \"Щит, Разброс, 3\"",
    "group": "Защ",
    "tier": 5,
    "kind": "face",
    "face": {
      "kind": "shield",
      "value": 3,
      "label": "Щит, Разброс, 3"
    }
  },
  {
    "id": "art-162",
    "title": "Грань · Лечение, 2",
    "description": "Заменяет сторону на \"Лечение, 2\"",
    "group": "Леч",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 2,
      "label": "Лечение, 2"
    }
  },
  {
    "id": "art-164",
    "title": "Грань · Лечение, Гниение, 3",
    "description": "Заменяет сторону на \"Лечение, Гниение, 3\"",
    "group": "Леч",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 3,
      "label": "Лечение, Гниение, 3"
    }
  },
  {
    "id": "art-165",
    "title": "Грань · Лечение, Мана, 1",
    "description": "Заменяет сторону на \"Лечение, Мана, 1\"",
    "group": "Леч",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 1,
      "label": "Лечение, Мана, 1"
    }
  },
  {
    "id": "art-166",
    "title": "Грань · Лечение, Очищение, 1",
    "description": "Заменяет сторону на \"Лечение, Очищение, 1\"",
    "group": "Леч",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 1,
      "label": "Лечение, Очищение, 1"
    }
  },
  {
    "id": "art-167",
    "title": "Грань · Лечение, Разброс, 1",
    "description": "Заменяет сторону на \"Лечение, Разброс, 1\"",
    "group": "Леч",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 1,
      "label": "Лечение, Разброс, 1"
    }
  },
  {
    "id": "art-170",
    "title": "Грань · Лечение, Яд, 1",
    "description": "Заменяет сторону на \"Лечение, Яд, 1\"",
    "group": "Леч",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 1,
      "label": "Лечение, Яд, 1"
    }
  },
  {
    "id": "art-172",
    "title": "Грань · Удар, СамоЛечение, 1",
    "description": "Заменяет сторону на \"Удар, СамоЛечение, 1\"",
    "group": "Леч",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 1,
      "label": "Удар, СамоЛечение, 1"
    }
  },
  {
    "id": "art-178",
    "title": "Грань · Лечение, 3",
    "description": "Заменяет сторону на \"Лечение, 3\"",
    "group": "Леч",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 3,
      "label": "Лечение, 3"
    }
  },
  {
    "id": "art-181",
    "title": "Грань · Лечение, Гниение, 4",
    "description": "Заменяет сторону на \"Лечение, Гниение, 4\"",
    "group": "Леч",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 4,
      "label": "Лечение, Гниение, 4"
    }
  },
  {
    "id": "art-182",
    "title": "Грань · Лечение, Дальность, 2",
    "description": "Заменяет сторону на \"Лечение, Дальность, 2\"",
    "group": "Леч",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 2,
      "label": "Лечение, Дальность, 2"
    }
  },
  {
    "id": "art-184",
    "title": "Грань · Лечение, Очищение, 2",
    "description": "Заменяет сторону на \"Лечение, Очищение, 2\"",
    "group": "Леч",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 2,
      "label": "Лечение, Очищение, 2"
    }
  },
  {
    "id": "art-185",
    "title": "Грань · Лечение, Рост, 1",
    "description": "Заменяет сторону на \"Лечение, Рост, 1\"",
    "group": "Леч",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 1,
      "label": "Лечение, Рост, 1"
    }
  },
  {
    "id": "art-192",
    "title": "Грань · Лечение, 4",
    "description": "Заменяет сторону на \"Лечение, 4\"",
    "group": "Леч",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 4,
      "label": "Лечение, 4"
    }
  },
  {
    "id": "art-194",
    "title": "Грань · Лечение, Дальность, 3",
    "description": "Заменяет сторону на \"Лечение, Дальность, 3\"",
    "group": "Леч",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 3,
      "label": "Лечение, Дальность, 3"
    }
  },
  {
    "id": "art-195",
    "title": "Грань · Лечение, Мана, 2",
    "description": "Заменяет сторону на \"Лечение, Мана, 2\"",
    "group": "Леч",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 2,
      "label": "Лечение, Мана, 2"
    }
  },
  {
    "id": "art-197",
    "title": "Грань · Лечение, Очищение, 3",
    "description": "Заменяет сторону на \"Лечение, Очищение, 3\"",
    "group": "Леч",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 3,
      "label": "Лечение, Очищение, 3"
    }
  },
  {
    "id": "art-198",
    "title": "Грань · Лечение, Разброс, 2",
    "description": "Заменяет сторону на \"Лечение, Разброс, 2\"",
    "group": "Леч",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 2,
      "label": "Лечение, Разброс, 2"
    }
  },
  {
    "id": "art-200",
    "title": "Грань · Лечение, Рост, 3",
    "description": "Заменяет сторону на \"Лечение, Рост, 3\"",
    "group": "Леч",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 3,
      "label": "Лечение, Рост, 3"
    }
  },
  {
    "id": "art-203",
    "title": "Грань · Удар, СамоЛечение, 2",
    "description": "Заменяет сторону на \"Удар, СамоЛечение, 2\"",
    "group": "Леч",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 2,
      "label": "Удар, СамоЛечение, 2"
    }
  },
  {
    "id": "art-212",
    "title": "Грань · Лечение, Дальность, 4",
    "description": "Заменяет сторону на \"Лечение, Дальность, 4\"",
    "group": "Леч",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 4,
      "label": "Лечение, Дальность, 4"
    }
  },
  {
    "id": "art-213",
    "title": "Грань · Лечение, Мана, 3",
    "description": "Заменяет сторону на \"Лечение, Мана, 3\"",
    "group": "Леч",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 3,
      "label": "Лечение, Мана, 3"
    }
  },
  {
    "id": "art-214",
    "title": "Грань · Лечение, Очищение, 4",
    "description": "Заменяет сторону на \"Лечение, Очищение, 4\"",
    "group": "Леч",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 4,
      "label": "Лечение, Очищение, 4"
    }
  },
  {
    "id": "art-218",
    "title": "Грань · Удар, СамоЛечение, 3",
    "description": "Заменяет сторону на \"Удар, СамоЛечение, 3\"",
    "group": "Леч",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 3,
      "label": "Удар, СамоЛечение, 3"
    }
  },
  {
    "id": "art-230",
    "title": "Грань · Лечение, Разброс, 3",
    "description": "Заменяет сторону на \"Лечение, Разброс, 3\"",
    "group": "Леч",
    "tier": 5,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 3,
      "label": "Лечение, Разброс, 3"
    }
  },
  {
    "id": "art-231",
    "title": "Грань · Лечение, Разброс, Очищение, 2",
    "description": "Заменяет сторону на \"Лечение, Разброс, Очищение, 2\"",
    "group": "Леч",
    "tier": 5,
    "kind": "face",
    "face": {
      "kind": "heal",
      "value": 2,
      "label": "Лечение, Разброс, Очищение, 2"
    }
  },
  {
    "id": "art-241",
    "title": "Грань · Мана, 2",
    "description": "Заменяет сторону на \"Мана, 2\"",
    "group": "Маг",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "mana",
      "value": 2,
      "label": "Мана, 2"
    }
  },
  {
    "id": "art-242",
    "title": "Грань · Мана, Боль, 3",
    "description": "Заменяет сторону на \"Мана, Боль, 3\"",
    "group": "Маг",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "mana",
      "value": 3,
      "label": "Мана, Боль, 3"
    }
  },
  {
    "id": "art-243",
    "title": "Грань · Мана, Гниение, 3",
    "description": "Заменяет сторону на \"Мана, Гниение, 3\"",
    "group": "Маг",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "mana",
      "value": 3,
      "label": "Мана, Гниение, 3"
    }
  },
  {
    "id": "art-248",
    "title": "Грань · Удар, Мана, 1",
    "description": "Заменяет сторону на \"Удар, Мана, 1\"",
    "group": "Маг",
    "tier": 1,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 1,
      "label": "Удар, Мана, 1"
    }
  },
  {
    "id": "art-255",
    "title": "Грань · Мана, 3",
    "description": "Заменяет сторону на \"Мана, 3\"",
    "group": "Маг",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "mana",
      "value": 3,
      "label": "Мана, 3"
    }
  },
  {
    "id": "art-256",
    "title": "Грань · Мана, Боль, 4",
    "description": "Заменяет сторону на \"Мана, Боль, 4\"",
    "group": "Маг",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "mana",
      "value": 4,
      "label": "Мана, Боль, 4"
    }
  },
  {
    "id": "art-257",
    "title": "Грань · Мана, Гниение, 4",
    "description": "Заменяет сторону на \"Мана, Гниение, 4\"",
    "group": "Маг",
    "tier": 2,
    "kind": "face",
    "face": {
      "kind": "mana",
      "value": 4,
      "label": "Мана, Гниение, 4"
    }
  },
  {
    "id": "art-271",
    "title": "Грань · Мана, 4",
    "description": "Заменяет сторону на \"Мана, 4\"",
    "group": "Маг",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "mana",
      "value": 4,
      "label": "Мана, 4"
    }
  },
  {
    "id": "art-273",
    "title": "Грань · Мана, Рост, 1",
    "description": "Заменяет сторону на \"Мана, Рост, 1\"",
    "group": "Маг",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "mana",
      "value": 1,
      "label": "Мана, Рост, 1"
    }
  },
  {
    "id": "art-276",
    "title": "Грань · Удар, Мана, 2",
    "description": "Заменяет сторону на \"Удар, Мана, 2\"",
    "group": "Маг",
    "tier": 3,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 2,
      "label": "Удар, Мана, 2"
    }
  },
  {
    "id": "art-288",
    "title": "Грань · Мана, Рост, 3",
    "description": "Заменяет сторону на \"Мана, Рост, 3\"",
    "group": "Маг",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "mana",
      "value": 3,
      "label": "Мана, Рост, 3"
    }
  },
  {
    "id": "art-292",
    "title": "Грань · Удар, Мана, 3",
    "description": "Заменяет сторону на \"Удар, Мана, 3\"",
    "group": "Маг",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 3,
      "label": "Удар, Мана, 3"
    }
  },
  {
    "id": "art-309",
    "title": "Реликвия · Здоровье",
    "description": "Даёт вам 2 полных единиц здоровья",
    "group": "Унив",
    "tier": 1,
    "kind": "hp",
    "amount": 2
  },
  {
    "id": "art-311",
    "title": "Реликвия · Запас HP",
    "description": "Даёт вам 6 пустых единиц здоровья",
    "group": "Унив",
    "tier": 1,
    "kind": "maxhp",
    "amount": 6
  },
  {
    "id": "art-317",
    "title": "Реликвия · Целебный эликсир",
    "description": "Можете восстановить себе 5 единиц здоровья в свой ход. Затем сбросьте этот артефакт",
    "group": "Унив",
    "tier": 1,
    "kind": "consumable",
    "amount": 5
  },
  {
    "id": "art-330",
    "title": "Реликвия · Здоровье",
    "description": "Даёт вам 4 полных единиц здоровья",
    "group": "Унив",
    "tier": 3,
    "kind": "hp",
    "amount": 4
  },
  {
    "id": "art-340",
    "title": "Реликвия · Здоровье",
    "description": "Даёт вам 6 полных единиц здоровья",
    "group": "Унив",
    "tier": 4,
    "kind": "hp",
    "amount": 6
  },
  {
    "id": "art-344",
    "title": "Грань · Удар, СамоЛечение, СамоЩит, Мана, 2",
    "description": "Заменяет сторону на \"Удар, СамоЛечение, СамоЩит, Мана, 2\"",
    "group": "Унив",
    "tier": 4,
    "kind": "face",
    "face": {
      "kind": "strike",
      "value": 2,
      "label": "Удар, СамоЛечение, СамоЩит, Мана, 2"
    }
  },
  {
    "id": "art-352",
    "title": "Реликвия · Усиление кубика",
    "description": "Добавляет всем сторонам +1 к значению стороны",
    "group": "Унив",
    "tier": 5,
    "kind": "buffall",
    "amount": 1
  },
  {
    "id": "art-357",
    "title": "Реликвия · Удвоение грани",
    "description": "Умножает значение стороны х2",
    "group": "Унив",
    "tier": 5,
    "kind": "doubleface",
    "amount": 2
  }
] as ArtifactCard[];
