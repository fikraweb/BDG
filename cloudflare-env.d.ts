declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    CATALOGUE_IMAGES?: R2Bucket;
  }
}
