#!/usr/bin/env node
// Обновляет src/data/groups.json из проекта расписания колледжа.
// Исходный репозиторий только читается: в нём ничего не меняется.
//
//   node scripts/sync-schedule.mjs ../2p1/all-groups.json
//
// После обновления данные попадут в новую базу (при первом запуске или после сброса демо-данных).
// Для рабочей базы расписание меняется через раздел «Расписание» учебной части.
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2];
if (!src) {
  console.error("Укажите путь к all-groups.json из проекта расписания");
  process.exit(1);
}
const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const data = JSON.parse(readFileSync(src, "utf8"));
const problems = [];
for (const [id, g] of Object.entries(data)) {
  if (typeof g.groupName !== "string") problems.push(`${id}: нет groupName`);
  for (const [day, lessons] of Object.entries(g.schedule ?? {})) {
    if (!DAYS.includes(day)) problems.push(`${id}: неизвестный день «${day}»`);
    for (const l of lessons) if (!(l.slot >= 1 && l.slot <= 6)) problems.push(`${id} ${day}: неверный номер пары ${l.slot}`);
  }
}
if (problems.length) {
  console.error("Файл не прошёл проверку:\n" + problems.slice(0, 20).join("\n"));
  process.exit(1);
}
// Копируем файл как есть, чтобы сохранить исходное форматирование
writeFileSync(new URL("../src/data/groups.json", import.meta.url), readFileSync(src));
console.log(`Готово: ${Object.keys(data).length} групп`);
