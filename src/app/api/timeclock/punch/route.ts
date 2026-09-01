import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase";
import { getUserBranchIds, getUserFullName } from "@/lib/roles";
import { isPunchType } from "@/lib/timeclock";
import {
  getLocation,
  REMOTE_LOCATION,
  distanceMeters,
  BRANCH_RADIUS_M,
  type Branch,
} from "@/lib/branches";

export async function POST(req: Request) {
  try {
    // 1. Validar sesión: solo un usuario autenticado puede marcar por sí mismo.
    const sb = await createSupabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      return new NextResponse("No autenticado", { status: 401 });
    }

    const body = (await req.json()) as {
      punchType?: string;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
    };

    if (!isPunchType(body.punchType)) {
      return new NextResponse("Tipo de marcaje inválido", { status: 400 });
    }

    // Ubicación obligatoria: no se permiten marcas sin GPS.
    if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
      return new NextResponse(
        "Necesitamos tu ubicación para marcar. Activá el GPS e intentá de nuevo.",
        { status: 400 }
      );
    }

    // 2. Ubicaciones asignadas al colaborador (puede tener varias + remoto).
    const locations = getUserBranchIds(user)
      .map(getLocation)
      .filter((l): l is Branch => !!l);
    const hasRemote = locations.some((l) => l.remote);
    const physical = locations.filter((l) => !l.remote);

    const lat = typeof body.latitude === "number" ? body.latitude : null;
    const lng = typeof body.longitude === "number" ? body.longitude : null;

    // 3. Determinar la sede del marcaje y si quedó "en sede".
    let matched: Branch | null = null;
    let distance: number | null = null;
    let withinRange: boolean | null = null;

    if (lat !== null && lng !== null) {
      // Sede física más cercana de las suyas.
      let best = Infinity;
      for (const l of physical) {
        const d = distanceMeters(lat, lng, l.lat, l.lng);
        if (d < best) {
          best = d;
          matched = l;
        }
      }
      if (matched && best <= BRANCH_RADIUS_M) {
        distance = best;
        withinRange = true; // está en una de sus sedes
      } else if (hasRemote) {
        matched = REMOTE_LOCATION; // trabaja remoto → verde "Casa"
        distance = null;
        withinRange = true;
      } else {
        distance = matched ? best : null; // fuera de rango (sede más cercana)
        withinRange = false;
      }
    } else if (hasRemote) {
      matched = REMOTE_LOCATION;
      withinRange = true;
    } else {
      matched = physical[0] ?? null; // sin ubicación
      withinRange = null;
    }

    // 4. Insertar (RLS sin políticas → service role).
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("time_entries")
      .insert({
        user_id: user.id,
        employee_name: getUserFullName(user),
        branch_id: matched?.id ?? null,
        branch_name: matched?.name ?? null,
        punch_type: body.punchType,
        latitude: lat,
        longitude: lng,
        accuracy_m: typeof body.accuracy === "number" ? body.accuracy : null,
        distance_m: distance,
        within_range: withinRange,
      })
      .select("*")
      .single();

    if (error) return new NextResponse(error.message, { status: 500 });
    return NextResponse.json({ ok: true, entry: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
