export const go = (hash: string) => {
  window.location.hash = hash;
};

export async function isValidMediaURL(url: string) {
  try {
    const res = await fetch(url, { method: "HEAD" });

    if (!res.ok) return false;

    const type = res.headers.get("content-type") || "";
    return type.startsWith("image/") || type.startsWith("video/");
  } catch {
    return false;
  }
}