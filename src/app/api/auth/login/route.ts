import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getUserRole } from "@/lib/roles";

/**
 * Login same-origin para evitar que redes corporativas bloqueen la llamada
 * directa del navegador a api.tustorecr.com. Supabase sigue siendo el
 * proveedor de identidad; esta ruta solo proxifica la autenticación y fija
 * las cookies SSR en el dominio de la tienda.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) {
      return NextResponse.json(
        { error: "Correo y contraseña son obligatorios." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const pendingCookies: Array<{
      name: string;
      value: string;
      options?: Parameters<typeof cookieStore.set>[2];
    }> = [];
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(toSet) {
            toSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              pendingCookies.push({ name, value, options });
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      return NextResponse.json(
        {
          error:
            error?.message === "Invalid login credentials"
              ? "Correo o contraseña incorrectos."
              : error?.message ?? "No se pudo iniciar sesión.",
        },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      role: getUserRole(data.user),
    });
    pendingCookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)
    );
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar sesión." },
      { status: 500 }
    );
  }
}
