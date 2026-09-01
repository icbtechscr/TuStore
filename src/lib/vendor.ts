import { createAdminClient } from "./supabase";

export type VendorConnection = {
  userId: string;
  pageId: string;
  pageName: string;
  accessToken: string;
  fbUserName: string | null;
  connectedAt: string;
};

export async function getConnection(userId: string): Promise<VendorConnection | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("vendor_fb_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    userId: data.user_id,
    pageId: data.page_id,
    pageName: data.page_name,
    accessToken: data.access_token,
    fbUserName: data.fb_user_name ?? null,
    connectedAt: data.connected_at,
  };
}

export async function saveConnection(input: {
  userId: string;
  pageId: string;
  pageName: string;
  accessToken: string;
  fbUserName?: string | null;
}): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb.from("vendor_fb_connections").upsert(
    {
      user_id: input.userId,
      page_id: input.pageId,
      page_name: input.pageName,
      access_token: input.accessToken,
      fb_user_name: input.fbUserName ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

export async function deleteConnection(userId: string): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb
    .from("vendor_fb_connections")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

export type VendorPost = {
  id: string;
  productName: string | null;
  permalink: string | null;
  title: string | null;
  imageUrl: string | null;
  status: string;
  error: string | null;
  createdAt: string;
};

export async function recordPost(input: {
  userId: string;
  productId?: string | null;
  productName?: string | null;
  pageId?: string | null;
  fbPostId?: string | null;
  permalink?: string | null;
  title?: string | null;
  message?: string | null;
  imageUrl?: string | null;
  status?: string;
  error?: string | null;
}): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb.from("vendor_posts").insert({
    user_id: input.userId,
    product_id: input.productId ?? null,
    product_name: input.productName ?? null,
    page_id: input.pageId ?? null,
    fb_post_id: input.fbPostId ?? null,
    permalink: input.permalink ?? null,
    title: input.title ?? null,
    message: input.message ?? null,
    image_url: input.imageUrl ?? null,
    status: input.status ?? "published",
    error: input.error ?? null,
  });
  if (error) throw error;
}

export async function listPosts(userId: string, limit = 20): Promise<VendorPost[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("vendor_posts")
    .select("id, product_name, permalink, title, image_url, status, error, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    productName: r.product_name ?? null,
    permalink: r.permalink ?? null,
    title: r.title ?? null,
    imageUrl: r.image_url ?? null,
    status: r.status,
    error: r.error ?? null,
    createdAt: r.created_at,
  }));
}
