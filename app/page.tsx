import { cookies } from "next/headers";
import { verifySignedValue } from "../lib/auth";
import DashboardClient from "./components/DashboardClient";

export default async function Home() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("auth")?.value ?? "";
  const initialRole = verifySignedValue(raw);
  return <DashboardClient initialRole={initialRole} />;
}
