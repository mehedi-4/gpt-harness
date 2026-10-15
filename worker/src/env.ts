export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
}

export interface User {
  id: string;
  email: string;
}
