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
        ? (() => {
            try {
              const keyData = JSON.parse(
                process.env.GCP_SERVICE_ACCOUNT_KEY || "{}"
              );
              // 修正私鑰中的換行符號
              if (keyData.private_key) {
                keyData.private_key = keyData.private_key.replace(/\\n/g, "\n");
              }
              return keyData;
            } catch (error) {
              console.error("Failed to parse GCP_SERVICE_ACCOUNT_KEY:", error);
              return {};
            }
          })()
        : null,
    bucketName: process.env.GCP_BUCKET_NAME,
    storageBaseUrl: process.env.GCP_STORAGE_BASE_URL,
  },
};
