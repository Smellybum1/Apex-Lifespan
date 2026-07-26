import { NextResponse } from "next/server";

import { getEvidenceDashboardData } from "@/lib/data/dashboard";

export async function GET() {
  try {
    const data = await getEvidenceDashboardData();

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Evidence dashboard detail data could not be loaded." },
      { status: 503 }
    );
  }
}
