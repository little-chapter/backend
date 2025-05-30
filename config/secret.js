module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresDay: process.env.JWT_EXPIRES_DAY,
  gcp: {
    projectId: process.env.GCP_PROJECT_ID ,
    serviceAccountKeyPath: process.env.GCP_SERVICE_ACCOUNT_KEY_PATH,
    bucketName: process.env.GCP_BUCKET_NAME ,
    storageBaseUrl: process.env.GCP_STORAGE_BASE_URL
  }
};
