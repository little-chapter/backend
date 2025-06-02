module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresDay: process.env.JWT_EXPIRES_DAY,
  gcp: {
    projectId: process.env.GCP_PROJECT_ID,
    serviceAccountKeyPath:
      process.env.NODE_ENV === "production"
        ? null
        : process.env.GCP_SERVICE_ACCOUNT_KEY_PATH,
    serviceAccountKey:
      process.env.NODE_ENV === "production"
        ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY || "{}")
        : null,
    bucketName: process.env.GCP_BUCKET_NAME,
    storageBaseUrl: process.env.GCP_STORAGE_BASE_URL,
  },
};
