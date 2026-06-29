export const LOCAL_INGESTION_WRITE_HEADER = "X-Apex-Local-Ingestion-Request";
export const LOCAL_INGESTION_WRITE_HEADER_VALUE = "dashboard";

export function isLocalIngestionWriteMethod(method?: string) {
  const normalizedMethod = (method ?? "GET").trim().toUpperCase();

  return !["GET", "HEAD", "OPTIONS"].includes(normalizedMethod);
}
