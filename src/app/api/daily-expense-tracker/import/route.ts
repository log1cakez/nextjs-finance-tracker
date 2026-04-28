import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { importDailyExpenseTrackerXlsx } from "@/lib/daily-expense-tracker-xlsx";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose an .xlsx file to import." }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx")) {
    return Response.json({ error: "Only .xlsx files are supported." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await importDailyExpenseTrackerXlsx(userId, buffer);
  if (result.errors.length > 0) {
    return Response.json(
      {
        error: "Import validation failed.",
        details: result.errors.slice(0, 20),
        totalErrors: result.errors.length,
      },
      { status: 400 },
    );
  }

  revalidatePath("/financetracker", "layout");
  revalidatePath("/financetracker/transactions");
  revalidatePath("/financetracker/accounts");

  return Response.json(result);
}
