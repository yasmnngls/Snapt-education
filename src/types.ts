export type Point = { x: number; y: number };

export type StrokeAnnotation = {
  id: string;
  type: 'stroke';
  tool: 'pen' | 'highlight';
  points: Point[];
  color: string;
  width: number;
};

export type ShapeKind = 'underline' | 'circle' | 'arrow';

export type ShapeAnnotation = {
  id: string;
  type: 'shape';
  kind: ShapeKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
};

export type NoteOrigin = 'suggested' | 'student';

export type Rect = { x: number; y: number; w: number; h: number };

export type TextAnnotation = {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  boxWidth?: number;
  origin?: NoteOrigin;
  styleId?: string;
  sourceBlockId?: string;
  anchor?: Rect;
  mark?: Rect;
};

export type DetectedBlock = {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
};

export type SlideReading = {
  blocks: DetectedBlock[];
  dismissedBlockIds: string[];
  readAt: number;
};

export type HandProfile = {
  id: 'local';
  styleId: string;
  inkColor: string;
  inkFromSample: boolean;
  sampleBlob?: Blob;
  updatedAt: number;
};

export type Annotation = StrokeAnnotation | ShapeAnnotation | TextAnnotation;

export type ClassRecord = {
  id: string;
  name: string;
  createdAt: number;
};

export type LectureRecord = {
  id: string;
  classId: string;
  title: string;
  createdAt: number;
};

export type SlideRecord = {
  id: string;
  lectureId: string;
  order: number;
  imageBlob: Blob;
  width: number;
  height: number;
  annotations: Annotation[];
  reading?: SlideReading;
  createdAt: number;
  updatedAt: number;
};

export type Rotation = 0 | 90 | 180 | 270;

export type NormCrop = {
  x: number;
  y: number;
  w: number;
  h: number;
};
