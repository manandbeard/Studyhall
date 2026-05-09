/** Shared domain types for Firestore document shapes used across the tracker UI. */

export type PassStatus =
  | "pending"
  | "in_transit"
  | "arrived"
  | "completed"
  | "cancelled";

export interface Pass {
  id: string;
  studentId: string;
  studentName: string;
  originTeacherId: string;
  originRoom: string;
  destinationTeacherId: string;
  destinationRoom: string;
  status: PassStatus;
  requestedAt: string;
  departedAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelledReason?: string;
  archivedBy?: string;
}

export interface Student {
  id: string;
  name: string;
  thirdPeriodTeacherId: string;
  notes?: string;
  isAbsent: boolean;
}

export interface Teacher {
  id: string;
  uid?: string;
  name: string;
  email: string;
  role: "teacher" | "admin";
  roomNumber?: string;
  phoneNumber?: string;
  isAway?: boolean;
  studyHallCapacity?: number;
  soundMuted?: boolean;
  isPlaceholder?: boolean;
}

export type AppRole = "teacher" | "admin";
