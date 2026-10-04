import Dexie, { type EntityTable } from 'dexie';
import type { ClassRecord, HandProfile, LectureRecord, SlideRecord } from './types';

export const db = new Dexie('snapt') as Dexie & {
  classes: EntityTable<ClassRecord, 'id'>;
  lectures: EntityTable<LectureRecord, 'id'>;
  slides: EntityTable<SlideRecord, 'id'>;
  profile: EntityTable<HandProfile, 'id'>;
};

db.version(1).stores({
  classes: 'id, createdAt',
  lectures: 'id, classId, createdAt',
  slides: 'id, lectureId, order, updatedAt',
});

db.version(2).stores({
  classes: 'id, createdAt',
  lectures: 'id, classId, createdAt',
  slides: 'id, lectureId, order, updatedAt',
  profile: 'id',
});

export async function deleteClass(classId: string) {
  const lectures = await db.lectures.where('classId').equals(classId).toArray();
  const lectureIds = lectures.map((lecture) => lecture.id);
  await db.transaction('rw', [db.classes, db.lectures, db.slides], async () => {
    if (lectureIds.length > 0) {
      await db.slides.where('lectureId').anyOf(lectureIds).delete();
    }
    await db.lectures.where('classId').equals(classId).delete();
    await db.classes.delete(classId);
  });
}

export async function deleteLecture(lectureId: string) {
  await db.transaction('rw', [db.lectures, db.slides], async () => {
    await db.slides.where('lectureId').equals(lectureId).delete();
    await db.lectures.delete(lectureId);
  });
}

export async function nextSlideOrder(lectureId: string) {
  const slides = await db.slides.where('lectureId').equals(lectureId).toArray();
  return slides.reduce((max, slide) => Math.max(max, slide.order), 0) + 1;
}
