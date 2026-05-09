/**
 * Maximum number of writes per Firestore batch.
 * The Firestore hard limit is 500; we use 450 to leave headroom.
 */
export const FIRESTORE_BATCH_LIMIT = 450;
