import { uid } from '../utils/math.js';

const DEMO_PLAYERS = [
  { id: 'p1', firstName: 'Олександр', lastName: 'Коваль', number: 1, position: 'GK', status: 'available' },
  { id: 'p2', firstName: 'Ігор', lastName: 'Бондар', number: 12, position: 'GK', status: 'available' },
  { id: 'p3', firstName: 'Андрій', lastName: 'Мельник', number: 2, position: 'CB', status: 'available' },
  { id: 'p4', firstName: 'Сергій', lastName: 'Шевченко', number: 3, position: 'CB', status: 'available' },
  { id: 'p5', firstName: 'Максим', lastName: 'Ткаченко', number: 4, position: 'LB', status: 'available' },
  { id: 'p6', firstName: 'Дмитро', lastName: 'Кравченко', number: 5, position: 'RB', status: 'injured' },
  { id: 'p7', firstName: 'Віктор', lastName: 'Лисенко', number: 6, position: 'DM', status: 'available' },
  { id: 'p8', firstName: 'Роман', lastName: 'Петренко', number: 8, position: 'CM', status: 'available' },
  { id: 'p9', firstName: 'Юрій', lastName: 'Гончаренко', number: 10, position: 'AM', status: 'available' },
  { id: 'p10', firstName: 'Тарас', lastName: 'Савченко', number: 7, position: 'LW', status: 'available' },
  { id: 'p11', firstName: 'Богдан', lastName: 'Морозенко', number: 9, position: 'ST', status: 'available' },
  { id: 'p12', firstName: 'Олег', lastName: 'Василенко', number: 11, position: 'RW', status: 'available' },
];

export function createDefaultState() {
  return {
    schemaVersion: 3,
    settings: {
      clubName: 'МЕТАЛІСТ ШТУТГАРТ',
      clubShort: 'МШ',
      primary: '#1a3a5c',
      accent: '#c8a84b',
    },
    players: DEMO_PLAYERS.map((p) => ({ ...p })),
    trainings: [],
    exercises: [],
    scenes: [],
    board: { objects: [], camera: { x: 0, y: 0, zoom: 1 } },
  };
}

let state = createDefaultState();
const listeners = new Set();

export const store = {
  get: () => state,
  set(next) {
    state = next;
    listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.error(e);
      }
    });
  },
  update(fn) {
    fn(state);
    listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.error(e);
      }
    });
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  replace(data) {
    state = { ...createDefaultState(), ...data };
    listeners.forEach((fn) => fn(state));
  },
};
