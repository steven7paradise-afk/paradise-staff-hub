import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  return context.params.then(({ reference }) => {
    const target = new URL("/orders", request.url);
    target.searchParams.set("ordine", reference);
    return NextResponse.redirect(target);
  });
}
