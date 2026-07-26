/**
 * Upload image and return public URL
 */
export async function uploadImage(file: File): Promise<string> {
  const presignRes = await fetch("/api/v1/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
    }),
  });
  const presignData = await presignRes.json();
  if (!presignData.success) {
    throw new Error(presignData.error?.message || "Failed to prepare image upload");
  }

  const directUpload = await fetch(presignData.data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!directUpload.ok) throw new Error("Failed to upload image to storage");

  const completeRes = await fetch("/api/v1/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: presignData.data.key,
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
    }),
  });
  const completeData = await completeRes.json();
  if (!completeData.success) {
    throw new Error(completeData.error?.message || "Failed to register image upload");
  }
  return completeData.data.publicUrl as string;
}
