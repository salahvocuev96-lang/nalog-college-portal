// Меню кабинетов. Новый раздел = одна строка здесь + одна страница в app/(cabinet).
import type { IconName } from "@/components/icons";
import type { Role } from "./types";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  short: string; // подпись в нижнем меню телефона
}

const I = (href: string, label: string, icon: IconName, short = label): NavItem => ({ href, label, icon, short });

export const NAV: Record<Role, NavItem[]> = {
  student: [
    I("/home/", "Главная", "home"),
    I("/diary/", "Электронный дневник", "book", "Дневник"),
    I("/grades/", "Оценки", "star"),
    I("/schedule/", "Расписание", "calendar", "Пары"),
    I("/attendance/", "Посещаемость", "check", "Пропуски"),
    I("/homework/", "Домашние задания", "task", "Задания"),
    I("/calendar/", "Календарь", "clock"),
    I("/messages/", "Сообщения", "chat"),
    I("/notifications/", "Уведомления", "bell"),
    I("/profile/", "Профиль", "user"),
  ],
  teacher: [
    I("/home/", "Главная", "home"),
    I("/journal/", "Электронный журнал", "journal", "Журнал"),
    I("/schedule/", "Расписание", "calendar", "Пары"),
    I("/groups/", "Мои группы", "users", "Группы"),
    I("/subjects/", "Мои предметы", "layers", "Предметы"),
    I("/attendance/", "Посещаемость", "check", "Пропуски"),
    I("/homework/", "Домашние задания", "task", "Задания"),
    I("/messages/", "Сообщения", "chat"),
    I("/notifications/", "Уведомления", "bell"),
    I("/profile/", "Профиль", "user"),
  ],
  parent: [
    I("/home/", "Главная", "home"),
    I("/grades/", "Оценки ребёнка", "star", "Оценки"),
    I("/schedule/", "Расписание", "calendar", "Пары"),
    I("/homework/", "Домашние задания", "task", "Задания"),
    I("/diary/", "Дневник", "book"),
    I("/attendance/", "Посещаемость", "check", "Пропуски"),
    I("/messages/", "Сообщения", "chat"),
    I("/notifications/", "Уведомления", "bell"),
    I("/profile/", "Профиль", "user"),
  ],
  college_admin: [
    I("/home/", "Обзор", "chart"),
    I("/groups/", "Группы", "layers"),
    I("/students/", "Студенты", "users"),
    I("/schedule/", "Расписание", "calendar", "Пары"),
    I("/teachers/", "Преподаватели", "user"),
    I("/parents/", "Родители", "users"),
    I("/subjects/", "Предметы", "book"),
    I("/loads/", "Назначения", "link"),
    I("/accounts/", "Аккаунты", "key"),
    I("/announcements/", "Объявления", "megaphone"),
    I("/audit/", "Журнал аудита", "history", "Аудит"),
    I("/settings/", "Учебные периоды", "settings", "Периоды"),
    I("/messages/", "Сообщения", "chat"),
    I("/profile/", "Профиль", "user"),
  ],
  tech_admin: [
    I("/home/", "Состояние системы", "server", "Система"),
    I("/audit/", "Журнал событий", "history", "События"),
    I("/messages/", "Сообщения", "chat"),
    I("/notifications/", "Уведомления", "bell"),
    I("/profile/", "Профиль", "user"),
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  student: "Студент",
  teacher: "Преподаватель",
  parent: "Родитель",
  college_admin: "Учебная часть",
  tech_admin: "Технический администратор",
};
